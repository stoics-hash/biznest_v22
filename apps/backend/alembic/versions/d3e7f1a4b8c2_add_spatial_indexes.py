"""add spatial indexes to all geometry columns

Revision ID: d3e7f1a4b8c2
Revises: c3f7a1d2e890
Create Date: 2026-04-22 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'd3e7f1a4b8c2'
down_revision: Union[str, Sequence[str], None] = 'c3f7a1d2e890'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # GIST spatial indices — enable PostGIS ST_Intersects / ST_Within etc. to use index scans
    op.execute("CREATE INDEX idx_regions_boundary ON regions USING GIST (boundary)")
    op.execute("CREATE INDEX idx_provinces_boundary ON provinces USING GIST (boundary)")
    op.execute("CREATE INDEX idx_cities_boundary ON cities USING GIST (boundary)")
    op.execute("CREATE INDEX idx_barangays_boundary ON barangays USING GIST (boundary)")
    op.execute("CREATE INDEX idx_hazard_areas_geometry ON hazard_areas USING GIST (geometry)")
    op.execute("CREATE INDEX idx_zoning_areas_geometry ON zoning_areas USING GIST (geometry)")
    op.execute("CREATE INDEX idx_establishments_location ON establishments USING GIST (location)")
    op.execute("CREATE INDEX idx_saved_locations_location ON saved_locations USING GIST (location)")

    # Composite B-tree index for the hazard seeder prefetch query:
    # WHERE city_id IN (...) AND hazard_type = ? AND scenario = ?
    op.execute(
        "CREATE INDEX idx_hazard_areas_city_type_scenario "
        "ON hazard_areas (city_id, hazard_type, scenario)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_hazard_areas_city_type_scenario")
    op.execute("DROP INDEX IF EXISTS idx_saved_locations_location")
    op.execute("DROP INDEX IF EXISTS idx_establishments_location")
    op.execute("DROP INDEX IF EXISTS idx_zoning_areas_geometry")
    op.execute("DROP INDEX IF EXISTS idx_hazard_areas_geometry")
    op.execute("DROP INDEX IF EXISTS idx_barangays_boundary")
    op.execute("DROP INDEX IF EXISTS idx_cities_boundary")
    op.execute("DROP INDEX IF EXISTS idx_provinces_boundary")
    op.execute("DROP INDEX IF EXISTS idx_regions_boundary")