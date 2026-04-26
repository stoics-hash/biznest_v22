# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

FastAPI + PostgreSQL (SQLAlchemy sync + PostGIS via geoalchemy2) + MinIO (object storage). JWT auth via HTTP-only cookies.

## Infrastructure

```bash
docker compose up -d
```

- PostgreSQL: `localhost:5433` (mapped from 5432), db/user/pass all `fastapi`
- MinIO: `localhost:9000` (API), `localhost:9090` (console), user `minio` / pass `minio123`
- MinIO bucket `uploads` auto-created on startup via `core/minio_client.py`

## Running the app

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Tables created via `Base.metadata.create_all` on startup. Seed (subscription plans + permissions + roles) runs every startup via `core/seed.py` (idempotent).

API docs: `http://localhost:8000/docs`

## Required ENV vars

`.env` at repo root, loaded by `python-dotenv` before any imports in `main.py`.

| Var | Required | Default |
|-----|----------|---------|
| `DATABASE_URL` | yes | — |
| `SECRET_KEY` | yes | — |
| `MINIO_ENDPOINT` | yes | — |
| `MINIO_ACCESS_KEY` | yes | — |
| `MINIO_SECRET_KEY` | yes | — |
| `ALGORITHM` | no | `HS256` |
| `ACCESS_TOKEN_EXPIRE_SECONDS` | no | `3600` |
| `JWT_COOKIE_NAME` | no | `ACCESS_TOKEN` |
| `SECURE_COOKIES` | no | `false` |
| `HUGGING_FACE_TOKEN` | scripts only | — |

All config constants read from ENV in `core/db.py`. Exception: `core/minio_client.py` uses hardcoded credentials matching docker compose defaults — update that file directly when deploying.

## Migrations (Alembic)

```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```

DB URL hardcoded in both `core/db.py` and `alembic.ini`. Prefer `create_all` for local dev; Alembic for versioned production migrations.

`create_all` does not run Alembic migrations — GIST spatial indexes and composite B-tree indexes (e.g., `idx_hazard_areas_city_type_scenario`) only exist after `alembic upgrade head`.

**PostGIS Tiger extension warning**: Alembic autogenerate will generate drop statements for ~30 Tiger geocoder extension tables. Always manually strip those from generated migrations before running. Use `sqlalchemy.inspect()` guards on all ops to handle `create_all` having already run.

## Architecture

```
main.py              # App entry: create_all, seed, router registrations
core/
  db.py              # Engine + config constants from ENV
  minio_client.py    # MinIO singleton + bucket init (hardcoded creds)
  seed.py            # Seeds subscription plans + 11 permissions + 2 roles
models/
  base.py            # Declarative Base
  __init__.py        # Imports all models — always update when adding a model
dto/                 # Pydantic request/response schemas (PascalCase filenames: UserDto.py)
routes/              # Thin route handlers — delegate entirely to services
services/            # Business logic (one file per domain)
utils/
  jwtUtils.py        # JWT creation (custom HS256), SHA256+salt password hashing, get_db
services/
  auth_service.py    # Cookie helpers, get_authenticated_user (cookie or Bearer header)
scripts/             # One-off data seeders (run manually)
boundaries/          # Local GeoJSON files for PH administrative boundaries
geo_hazard/          # Local hazard shapefiles/data
```

## Domain models

All use UUID PKs and `func.now()` server-default timestamps.

**Core**: `User`, `Document`

**Philippine administrative hierarchy**: `Region` → `Province` → `City` → `Barangay`
- All four levels have `boundary` (PostGIS `MULTIPOLYGON`, srid=4326) and `pmtile_url`
- `code` is the PSA/PSGC code at each level (adm1/adm2/adm3/adm4) — used as PMTile filename stem
- `City` also carries denormalized `province` and `region` string columns alongside the FK to `Province`
- `CityResponse` DTO includes serialized `boundary` (GeoJSON dict), `province_id`, and `pmtile_url`

