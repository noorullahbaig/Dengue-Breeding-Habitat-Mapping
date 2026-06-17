from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.config import settings
from app.hotspots import PublicHotspot, assess_hotspot_priority, sync_current_hotspots


def _postgres_session() -> Session:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            dialect_name = connection.dialect.name
            postgis_enabled = connection.scalar(
                text("select exists(select 1 from pg_extension where extname = 'postgis')")
            )
    except Exception as exc:
        pytest.skip(f"Local PostgreSQL/PostGIS is unavailable: {exc}")

    if dialect_name != "postgresql" or not postgis_enabled:
        pytest.skip("PostGIS integration tests require a migrated local PostgreSQL database.")

    return Session(engine)


def test_postgis_extension_report_geography_columns_and_indexes_exist():
    db = _postgres_session()
    try:
        columns = set(
            db.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'reports'
                      AND column_name IN ('report_location_geog', 'public_location_geog')
                    """
                )
            ).scalars()
        )
        indexes = set(
            db.execute(
                text(
                    """
                    SELECT indexname
                    FROM pg_indexes
                    WHERE tablename IN ('reports', 'hotspots')
                    """
                )
            ).scalars()
        )
        hotspot_geography_column = db.scalar(
            text(
                """
                SELECT exists(
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'hotspots'
                      AND column_name = 'center_geog'
                )
                """
            )
        )

        assert columns == {"report_location_geog", "public_location_geog"}
        assert "ix_reports_report_location_geog" in indexes
        assert "ix_reports_public_location_geog" in indexes
        assert "ix_hotspots_center_geog" in indexes
        assert hotspot_geography_column is True
    finally:
        db.close()


def test_hotspot_sync_upserts_and_priority_uses_postgis(monkeypatch):
    db = _postgres_session()
    snapshot = datetime(2026, 4, 20, tzinfo=timezone.utc)
    hotspot = PublicHotspot(
        id="test-hotspot-postgis",
        locality="PostGIS Test Locality",
        district="Wilayah Persekutuan",
        latitude=3.139,
        longitude=101.6869,
        radius_meters=200,
        cumulative_cases=8,
        outbreak_duration_days=12,
        outbreak_start_date=snapshot,
        week_number=17,
        year=2026,
        snapshot_date=snapshot,
    )

    monkeypatch.setattr("app.hotspots.fetch_current_hotspots", lambda: [hotspot])

    try:
        sync_result = sync_current_hotspots(db)
        stored_count = db.scalar(
            text("SELECT count(*) FROM hotspots WHERE id = 'test-hotspot-postgis'")
        )
        priority = assess_hotspot_priority(db, 3.13901, 101.68691)

        assert sync_result.synced_count == 1
        assert stored_count == 1
        assert priority.priority_level == "core"
        assert priority.nearest_hotspot_id == "test-hotspot-postgis"
        assert priority.nearest_hotspot_distance_meters is not None
        assert priority.nearest_hotspot_distance_meters < 3
    finally:
        db.close()
