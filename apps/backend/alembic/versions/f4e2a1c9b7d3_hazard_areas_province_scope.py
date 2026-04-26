"""hazard_areas: replace city_id with province_id

Revision ID: f4e2a1c9b7d3
Revises: d3e7f1a4b8c2
Create Date: 2026-04-23 00:00:00.000000

Hazard data is province-scoped (NOAH shapefiles carry no city reference).
Wipes all existing hazard_areas rows — re-run seed_noah_hazards.py after.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f4e2a1c9b7d3'
down_revision: Union[str, Sequence[str], None] = 'd3e7f1a4b8c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Wipe seeder-managed data — city_id values are now invalid.
    # Re-run scripts/seed_noah_hazards.py after this migration.
    op.execute("DELETE FROM hazard_areas")

    # Drop old city-scoped composite index (created in d3e7f1a4b8c2)
    op.execute("DROP INDEX IF EXISTS idx_hazard_areas_city_type_scenario")

    # Drop old B-tree index on city_id (created via __table_args__ in original model)
    op.execute("DROP INDEX IF EXISTS idx_hazard_areas_city_id")

    # Drop FK constraint then the column
    op.drop_constraint("hazard_areas_city_id_fkey", "hazard_areas", type_="foreignkey")
    op.drop_column("hazard_areas", "city_id")

    # Add province_id
    op.add_column(
        "hazard_areas",
        sa.Column(
            "province_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),  # temp default so NOT NULL passes on empty table
        ),
    )
    op.alter_column("hazard_areas", "province_id", server_default=None)

    op.create_foreign_key(
        "hazard_areas_province_id_fkey",
        "hazard_areas", "provinces",
        ["province_id"], ["id"],
        ondelete="CASCADE",
    )

    # New B-tree index on province_id
    op.execute(
        "CREATE INDEX idx_hazard_areas_province_id ON hazard_areas (province_id)"
    )

    # Replace city-scoped composite index with province-scoped equivalent
    op.execute(
        "CREATE INDEX idx_hazard_areas_province_type_scenario "
        "ON hazard_areas (province_id, hazard_type, scenario)"
    )


def downgrade() -> None:
    op.execute("DELETE FROM hazard_areas")

    op.execute("DROP INDEX IF EXISTS idx_hazard_areas_province_type_scenario")
    op.execute("DROP INDEX IF EXISTS idx_hazard_areas_province_id")

    op.drop_constraint("hazard_areas_province_id_fkey", "hazard_areas", type_="foreignkey")
    op.drop_column("hazard_areas", "province_id")

    op.add_column(
        "hazard_areas",
        sa.Column(
            "city_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
    )
    op.alter_column("hazard_areas", "city_id", server_default=None)

    op.create_foreign_key(
        "hazard_areas_city_id_fkey",
        "hazard_areas", "cities",
        ["city_id"], ["id"],
        ondelete="CASCADE",
    )

    op.execute(
        "CREATE INDEX idx_hazard_areas_city_id ON hazard_areas (city_id)"
    )
    op.execute(
        "CREATE INDEX idx_hazard_areas_city_type_scenario "
        "ON hazard_areas (city_id, hazard_type, scenario)"
    )