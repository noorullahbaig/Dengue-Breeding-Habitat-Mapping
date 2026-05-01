from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_report_stacking"
down_revision = "0001_initial_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("parent_report_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_reports_parent_report_id_reports",
        "reports",
        "reports",
        ["parent_report_id"],
        ["id"],
    )
    op.create_index("ix_reports_parent_report_id", "reports", ["parent_report_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_reports_parent_report_id", table_name="reports")
    op.drop_constraint("fk_reports_parent_report_id_reports", "reports", type_="foreignkey")
    op.drop_column("reports", "parent_report_id")
