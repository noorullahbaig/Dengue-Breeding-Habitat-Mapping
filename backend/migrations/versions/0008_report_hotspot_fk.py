"""add report nearest-hotspot foreign key

Revision ID: 0008_report_hotspot_fk
Revises: 0007_annotated_evidence
"""

from __future__ import annotations

import logging

from alembic import op
import sqlalchemy as sa


revision = "0008_report_hotspot_fk"
down_revision = "0007_annotated_evidence"
branch_labels = None
depends_on = None


logger = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    cleanup_result = op.get_bind().execute(
        sa.text(
            """
            UPDATE reports AS report
            SET nearest_hotspot_id = NULL
            WHERE report.nearest_hotspot_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM hotspots AS hotspot
                  WHERE hotspot.id = report.nearest_hotspot_id
              )
            """
        )
    )
    logger.info(
        "Cleared %d orphaned reports.nearest_hotspot_id value(s) before adding the FK.",
        cleanup_result.rowcount,
    )

    op.create_index(
        "ix_reports_nearest_hotspot_id",
        "reports",
        ["nearest_hotspot_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_reports_nearest_hotspot_id_hotspots",
        "reports",
        "hotspots",
        ["nearest_hotspot_id"],
        ["id"],
    )


def downgrade() -> None:
    # The orphan IDs cleared during upgrade cannot be reconstructed by downgrade.
    # Copied hotspot snapshot fields and all report/hotspot rows remain untouched.
    op.drop_constraint(
        "fk_reports_nearest_hotspot_id_hotspots",
        "reports",
        type_="foreignkey",
    )
    op.drop_index("ix_reports_nearest_hotspot_id", table_name="reports")
