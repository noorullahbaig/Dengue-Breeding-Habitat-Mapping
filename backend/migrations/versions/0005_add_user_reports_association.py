"""add user reports association

Revision ID: 0005
Revises: 0004
Create Date: 2026-01-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0005'
down_revision = '0004_postgis_spatial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=128), nullable=False),
        sa.Column('cognito_sub', sa.String(length=128), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('photo_url', sa.Text(), nullable=True),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cognito_sub')
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_cognito_sub', 'users', ['cognito_sub'])
    
    # Add user_id to reports (nullable for backward compatibility with existing reports)
    op.add_column('reports', sa.Column('user_id', sa.String(length=128), nullable=True))
    op.create_foreign_key(
        'fk_reports_user_id',
        'reports', 'users',
        ['user_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_reports_user_id', 'reports', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_reports_user_id', table_name='reports')
    op.drop_constraint('fk_reports_user_id', 'reports', type_='foreignkey')
    op.drop_column('reports', 'user_id')
    
    op.drop_index('ix_users_cognito_sub', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
