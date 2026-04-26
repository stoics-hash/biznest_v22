from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.InvestorCityAccessDto import InvestorCityAccessCreate
from models.investor_city_access import InvestorCityAccess


def get_all(db: Session) -> list[InvestorCityAccess]:
    return db.query(InvestorCityAccess).all()


def get_by_user(user_id: UUID, db: Session) -> list[InvestorCityAccess]:
    return db.query(InvestorCityAccess).filter(InvestorCityAccess.user_id == user_id).all()


def grant(payload: InvestorCityAccessCreate, db: Session) -> InvestorCityAccess:
    existing = db.query(InvestorCityAccess).filter(
        InvestorCityAccess.user_id == payload.user_id,
        InvestorCityAccess.city_id == payload.city_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Access already granted")
    access = InvestorCityAccess(**payload.model_dump())
    db.add(access)
    db.commit()
    db.refresh(access)
    return access


def revoke(access_id: UUID, db: Session) -> None:
    access = db.query(InvestorCityAccess).filter(InvestorCityAccess.id == access_id).first()
    if not access:
        raise HTTPException(status_code=404, detail="Access record not found")
    db.delete(access)
    db.commit()