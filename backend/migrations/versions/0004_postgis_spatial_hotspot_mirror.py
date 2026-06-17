from __future__ import annotations

from alembic import op


revision = "0004_postgis_spatial"
down_revision = "0003_aws_ready_report_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("ALTER TABLE reports ADD COLUMN report_location_geog geography(Point, 4326)")
    op.execute("ALTER TABLE reports ADD COLUMN public_location_geog geography(Point, 4326)")
    op.execute(
        """
        UPDATE reports
        SET report_location_geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            public_location_geog = ST_SetSRID(
                ST_MakePoint(public_longitude, public_latitude),
                4326
            )::geography
        WHERE report_location_geog IS NULL
           OR public_location_geog IS NULL
        """
    )
    op.execute(
        "CREATE INDEX ix_reports_report_location_geog ON reports USING gist (report_location_geog)"
    )
    op.execute(
        "CREATE INDEX ix_reports_public_location_geog ON reports USING gist (public_location_geog)"
    )
    op.execute(
        """
        CREATE TABLE hotspots (
            id varchar(255) PRIMARY KEY,
            locality varchar(255) NOT NULL,
            district varchar(120) NOT NULL,
            latitude double precision NOT NULL,
            longitude double precision NOT NULL,
            center_geog geography(Point, 4326) NOT NULL,
            radius_meters integer NOT NULL DEFAULT 200,
            cumulative_cases integer,
            outbreak_duration_days integer,
            outbreak_start_date timestamptz NOT NULL,
            week_number integer NOT NULL,
            year integer NOT NULL,
            snapshot_date timestamptz NOT NULL,
            source_label varchar(120) NOT NULL DEFAULT 'iDengue hotspot context',
            synced_at timestamptz NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX ix_hotspots_center_geog ON hotspots USING gist (center_geog)")
    op.execute("CREATE INDEX ix_hotspots_snapshot_date ON hotspots (snapshot_date)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_hotspots_snapshot_date")
    op.execute("DROP INDEX IF EXISTS ix_hotspots_center_geog")
    op.execute("DROP TABLE IF EXISTS hotspots")
    op.execute("DROP INDEX IF EXISTS ix_reports_public_location_geog")
    op.execute("DROP INDEX IF EXISTS ix_reports_report_location_geog")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS public_location_geog")
    op.execute("ALTER TABLE reports DROP COLUMN IF EXISTS report_location_geog")
