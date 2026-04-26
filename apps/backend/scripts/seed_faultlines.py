"""
Seed Philippine fault lines from local GeoJSON into the database.

Source : geo_hazard/faultline/faultline.geojson
         (PHIVOLCS/GEM Global Earthquake Model — not from Project NOAH)

Spatial-joins fault lines to province boundaries, generates one PMTile
per province, and stores each feature as a separate HazardArea row.

Usage:
  python scripts/seed_faultlines.py              # seed + generate PMTiles
  python scripts/seed_faultlines.py --skip-pmtiles
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

import sqlalchemy as sa
from geoalchemy2.shape import from_shape

from core.db import SessionLocal
from core.minio_client import minio_client, BUCKET_NAME
import models  # noqa: F401
from models.province import Province
from models.hazard_area import HazardArea

BACKEND_DIR       = Path(__file__).resolve().parent.parent
FAULTLINE_GEOJSON = BACKEND_DIR / "geo_hazard" / "faultline" / "faultline.geojson"


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

@dataclass
class ProvinceInfo:
    id:   str
    name: str
    code: Optional[str]


def _build_provinces_gdf(db) -> tuple:
    import geopandas as gpd
    from geoalchemy2.shape import to_shape

    ids, geoms, infos = [], [], {}
    for p in db.query(Province).all():
        if p.boundary is None:
            continue
        try:
            info = ProvinceInfo(id=str(p.id), name=str(p.name), code=str(p.code) if p.code else None)
            ids.append(str(p.id))
            geoms.append(to_shape(p.boundary))
            infos[str(p.id)] = info
        except Exception:
            pass

    gdf = gpd.GeoDataFrame({"province_id_ref": ids}, geometry=geoms, crs="EPSG:4326")
    return gdf.reset_index(drop=True), infos


def _geom_to_wkb(geom):
    if geom is None or geom.is_empty:
        return None
    try:
        import shapely
        return from_shape(shapely.force_2d(geom), srid=4326)
    except Exception:
        return None


def _check_tippecanoe() -> bool:
    try:
        return subprocess.run(["tippecanoe", "--version"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


def _generate_pmtiles(geojson_path: Path, minio_key: str) -> Optional[str]:
    with tempfile.NamedTemporaryFile(suffix=".pmtiles", delete=False) as f:
        pm_path = f.name
    try:
        result = subprocess.run(
            [
                "tippecanoe",
                "-o", pm_path,
                "-Z10", "-z14",
                "--drop-densest-as-needed",
                "--extend-zooms-if-still-dropping",
                "--force",
                str(geojson_path),
            ],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"      tippecanoe error: {result.stderr[:300]}", flush=True)
            return None
        minio_client.fput_object(
            BUCKET_NAME, minio_key, pm_path,
            content_type="application/vnd.pmtiles",
        )
        return minio_key
    finally:
        if os.path.exists(pm_path):
            os.unlink(pm_path)


def _replace_features(
    province_id: str,
    pmtile_url:  Optional[str],
    wkbs:        list,
) -> int:
    if not wkbs:
        return 0
    with SessionLocal() as db:
        db.execute(
            sa.delete(HazardArea).where(
                sa.and_(
                    HazardArea.province_id == province_id,
                    HazardArea.hazard_type == "faultline",
                    HazardArea.scenario.is_(None),
                )
            )
        )
        db.execute(
            sa.insert(HazardArea),
            [
                {
                    "id":          str(uuid4()),
                    "province_id": province_id,
                    "hazard_type": "faultline",
                    "scenario":    None,
                    "pmtile_url":  pmtile_url,
                    "geometry":    wkb,
                }
                for wkb in wkbs
            ],
        )
        db.commit()
    return len(wkbs)


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

def seed_faultlines(skip_pmtiles: bool) -> None:
    import geopandas as gpd

    if not FAULTLINE_GEOJSON.exists():
        print(f"ERROR: {FAULTLINE_GEOJSON} not found")
        sys.exit(1)

    print(f"  Reading {FAULTLINE_GEOJSON.relative_to(BACKEND_DIR)}…", flush=True)
    gdf = gpd.read_file(str(FAULTLINE_GEOJSON))
    gdf = gdf[gdf["catalog_name"] == "philippines"].copy().reset_index(drop=True)
    print(f"  {len(gdf)} Philippines faultline features")

    if gdf.empty:
        print("  Nothing to seed.")
        return

    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    print("  Building province geometry index…", flush=True)
    with SessionLocal() as db:
        provinces_gdf, province_infos = _build_provinces_gdf(db)
    print(f"  {len(provinces_gdf)} provinces with geometry")

    joined = gpd.sjoin(
        gdf[["geometry"]],
        provinces_gdf[["province_id_ref", "geometry"]],
        how="inner", predicate="intersects",
    )
    if joined.empty:
        print("  No faultlines intersect any province boundary.")
        return

    joined = joined[["province_id_ref", "geometry"]].copy()
    total_rows = 0

    for prov_id_str, group in joined.groupby("province_id_ref"):
        province = province_infos.get(str(prov_id_str))
        if not province or not province.code:
            continue

        pmtile_url = None
        if not skip_pmtiles:
            minio_key = f"pmtiles/hazards/faultline/all/province-{province.code}.pmtiles"
            with tempfile.TemporaryDirectory() as tmp:
                slice_path = Path(tmp) / "faultline.geojson"
                group[["geometry"]].to_file(str(slice_path), driver="GeoJSON")
                pmtile_url = _generate_pmtiles(slice_path, minio_key)

        wkbs = [w for g in group.geometry if (w := _geom_to_wkb(g)) is not None]
        count = _replace_features(str(province.id), pmtile_url, wkbs)
        total_rows += count
        print(f"  [{province.name}] {count} rows", flush=True)

    print(f"\n  → {total_rows} faultline rows inserted")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed faultline data from local GeoJSON")
    parser.add_argument("--skip-pmtiles", action="store_true")
    args = parser.parse_args()

    if not args.skip_pmtiles and not _check_tippecanoe():
        print(
            "ERROR: tippecanoe not found.\n"
            "  Use --skip-pmtiles to seed geometry without generating tiles.\n"
            "  Install tippecanoe on Linux/Mac/WSL: https://github.com/felt/tippecanoe"
        )
        sys.exit(1)

    print("\n" + "=" * 55)
    print("  FAULTLINES")
    print("=" * 55)
    seed_faultlines(skip_pmtiles=args.skip_pmtiles)
    print("\nDone.")