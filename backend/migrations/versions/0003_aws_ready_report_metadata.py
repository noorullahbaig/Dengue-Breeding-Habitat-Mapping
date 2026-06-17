from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_aws_ready_report_metadata"
down_revision = "0002_report_stacking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'
            ) THEN
                CREATE EXTENSION IF NOT EXISTS postgis;
            END IF;
        END
        $$;
        """
    )

    op.add_column("reports", sa.Column("image_storage_key", sa.String(length=255), nullable=True))
    op.add_column("reports", sa.Column("thumbnail_storage_key", sa.String(length=255), nullable=True))
    op.add_column(
        "reports",
        sa.Column("public_consent_accepted", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("reports", sa.Column("public_consent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("reports", sa.Column("public_consent_version", sa.String(length=64), nullable=True))
    op.add_column("reports", sa.Column("public_consent_text", sa.Text(), nullable=True))
    op.add_column("reports", sa.Column("hotspot_snapshot_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("reports", sa.Column("nearest_hotspot_id", sa.String(length=255), nullable=True))
    op.add_column("reports", sa.Column("nearest_hotspot_locality", sa.String(length=255), nullable=True))
    op.add_column("reports", sa.Column("nearest_hotspot_district", sa.String(length=120), nullable=True))
    op.add_column("reports", sa.Column("nearest_hotspot_distance_meters", sa.Float(), nullable=True))
    op.add_column(
        "reports",
        sa.Column(
            "hotspot_priority_level",
            sa.String(length=32),
            nullable=False,
            server_default="unassessed",
        ),
    )
    op.add_column(
        "reports",
        sa.Column(
            "hotspot_priority_reason",
            sa.Text(),
            nullable=False,
            server_default="Hotspot priority has not been assessed yet.",
        ),
    )
    op.add_column("reports", sa.Column("officer_notes", sa.Text(), nullable=True))
    op.add_column("reports", sa.Column("follow_up_action", sa.Text(), nullable=True))
    op.add_column("reports", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("reports", sa.Column("reviewed_by", sa.String(length=120), nullable=True))
    op.create_index("ix_reports_image_storage_key", "reports", ["image_storage_key"], unique=False)
    op.create_index(
        "ix_reports_hotspot_priority_level",
        "reports",
        ["hotspot_priority_level"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_reports_hotspot_priority_level", table_name="reports")
    op.drop_index("ix_reports_image_storage_key", table_name="reports")
    op.drop_column("reports", "reviewed_by")
    op.drop_column("reports", "reviewed_at")
    op.drop_column("reports", "follow_up_action")
    op.drop_column("reports", "officer_notes")
    op.drop_column("reports", "hotspot_priority_reason")
    op.drop_column("reports", "hotspot_priority_level")
    op.drop_column("reports", "nearest_hotspot_distance_meters")
    op.drop_column("reports", "nearest_hotspot_district")
    op.drop_column("reports", "nearest_hotspot_locality")
    op.drop_column("reports", "nearest_hotspot_id")
    op.drop_column("reports", "hotspot_snapshot_date")
    op.drop_column("reports", "public_consent_text")
    op.drop_column("reports", "public_consent_version")
    op.drop_column("reports", "public_consent_at")
    op.drop_column("reports", "public_consent_accepted")
    op.drop_column("reports", "thumbnail_storage_key")
    op.drop_column("reports", "image_storage_key")
