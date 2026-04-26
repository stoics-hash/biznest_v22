"""add_province_id and code in city table

Revision ID: 0552bd4c61c0
Revises: 845c085ded86
Create Date: 2026-04-22 01:55:46.635620

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0552bd4c61c0'
down_revision: Union[str, Sequence[str], None] = '845c085ded86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cities', sa.Column('code', sa.String(length=50), nullable=True))
    op.add_column('cities', sa.Column('province_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_cities_province_id',
        'cities', 'provinces',
        ['province_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_cities_province_id', 'cities', type_='foreignkey')
    op.drop_column('cities', 'province_id')
    op.drop_column('cities', 'code')