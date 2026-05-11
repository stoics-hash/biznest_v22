from datetime import timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.minio_client import BUCKET_NAME, minio_client
from dto.HazardAreaDto import HazardAreaCreate, HazardAreaUpdate, HazardPmtileResponse
from models.hazard_area import HazardArea

_PMTILE_URL_TTL = timedelta(hours=5)


def get_pmtiles_by_city(
    city_id: UUID,
    db: Session,
    hazard_type: str | None = None,
    scenario: str | None = None,
) -> list[HazardPmtileResponse]:
    q = (
        db.query(HazardArea.hazard_type, HazardArea.scenario, HazardArea.pmtile_url)
        .filter(HazardArea.city_id == city_id, HazardArea.pmtile_url.isnot(None))
    )
    if hazard_type:
        q = q.filter(HazardArea.hazard_type == hazard_type)
    if scenario:
        q = q.filter(HazardArea.scenario == scenario)
    rows = q.distinct().all()
    return [
        HazardPmtileResponse(
            hazard_type=r[0],
            scenario=r[1],
            pmtile_url=minio_client.presigned_get_object(BUCKET_NAME, r[2], expires=_PMTILE_URL_TTL),
        )
        for r in rows
    ]


def get_by_city(city_id: UUID, db: Session) -> list[HazardArea]:
    return db.query(HazardArea).filter(HazardArea.city_id == city_id).all()


def get_or_404(hazard_id: UUID, city_id: UUID, db: Session) -> HazardArea:
    hazard = (
        db.query(HazardArea)
        .filter(HazardArea.id == hazard_id, HazardArea.city_id == city_id)
        .first()
    )
    if not hazard:
        raise HTTPException(status_code=404, detail="Hazard area not found")
    return hazard


def create(city_id: UUID, payload: HazardAreaCreate, created_by: UUID, db: Session) -> HazardArea:
    hazard = HazardArea(
        city_id=city_id,
        created_by=created_by,
        **payload.model_dump(),
    )
    db.add(hazard)
    db.commit()
    db.refresh(hazard)
    return hazard


def update(hazard_id: UUID, city_id: UUID, payload: HazardAreaUpdate, db: Session) -> HazardArea:
    hazard = get_or_404(hazard_id, city_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(hazard, field, value)
    db.commit()
    db.refresh(hazard)
    return hazard


def delete(hazard_id: UUID, city_id: UUID, db: Session) -> None:
    hazard = get_or_404(hazard_id, city_id, db)
    db.delete(hazard)
    db.commit()