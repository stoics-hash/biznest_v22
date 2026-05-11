import base64
import gzip
import json
from datetime import datetime
from uuid import UUID

import redis as redis_lib
from fastapi import HTTPException
from geoalchemy2 import WKBElement
from sqlalchemy.orm import Session, defer

from dto.CityDto import CityCreate, CityUpdate
from models.city import City

_TTL_CITY      = 3600   # 1 h  — single city
_TTL_CITY_LIST = 300    # 5 min — full list

# Separate cache slots for with-geometry vs without-geometry responses
_KEY_ALL         = "cities:all:v2"
_KEY_ALL_GEO     = "cities:all:geo:v2"
_KEY_ONE         = "city:{}:v2"
_KEY_ONE_GEO     = "city:{}:geo:v2"


# ---------------------------------------------------------------------------
# Serialization helpers
# WKB stored as raw hex (city.boundary.desc) — no Shapely roundtrip.
# Payload gzip-compressed then base64-encoded to survive decode_responses=True.
# ---------------------------------------------------------------------------

def _pack(data) -> str:
    compressed = gzip.compress(json.dumps(data).encode(), compresslevel=6)
    return base64.b64encode(compressed).decode()


def _unpack(s: str):
    return json.loads(gzip.decompress(base64.b64decode(s)))


def _serialize(city: City, include_geometry: bool) -> dict:
    d = {
        "id":          str(city.id),
        "name":        city.name,
        "code":        city.code,
        "province":    city.province,
        "region":      city.region,
        "province_id": str(city.province_id) if city.province_id else None,
        "pmtile_url":  city.pmtile_url,
        "created_at":  city.created_at.isoformat() if city.created_at else None,
    }
    if include_geometry:
        d["boundary_wkb"] = city.boundary.desc if city.boundary is not None else None
    else:
        d["boundary_wkb"] = None
    return d


def _deserialize(data: dict) -> City:
    boundary = None
    if data.get("boundary_wkb"):
        boundary = WKBElement(data["boundary_wkb"], extended=True)
    return City(
        id          = data["id"],
        name        = data["name"],
        code        = data.get("code"),
        province    = data.get("province"),
        region      = data.get("region"),
        province_id = data.get("province_id"),
        pmtile_url  = data.get("pmtile_url"),
        created_at  = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
        boundary    = boundary,
    )


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_key_all(include_geometry: bool) -> str:
    return _KEY_ALL_GEO if include_geometry else _KEY_ALL


def _cache_key_one(city_id, include_geometry: bool) -> str:
    return (_KEY_ONE_GEO if include_geometry else _KEY_ONE).format(city_id)


def _invalidate(city_id: UUID | str, rc: redis_lib.Redis) -> None:
    rc.delete(
        _KEY_ONE.format(city_id),
        _KEY_ONE_GEO.format(city_id),
        _KEY_ALL,
        _KEY_ALL_GEO,
    )


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

def get_all(
    db: Session,
    rc: redis_lib.Redis | None = None,
    include_geometry: bool = False,
) -> list[City]:
    key = _cache_key_all(include_geometry)

    if rc:
        cached = rc.get(key)
        if cached:
            try:
                return [_deserialize(d) for d in _unpack(cached)]
            except Exception:
                rc.delete(key)

    query = db.query(City)
    if not include_geometry:
        query = query.options(defer(City.boundary))  # skip large WKB column entirely
    cities = query.all()

    if rc and cities:
        rc.setex(key, _TTL_CITY_LIST, _pack([_serialize(c, include_geometry) for c in cities]))

    return cities


def get_or_404(
    city_id: UUID,
    db: Session,
    rc: redis_lib.Redis | None = None,
    include_geometry: bool = False,
) -> City:
    key = _cache_key_one(city_id, include_geometry)

    if rc:
        cached = rc.get(key)
        if cached:
            try:
                return _deserialize(_unpack(cached))
            except Exception:
                rc.delete(key)

    query = db.query(City).filter(City.id == city_id)
    if not include_geometry:
        query = query.options(defer(City.boundary))
    city = query.first()

    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    if rc:
        rc.setex(key, _TTL_CITY, _pack(_serialize(city, include_geometry)))

    return city


def create(payload: CityCreate, db: Session) -> City:
    city = City(**payload.model_dump())
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


def update(city_id: UUID, payload: CityUpdate, db: Session, rc: redis_lib.Redis | None = None) -> City:
    city = get_or_404(city_id, db, include_geometry=True)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(city, field, value)
    db.commit()
    db.refresh(city)
    if rc:
        _invalidate(city_id, rc)
    return city


def delete(city_id: UUID, db: Session, rc: redis_lib.Redis | None = None) -> None:
    city = get_or_404(city_id, db)
    db.delete(city)
    db.commit()
    if rc:
        _invalidate(city_id, rc)