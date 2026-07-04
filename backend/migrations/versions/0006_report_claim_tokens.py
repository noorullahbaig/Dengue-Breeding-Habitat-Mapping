"""add secure anonymous report claim tokens

Revision ID: 0006_report_claim_tokens
Revises: b743af9d26cd
Create Date: 2026-07-04 18:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_report_claim_tokens"
down_revision: Union[str, None] = "b743af9d26cd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("claim_token_hash", sa.String(length=64), nullable=True))
    op.add_column(
        "reports",
        sa.Column("claim_token_created_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reports", "claim_token_created_at")
    op.drop_column("reports", "claim_token_hash")
