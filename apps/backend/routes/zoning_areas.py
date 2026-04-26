from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from dto.ZoningAreaDto import ZoningAreaCreate, ZoningAreaResponse, ZoningAreaUpdate
from models.user import User
from services import zoning_area_service
from services.auth_service import get_authenticated_user
from utils.jwtUtils import get_db

router = APIRouter()


@router.get("/{city_id}/zoning", response_model=list[ZoningAreaResponse])
def list_zoning_areas(city_id: UUID, db: Session = Depends(get_db)):
    return zoning_area_service.get_by_city(city_id, db)


@router.post("/{city_id}/zoning", response_model=ZoningAreaResponse, status_code=status.HTTP_201_CREATED)
def create_zoning_area(
    city_id: UUID,
    payload: ZoningAreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return zoning_area_service.create(city_id, payload, current_user.id, db)


@router.get("/{city_id}/zoning/{zone_id}", response_model=ZoningAreaResponse)
def get_zoning_area(city_id: UUID, zone_id: UUID, db: Session = Depends(get_db)):
    return zoning_area_service.get_or_404(zone_id, city_id, db)


@router.patch("/{city_id}/zoning/{zone_id}", response_model=ZoningAreaResponse)
def update_zoning_area(
    city_id: UUID,
    zone_id: UUID,
    payload: ZoningAreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return zoning_area_service.update(zone_id, city_id, payload, db)


@router.delete("/{city_id}/zoning/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zoning_area(
    city_id: UUID,
    zone_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    zoning_area_service.delete(zone_id, city_id, db)