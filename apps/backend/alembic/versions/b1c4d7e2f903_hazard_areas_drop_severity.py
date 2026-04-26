"""hazard_areas: drop severity column

Revision ID: b1c4d7e2f903
Revises: f4e2a1c9b7d3
Create Date: 2026-04-24 00:00:00.000000

NOAH data is no longer split by severity level.
Each (province, hazard_type, scenario) is now one row containing the full
dissolved geometry. Wipes all existing hazard_areas rows — re-run
seed_noah_hazards.py after.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b1c4d7e2f903"
down_revision: Union[str, None] = "f4e2a1c9b7d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Wipe rows first — geometry semantics changed (no severity split)
    op.execute("DELETE FROM hazard_areas")

    # Drop old composite index that referenced severity (may not exist on all installs)
    op.drop_index(
        "idx_hazard_areas_hazard_type_severity_scenario",
        table_name="hazard_areas",
        if_exists=True,
    )

    # Drop severity column
    op.drop_column("hazard_areas", "severity")

    # Add replacement index without severity
    op.create_index(
        "idx_hazard_areas_hazard_type_scenario",
        "hazard_areas",
        ["hazard_type", "scenario"],
    )


def downgrade() -> None:
    op.drop_index("idx_hazard_areas_hazard_type_scenario", table_name="hazard_areas")
    op.add_column(
        "hazard_areas",
        sa.Column("severity", sa.String(50), nullable=True),
    )
    op.create_index(
        "idx_hazard_areas_hazard_type_severity_scenario",
        "hazard_areas",
        ["hazard_type", "severity", "scenario"],
    )