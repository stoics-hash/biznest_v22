"""
Seed Philippine administrative boundaries from local GeoJSON files.

Directory layout (relative to backend root):
  boundaries/mun/      provdists-region-{adm1_psgc}.0.1.json   (17 files)  geo_level=Prov
  boundaries/province/ municities-provdist-{adm2_psgc}.0.1.json (88 files)  geo_level=Mun
  boundaries/barangay/ bgysubmuns-municity-{adm3_psgc}.0.1.json (1642 files) geo_level=Bgy

mun/ files:      each file = one region's provinces    → seed Region (null boundary/pmtile) + Province records
province/ files: each file = one province's municities → seed City records (null pmtile)
barangay/ files: each file = one municipality's brgys  → seed Barangay records + update City pmtile

PMTile paths in MinIO:
  pmtiles/provinces/province-{adm2_psgc}.pmtiles
  pmtiles/cities/city-{adm3_psgc}.pmtiles

Usage:
  python scripts/seed_local_boundaries.py                           # all levels
  python scripts/seed_local_boundaries.py --levels province city    # specific levels
  python scripts/seed_local_boundaries.py --skip-pmtiles            # DB only
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from geoalchemy2.shape import from_shape
from shapely.geometry import shape, mapping, MultiPolygon
from sqlalchemy.orm import Session

from core.db import SessionLocal
from core.minio_client import minio_client, BUCKET_NAME
import models  # noqa: F401
from models.region import Region
from models.province import Province
from models.city import City
from models.barangay import Barangay

REGION_NAMES: dict[str, str] = {
    "100000000":  "Region I – Ilocos Region",
    "200000000":  "Region II – Cagayan Valley",
    "300000000":  "Region III – Central Luzon",
    "400000000":  "Region IV-A – CALABARZON",
    "500000000":  "Region V – Bicol Region",
    "600000000":  "Region VI – Western Visayas",
    "700000000":  "Region VII – Central Visayas",
    "800000000":  "Region VIII – Eastern Visayas",
    "900000000":  "Region IX – Zamboanga Peninsula",
    "1000000000": "Region X – Northern Mindanao",
    "1100000000": "Region XI – Davao Region",
    "1200000000": "Region XII – SOCCSKSARGEN",
    "1300000000": "NCR – National Capital Region",
    "1400000000": "CAR – Cordillera Administrative Region",
    "1600000000": "Region XIII – Caraga",
    "1700000000": "MIMAROPA Region",
    "1900000000": "BARMM – Bangsamoro Autonomous Region",
}

BACKEND_ROOT = Path(__file__).resolve().parent.parent
BOUNDARIES_ROOT = BACKEND_ROOT / "boundaries"

REGION_DIR = BOUNDARIES_ROOT / "mun"       # provdists-region-*.json  (Prov features)
PROVINCE_DIR = BOUNDARIES_ROOT / "province"  # municities-provdist-*.json (Mun features)
BARANGAY_DIR = BOUNDARIES_ROOT / "barangay"  # bgysubmuns-municity-*.json (Bgy features)


# ---------------------------------------------------------------------------
# tippecanoe
# ---------------------------------------------------------------------------

def check_tippecanoe() -> bool:
    try:
        return subprocess.run(["tippecanoe", "--version"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


def generate_pmtiles(geojson_path: str, out_path: str, min_zoom: int, max_zoom: int) -> bool:
    cmd = [
        "tippecanoe",
        "-o", out_path,
        f"-z{max_zoom}",
        f"-Z{min_zoom}",
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--force",
        geojson_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"    tippecanoe error:\n{result.stderr}")
        return False
    return True


# ---------------------------------------------------------------------------
# MinIO
# ---------------------------------------------------------------------------

def upload_pmtiles(local_path: str, minio_key: str) -> str:
    minio_client.fput_object(
        BUCKET_NAME,
        minio_key,
        local_path,
        content_type="application/vnd.pmtiles",
    )
    return minio_key


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def force_multipolygon(geom):
    if geom is None:
        return None
    if geom.geom_type == "Polygon":
        return MultiPolygon([geom])
    return geom


def to_wkb(geom):
    if geom is None:
        return None
    try:
        return from_shape(force_multipolygon(geom), srid=4326)
    except Exception as exc:
        print(f"    geometry error: {exc}")
        return None


def load_features(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("features", [])


def make_feature_collection(features: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------------------
# PMTile generation + upload
# ---------------------------------------------------------------------------

def make_pmtile(
    geojson: dict,
    minio_key: str,
    min_zoom: int,
    max_zoom: int,
    skip_pmtiles: bool,
) -> str | None:
    if skip_pmtiles:
        return None
    with tempfile.TemporaryDirectory() as tmp:
        gj_path = os.path.join(tmp, "unit.geojson")
        pm_path = os.path.join(tmp, "unit.pmtiles")
        with open(gj_path, "w", encoding="utf-8") as fh:
            json.dump(geojson, fh)
        ok = generate_pmtiles(gj_path, pm_path, min_zoom, max_zoom)
        if not ok:
            return None
        return upload_pmtiles(pm_path, minio_key)


# ---------------------------------------------------------------------------
# Region + Province seeder  (reads mun/ — geo_level=Prov features)
# ---------------------------------------------------------------------------

def seed_provinces(skip_pmtiles: bool, db: Session) -> None:
    """
    Each file = one region's province features (geo_level=Prov).
    Seeds Region rows (boundary=null, pmtile=null) and Province rows with geometry.
    """
    files = sorted(REGION_DIR.glob("provdists-region-*.json"))
    print(f"  {len(files)} region files found")

    for fp in files:
        features = load_features(fp)
        if not features:
            continue

        # --- Region (no geometry) ---
        adm1_psgc = str(int((features[0].get("properties") or {}).get("adm1_psgc", 0)))
        region_name = REGION_NAMES.get(adm1_psgc, f"Region {adm1_psgc}")

        region = db.query(Region).filter_by(code=adm1_psgc).first()
        if not region:
            region = Region(name=region_name, code=adm1_psgc, boundary=None, pmtile_url=None)
            db.add(region)
            db.flush()
        print(f"    region {adm1_psgc} ({region_name})")

        # --- Province per feature ---
        for f in features:
            props = f.get("properties") or {}
            adm2_psgc = str(int(props.get("adm2_psgc", 0)))
            prov_name = (props.get("adm2_en") or "").strip() or adm2_psgc

            geom = None
            if f.get("geometry"):
                try:
                    geom = to_wkb(shape(f["geometry"]))
                except Exception:
                    pass

            minio_key = f"pmtiles/provinces/province-{adm2_psgc}.pmtiles"
            pmtile_url = make_pmtile(
                make_feature_collection([f]),
                minio_key,
                min_zoom=5, max_zoom=10,
                skip_pmtiles=skip_pmtiles,
            )

            existing = db.query(Province).filter_by(code=adm2_psgc).first()
            if existing:
                existing.boundary = geom
                if pmtile_url:
                    existing.pmtile_url = pmtile_url
                if not existing.region_id:
                    existing.region_id = region.id
            else:
                db.add(Province(
                    name=prov_name,
                    code=adm2_psgc,
                    region_id=region.id,
                    boundary=geom,
                    pmtile_url=pmtile_url,
                ))

        db.commit()

    print(f"  done: {len(files)} region files → regions + provinces seeded")


# ---------------------------------------------------------------------------
# City / Municipality seeder  (reads province/ — geo_level=Mun features)
# ---------------------------------------------------------------------------

def seed_cities(skip_pmtiles: bool, db: Session) -> None:
    """
    Each file = one province's municipality features (geo_level=Mun).
    Seeds City rows. pmtile_url left null — updated by seed_barangays.
    """
    files = sorted(PROVINCE_DIR.glob("municities-provdist-*.json"))
    print(f"  {len(files)} province files found")

    for idx, fp in enumerate(files, 1):
        features = load_features(fp)
        if not features:
            continue

        adm2_psgc = str(int((features[0].get("properties") or {}).get("adm2_psgc", 0)))
        province_rec = db.query(Province).filter_by(code=adm2_psgc).first()

        for f in features:
            props = f.get("properties") or {}
            adm3_psgc = str(int(props.get("adm3_psgc", 0)))
            city_name = (props.get("adm3_en") or "").strip() or adm3_psgc

            geom = None
            if f.get("geometry"):
                try:
                    geom = to_wkb(shape(f["geometry"]))
                except Exception:
                    pass

            existing = db.query(City).filter_by(code=adm3_psgc).first()
            if existing:
                existing.boundary = geom
                if province_rec and not existing.province_id:
                    existing.province_id = province_rec.id
                    existing.province = province_rec.name
                    existing.region = province_rec.region.name if province_rec.region else ""
            else:
                db.add(City(
                    name=city_name,
                    code=adm3_psgc,
                    province=province_rec.name if province_rec else "",
                    region=province_rec.region.name if (province_rec and province_rec.region) else "",
                    province_id=province_rec.id if province_rec else None,
                    boundary=geom,
                    pmtile_url=None,
                ))

        db.commit()
        print(f"    [{idx}/{len(files)}] province {adm2_psgc} → {len(features)} cities", end="\r")

    print()
    print(f"  done: {len(files)} province files → cities seeded")


# ---------------------------------------------------------------------------
# Barangay seeder  (reads barangay/ — geo_level=Bgy features)
# ---------------------------------------------------------------------------

def seed_barangays(skip_pmtiles: bool, db: Session) -> None:
    """
    Each file = one municipality's barangay features (geo_level=Bgy).
    Seeds Barangay rows and updates the parent City.pmtile_url with a
    barangay-detail PMTile for that municipality.
    """
    files = sorted(BARANGAY_DIR.glob("bgysubmuns-municity-*.json"))
    print(f"  {len(files)} municipality files found")

    for idx, fp in enumerate(files, 1):
        features = load_features(fp)
        if not features:
            continue

        props = features[0].get("properties") or {}
        adm3_psgc = str(int(props.get("adm3_psgc", 0)))

        city_rec = db.query(City).filter_by(code=adm3_psgc).first()

        minio_key = f"pmtiles/cities/city-{adm3_psgc}.pmtiles"
        pmtile_url = make_pmtile(
            make_feature_collection(features),
            minio_key,
            min_zoom=10, max_zoom=14,
            skip_pmtiles=skip_pmtiles,
        )

        if city_rec and pmtile_url:
            city_rec.pmtile_url = pmtile_url

        for f in features:
            bprops = f.get("properties") or {}
            adm4_psgc_raw = bprops.get("adm4_psgc")
            if not adm4_psgc_raw:
                continue
            adm4_psgc = str(int(adm4_psgc_raw))
            brgy_name = (bprops.get("adm4_en") or "").strip() or adm4_psgc

            geom = None
            if f.get("geometry"):
                try:
                    geom = to_wkb(shape(f["geometry"]))
                except Exception:
                    pass

            existing = db.query(Barangay).filter_by(code=adm4_psgc).first()
            if existing:
                existing.boundary = geom
                if pmtile_url:
                    existing.pmtile_url = pmtile_url
            else:
                db.add(Barangay(
                    name=brgy_name,
                    code=adm4_psgc,
                    city_id=city_rec.id if city_rec else None,
                    boundary=geom,
                    pmtile_url=pmtile_url,
                ))

        db.commit()
        print(f"    [{idx}/{len(files)}] city {adm3_psgc} + {len(features)} barangays", end="\r")

    print()
    print(f"  done: {len(files)} municipality files → barangays seeded")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

LEVEL_ORDER = ["province", "city", "barangay"]

SEEDERS = {
    "province": seed_provinces,
    "city":     seed_cities,
    "barangay": seed_barangays,
}


def run(levels: list[str], skip_pmtiles: bool = False) -> None:
    if not skip_pmtiles and not check_tippecanoe():
        print(
            "ERROR: tippecanoe not found.\n"
            "  tippecanoe runs on Linux/Mac only. Use --skip-pmtiles to seed DB without tiles.\n"
            "  In WSL: pip install tippecanoe OR https://github.com/felt/tippecanoe\n"
            "\n"
            "  To seed DB only:\n"
            "    python scripts/seed_local_boundaries.py --skip-pmtiles"
        )
        sys.exit(1)

    with SessionLocal() as db:
        for level in levels:
            print(f"\n{'='*55}")
            print(f"  {level.upper()}")
            print(f"{'='*55}")
            SEEDERS[level](skip_pmtiles=skip_pmtiles, db=db)

    print("\nAll done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed PH boundaries from local GeoJSON files")
    parser.add_argument(
        "--levels",
        nargs="+",
        choices=LEVEL_ORDER,
        default=LEVEL_ORDER,
        metavar="LEVEL",
        help="Levels to seed: province city barangay (default: all, in order)",
    )
    parser.add_argument(
        "--skip-pmtiles",
        action="store_true",
        help="Skip tippecanoe + MinIO — seed geometry into DB only",
    )
    args = parser.parse_args()

    ordered = [l for l in LEVEL_ORDER if l in args.levels]
    run(ordered, skip_pmtiles=args.skip_pmtiles)