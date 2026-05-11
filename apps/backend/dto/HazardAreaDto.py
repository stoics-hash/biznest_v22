from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HazardAreaCreate(BaseModel):
    hazard_type: str | None = None
    scenario:    str | None = None
    geometry:    dict[str, Any] | None = None  # GeoJSON


class HazardAreaUpdate(BaseModel):
    hazard_type: str | None = None
    geometry:    dict[str, Any] | None = None


class HazardAreaSummary(BaseModel):
    """List/get response — geometry excluded (use pmtile_url for rendering)."""
    model_config = ConfigDict(from_attributes=True)

    id:          UUID
    city_id: UUID
    hazard_type: str | None
    scenario:    str | None
    pmtile_url:  str | None
    created_by:  UUID | None
    created_at:  datetime


class HazardAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:          UUID
    city_id: UUID
    hazard_type: str | None
    scenario:    str | None
    pmtile_url:  str | None
    geometry:    dict[str, Any] | None
    created_by:  UUID | None
    created_at:  datetime


class HazardPmtileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hazard_type: str
    scenario:    str | None
    pmtile_url:  str