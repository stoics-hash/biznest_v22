from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.CityDto import CityCreate, CityUpdate
from models.city import City


def get_all(db: Session) -> list[City]:
    return db.query(City).all()


def get_or_404(city_id: UUID, db: Session) -> City:
    city = db.query(City).filter(City.id == city_id).first()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
    return city


def create(payload: CityCreate, db: Session) -> City:
    city = City(**payload.model_dump())
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


def update(city_id: UUID, payload: CityUpdate, db: Session) -> City:
    city = get_or_404(city_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(city, field, value)
    db.commit()
    db.refresh(city)
    return city


def delete(city_id: UUID, db: Session) -> None:
    city = get_or_404(city_id, db)
    db.delete(city)
    db.commit()