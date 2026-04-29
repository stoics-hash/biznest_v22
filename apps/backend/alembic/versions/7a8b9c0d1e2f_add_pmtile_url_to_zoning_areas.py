"""add pmtile_url to zoning_areas

Revision ID: 7a8b9c0d1e2f
Revises: f4e2a1c9b7d3
Create Date: 2026-04-29 00:00:00.000000

Stores the MinIO object key for the city-level zoning PMTile on each ZoningArea row.
All zones in a city share the same object key (updated together on every process-image run).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision: str = "7a8b9c0d1e2f"
down_revision: Union[str, Sequence[str], None] = "f4e2a1c9b7d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = Inspector.from_engine(op.get_bind())
    existing = {col["name"] for col in insp.get_columns("zoning_areas")}
    if "pmtile_url" not in existing:
        op.add_column(
            "zoning_areas",
            sa.Column("pmtile_url", sa.String(500), nullable=True),
        )


def downgrade() -> None:
    insp = Inspector.from_engine(op.get_bind())
    existing = {col["name"] for col in insp.get_columns("zoning_areas")}
    if "pmtile_url" in existing:
        op.drop_column("zoning_areas", "pmtile_url")