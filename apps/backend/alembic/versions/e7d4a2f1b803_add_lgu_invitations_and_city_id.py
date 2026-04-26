"""add lgu_invitations table and city_id column

Revision ID: e7d4a2f1b803
Revises: 976a934d2705
Create Date: 2026-04-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = 'e7d4a2f1b803'
down_revision: Union[str, Sequence[str], None] = '976a934d2705'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = inspect(bind).get_table_names()

    if 'lgu_invitations' not in existing_tables:
        op.create_table(
            'lgu_invitations',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('token', sa.String(length=255), nullable=False),
            sa.Column('city_id', sa.UUID(), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_by_id', sa.UUID(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['city_id'], ['cities.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('token'),
        )
        op.create_index('ix_lgu_invitations_email', 'lgu_invitations', ['email'])
        op.create_index('ix_lgu_invitations_token', 'lgu_invitations', ['token'])
        return

    # Table already exists (created via create_all) — add city_id if missing
    existing_cols = {c['name'] for c in inspect(bind).get_columns('lgu_invitations')}

    if 'city_id' not in existing_cols:
        op.add_column('lgu_invitations', sa.Column('city_id', sa.UUID(), nullable=True))
        op.create_foreign_key(
            'fk_lgu_invitations_city_id',
            'lgu_invitations', 'cities',
            ['city_id'], ['id'],
            ondelete='CASCADE',
        )
        # Safe to enforce NOT NULL — table is new and should have no rows.
        op.alter_column('lgu_invitations', 'city_id', nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    existing_tables = inspect(bind).get_table_names()

    if 'lgu_invitations' not in existing_tables:
        return

    existing_cols = {c['name'] for c in inspect(bind).get_columns('lgu_invitations')}

    if 'city_id' in existing_cols:
        existing_fks = {fk['name'] for fk in inspect(bind).get_foreign_keys('lgu_invitations')}
        if 'fk_lgu_invitations_city_id' in existing_fks:
            op.drop_constraint('fk_lgu_invitations_city_id', 'lgu_invitations', type_='foreignkey')
        op.drop_column('lgu_invitations', 'city_id')