**Geo / city-scoped**: `ZoningArea`, `Establishment`, `Alert` — FK `cities.id` (`ondelete="CASCADE"`)

**Province-scoped**: `HazardArea` — FK `provinces.id` (`ondelete="CASCADE"`). NOAH dataset is province-granularity; routes accept `city_id` URL param but resolve to `province_id` internally via `hazard_area_service._province_id_for_city()`.
- `ZoningArea.geometry` — PostGIS `GEOMETRY` (srid=4326)
- `HazardArea.geometry` — PostGIS `GEOMETRY` (srid=4326); also has `hazard_type` (`flood`, `landslide`, `storm_surge`, `debris_flow`, `faultline`), `scenario` (`5yr`/`25yr`/`100yr`/`ssa1`–`ssa4`, nullable for faultlines), and `pmtile_url`

**Access control**: `Permission`, `Role`, `RolePermission`, `UserRole`
- `InvestorCityAccess` — which cities an investor user can access
- `LguAssignment` — which cities an LGU admin manages

**Subscription**: `SubscriptionPlan` + `InvestorSubscription`
- `SubscriptionPlan` — `name` (unique), `max_cities` (nullable = unlimited). Seeded: `free`(1), `premium`(10), `pro`(40), `enterprise`(null).
- `InvestorSubscription` — `user_id` (unique FK), `plan_id` FK → `subscription_plans.id` (RESTRICT), optional `expires_at`. Has `plan` relationship. New users auto-subscribed to `free` plan on register.

**Utility**: `SavedLocation`, `AuditLog`

## Routes

City-scoped routes share the `/cities` prefix in `main.py` but live in separate router files:

```
/users              → routes/users.py
/files              → routes/files.py
/cities             → routes/cities.py + zoning_areas.py + establishments.py + alerts.py
/provinces          → routes/hazard_areas.py  (/{province_id}/hazards/*)
/subscriptions      → routes/investor_subscriptions.py  (GET /subscriptions/plans is public)
/lgu-assignments    → routes/lgu_assignments.py
/city-access        → routes/investor_city_access.py
/permissions        → routes/permissions.py
/roles              → routes/roles.py
/user-roles         → routes/user_roles.py
/saved-locations    → routes/saved_locations.py
/audit-logs         → routes/audit_logs.py
```

## Data seeding scripts

Run from backend root. All require docker compose running and `.env` loaded.

```bash
# Seed PH boundaries from local GeoJSON files in boundaries/
python scripts/seed_local_boundaries.py                        # all levels
python scripts/seed_local_boundaries.py --levels province city # specific levels
python scripts/seed_local_boundaries.py --skip-pmtiles         # DB only, skip tippecanoe

# Seed Project NOAH hazard maps — downloads ZIPs directly from HuggingFace,
# converts in-memory (temp dir), generates PMTiles, stores geometry to DB.
# No local GeoJSON cache. Requires provinces already seeded with geometry.
# pip install fiona geopandas requests
python scripts/seed_noah_hazards.py                                    # all hazards
python scripts/seed_noah_hazards.py --hazards flood                    # one type
python scripts/seed_noah_hazards.py --hazards flood --scenarios 100yr  # one scenario
python scripts/seed_noah_hazards.py --skip-pmtiles                     # geometry only
python scripts/seed_noah_hazards.py --province Cebu                    # debug one province
python scripts/seed_noah_hazards.py --list-files                       # inspect HF repo structure

# Seed faultlines from local geo_hazard/faultline/faultline.geojson
# (PHIVOLCS/GEM data — not from NOAH, kept in repo)
python scripts/seed_faultlines.py
python scripts/seed_faultlines.py --skip-pmtiles
```

**PMTile storage layout in MinIO**:
```
pmtiles/provinces/province-{adm2_psgc}.pmtiles
pmtiles/cities/city-{adm3_psgc}.pmtiles
pmtiles/hazards/{hazard_type}/{scenario}/province-{adm2_psgc}.pmtiles
pmtiles/hazards/faultline/all/province-{adm2_psgc}.pmtiles
```

