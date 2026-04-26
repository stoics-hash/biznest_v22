from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from dto.HazardAreaDto import HazardAreaCreate, HazardAreaResponse, HazardAreaSummary, HazardAreaUpdate, HazardPmtileResponse
from models.user import User
from services import hazard_area_service
from services.auth_service import get_authenticated_user
from utils.jwtUtils import get_db

router = APIRouter()


@router.get("/{province_id}/hazards/pmtiles", response_model=list[HazardPmtileResponse])
def list_hazard_pmtiles(
    province_id: UUID,
    hazard_type: str | None = Query(default=None),
    scenario: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return hazard_area_service.get_pmtiles_by_province(province_id, db, hazard_type, scenario)


@router.get("/{province_id}/hazards", response_model=list[HazardAreaSummary])
def list_hazard_areas(province_id: UUID, db: Session = Depends(get_db)):
    return hazard_area_service.get_by_province(province_id, db)


@router.post("/{province_id}/hazards", response_model=HazardAreaSummary, status_code=status.HTTP_201_CREATED)
def create_hazard_area(
    province_id: UUID,
    payload: HazardAreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return hazard_area_service.create(province_id, payload, current_user.id, db)


@router.get("/{province_id}/hazards/{hazard_id}", response_model=HazardAreaSummary)
def get_hazard_area(province_id: UUID, hazard_id: UUID, db: Session = Depends(get_db)):
    return hazard_area_service.get_or_404(hazard_id, province_id, db)


@router.patch("/{province_id}/hazards/{hazard_id}", response_model=HazardAreaSummary)
def update_hazard_area(
    province_id: UUID,
    hazard_id: UUID,
    payload: HazardAreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return hazard_area_service.update(hazard_id, province_id, payload, db)


@router.delete("/{province_id}/hazards/{hazard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hazard_area(
    province_id: UUID,
    hazard_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    hazard_area_service.delete(hazard_id, province_id, db)