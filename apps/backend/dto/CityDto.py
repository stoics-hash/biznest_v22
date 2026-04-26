from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class CityCreate(BaseModel):
    name: str
    province: str | None = None
    region: str | None = None


class CityUpdate(BaseModel):
    name: str | None = None
    province: str | None = None
    region: str | None = None


class CityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:          UUID
    name:        str
    province:    str | None
    region:      str | None
    province_id: UUID | None
    pmtile_url:  str | None
    boundary:    dict[str, Any] | None
    created_at:  datetime

    @field_validator("boundary", mode="before")
    @classmethod
    def _wkb_to_geojson(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        try:
            from geoalchemy2.shape import to_shape
            from shapely.geometry import mapping
            return dict(mapping(to_shape(v)))
        except Exception:
            return None