`tippecanoe` must be installed on Linux/Mac/WSL — not available natively on Windows. Use `--skip-pmtiles` on Windows to seed geometry into DB without generating tiles.

**HazardArea geometry**: stored as individual features (one row per GeoJSON feature), not dissolved. Used for PostGIS spatial queries only (ST_Intersects, ST_Contains, ST_Within). PMTiles handle all rendering.

## Key design decisions

**Auth flow**: JWT issued on register/login via `jwtUtils.create_jwt` (custom HS256 implementation). Decoded via `python-jose`. Set as HTTP-only cookie. `auth_service.get_authenticated_user` accepts cookie (`ACCESS_TOKEN`) or `Authorization: Bearer <token>`. Checks `user.is_active` — inactive users get 403. New users auto-subscribed to `free` plan in same transaction as `UserRole` assignment (`user_service.py`).

**Permission enforcement**: Routes authenticate via `get_authenticated_user` but do NOT check role-permission graph at the route level. The seeded permissions exist for frontend consumption and future enforcement. Adding permission checks means reading `user.user_roles` → `role.role_permissions` manually in the service or as a new dependency.

**Password hashing**: Custom SHA256+salt in `jwtUtils.py`. Format: `{base64_salt}${hex_digest}`.

**DB session**: `get_db` generator lives in `utils/jwtUtils.py` (not `core/db.py`). `SessionLocal` is configured with `expire_on_commit=False` — ORM objects remain readable after `db.commit()` without a reload. Used as FastAPI dependency throughout all routes.

**DTO pattern**: All Pydantic schemas use `ConfigDict(from_attributes=True)`. Files named PascalCase (`UserDto.py`). Request/response models co-located in one DTO file per domain.

**Geometry serialization**: Geometry columns store WKB via geoalchemy2. DTOs receive raw GeoJSON dicts on input (`dict` typed field) and serialize back to GeoJSON dicts on output using `mapping(to_shape(wkb))` in a `@field_validator("field", mode="before")`. All geometry is SRID 4326.

**Service layer**: Route handlers call a single service function and return the result. All logic lives in `services/`. Services raise `HTTPException` directly (not custom exceptions).

**Audit logging**: `audit_log_service.log(user_id, city_id, action, meta, db)` — call from service functions when writes need an audit trail. `AuditLog` has no FK on `user_id`/`city_id` by design — records survive entity deletion.

**Models registration**: All models must be imported in `models/__init__.py` for `Base.metadata.create_all` and Alembic autogenerate to detect them. Import order matters for FK resolution (e.g., `SubscriptionPlan` before `InvestorSubscription`).

**File storage**: Files stored in MinIO as `{uuid}_{filename}`. `file_service.upload_file` also writes a `Document` record to DB. Only the file upload route handler is `async`.

**CORS**: Hardcoded to `http://localhost:3001` in `main.py`. Update when deploying or adding frontends.

**Seeded data** (`core/seed.py`):

Subscription plans: `free`(max 1 city), `premium`(10), `pro`(40), `enterprise`(unlimited/null)

Permission slugs:
```
city:view  zoning:read  zoning:write  hazard:read  hazard:write
establishment:read  establishment:write  alert:read  alert:write
analytics:view  location:save
```
`investor` has: `city:view`, `zoning:read`, `hazard:read`, `establishment:read`, `alert:read`, `analytics:view`, `location:save`
`lgu_admin` has all 11.

**HazardArea DTOs**: All route endpoints return `HazardAreaSummary` (no geometry — avoids large WKB over the wire). `HazardAreaResponse` (includes geometry) exists in `dto/HazardAreaDto.py` for future use. Apply same summary-vs-full pattern when adding new geo resources.

**Hazard pmtile URLs**: `get_pmtiles_by_city` returns presigned MinIO URLs with 5-hour TTL — not static paths. Frontend must re-fetch when URLs expire.