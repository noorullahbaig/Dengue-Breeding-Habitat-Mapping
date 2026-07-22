from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.main import migration_is_ready
from app.models import Report
from postgres_helpers import PostgresTestSchema


def _insert_hotspot(db, *, hotspot_id: str, snapshot_date: datetime) -> None:
    db.execute(
        text(
            """
            INSERT INTO hotspots (
                id, locality, district, latitude, longitude, center_geog,
                radius_meters, cumulative_cases, outbreak_duration_days,
                outbreak_start_date, week_number, year, snapshot_date,
                source_label, synced_at
            ) VALUES (
                :id, :locality, 'Wilayah Persekutuan', 3.139, 101.6869,
                ST_SetSRID(ST_MakePoint(101.6869, 3.139), 4326)::geography,
                200, 8, 12, :snapshot_date, 17, 2026, :snapshot_date,
                'iDengue hotspot context', :snapshot_date
            )
            """
        ),
        {
            "id": hotspot_id,
            "locality": f"Locality {hotspot_id}",
            "snapshot_date": snapshot_date,
        },
    )


def _report(*, reference: str, nearest_hotspot_id: str | None) -> Report:
    now = datetime(2026, 4, 20, tzinfo=timezone.utc)
    return Report(
        id=str(uuid4()),
        reference=reference,
        created_at=now,
        captured_at=now,
        latitude=3.139,
        longitude=101.6869,
        accuracy_meters=12,
        location_source="browser",
        public_latitude=3.139,
        public_longitude=101.6869,
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
        hotspot_snapshot_date=now,
        nearest_hotspot_id=nearest_hotspot_id,
        nearest_hotspot_locality="Historical Locality",
        nearest_hotspot_district="Wilayah Persekutuan",
        nearest_hotspot_distance_meters=42.5,
        hotspot_priority_level="core",
        hotspot_priority_reason="Within 200 m.",
    )


def test_upgrade_cleans_orphans_and_adds_named_fk_index_and_readiness(
    postgres_schema: PostgresTestSchema,
):
    postgres_schema.run_alembic("upgrade", "0007_annotated_evidence")
    snapshot = datetime(2026, 4, 20, tzinfo=timezone.utc)

    with postgres_schema.session() as db:
        _insert_hotspot(db, hotspot_id="valid-hotspot", snapshot_date=snapshot)
        orphan = _report(reference="KL-ORPHAN-0001", nearest_hotspot_id="missing-hotspot")
        db.add(orphan)
        db.commit()
        orphan_id = orphan.id

    postgres_schema.run_alembic("upgrade", "head")

    engine = postgres_schema.engine()
    try:
        with engine.connect() as connection:
            cleaned = connection.execute(
                text(
                    """
                    SELECT nearest_hotspot_id, nearest_hotspot_locality,
                           nearest_hotspot_district, nearest_hotspot_distance_meters,
                           hotspot_priority_level
                    FROM reports WHERE id = :id
                    """
                ),
                {"id": orphan_id},
            ).one()
            assert cleaned == (
                None,
                "Historical Locality",
                "Wilayah Persekutuan",
                42.5,
                "core",
            )

            inspector = inspect(connection)
            foreign_keys = {fk["name"]: fk for fk in inspector.get_foreign_keys("reports")}
            indexes = {index["name"] for index in inspector.get_indexes("reports")}

            hotspot_fk = foreign_keys["fk_reports_nearest_hotspot_id_hotspots"]
            assert hotspot_fk["constrained_columns"] == ["nearest_hotspot_id"]
            assert hotspot_fk["referred_table"] == "hotspots"
            assert hotspot_fk["referred_columns"] == ["id"]
            assert hotspot_fk["options"].get("ondelete") in (None, "NO ACTION")
            assert "ix_reports_nearest_hotspot_id" in indexes

        with postgres_schema.session() as db:
            assert migration_is_ready(db) is True
    finally:
        engine.dispose()


def test_fk_accepts_valid_and_null_references_rejects_orphans_and_blocks_delete(
    migrated_postgres_schema: PostgresTestSchema,
):
    snapshot = datetime(2026, 4, 20, tzinfo=timezone.utc)
    with migrated_postgres_schema.session() as db:
        _insert_hotspot(db, hotspot_id="referenced-hotspot", snapshot_date=snapshot)
        valid = _report(reference="KL-VALID-0001", nearest_hotspot_id="referenced-hotspot")
        without_hotspot = _report(reference="KL-NULL-0001", nearest_hotspot_id=None)
        db.add_all([valid, without_hotspot])
        db.commit()

        invalid = _report(reference="KL-INVALID-0001", nearest_hotspot_id="not-present")
        db.add(invalid)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        with pytest.raises(IntegrityError):
            db.execute(text("DELETE FROM hotspots WHERE id = 'referenced-hotspot'"))
            db.commit()
        db.rollback()

        assert db.scalar(text("SELECT count(*) FROM reports")) == 2
        assert db.scalar(
            text("SELECT count(*) FROM hotspots WHERE id = 'referenced-hotspot'")
        ) == 1


def test_downgrade_removes_fk_and_index_without_deleting_rows(
    migrated_postgres_schema: PostgresTestSchema,
):
    snapshot = datetime(2026, 4, 20, tzinfo=timezone.utc)
    with migrated_postgres_schema.session() as db:
        _insert_hotspot(db, hotspot_id="downgrade-hotspot", snapshot_date=snapshot)
        db.add(_report(reference="KL-DOWN-0001", nearest_hotspot_id="downgrade-hotspot"))
        db.commit()

    migrated_postgres_schema.run_alembic("downgrade", "0007_annotated_evidence")

    engine = migrated_postgres_schema.engine()
    try:
        with engine.connect() as connection:
            inspector = inspect(connection)
            foreign_key_names = {fk["name"] for fk in inspector.get_foreign_keys("reports")}
            index_names = {index["name"] for index in inspector.get_indexes("reports")}
            assert "fk_reports_nearest_hotspot_id_hotspots" not in foreign_key_names
            assert "ix_reports_nearest_hotspot_id" not in index_names
            assert connection.scalar(text("SELECT count(*) FROM reports")) == 1
            assert connection.scalar(text("SELECT count(*) FROM hotspots")) == 1
    finally:
        engine.dispose()
