"""
Geo-processing pipeline for zoning image analysis:
  1. K-means color segmentation → zone regions
  2. OpenCV contour detection → polygon boundaries
  3. Projective transform (homography) → pixel coords to geographic coords
  4. Google Vision OCR → zone label extraction
  5. Tippecanoe → PMTiles for MapLibre rendering
"""
from __future__ import annotations

import io
import json
import subprocess
import tempfile
from datetime import timedelta
from pathlib import Path
from uuid import UUID

import cv2
import numpy as np
from minio.error import S3Error
from shapely.geometry import Polygon, mapping
from shapely.validation import make_valid
from sklearn.cluster import KMeans

from core.minio_client import minio_client, BUCKET_NAME

_ZONING_PMTILE_PREFIX = "pmtiles/zoning"
_PMTILE_PRESIGN_HOURS = 5
_WHITE_THRESHOLD = 230
_BLACK_THRESHOLD = 30


# ---------------------------------------------------------------------------
# Image loading
# ---------------------------------------------------------------------------

def load_image_from_minio(file_id: str) -> tuple[bytes, np.ndarray]:
    """
    Download image from MinIO and decode with OpenCV.
    Returns (raw_bytes, BGR ndarray).
    raw_bytes passed to Vision API; ndarray used for CV operations.
    """
    try:
        obj = minio_client.get_object(BUCKET_NAME, file_id)
        raw = obj.read()
        obj.close()
        obj.release_conn()
    except S3Error as exc:
        raise ValueError(f"Image not found in storage: {file_id}") from exc

    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Cannot decode image (unsupported format): {file_id}")
    return raw, img


# ---------------------------------------------------------------------------
# Georeferencing — pixel ↔ geographic coordinate transform
# ---------------------------------------------------------------------------

def compute_homography(gcps: list) -> np.ndarray:
    """
    Compute pixel→geo homography from ≥4 ground control points.
    gcps: objects with .pixel_x, .pixel_y, .longitude, .latitude
    Returns 3×3 H such that: [lng, lat, w] = H @ [px, py, 1]
    """
    src = np.array([[g.pixel_x, g.pixel_y] for g in gcps], dtype=np.float64)
    dst = np.array([[g.longitude, g.latitude] for g in gcps], dtype=np.float64)
    H, _ = cv2.findHomography(src, dst, method=0)
    if H is None:
        raise ValueError(
            "Cannot compute homography — GCPs may be collinear or degenerate"
        )
    return H


def transform_pixels_to_geo(pixel_pts: np.ndarray, H: np.ndarray) -> np.ndarray:
    """(N, 2) pixel [col, row] → (N, 2) geographic [lng, lat]."""
    pts = pixel_pts.reshape(-1, 1, 2).astype(np.float64)
    return cv2.perspectiveTransform(pts, H).reshape(-1, 2)


# ---------------------------------------------------------------------------
# Color segmentation — K-means
# ---------------------------------------------------------------------------

def segment_by_color(
    image_bgr: np.ndarray, n_colors: int = 8
) -> tuple[np.ndarray, np.ndarray]:
    """
    K-means clustering on pixel colors.
    Fits on a ≤600px thumbnail for speed; predicts at full resolution.
    Returns (label_map H×W int32, cluster_centers N×3 uint8 RGB).
    """
    img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    h, w = img_rgb.shape[:2]

    scale = min(1.0, 600.0 / max(h, w, 1))
    small = cv2.resize(img_rgb, (max(1, int(w * scale)), max(1, int(h * scale))))

    km = KMeans(n_clusters=n_colors, random_state=42, n_init=10, max_iter=300)
    km.fit(small.reshape(-1, 3).astype(np.float32))

    labels = km.predict(img_rgb.reshape(-1, 3).astype(np.float32))
    centers = km.cluster_centers_.astype(np.uint8)  # RGB
    return labels.reshape(h, w).astype(np.int32), centers


def _is_near_white(rgb: np.ndarray) -> bool:
    return bool(np.all(rgb >= _WHITE_THRESHOLD))


def _is_near_black(rgb: np.ndarray) -> bool:
    return bool(np.all(rgb <= _BLACK_THRESHOLD))


# ---------------------------------------------------------------------------
# Contour detection
# ---------------------------------------------------------------------------

def get_zone_contours(
    label_map: np.ndarray,
    n_colors: int,
    min_area_px: int,
    centers_rgb: np.ndarray,
) -> list[tuple[np.ndarray, np.ndarray]]:
    """
    For each non-white, non-black cluster extract cleaned contours.
    Returns list of (contour_array, color_rgb_uint8).
    Morphological close+open removes noise and fills small gaps.
    """
    results: list[tuple[np.ndarray, np.ndarray]] = []
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

    for idx in range(n_colors):
        color = centers_rgb[idx]
        if _is_near_white(color) or _is_near_black(color):
            continue

        mask = ((label_map == idx) * 255).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            if cv2.contourArea(c) >= min_area_px:
                results.append((c, color))

    return results


