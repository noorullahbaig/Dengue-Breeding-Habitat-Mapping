"""remove_officer_columns

Revision ID: b743af9d26cd
Revises: 0005
Create Date: 2026-07-04 17:18:20.326950

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b743af9d26cd'
down_revision: Union[str, None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('reports', 'reviewed_at')
    op.drop_column('reports', 'follow_up_action')
    op.drop_column('reports', 'reviewed_by')
    op.drop_column('reports', 'officer_notes')


def downgrade() -> None:
    op.add_column('reports', sa.Column('officer_notes', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('reports', sa.Column('reviewed_by', sa.VARCHAR(length=120), autoincrement=False, nullable=True))
    op.add_column('reports', sa.Column('follow_up_action', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('reports', sa.Column('reviewed_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True))
