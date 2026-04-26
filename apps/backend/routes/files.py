from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from dto.DocumentDto import DocumentUploadResponse
from models.user import User
from services import file_service
from services.auth_service import get_authenticated_user
from utils.jwtUtils import get_db

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_file(
    file: UploadFile,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
):
    return await file_service.upload_file(file, current_user, db)


@router.get("/{file_id}")
def download_file(file_id: str) -> StreamingResponse:
    return file_service.download_file(file_id)