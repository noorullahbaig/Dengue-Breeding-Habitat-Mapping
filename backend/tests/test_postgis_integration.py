from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import text

from app.hotspots import PublicHotspot, assess_hotspot_priority, sync_current_hotspots
from app.main import app, get_db
from app.models import Report
from postgres_helpers import PostgresTestSchema


def test_postgis_extension_report_geography_columns_and_indexes_exist(
    migrated_postgres_schema: PostgresTestSchema,
):
    db = migrated_postgres_schema.session()
    try:
        columns = set(
            db.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = current_schema()
                      AND table_name = 'reports'
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
                    WHERE schemaname = current_schema()
                      AND tablename IN ('reports', 'hotspots')
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
                    WHERE table_schema = current_schema()
                      AND table_name = 'hotspots'
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


def test_hotspot_sync_upserts_and_priority_uses_postgis(
    monkeypatch,
    migrated_postgres_schema: PostgresTestSchema,
):
    db = migrated_postgres_schema.session()
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


def test_hotspot_sync_with_no_usable_source_rows_preserves_existing_mirror(
    monkeypatch,
    migrated_postgres_schema: PostgresTestSchema,
):
    snapshot = datetime(2026, 4, 20, tzinfo=timezone.utc)
    existing = PublicHotspot(
        id="existing-current",
        locality="Existing Current",
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

    with migrated_postgres_schema.session() as db:
        _insert_hotspot(db, existing)
        db.commit()
        monkeypatch.setattr("app.hotspots.fetch_current_hotspots", lambda: [])

        with pytest.raises(RuntimeError, match="did not contain current Kuala Lumpur rows"):
            sync_current_hotspots(db)

        assert db.scalar(text("SELECT count(*) FROM hotspots")) == 1
        assert db.scalar(text("SELECT id FROM hotspots")) == "existing-current"


def _insert_hotspot(db, hotspot: PublicHotspot) -> None:
    db.execute(
        text(
            """
            INSERT INTO hotspots (
                id, locality, district, latitude, longitude, center_geog,
                radius_meters, cumulative_cases, outbreak_duration_days,
                outbreak_start_date, week_number, year, snapshot_date,
                source_label, synced_at
            ) VALUES (
                :id, :locality, :district, :latitude, :longitude,
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                :radius_meters, :cumulative_cases, :outbreak_duration_days,
                :outbreak_start_date, :week_number, :year, :snapshot_date,
                :source_label, :snapshot_date
            )
            """
        ),
        hotspot.__dict__,
    )


def _insert_referencing_report(db, *, hotspot: PublicHotspot) -> None:
    now = hotspot.snapshot_date
    db.add(
        Report(
            id="retention-report",
            reference="KL-RETENTION-0001",
            created_at=now,
            captured_at=now,
            latitude=hotspot.latitude,
            longitude=hotspot.longitude,
            location_source="browser",
            public_latitude=hotspot.latitude,
            public_longitude=hotspot.longitude,
            status="submitted",
            neighborhood="Bukit Jalil",
            status_message="Report received.",
            image_original_filename="sample.jpg",
            image_mime_type="image/jpeg",
            image_size_bytes=123,
            image_sha256="a" * 64,
            image_path="/tmp/sample.jpg",
            thumbnail_path="/tmp/sample-thumb.jpg",
            prediction_label="tire",
            prediction_confidence=0.91,
            prediction_confidence_band="high",
            prediction_top_raw_label="Tire",
            prediction_advisory_text="Advisory only.",
            detections=[],
            public_consent_accepted=True,
            hotspot_snapshot_date=hotspot.snapshot_date,
            nearest_hotspot_id=hotspot.id,
            nearest_hotspot_locality=hotspot.locality,
            nearest_hotspot_district=hotspot.district,
            nearest_hotspot_distance_meters=10,
            hotspot_priority_level="core",
            hotspot_priority_reason="Within 200 m.",
        )
    )


def test_sync_retains_latest_and_referenced_history_but_deletes_unreferenced_history(
    monkeypatch,
    migrated_postgres_schema: PostgresTestSchema,
):
    old_snapshot = datetime(2026, 4, 13, tzinfo=timezone.utc)
    latest_snapshot = datetime(2026, 4, 20, tzinfo=timezone.utc)
    old_referenced = PublicHotspot(
        id="old-referenced",
        locality="Referenced History",
        district="Wilayah Persekutuan",
        latitude=3.139,
        longitude=101.6869,
        radius_meters=200,
        cumulative_cases=8,
        outbreak_duration_days=12,
        outbreak_start_date=old_snapshot,
        week_number=16,
        year=2026,
        snapshot_date=old_snapshot,
    )
    old_unreferenced = PublicHotspot(
        id="old-unreferenced",
        locality="Obsolete History",
        district="Wilayah Persekutuan",
        latitude=3.14,
        longitude=101.687,
        radius_meters=200,
        cumulative_cases=4,
        outbreak_duration_days=7,
        outbreak_start_date=old_snapshot,
        week_number=16,
        year=2026,
        snapshot_date=old_snapshot,
    )
    latest = PublicHotspot(
        id="latest-current",
        locality="Current Snapshot",
        district="Wilayah Persekutuan",
        latitude=3.141,
        longitude=101.688,
        radius_meters=200,
        cumulative_cases=10,
        outbreak_duration_days=14,
        outbreak_start_date=latest_snapshot,
        week_number=17,
        year=2026,
        snapshot_date=latest_snapshot,
    )

    with migrated_postgres_schema.session() as db:
        _insert_hotspot(db, old_referenced)
        _insert_hotspot(db, old_unreferenced)
        _insert_referencing_report(db, hotspot=old_referenced)
        db.commit()

        monkeypatch.setattr("app.hotspots.fetch_current_hotspots", lambda: [latest])
        sync_current_hotspots(db)

        remaining_ids = set(db.scalars(text("SELECT id FROM hotspots")))
        assert remaining_ids == {"old-referenced", "latest-current"}

        def override_get_db():
            with migrated_postgres_schema.session() as request_db:
                yield request_db

        app.dependency_overrides[get_db] = override_get_db
        try:
            response = TestClient(app).get("/api/hotspots/current")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        assert [hotspot["id"] for hotspot in response.json()] == ["latest-current"]
        assert response.json()[0]["radiusMeters"] == 200
        assert response.json()[0]["warningRadiusMeters"] == 400
