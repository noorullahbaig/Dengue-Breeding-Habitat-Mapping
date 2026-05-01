from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_reports"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("reference", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("accuracy_meters", sa.Float(), nullable=True),
        sa.Column("location_source", sa.String(length=32), nullable=False),
        sa.Column("public_latitude", sa.Float(), nullable=False),
        sa.Column("public_longitude", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("neighborhood", sa.String(length=80), nullable=False),
        sa.Column("status_message", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("image_original_filename", sa.String(length=255), nullable=False),
        sa.Column("image_mime_type", sa.String(length=80), nullable=False),
        sa.Column("image_size_bytes", sa.Integer(), nullable=False),
        sa.Column("image_sha256", sa.String(length=64), nullable=False),
        sa.Column("image_path", sa.Text(), nullable=False),
        sa.Column("thumbnail_path", sa.Text(), nullable=False),
        sa.Column("prediction_label", sa.String(length=64), nullable=False),
        sa.Column("prediction_confidence", sa.Float(), nullable=True),
        sa.Column("prediction_confidence_band", sa.String(length=32), nullable=False),
        sa.Column("prediction_top_raw_label", sa.String(length=120), nullable=True),
        sa.Column("prediction_advisory_text", sa.Text(), nullable=False),
        sa.Column("detections", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_reference", "reports", ["reference"], unique=True)
    op.create_index("ix_reports_image_sha256", "reports", ["image_sha256"], unique=False)
    op.create_index(
        "ix_reports_public_location",
        "reports",
        ["public_latitude", "public_longitude"],
        unique=False,
    )
    op.create_index(
        "ix_reports_status_prediction",
        "reports",
        ["status", "prediction_label"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reports_status_prediction", table_name="reports")
    op.drop_index("ix_reports_public_location", table_name="reports")
    op.drop_index("ix_reports_image_sha256", table_name="reports")
    op.drop_index("ix_reports_reference", table_name="reports")
    op.drop_table("reports")