# ---------------------------------------------------------------------------
# OCR — Google Vision API
# ---------------------------------------------------------------------------

def run_ocr(image_bytes: bytes) -> list[dict]:
    """
    Detect text with Google Vision (uses ADC — gcloud auth application-default login).
    Returns [{text, cx, cy}] in pixel coordinates.
    Falls back to [] on any error so the pipeline can continue without labels.
    """
    try:
        from google.cloud import vision  # deferred — optional dependency

        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.text_detection(image=image)

        if response.error.message:
            return []

        results = []
        for ann in response.text_annotations[1:]:  # [0] is full-page text, skip
            verts = ann.bounding_poly.vertices
            if not verts:
                continue
            text = ann.description.strip().upper()
            if len(text) < 2:
                continue
            xs = [v.x for v in verts]
            ys = [v.y for v in verts]
            results.append({
                "text": text,
                "cx": sum(xs) / len(xs),
                "cy": sum(ys) / len(ys),
            })
        return results
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Label assignment — OCR centroids → zones
# ---------------------------------------------------------------------------

def assign_labels(
    contours_with_colors: list[tuple[np.ndarray, np.ndarray]],
    ocr_results: list[dict],
) -> list[str | None]:
    """
    Point-in-polygon test: if an OCR text centroid falls inside a contour,
    assign that text as the zone label. Multiple texts are space-joined.
    """
    labels: list[str | None] = []
    for contour, _ in contours_with_colors:
        texts = []
        for ocr in ocr_results:
            pt = (float(ocr["cx"]), float(ocr["cy"]))
            if cv2.pointPolygonTest(contour, pt, False) >= 0:
                texts.append(ocr["text"])
        labels.append(" ".join(texts) if texts else None)
    return labels


# ---------------------------------------------------------------------------
# Vectorization — contour → geo polygon
# ---------------------------------------------------------------------------

def contour_to_geo_polygon(contour: np.ndarray, H: np.ndarray) -> Polygon | None:
    """
    Approximate contour with Douglas-Peucker, transform pixel→geo, build Shapely Polygon.
    epsilon_factor=0.002 balances detail vs vertex count.
    """
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.002 * peri, True)
    pixel_pts = approx.reshape(-1, 2).astype(np.float64)

    if len(pixel_pts) < 3:
        return None

    geo_pts = transform_pixels_to_geo(pixel_pts, H)

    try:
        poly = Polygon(geo_pts)
        if not poly.is_valid:
            poly = make_valid(poly)
        # make_valid may produce MultiPolygon — take largest piece
        if poly.geom_type != "Polygon":
            parts = list(poly.geoms) if hasattr(poly, "geoms") else []
            poly = max(parts, key=lambda p: p.area) if parts else None
        if poly is None or poly.is_empty or poly.area < 1e-14:
            return None
        return poly
    except Exception:
        return None


# ---------------------------------------------------------------------------
# PMTile generation
# ---------------------------------------------------------------------------

def generate_pmtiles(geojson: dict, city_id: UUID) -> str | None:
    """
    Write GeoJSON to temp file → tippecanoe → upload to MinIO.
    Returns presigned URL (5 h TTL) or None if tippecanoe unavailable.
    Overwrites any existing zoning PMTile for this city.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        geojson_path = Path(tmpdir) / "zones.geojson"
        pmtile_path = Path(tmpdir) / "zones.pmtiles"
        geojson_path.write_text(json.dumps(geojson), encoding="utf-8")

        try:
            result = subprocess.run(
                [
                    "tippecanoe",
                    "-o", str(pmtile_path),
                    "--force",
                    "--minimum-zoom=8",
                    "--maximum-zoom=18",
                    "--generate-ids",
                    "--no-tile-stats",
                    str(geojson_path),
                ],
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            return None  # tippecanoe not installed (Windows native)

        if result.returncode != 0 or not pmtile_path.exists():
            return None

        object_key = f"{_ZONING_PMTILE_PREFIX}/city-{city_id}.pmtiles"
        pmtile_bytes = pmtile_path.read_bytes()
        minio_client.put_object(
            BUCKET_NAME,
            object_key,
            data=io.BytesIO(pmtile_bytes),
            length=len(pmtile_bytes),
            content_type="application/octet-stream",
        )

    return minio_client.presigned_get_object(
        BUCKET_NAME,
        object_key,
        expires=timedelta(hours=_PMTILE_PRESIGN_HOURS),
    )