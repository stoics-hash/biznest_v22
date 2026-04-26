"""add subscription plan

Revision ID: 976a934d2705
Revises: b1c4d7e2f903
Create Date: 2026-04-26 14:18:35.783901

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '976a934d2705'
down_revision: Union[str, Sequence[str], None] = 'b1c4d7e2f903'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing_tables = inspect(bind).get_table_names()

    if 'subscription_plans' not in existing_tables:
        op.create_table(
            'subscription_plans',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('name', sa.String(length=50), nullable=False),
            sa.Column('max_cities', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name'),
        )

    # investor_subscriptions: swap plan/max_cities columns for plan_id FK
    existing_cols = {c['name'] for c in inspect(bind).get_columns('investor_subscriptions')}
    if 'plan_id' not in existing_cols:
        op.add_column('investor_subscriptions', sa.Column('plan_id', sa.UUID(), nullable=True))
        op.create_foreign_key(
            'fk_investor_subscriptions_plan_id',
            'investor_subscriptions', 'subscription_plans',
            ['plan_id'], ['id'],
            ondelete='RESTRICT',
        )
    if 'max_cities' in existing_cols:
        op.drop_column('investor_subscriptions', 'max_cities')
    if 'plan' in existing_cols:
        op.drop_column('investor_subscriptions', 'plan')

    op.alter_column('investor_subscriptions', 'plan_id', nullable=False)

    # indexes
    existing_indexes = {i['name'] for i in inspect(bind).get_indexes('hazard_areas')}
    if 'idx_hazard_areas_province_type_scenario' in existing_indexes:
        op.drop_index('idx_hazard_areas_province_type_scenario', table_name='hazard_areas')
    if 'idx_hazard_areas_hazard_type' not in existing_indexes:
        op.create_index('idx_hazard_areas_hazard_type', 'hazard_areas', ['hazard_type'], unique=False)

    sl_indexes = {i['name'] for i in inspect(bind).get_indexes('saved_locations')}
    if 'idx_name' not in sl_indexes:
        op.create_index('idx_name', 'saved_locations', ['name'], unique=False)
    if 'idx_saved_locations_city_id' not in sl_indexes:
        op.create_index('idx_saved_locations_city_id', 'saved_locations', ['city_id'], unique=False)
    if 'idx_saved_locations_user_id' not in sl_indexes:
        op.create_index('idx_saved_locations_user_id', 'saved_locations', ['user_id'], unique=False)

    za_indexes = {i['name'] for i in inspect(bind).get_indexes('zoning_areas')}
    if 'idx_zoning_areas_city_id' not in za_indexes:
        op.create_index('idx_zoning_areas_city_id', 'zoning_areas', ['city_id'], unique=False)
    if 'idx_zoning_areas_zone_type' not in za_indexes:
        op.create_index('idx_zoning_areas_zone_type', 'zoning_areas', ['zone_type'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_zoning_areas_zone_type', table_name='zoning_areas')
    op.drop_index('idx_zoning_areas_city_id', table_name='zoning_areas')
    op.drop_index('idx_saved_locations_user_id', table_name='saved_locations')
    op.drop_index('idx_saved_locations_city_id', table_name='saved_locations')
    op.drop_index('idx_name', table_name='saved_locations')
    op.drop_index('idx_hazard_areas_hazard_type', table_name='hazard_areas')
    op.create_index('idx_hazard_areas_province_type_scenario', 'hazard_areas', ['province_id', 'hazard_type', 'scenario'], unique=False)

    op.add_column('investor_subscriptions', sa.Column('plan', sa.VARCHAR(length=50), nullable=True))
    op.add_column('investor_subscriptions', sa.Column('max_cities', sa.INTEGER(), nullable=True))
    op.drop_constraint('fk_investor_subscriptions_plan_id', 'investor_subscriptions', type_='foreignkey')
    op.drop_column('investor_subscriptions', 'plan_id')
    op.alter_column('investor_subscriptions', 'plan', nullable=False)

    op.drop_table('subscription_plans')