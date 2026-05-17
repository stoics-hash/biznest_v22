from sqlalchemy.orm import Session
from sqlalchemy import distinct

from models.city import City
from models.zoning_area import ZoningArea
from models.hazard_area import HazardArea


class AnalyzeRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_city(self, city_id: str) -> City | None:
        return self.db.query(City).filter(City.id == city_id).first()

    def get_zone_types(self, city_id: str) -> list[str]:
        rows = (
            self.db.query(distinct(ZoningArea.zone_type))
            .filter(ZoningArea.city_id == city_id, ZoningArea.zone_type.isnot(None))
            .all()
        )
        return [r[0] for r in rows if r[0]]

    def get_hazard_summary(self, city_id: str) -> list[dict]:
        rows = (
            self.db.query(distinct(HazardArea.hazard_type), HazardArea.scenario)
            .filter(HazardArea.city_id == city_id)
            .all()
        )
        seen: dict[str, set] = {}
        for hazard_type, scenario in rows:
            seen.setdefault(hazard_type, set())
            if scenario:
                seen[hazard_type].add(scenario)
        return [
            {"hazard_type": ht, "scenarios": sorted(sc)}
            for ht, sc in seen.items()
        ]