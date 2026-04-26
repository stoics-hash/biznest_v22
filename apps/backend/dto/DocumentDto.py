from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentUploadResponse(BaseModel):
    file_id: str
    url: str


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_id: str
    file_name: str
    file_type: str
    file_size: int
    owner_id: UUID
    created_at: datetime
    updated_at: datetime