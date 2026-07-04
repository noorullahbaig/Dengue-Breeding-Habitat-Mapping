"""add annotated evidence storage keys

Revision ID: 0007_annotated_evidence
Revises: 0006_report_claim_tokens
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_annotated_evidence"
down_revision = "0006_report_claim_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("annotated_image_storage_key", sa.String(255), nullable=True))
    op.add_column("reports", sa.Column("annotated_thumbnail_storage_key", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "annotated_thumbnail_storage_key")
    op.drop_column("reports", "annotated_image_storage_key")
