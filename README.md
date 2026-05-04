# BizNest v2

Geo-intelligence platform for Philippine city investment analysis. Multi-tenant, role-based: Investor users browse hazard maps, zoning areas, and establishments per city; LGU admins manage data for their assigned city.

**Stack**: pnpm workspaces + Turborepo · React 19 + TanStack Router · FastAPI + PostgreSQL/PostGIS + MinIO

---

## Repository structure

```
apps/
  frontend/          React 19 + Vite + TanStack Router + MapLibre GL
  backend/           FastAPI + SQLAlchemy + PostGIS + MinIO
packages/
  api/               Auto-generated React Query + Axios client (Orval)
```

---

## Prerequisites

- Node.js ≥ 20 + pnpm ≥ 10
- Python ≥ 3.11
- Docker Desktop (for PostgreSQL/PostGIS and MinIO)
- WSL2 (required for PMTile generation with tippecanoe — see [Tippecanoe Setup](#tippecanoe-setup-wsl2))

---

## Frontend setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Create `apps/frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_MAPTILER_KEY=your_maptiler_api_key
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_LGU_REGISTER_TOKEN=change-me-in-production
```

### 3. Start dev server

```bash
pnpm -F frontend dev
# → http://localhost:3001
```

### 4. Build for production

```bash
pnpm -F frontend build      # runs tsc + vite build
```

### 5. Lint

```bash
pnpm -F frontend lint
```

### 6. Regenerate API client

Run this after any backend route or schema change. The backend must be running.

```bash
pnpm generate:api
```

This pulls `http://localhost:8000/openapi.json` via Orval and writes React Query hooks + TypeScript types into `packages/api/generated/`.

---

## Backend setup

### 1. Start infrastructure

```bash
cd apps/backend
docker compose up -d
```

Services started:

| Service | Host port | Credentials |
|---------|-----------|-------------|
| PostgreSQL (PostGIS) | `localhost:5433` | db/user/pass: `fastapi` |
| MinIO S3 API | `localhost:9000` | `minio` / `minio123` |
| MinIO console | `localhost:9090` | `minio` / `minio123` |

The `uploads` bucket is created automatically on first startup.

### 2. Create Python environment

```bash
cd apps/backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux/WSL
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure environment

Create `.env` at `apps/backend/.env` (or repo root — python-dotenv searches upward):

```env
# Required
DATABASE_URL=postgresql+pg8000://fastapi:fastapi@localhost:5433/fastapi
SECRET_KEY=your-secret-key-here
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123

# Optional — defaults shown
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_SECONDS=900
REFRESH_TOKEN_EXPIRE_SECONDS=604800
JWT_COOKIE_NAME=ACCESS_TOKEN
REFRESH_COOKIE_NAME=REFRESH_TOKEN
SECURE_COOKIES=false
FRONTEND_URL=http://localhost:3001
LGU_INVITE_EXPIRE_HOURS=24

# Email — LGU invites silently disabled when unset
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# Seed scripts only
HUGGING_FACE_TOKEN=your_hf_token
```

### 4. Run the server

```bash
uvicorn main:app --reload
# → http://localhost:8000/docs
```

Tables are created via `Base.metadata.create_all` on startup. Seed data (subscription plans, permissions, roles) runs automatically and is idempotent.

---

## Database migrations (Alembic)

> **Note**: `create_all` on startup handles local dev. Use Alembic for versioned production migrations. Spatial indexes (`GIST`, composite B-tree) only exist after `alembic upgrade head` — `create_all` does not create them.

All commands run from `apps/backend/`.

### Apply all pending migrations

```bash
alembic upgrade head
```

### Create a new migration

```bash
alembic revision --autogenerate -m "describe your change"
```

> **Warning — Tiger geocoder tables**: PostGIS installs ~30 Tiger geocoder extension tables. Alembic autogenerate will include `drop_table` statements for all of them in every generated migration. **Always open the generated file and delete those drop_table calls before running the migration.** Look for tables like `tiger.*`, `topology.*`, `address_standardizer*`, etc.

### Inspect migration history

```bash
alembic history --verbose
alembic current
```

### Migration chain (in order)

1. `72292349d3c0` — initial full schema
2. `845c085ded86` — geo admin hierarchy (Region → Province → City → Barangay with PostGIS boundaries)
3. `0552bd4c61c0` — add `province_id` + `code` to City
4. `976a934d2705` — subscription plans
5. `c3f7a1d2e890` — hazard scenario + `pmtile_url`
6. `d3e7f1a4b8c2` — spatial GIST indexes + composite B-tree indexes
7. `f4e2a1c9b7d3` — hazard areas province-scoped
8. `b1c4d7e2f903` — drop hazard severity column
9. `e7d4a2f1b803` — LGU invitations + city_id
10. `a2f4c8e1d509` — refresh tokens
11. `7a8b9c0d1e2f` — `pmtile_url` on zoning areas

---

## Tippecanoe setup (WSL2)

Tippecanoe converts GeoJSON/shapefiles into PMTiles. It only runs on Linux/macOS — **not natively on Windows**. Use WSL2.

### 1. Install WSL2 (if not already)

Run in PowerShell as Administrator:

```powershell
wsl --install
# Restart, then set up a Linux user
```

Verify:

```powershell
wsl --list --verbose
# Should show a distro with VERSION 2
```

### 2. Install tippecanoe in WSL2

```bash
# Open WSL terminal, then:
sudo apt update && sudo apt install -y build-essential libsqlite3-dev zlib1g-dev

# Clone and build
git clone https://github.com/felt/tippecanoe.git
cd tippecanoe
make -j$(nproc)
sudo make install

# Verify
tippecanoe --version
```

### 3. Confirm tippecanoe is on PATH in WSL

The seed scripts call `tippecanoe` via `subprocess`. Make sure it resolves:

```bash
which tippecanoe
# Should print: /usr/local/bin/tippecanoe
```

### 4. Run seed scripts from WSL

The scripts must be run **inside WSL** (not from Windows PowerShell/CMD) when PMTile generation is needed. Mount your Windows project path:

```bash
# Your Windows repo at E:\Dev\monorepo projects\biznest_v2
# is available in WSL at:
cd /mnt/e/Dev/monorepo\ projects/biznest_v2/apps/backend

# Activate your Python venv (create one in WSL if needed)
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run scripts from WSL
python scripts/seed_local_boundaries.py
```

> **Windows-only fallback**: Add `--skip-pmtiles` to any seeder to write geometry to the database without generating PMTiles. PMTile generation can be deferred and run later from WSL.

---

## Data seeding (PMTiles)

All seed scripts run from `apps/backend/` with the venv activated. Docker Compose must be running.

Seeding order matters: **boundaries → hazards → faultlines**.

### Step 1 — Seed Philippine administrative boundaries

Reads local GeoJSON files from `boundaries/` (included in repo). Seeds Regions, Provinces, Cities, and Barangays. Generates one PMTile per Province and per City.

```bash
# Seed all levels (region → province → city → barangay) + generate PMTiles
python scripts/seed_local_boundaries.py

# Seed only specific levels
python scripts/seed_local_boundaries.py --levels province city

# DB only — skip tippecanoe (use on Windows)
python scripts/seed_local_boundaries.py --skip-pmtiles
```

**PMTile output paths in MinIO**:
```
pmtiles/provinces/province-{adm2_psgc}.pmtiles
pmtiles/cities/city-{adm3_psgc}.pmtiles
```

### Step 2 — Seed Project NOAH hazard maps

Downloads shapefiles directly from HuggingFace (private dataset — requires `HUGGING_FACE_TOKEN`), converts to GeoJSON in a temp directory, generates PMTiles, and stores geometry to DB. Provinces must be seeded first.

```bash
# Seed all hazard types and scenarios
python scripts/seed_noah_hazards.py

# Seed a specific hazard type
python scripts/seed_noah_hazards.py --hazards flood

# Seed a specific hazard + scenario
python scripts/seed_noah_hazards.py --hazards flood --scenarios 100yr

# DB only — skip PMTile generation
python scripts/seed_noah_hazards.py --skip-pmtiles

# Debug a single province
python scripts/seed_noah_hazards.py --province Cebu

# Use multiple workers (default: cpu_count)
python scripts/seed_noah_hazards.py --workers 4

# Force re-download of already-processed files
python scripts/seed_noah_hazards.py --force

# Inspect HuggingFace repo file structure
python scripts/seed_noah_hazards.py --list-files
```

Available `--hazards` values: `flood`, `landslide`, `debris_flow`, `storm_surge`

Available `--scenarios` values: `5yr`, `25yr`, `100yr`, `ssa1`, `ssa2`, `ssa3`, `ssa4`

**PMTile output paths in MinIO**:
```
pmtiles/hazards/{hazard_type}/{scenario}/province-{adm2_psgc}.pmtiles
pmtiles/hazards/faultline/all/province-{adm2_psgc}.pmtiles
```

### Step 3 — Seed faultlines

Reads `geo_hazard/faultline/faultline.geojson` (PHIVOLCS/GEM data, included in repo). Spatial-joins fault lines to province boundaries and generates one PMTile per province.

```bash
# Seed faultlines + generate PMTiles
python scripts/seed_faultlines.py

# DB only — skip PMTile generation
python scripts/seed_faultlines.py --skip-pmtiles
```

---

## Running all apps together

```bash
# From repo root
pnpm install
pnpm turbo dev
```

This starts frontend (`:3001`) and backend (`:8000`) in parallel via Turborepo.

---

## Roles and permissions

Three roles are seeded automatically on backend startup:

| Role | Permissions |
|------|------------|
| `investor` | `zoning:read`, `hazard:read`, `establishment:read`, `alert:read`, `analytics:view`, `location:save` |
| `lgu_admin` | All investor perms + `manage:city`, `zoning:write`, `hazard:write`, `establishment:write`, `alert:write` |
| `admin` | All lgu_admin perms + `manage:user`, `manage:role` |

Subscription plans seeded: `free` (1 city), `premium` (10), `pro` (40), `enterprise` (unlimited). New users auto-enroll in `free` on registration.