from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from dto.ZoningAreaDto import ZoningAreaCreate, ZoningAreaUpdate
from models.city import City
from models.zoning_area import ZoningArea


def get_by_city(city_id: UUID, db: Session) -> list[ZoningArea]:
    return db.query(ZoningArea).filter(ZoningArea.city_id == city_id).all()


def get_or_404(zone_id: UUID, city_id: UUID, db: Session) -> ZoningArea:
    zone = db.query(ZoningArea).filter(ZoningArea.id == zone_id, ZoningArea.city_id == city_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zoning area not found")
    return zone


def create(city_id: UUID, payload: ZoningAreaCreate, created_by: UUID, db: Session) -> ZoningArea:
    if not db.query(City).filter(City.id == city_id).first():
        raise HTTPException(status_code=404, detail="City not found")
    zone = ZoningArea(**payload.model_dump(), created_by=created_by)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


def update(zone_id: UUID, city_id: UUID, payload: ZoningAreaUpdate, db: Session) -> ZoningArea:
    zone = get_or_404(zone_id, city_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(zone, field, value)
    db.commit()
    db.refresh(zone)
    return zone


def delete(zone_id: UUID, city_id: UUID, db: Session) -> None:
    zone = get_or_404(zone_id, city_id, db)
    db.delete(zone)
    db.commit()