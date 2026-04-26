from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from dto.CityDto import CityCreate, CityResponse, CityUpdate
from models.user import User
from services import city_service
from services.auth_service import get_authenticated_user
from utils.jwtUtils import get_db

router = APIRouter()


@router.get("/", response_model=list[CityResponse])
def list_cities(db: Session = Depends(get_db)):
    return city_service.get_all(db)


@router.post("/", response_model=CityResponse, status_code=status.HTTP_201_CREATED)
def create_city(
    payload: CityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return city_service.create(payload, db)


@router.get("/{city_id}", response_model=CityResponse)
def get_city(city_id: UUID, db: Session = Depends(get_db)):
    return city_service.get_or_404(city_id, db)


@router.patch("/{city_id}", response_model=CityResponse)
def update_city(
    city_id: UUID,
    payload: CityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return city_service.update(city_id, payload, db)


@router.delete("/{city_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_city(
    city_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    city_service.delete(city_id, db)