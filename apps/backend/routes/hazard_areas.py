from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from dto.HazardAreaDto import HazardAreaCreate, HazardAreaResponse, HazardAreaSummary, HazardAreaUpdate, HazardPmtileResponse
from models.user import User
from services import hazard_area_service
from services.auth_service import get_authenticated_user
from utils.jwtUtils import get_db

router = APIRouter()


@router.get("/{city_id}/hazards/pmtiles", response_model=list[HazardPmtileResponse])
def list_hazard_pmtiles(
    city_id: UUID,
    hazard_type: str | None = Query(default=None),
    scenario: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return hazard_area_service.get_pmtiles_by_city(city_id, db, hazard_type, scenario)


@router.get("/{city_id}/hazards", response_model=list[HazardAreaSummary])
def list_hazard_areas(city_id: UUID, db: Session = Depends(get_db)):
    return hazard_area_service.get_by_city(city_id, db)


@router.post("/{city_id}/hazards", response_model=HazardAreaSummary, status_code=status.HTTP_201_CREATED)
def create_hazard_area(
    city_id: UUID,
    payload: HazardAreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return hazard_area_service.create(city_id, payload, current_user.id, db)


@router.get("/{city_id}/hazards/{hazard_id}", response_model=HazardAreaSummary)
def get_hazard_area(city_id: UUID, hazard_id: UUID, db: Session = Depends(get_db)):
    return hazard_area_service.get_or_404(hazard_id, city_id, db)


@router.patch("/{city_id}/hazards/{hazard_id}", response_model=HazardAreaSummary)
def update_hazard_area(
    city_id: UUID,
    hazard_id: UUID,
    payload: HazardAreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return hazard_area_service.update(hazard_id, city_id, payload, db)


@router.delete("/{city_id}/hazards/{hazard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hazard_area(
    city_id: UUID,
    hazard_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    hazard_area_service.delete(hazard_id, city_id, db)