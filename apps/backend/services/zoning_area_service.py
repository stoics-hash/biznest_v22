from uuid import UUID

from fastapi import HTTPException
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping
from sqlalchemy.orm import Session

from dto.ZoningAreaDto import (
    ZoningAreaCreate,
    ZoningAreaResponse,
    ZoningAreaUpdate,
    ZoningImageProcessRequest,
    ZoningProcessResponse,
)
from models.city import City
from models.zoning_area import ZoningArea
from services import geo_processing_service as gps


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


def process_zoning_image(
    city_id: UUID,
    payload: ZoningImageProcessRequest,
    user_id: UUID,
    db: Session,
) -> ZoningProcessResponse:
    """
    Full pipeline:
      image → K-means segmentation → contour detection → OCR label assignment
      → homography transform (pixel→geo) → ZoningArea records → PMTiles
    """
    if not db.query(City).filter(City.id == city_id).first():
        raise HTTPException(status_code=404, detail="City not found")

    if len(payload.gcps) < 4:
        raise HTTPException(status_code=422, detail="At least 4 ground control points required")

    # Load image from MinIO
    try:
        image_bytes, image_bgr = gps.load_image_from_minio(payload.file_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Compute pixel→geo homography
    try:
        H = gps.compute_homography(payload.gcps)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # K-means color segmentation
    label_map, centers_rgb = gps.segment_by_color(image_bgr, payload.n_colors)

    # Extract contours per color cluster (skip white/black background clusters)
    contours_with_colors = gps.get_zone_contours(
        label_map, payload.n_colors, payload.min_area_px, centers_rgb
    )

    if not contours_with_colors:
        raise HTTPException(
            status_code=422,
            detail="No colored zones detected. Try increasing n_colors or decreasing min_area_px.",
        )

    # OCR — assign zone labels (falls back to [] on API failure)
    ocr_results = gps.run_ocr(image_bytes)
    labels = gps.assign_labels(contours_with_colors, ocr_results)

    # Vectorize contours → geo polygons → ZoningArea records
    created_zones: list[tuple[ZoningArea, object]] = []  # (db record, shapely poly)
    skipped = 0

    for (contour, color_rgb), zone_type in zip(contours_with_colors, labels):
        poly = gps.contour_to_geo_polygon(contour, H)
        if poly is None:
            skipped += 1
            continue
        zone = ZoningArea(
            city_id=city_id,
            zone_type=zone_type,
            geometry=from_shape(poly, srid=4326),
            created_by=user_id,
        )
        db.add(zone)
        created_zones.append((zone, poly))

    if not created_zones:
        raise HTTPException(
            status_code=422,
            detail="All detected zones failed geometry validation. Check GCP accuracy.",
        )

    db.commit()
    for zone, _ in created_zones:
        db.refresh(zone)

    # Build GeoJSON from ALL city zones (newly created + existing) for PMTile
    all_city_zones = (
        db.query(ZoningArea)
        .filter(ZoningArea.city_id == city_id, ZoningArea.geometry.isnot(None))
        .all()
    )
    features = []
    for z in all_city_zones:
        try:
            features.append({
                "type": "Feature",
                "properties": {"zone_type": z.zone_type},
                "geometry": mapping(to_shape(z.geometry)),
            })
        except Exception:
            continue

    pmtile_url = gps.generate_pmtiles(
        {"type": "FeatureCollection", "features": features},
        city_id,
    )

    # Build response using Shapely polygons we already have (avoids WKB round-trip)
    zone_responses = [
        ZoningAreaResponse(
            id=zone.id,
            city_id=zone.city_id,
            zone_type=zone.zone_type,
            geometry=dict(mapping(poly)),
            created_by=zone.created_by,
            created_at=zone.created_at,
        )
        for zone, poly in created_zones
    ]

    return ZoningProcessResponse(
        zones_created=len(created_zones),
        skipped_zones=skipped,
        pmtile_url=pmtile_url,
        zones=zone_responses,
    )