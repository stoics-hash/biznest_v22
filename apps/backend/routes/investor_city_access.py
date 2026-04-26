from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from dto.InvestorCityAccessDto import InvestorCityAccessCreate, InvestorCityAccessResponse
from models.user import User
from services import investor_city_access_service
from services.auth_service import get_authenticated_user
from utils.jwtUtils import get_db

router = APIRouter()


@router.get("/", response_model=list[InvestorCityAccessResponse])
def list_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_city_access_service.get_all(db)


@router.get("/me", response_model=list[InvestorCityAccessResponse])
def my_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_city_access_service.get_by_user(current_user.id, db)


@router.post("/", response_model=InvestorCityAccessResponse, status_code=status.HTTP_201_CREATED)
def grant_access(
    payload: InvestorCityAccessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    return investor_city_access_service.grant(payload, db)


@router.delete("/{access_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_access(
    access_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    investor_city_access_service.revoke(access_id, db)