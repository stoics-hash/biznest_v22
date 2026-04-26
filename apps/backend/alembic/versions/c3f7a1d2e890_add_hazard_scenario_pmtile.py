"""add hazard scenario and pmtile_url

Revision ID: c3f7a1d2e890
Revises: 845c085ded86
Create Date: 2026-04-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c3f7a1d2e890'
down_revision: Union[str, Sequence[str], None] = '0552bd4c61c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('hazard_areas', sa.Column('scenario', sa.String(50), nullable=True))
    op.add_column('hazard_areas', sa.Column('pmtile_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('hazard_areas', 'pmtile_url')
    op.drop_column('hazard_areas', 'scenario')