from datetime import datetime
from typing import Any
from uuid import UUID

from geoalchemy2.shape import to_shape
from pydantic import BaseModel, ConfigDict, field_validator
from shapely.geometry import mapping


class ZoningAreaCreate(BaseModel):
    city_id: UUID
    zone_type: str | None = None
    geometry: dict[str, Any] | None = None  # GeoJSON


class ZoningAreaUpdate(BaseModel):
    zone_type: str | None = None
    geometry: dict[str, Any] | None = None


class ZoningAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    city_id: UUID
    zone_type: str | None
    geometry: dict[str, Any] | None
    created_by: UUID | None
    created_at: datetime

    @field_validator("geometry", mode="before")
    @classmethod
    def parse_geometry(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        try:
            return dict(mapping(to_shape(v)))
        except Exception:
            return None


# --- Process-image DTOs ---

class GroundControlPoint(BaseModel):
    pixel_x: float
    pixel_y: float
    longitude: float
    latitude: float


class ZoningImageProcessRequest(BaseModel):
    file_id: str
    gcps: list[GroundControlPoint]
    n_colors: int = 8
    min_area_px: int = 500


class ZoningProcessResponse(BaseModel):
    zones_created: int
    skipped_zones: int
    pmtile_url: str | None
    zones: list[ZoningAreaResponse]