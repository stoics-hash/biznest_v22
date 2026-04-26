from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ZoningAreaCreate(BaseModel):
    city_id: UUID
    zone_type: str | None = None  # residential, commercial, industrial
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