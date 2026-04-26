"""
Seed Project NOAH hazard maps directly from HuggingFace.

Downloads ZIP files, converts shapefiles to GeoJSON in a temp directory,
generates PMTiles, and stores geometry to the database — no permanent
local files required for NOAH data.

Dataset : bettergovph/project-noah-hazard-maps (private — needs HUGGING_FACE_TOKEN in .env)

Requires:
  pip install fiona geopandas requests

Usage:
  python scripts/seed_noah_hazards.py                                   # all hazards
  python scripts/seed_noah_hazards.py --hazards flood                   # flood only
  python scripts/seed_noah_hazards.py --hazards flood --scenarios 100yr # one scenario
  python scripts/seed_noah_hazards.py --skip-pmtiles                    # geometry only
  python scripts/seed_noah_hazards.py --province Bukidnon               # one province
  python scripts/seed_noah_hazards.py --workers 4                       # default: cpu_count
  python scripts/seed_noah_hazards.py --list-files                      # inspect HF repo
  python scripts/seed_noah_hazards.py --force                           # re-download existing
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile
import time
import zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import quote

os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

import requests
import sqlalchemy as sa
from geoalchemy2.shape import from_shape
from requests.adapters import HTTPAdapter
from sqlalchemy.orm import Session
from urllib3.util.retry import Retry

from core.db import SessionLocal
from core.minio_client import minio_client, BUCKET_NAME
import models  # noqa: F401
from models.city import City
from models.province import Province
from models.hazard_area import HazardArea

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BACKEND_DIR    = Path(__file__).resolve().parent.parent
GEO_HAZARD_DIR = BACKEND_DIR / "geo_hazard"
HF_BASE        = "https://huggingface.co"
HF_REPO_ID     = "bettergovph/project-noah-hazard-maps"

_DOWNLOAD_MAX_ATTEMPTS = 5
_DOWNLOAD_CHUNK_SIZE   = 1 << 20  # 1 MiB

# HF directory prefix → (hazard_type, scenario, is_national_file, local_subdir)
HF_SOURCE_MAP: dict[str, tuple[str, Optional[str], bool, str]] = {
    "Flood/5yr":                       ("flood",       "5yr",  False, "flood/5yr"),
    "Flood/25yr":                      ("flood",       "25yr", False, "flood/25yr"),
    "Flood/100yr":                     ("flood",       "100yr",False, "flood/100yr"),
    "Landslide/LandslideHazards":      ("landslide",   None,   False, "landslide/landslide"),
    "Landslide/DebrisFlowAlluvialFan": ("debris_flow", None,   True,  "landslide/DebrisFlow"),
    "Storm Surge/StormSurgeAdvisory1": ("storm_surge", "ssa1", False, "storm_surge/storm_surge_advisory_1"),
    "Storm Surge/StormSurgeAdvisory2": ("storm_surge", "ssa2", False, "storm_surge/storm_surge_advisory_2"),
    "Storm Surge/StormSurgeAdvisory3": ("storm_surge", "ssa3", False, "storm_surge/storm_surge_advisory_3"),
    "Storm Surge/StormSurgeAdvisory4": ("storm_surge", "ssa4", False, "storm_surge/storm_surge_advisory_4"),
}

HAZARD_FILTER_MAP: dict[str, list[str]] = {
    "flood":        ["Flood/5yr", "Flood/25yr", "Flood/100yr"],
    "landslide":    ["Landslide/LandslideHazards"],
    "debris_flow":  ["Landslide/DebrisFlowAlluvialFan"],
    "storm_surge":  [
        "Storm Surge/StormSurgeAdvisory1",
        "Storm Surge/StormSurgeAdvisory2",
        "Storm Surge/StormSurgeAdvisory3",
        "Storm Surge/StormSurgeAdvisory4",
    ],
}

SCENARIO_FILTER_MAP: dict[str, list[str]] = {
    "5yr":  ["Flood/5yr"],
    "25yr": ["Flood/25yr"],
    "100yr":["Flood/100yr"],
    "ssa1": ["Storm Surge/StormSurgeAdvisory1"],
    "ssa2": ["Storm Surge/StormSurgeAdvisory2"],
    "ssa3": ["Storm Surge/StormSurgeAdvisory3"],
    "ssa4": ["Storm Surge/StormSurgeAdvisory4"],
}

# Filename-stem → province-name overrides for unresolvable names.
STEM_OVERRIDES: dict[str, str] = {}


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------

def get_hf_token() -> str:
    token = os.environ.get("HUGGING_FACE_TOKEN", "").strip()
    if not token:
        print("ERROR: HUGGING_FACE_TOKEN not set in .env")
        sys.exit(1)
    return token


def make_session(token: str) -> requests.Session:
    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {token}"
    retry = Retry(
        total=5,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


# ---------------------------------------------------------------------------
# HuggingFace API
# ---------------------------------------------------------------------------

def _parse_next_url(link_header: str) -> Optional[str]:
    for part in link_header.split(","):
        url_part, *rels = part.strip().split(";")
        if any('rel="next"' in r for r in rels):
            return url_part.strip().strip("<>")
    return None


def list_zips_for_prefix(hf_prefix: str, session: requests.Session) -> list[str]:
    """List all .zip paths under hf_prefix via the HF datasets tree API."""
    encoded = quote(hf_prefix, safe="/")
    url: Optional[str] = f"{HF_BASE}/api/datasets/{HF_REPO_ID}/tree/main/{encoded}"
    result: list[str] = []
    while url:
        resp = session.get(url, timeout=30)
        if resp.status_code == 404:
            break
        resp.raise_for_status()
        for item in resp.json():
            if item.get("type") == "file" and item["path"].endswith(".zip"):
                result.append(item["path"])
        url = _parse_next_url(resp.headers.get("Link", ""))
    return result


# ---------------------------------------------------------------------------
# Download + convert
# ---------------------------------------------------------------------------

def _download_file(hf_path: str, dest: Path, session: requests.Session) -> None:
    """Stream-download with retry; writes to .part then renames on success."""
    url = f"{HF_BASE}/datasets/{HF_REPO_ID}/resolve/main/{quote(hf_path, safe='/')}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".part")

    for attempt in range(1, _DOWNLOAD_MAX_ATTEMPTS + 1):
        try:
            with session.get(url, stream=True, timeout=300) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("Content-Length", 0))
                downloaded = 0
                with open(tmp, "wb") as fh:
                    for chunk in resp.iter_content(chunk_size=_DOWNLOAD_CHUNK_SIZE):
                        if chunk:
                            fh.write(chunk)
                            downloaded += len(chunk)
            if total and downloaded < total:
                raise IOError(f"incomplete: got {downloaded}/{total} bytes")
            tmp.rename(dest)
            return
        except Exception as exc:
            tmp.unlink(missing_ok=True)
            if attempt == _DOWNLOAD_MAX_ATTEMPTS:
                raise RuntimeError(
                    f"download failed after {_DOWNLOAD_MAX_ATTEMPTS} attempts: {exc}"
                ) from exc
            wait = 2 ** attempt
            print(f"    attempt {attempt} failed ({exc}), retrying in {wait}s…", flush=True)
            time.sleep(wait)


def _zip_to_geojson(zip_path: Path, out_path: Path) -> bool:
    """Extract shapefile from ZIP and write as GeoJSON (EPSG:4326)."""
    import geopandas as gpd

    with tempfile.TemporaryDirectory() as tmp:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp)

        shp_files = list(Path(tmp).rglob("*.shp"))
        if not shp_files:
            print(f"    no .shp in {zip_path.name}", flush=True)
            return False

        try:
            gdf = gpd.read_file(str(shp_files[0]))
        except Exception as exc:
            print(f"    read failed: {exc}", flush=True)
            return False

        if gdf.empty:
            return False

        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        elif gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs("EPSG:4326")

        out_path.parent.mkdir(parents=True, exist_ok=True)
        gdf.to_file(str(out_path), driver="GeoJSON")
        return True


def _download_and_convert(
    hf_path: str, out_path: Path, session: requests.Session, force: bool = False
) -> Optional[Path]:
    """Download HF ZIP and convert to GeoJSON. Skips if already exists unless force=True."""
    if out_path.exists() and not force:
        return out_path
    with tempfile.TemporaryDirectory() as tmp:
        zip_dest = Path(tmp) / Path(hf_path).name
        try:
            _download_file(hf_path, zip_dest, session)
        except Exception as exc:
            print(f"    download failed: {exc}", flush=True)
            return None
        if _zip_to_geojson(zip_dest, out_path):
            return out_path
        return None


# ---------------------------------------------------------------------------
# Province index
# ---------------------------------------------------------------------------

@dataclass
class ProvinceInfo:
    id:   str
    name: str
    code: Optional[str]


def _norm(s: str) -> str:
    return re.sub(r"[\s\-.–—_']", "", s).lower()


def build_indexes(db: Session) -> tuple[
    dict[str, ProvinceInfo],
    dict[str, ProvinceInfo],
    dict[str, ProvinceInfo],
]:
    provinces = db.query(Province).all()
    name_index: dict[str, ProvinceInfo] = {}
    id_index:   dict[str, ProvinceInfo] = {}
    for p in provinces:
        info = ProvinceInfo(id=str(p.id), name=str(p.name), code=str(p.code) if p.code else None)
        name_index[_norm(p.name)] = info
        id_index[str(p.id)]       = info

    city_index: dict[str, ProvinceInfo] = {}
    for c in db.query(City).filter(City.province_id.isnot(None)).all():
        prov = id_index.get(str(c.province_id))
        if prov:
            city_index[_norm(c.name)] = prov

    return name_index, id_index, city_index


def match_province(
    stem: str,
    name_index: dict[str, ProvinceInfo],
    city_index: dict[str, ProvinceInfo],
) -> Optional[ProvinceInfo]:
    normalized = STEM_OVERRIDES.get(_norm(stem), _norm(stem))
    if normalized in name_index:
        return name_index[normalized]
    for key, p in name_index.items():
        if normalized in key or key in normalized:
            return p
    if normalized in city_index:
        return city_index[normalized]
    for key, p in city_index.items():
        if normalized in key or key in normalized:
            return p
    return None


def build_provinces_gdf(db: Session) -> tuple:
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


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def _geom_to_wkb(geom):
    """Strip Z coordinates and return a geoalchemy2 WKBElement."""
    if geom is None or geom.is_empty:
        return None
    try:
        import shapely
        return from_shape(shapely.force_2d(geom), srid=4326)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# PMTile generation
# ---------------------------------------------------------------------------

def check_tippecanoe() -> bool:
    try:
        return subprocess.run(["tippecanoe", "--version"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


def generate_pmtiles(geojson_path: Path, minio_key: str) -> Optional[str]:
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


# ---------------------------------------------------------------------------
# DB write
# ---------------------------------------------------------------------------

def _replace_features(
    province_id: str,
    hazard_type: str,
    scenario:    Optional[str],
    pmtile_url:  Optional[str],
    wkbs:        list,
) -> int:
    """Delete existing rows for (province, hazard_type, scenario) then bulk insert."""
    if not wkbs:
        return 0
    from uuid import uuid4
    scenario_clause = (
        HazardArea.scenario.is_(None) if scenario is None else HazardArea.scenario == scenario
    )
    with SessionLocal() as db:
        db.execute(
            sa.delete(HazardArea).where(
                sa.and_(
                    HazardArea.province_id == province_id,
                    HazardArea.hazard_type == hazard_type,
                    scenario_clause,
                )
            )
        )
        db.execute(
            sa.insert(HazardArea),
            [
                {
                    "id":          str(uuid4()),
                    "province_id": province_id,
                    "hazard_type": hazard_type,
                    "scenario":    scenario,
                    "pmtile_url":  pmtile_url,
                    "geometry":    wkb,
                }
                for wkb in wkbs
            ],
        )
        db.commit()
    return len(wkbs)


# ---------------------------------------------------------------------------
# Per-province worker — top-level for ProcessPoolExecutor pickling
# ---------------------------------------------------------------------------

def _worker(task: dict) -> tuple[str, str, int]:
    """
    Read one province GeoJSON, store each feature as a HazardArea row.
    Returns (stem, province_name, rows_inserted).
    """
    import geopandas as gpd

    os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

    geojson_path: Path          = task["path"]
    province:     ProvinceInfo  = task["province"]
    hazard_type:  str           = task["hazard_type"]
    scenario:     Optional[str] = task["scenario"]
    skip_pmtiles: bool          = task["skip_pmtiles"]

    stem = geojson_path.stem

    pmtile_url = None
    if not skip_pmtiles and province.code:
        scenario_slug = scenario or "all"
        minio_key = f"pmtiles/hazards/{hazard_type}/{scenario_slug}/province-{province.code}.pmtiles"
        pmtile_url = generate_pmtiles(geojson_path, minio_key)

    try:
        gdf = gpd.read_file(str(geojson_path))
    except Exception as exc:
        print(f"    [{stem}] read failed: {exc}", flush=True)
        return stem, province.name, 0

    if gdf.empty:
        return stem, province.name, 0

    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    wkbs = [w for g in gdf.geometry if (w := _geom_to_wkb(g)) is not None]
    count = _replace_features(province.id, hazard_type, scenario, pmtile_url, wkbs)
    return stem, province.name, count


# ---------------------------------------------------------------------------
# National file worker (spatial-join → per-province bulk insert)
# ---------------------------------------------------------------------------

def _process_national(
    geojson_path:   Path,
    hazard_type:    str,
    scenario:       Optional[str],
    provinces_gdf,
    province_infos: dict[str, ProvinceInfo],
    skip_pmtiles:   bool,
) -> None:
    import geopandas as gpd

    print(f"  National: {geojson_path.stem} — spatial joining…", flush=True)
    os.environ["OGR_GEOJSON_MAX_OBJ_SIZE"] = "0"

    try:
        gdf = gpd.read_file(str(geojson_path))
    except Exception as exc:
        print(f"    error: {exc}", flush=True)
        return

    if gdf.empty:
        return
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    joined = gpd.sjoin(
        gdf, provinces_gdf[["province_id_ref", "geometry"]],
        how="left", predicate="intersects",
    )
    joined = joined[~joined.index.duplicated(keep="first")]
    joined = joined[joined["province_id_ref"].notna()]
    if joined.empty:
        print(f"    no features intersect any province", flush=True)
        return

    scenario_slug = scenario or "all"
    for prov_id_str, group in joined.groupby("province_id_ref"):
        province = province_infos.get(str(prov_id_str))
        if not province or not province.code:
            continue

        pmtile_url = None
        if not skip_pmtiles:
            minio_key = f"pmtiles/hazards/{hazard_type}/{scenario_slug}/province-{province.code}.pmtiles"
            with tempfile.TemporaryDirectory() as tmp:
                slice_path = Path(tmp) / "slice.geojson"
                cols = [c for c in group.columns if not c.startswith("index_")]
                group[cols].to_file(str(slice_path), driver="GeoJSON")
                pmtile_url = generate_pmtiles(slice_path, minio_key)

        wkbs = [w for g in group.geometry if (w := _geom_to_wkb(g)) is not None]
        count = _replace_features(province.id, hazard_type, scenario, pmtile_url, wkbs)
        print(f"    [{province.name}] {count} rows", flush=True)


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def _build_allowed_prefixes(
    hazard_filter:   Optional[list[str]],
    scenario_filter: Optional[list[str]],
) -> set[str]:
    if not hazard_filter and not scenario_filter:
        return set(HF_SOURCE_MAP.keys())

    if hazard_filter and scenario_filter:
        hazard_set:   set[str] = set()
        scenario_set: set[str] = set()
        for h in hazard_filter:
            hazard_set.update(HAZARD_FILTER_MAP.get(h, []))
        for s in scenario_filter:
            scenario_set.update(SCENARIO_FILTER_MAP.get(s, []))
        return hazard_set & scenario_set

    result: set[str] = set()
    for h in (hazard_filter or []):
        result.update(HAZARD_FILTER_MAP.get(h, []))
    for s in (scenario_filter or []):
        result.update(SCENARIO_FILTER_MAP.get(s, []))
    return result


def seed_hazard_source(
    hazard_type:     str,
    scenario:        Optional[str],
    geojsons:        list[Path],
    is_national:     bool,
    name_index:      dict[str, ProvinceInfo],
    city_index:      dict[str, ProvinceInfo],
    provinces_gdf,
    province_infos:  dict[str, ProvinceInfo],
    skip_pmtiles:    bool,
    workers:         int,
    province_filter: Optional[str],
) -> None:
    if province_filter:
        geojsons = [g for g in geojsons if province_filter.lower() in g.stem.lower()]
        print(f"  filtered to {len(geojsons)} file(s) matching '{province_filter}'", flush=True)

    if not geojsons:
        print("  no files to process", flush=True)
        return

    print(f"  {len(geojsons)} file(s) to seed", flush=True)

    if is_national:
        for gj in geojsons:
            _process_national(gj, hazard_type, scenario, provinces_gdf, province_infos, skip_pmtiles)
        return

    tasks = []
    for gj in geojsons:
        province = match_province(gj.stem, name_index, city_index)
        if not province:
            print(f"  [{gj.stem}] no matching province — add to STEM_OVERRIDES if needed", flush=True)
            continue
        tasks.append({
            "path":         gj,
            "province":     province,
            "hazard_type":  hazard_type,
            "scenario":     scenario,
            "skip_pmtiles": skip_pmtiles,
        })

    total = len(tasks)
    done  = 0
    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(_worker, t): t for t in tasks}
        for fut in as_completed(futures):
            done += 1
            try:
                stem, prov_name, count = fut.result()
                print(f"  [{done}/{total}] {stem} → {prov_name}  ({count} rows)", flush=True)
            except Exception as exc:
                t = futures[fut]
                print(f"  [{done}/{total}] {t['path'].stem}  error: {exc}", flush=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run(
    hazard_filter:   Optional[list[str]],
    scenario_filter: Optional[list[str]],
    skip_pmtiles:    bool,
    province_filter: Optional[str],
    workers:         int,
    list_files_only: bool,
    force:           bool,
) -> None:
    if not skip_pmtiles and not list_files_only and not check_tippecanoe():
        print(
            "ERROR: tippecanoe not found.\n"
            "  Use --skip-pmtiles to seed geometry without generating tiles.\n"
            "  Install tippecanoe on Linux/Mac/WSL: https://github.com/felt/tippecanoe"
        )
        sys.exit(1)

    token   = get_hf_token()
    session = make_session(token)

    if list_files_only:
        print(f"Listing files in {HF_REPO_ID}…", flush=True)
        for prefix in HF_SOURCE_MAP:
            zips = list_zips_for_prefix(prefix, session)
            print(f"\n[{prefix}] {len(zips)} ZIP(s)")
            for z in sorted(zips):
                print(f"  {z}")
        return

    allowed = _build_allowed_prefixes(hazard_filter, scenario_filter)
    if not allowed:
        print("No matching sources for the given filters.")
        return

    print("\n" + "=" * 55)
    print("  Building province + city index from DB…")
    print("=" * 55)
    with SessionLocal() as db:
        name_index, id_index, city_index = build_indexes(db)
        print(f"  {len(name_index)} provinces, {len(city_index)} cities indexed")
        provinces_gdf, province_infos = build_provinces_gdf(db)
        print(f"  {len(provinces_gdf)} provinces with geometry")

    for hf_prefix, (hazard_type, scenario, is_national, local_subdir) in HF_SOURCE_MAP.items():
        if hf_prefix not in allowed:
            continue

        print(f"\n{'=' * 55}")
        print(f"  {hazard_type.upper()} / {scenario or 'all'}")
        print(f"{'=' * 55}")

        print(f"  Listing {hf_prefix}…", flush=True)
        zips = list_zips_for_prefix(hf_prefix, session)
        if not zips:
            print(f"  no ZIPs found (run --list-files to inspect repo structure)", flush=True)
            continue
        print(f"  {len(zips)} ZIP(s) found", flush=True)

        prefix_dir = GEO_HAZARD_DIR / local_subdir
        prefix_dir.mkdir(parents=True, exist_ok=True)

        geojsons: list[Path] = []
        for i, hf_path in enumerate(sorted(zips), 1):
            stem     = Path(hf_path).stem
            out_path = prefix_dir / f"{stem}.geojson"
            cached   = out_path.exists() and not force
            print(f"  [{i}/{len(zips)}] {stem}{'  [cached]' if cached else '…'}", end=" ", flush=True)
            result = _download_and_convert(hf_path, out_path, session, force=force)
            if result:
                geojsons.append(result)
                print("✓", flush=True)
            else:
                print("✗", flush=True)

        seed_hazard_source(
            hazard_type, scenario, geojsons, is_national,
            name_index, city_index, provinces_gdf, province_infos,
            skip_pmtiles, workers, province_filter,
        )

    print("\nAll done.")


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()  # Windows spawn safety

    ALL_HAZARDS = ["flood", "landslide", "debris_flow", "storm_surge"]

    parser = argparse.ArgumentParser(
        description="Seed NOAH hazard maps — downloads from HuggingFace, no local cache"
    )
    parser.add_argument("--hazards",      nargs="+", choices=ALL_HAZARDS, default=ALL_HAZARDS)
    parser.add_argument("--scenarios",    nargs="+", default=None, metavar="SCENARIO",
                        help="5yr 25yr 100yr ssa1 ssa2 ssa3 ssa4")
    parser.add_argument("--skip-pmtiles", action="store_true")
    parser.add_argument("--province",     default=None, metavar="NAME")
    parser.add_argument("--list-files",   action="store_true",
                        help="Print all ZIP paths in the HF repo and exit")
    parser.add_argument("--force",        action="store_true",
                        help="Re-download and re-convert already cached GeoJSON files")
    parser.add_argument(
        "--workers", type=int,
        default=os.cpu_count() or 4, metavar="N",
        help=f"Parallel workers for DB insert (default: cpu_count = {os.cpu_count()})",
    )
    args = parser.parse_args()

    run(
        hazard_filter   = args.hazards,
        scenario_filter = args.scenarios,
        skip_pmtiles    = args.skip_pmtiles,
        province_filter = args.province,
        workers         = args.workers,
        list_files_only = args.list_files,
        force           = args.force,
    )