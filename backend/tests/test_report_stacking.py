from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import image_storage
from app.config import settings
from app.database import Base
from app.domain import distance_meters
from app.inference import Detection, PredictionSummary
from app.hotspots import HotspotMirrorStatus, HotspotPriority, HotspotSyncResult
from app.main import app, get_db
from app.models import Report


class ReadyModel:
    ready = True
    load_error = None

    def __init__(self, label: str = "tire") -> None:
        self.label = label
        self.predict_calls = 0

    def load(self) -> None:
        return None

    def predict(self, image_path: Path) -> PredictionSummary:
        self.predict_calls += 1

        if self.label == "unclassified":
            return PredictionSummary(
                label="unclassified",
                confidence=None,
                confidence_band="low",
                top_raw_label=None,
                detections=[],
            )

        raw_labels = {
            "artificial_container": "Bottle",
            "drain_inlet": "Drain-Inlet",
            "tire": "Tire",
        }
        raw_label = raw_labels[self.label]

        return PredictionSummary(
            label=self.label,
            confidence=0.91,
            confidence_band="high",
            top_raw_label=raw_label,
            detections=[
                Detection(
                    raw_label=raw_label,
                    confidence=0.91,
                    bbox=[1, 2, 3, 4],
                    bbox_normalized=[0.01, 0.02, 0.03, 0.04],
                    image_width=100,
                    image_height=100,
                )
            ],
        )


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    upload_root = tmp_path / "uploads"
    monkeypatch.setattr(image_storage, "settings", replace(settings, upload_root=upload_root))

    import app.main as main_module

    model = ReadyModel()
    monkeypatch.setattr(main_module, "model_inference", model)
    monkeypatch.setattr(
        main_module,
        "assess_hotspot_priority",
        lambda db, latitude, longitude: HotspotPriority(
            snapshot_date=None,
            nearest_hotspot_id=None,
            nearest_hotspot_locality=None,
            nearest_hotspot_district=None,
            nearest_hotspot_distance_meters=None,
            priority_level="unavailable",
            priority_reason="Hotspot context is temporarily unavailable.",
        ),
    )
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client, TestingSessionLocal, model, upload_root

    app.dependency_overrides.clear()


def jpeg_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (32, 32), color=(180, 90, 40)).save(output, format="JPEG")
    return output.getvalue()


def trusted_detected_payload(
    *,
    latitude: str = "3.13902",
    longitude: str = "101.68692",
    accuracy_meters: str = "42",
) -> dict[str, str]:
    return {
        "detected_latitude": latitude,
        "detected_longitude": longitude,
        "detected_accuracy_meters": accuracy_meters,
        "detected_source": "browser",
    }


def make_report(
    *,
    reference: str,
    latitude: float = 3.139,
    longitude: float = 101.6869,
    status: str = "submitted",
    parent_report_id: str | None = None,
    created_at: datetime | None = None,
    prediction_label: str = "tire",
) -> Report:
    created_at = created_at or datetime.now(timezone.utc)
    return Report(
        id=str(uuid4()),
        parent_report_id=parent_report_id,
        reference=reference,
        created_at=created_at,
        captured_at=created_at,
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=12,
        location_source="browser",
        public_latitude=latitude,
        public_longitude=longitude,
        status=status,
        neighborhood="Bukit Jalil",
        status_message="Received and awaiting officer review.",
        notes="Officer-only resident note",
        image_original_filename="sample.jpg",
        image_mime_type="image/jpeg",
        image_size_bytes=123,
        image_sha256="a" * 64,
        image_path="/outside/evidence.jpg",
        thumbnail_path="/outside/thumb.jpg",
        prediction_label=prediction_label,
        prediction_confidence=0.91,
        prediction_confidence_band="high",
        prediction_top_raw_label="Tire",
        prediction_advisory_text="Advisory only.",
        detections=[{"rawLabel": "Tire", "confidence": 0.91, "bbox": [1, 2, 3, 4]}],
        public_consent_accepted=True,
        public_consent_at=created_at,
        public_consent_version="public-image-pin-v1",
        public_consent_text="Test consent.",
        hotspot_priority_level="unavailable",
        hotspot_priority_reason="Hotspot context is temporarily unavailable.",
    )


def test_nearby_candidates_return_only_active_same_class_parents(client):
    test_client, session_factory, model, upload_root = client
    model.label = "tire"
    db = session_factory()
    parent = make_report(reference="KL-PARENT-0001")
    child = make_report(reference="KL-CHILD-0001", parent_report_id=parent.id)
    far = make_report(reference="KL-FAR-0001", latitude=3.15, longitude=101.7)
    closed = make_report(reference="KL-CLOSED-0001", status="closed", latitude=3.13901)
    different_class = make_report(
        reference="KL-DRAIN-0001",
        latitude=3.13901,
        longitude=101.68691,
        prediction_label="drain_inlet",
    )
    db.add_all([parent, child, far, closed, different_class])
    db.commit()
    db.close()

    response = test_client.post(
        "/api/reports/nearby-candidates",
        data={"latitude": "3.13902", "longitude": "101.68692", **trusted_detected_payload()},
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["prediction"]["label"] == "tire"
    assert [item["reference"] for item in body["candidates"]] == ["KL-PARENT-0001"]
    assert body["candidates"][0]["reportCount"] == 2
    assert body["imageUrl"].startswith("/api/reports/precheck-images/prechecks/")
    assert test_client.get(body["imageUrl"]).status_code == 200
    assert list((upload_root / "prechecks").glob("*.jpg"))
    assert not list((upload_root / "evidence").glob("*.jpg"))
    assert not list((upload_root / "thumbnails").glob("*.jpg"))


def test_precheck_alias_runs_inference_and_returns_temp_image_url(client):
    test_client, _session_factory, model, upload_root = client
    model.label = "drain_inlet"

    response = test_client.post(
        "/api/reports/precheck",
        data={"latitude": "3.13902", "longitude": "101.68692", **trusted_detected_payload()},
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["prediction"]["label"] == "drain_inlet"
    assert body["prediction"]["confidence"] == 0.91
    assert body["prediction"]["topRawLabel"] == "Drain-Inlet"
    assert body["prediction"]["detections"][0]["rawLabel"] == "Drain-Inlet"
    assert body["prediction"]["detections"][0]["bboxNormalized"] == [0.01, 0.02, 0.03, 0.04]
    assert body["prediction"]["detections"][0]["imageWidth"] == 100
    assert body["prediction"]["detections"][0]["imageHeight"] == 100
    assert body["candidates"] == []
    assert body["imageUrl"].startswith("/api/reports/precheck-images/prechecks/")
    assert test_client.get(body["imageUrl"]).status_code == 200
    assert model.predict_calls == 1
    assert list((upload_root / "prechecks").glob("*.jpg"))
    assert not list((upload_root / "evidence").glob("*.jpg"))
    assert not list((upload_root / "thumbnails").glob("*.jpg"))


def test_nearby_candidates_exclude_unclassified_predictions(client):
    test_client, session_factory, model, upload_root = client
    model.label = "unclassified"
    db = session_factory()
    db.add(make_report(reference="KL-PARENT-UNCLASSIFIED"))
    db.commit()
    db.close()

    response = test_client.post(
        "/api/reports/nearby-candidates",
        data={"latitude": "3.13902", "longitude": "101.68692", **trusted_detected_payload()},
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["prediction"]["label"] == "unclassified"
    assert body["candidates"] == []
    assert body["imageUrl"].startswith("/api/reports/precheck-images/prechecks/")
    assert test_client.get(body["imageUrl"]).status_code == 200
    assert list((upload_root / "prechecks").glob("*.jpg"))
    assert not list((upload_root / "evidence").glob("*.jpg"))
    assert not list((upload_root / "thumbnails").glob("*.jpg"))


def test_nearby_candidates_rejects_outside_kuala_lumpur_before_inference(client):
    test_client, _session_factory, model, upload_root = client

    response = test_client.post(
        "/api/reports/nearby-candidates",
        data={
            "latitude": "2.9264",
            "longitude": "101.6964",
            **trusted_detected_payload(latitude="2.9264", longitude="101.6964"),
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Reports can only be submitted within Kuala Lumpur."
    assert model.predict_calls == 0
    assert not list(upload_root.rglob("*.jpg"))


def test_nearby_candidates_require_precise_detected_browser_location(client):
    test_client, _session_factory, model, upload_root = client

    response = test_client.post(
        "/api/reports/nearby-candidates",
        data={
            "latitude": "3.13902",
            "longitude": "101.68692",
            "detected_latitude": "3.13902",
            "detected_longitude": "101.68692",
            "detected_accuracy_meters": "320",
            "detected_source": "browser",
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Device location accuracy must be 250 meters or better."
    assert model.predict_calls == 0
    assert not list(upload_root.rglob("*.jpg"))


def test_create_report_with_stack_parent_creates_child_reference(client):
    test_client, session_factory, model, _upload_root = client
    model.label = "tire"
    db = session_factory()
    parent = make_report(reference="KL-PARENT-0002")
    parent_id = parent.id
    db.add(parent)
    db.commit()
    db.close()

    response = test_client.post(
        "/api/reports",
        data={
            "captured_at": "2026-04-20T01:00:00.000Z",
            "latitude": "3.13901",
            "longitude": "101.68691",
            "source": "browser",
            **trusted_detected_payload(latitude="3.13901", longitude="101.68691"),
            "stack_parent_reference": "KL-PARENT-0002",
            "public_consent_accepted": "true",
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["reference"] != "KL-PARENT-0002"
    assert body["stackedOnReference"] == "KL-PARENT-0002"

    db = session_factory()
    child = db.scalar(select(Report).where(Report.reference == body["reference"]))
    assert child is not None
    assert child.parent_report_id == parent_id
    assert child.public_consent_accepted is True
    assert child.public_consent_version == "public-image-pin-ai-v2"
    assert "computer-vision advisory result" in child.public_consent_text
    assert child.detections[0]["bboxNormalized"] == [0.01, 0.02, 0.03, 0.04]
    assert child.detections[0]["imageWidth"] == 100
    assert child.detections[0]["imageHeight"] == 100
    assert child.image_storage_key and child.image_storage_key.startswith("evidence/")
    assert child.thumbnail_storage_key and child.thumbnail_storage_key.startswith("thumbnails/")
    assert child.hotspot_priority_level == "unavailable"
    db.close()


def test_create_report_rejects_outside_kuala_lumpur_before_inference(client):
    test_client, _session_factory, model, upload_root = client

    response = test_client.post(
        "/api/reports",
        data={
            "captured_at": "2026-04-20T01:00:00.000Z",
            "latitude": "2.9264",
            "longitude": "101.6964",
            "source": "browser",
            **trusted_detected_payload(latitude="2.9264", longitude="101.6964"),
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Reports can only be submitted within Kuala Lumpur."
    assert model.predict_calls == 0
    assert not list(upload_root.rglob("*.jpg"))


def test_create_report_requires_public_consent_before_inference(client):
    test_client, _session_factory, model, upload_root = client

    response = test_client.post(
        "/api/reports",
        data={
            "captured_at": "2026-04-20T01:00:00.000Z",
            "latitude": "3.13901",
            "longitude": "101.68691",
            "source": "browser",
            **trusted_detected_payload(latitude="3.13901", longitude="101.68691"),
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "Confirm public image and exact-pin publication before submitting."
    )
    assert model.predict_calls == 0
    assert not list(upload_root.rglob("*.jpg"))


def test_create_report_requires_precise_detected_browser_location(client):
    test_client, _session_factory, model, upload_root = client

    response = test_client.post(
        "/api/reports",
        data={
            "captured_at": "2026-04-20T01:00:00.000Z",
            "latitude": "3.13901",
            "longitude": "101.68691",
            "source": "manual",
            "detected_latitude": "3.13901",
            "detected_longitude": "101.68691",
            "detected_accuracy_meters": "320",
            "detected_source": "browser",
            "public_consent_accepted": "true",
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Device location accuracy must be 250 meters or better."
    assert model.predict_calls == 0
    assert not list(upload_root.rglob("*.jpg"))


def test_create_report_rejects_pin_outside_detected_correction_radius(client):
    test_client, _session_factory, model, upload_root = client

    response = test_client.post(
        "/api/reports",
        data={
            "captured_at": "2026-04-20T01:00:00.000Z",
            "latitude": "3.1404",
            "longitude": "101.6884",
            "source": "manual",
            **trusted_detected_payload(latitude="3.13901", longitude="101.68691", accuracy_meters="42"),
            "public_consent_accepted": "true",
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "The selected site is outside the allowed correction radius for this device location."
    )
    assert model.predict_calls == 0
    assert not list(upload_root.rglob("*.jpg"))


def test_stack_parent_must_be_within_same_site_radius(client):
    test_client, session_factory, model, upload_root = client
    model.label = "tire"
    db = session_factory()
    parent = make_report(reference="KL-PARENT-0003")
    parent_latitude = parent.latitude
    parent_longitude = parent.longitude
    db.add(parent)
    db.commit()
    db.close()

    assert distance_meters(3.14, 101.6875, parent_latitude, parent_longitude) > 30

    response = test_client.post(
        "/api/reports",
        data={
            "captured_at": "2026-04-20T01:00:00.000Z",
            "latitude": "3.14",
            "longitude": "101.6875",
            "source": "browser",
            **trusted_detected_payload(latitude="3.14", longitude="101.6875"),
            "stack_parent_reference": "KL-PARENT-0003",
            "public_consent_accepted": "true",
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 409
    assert not list(upload_root.rglob("*.jpg"))


def test_stack_parent_must_match_inferred_class_and_cleans_upload(client):
    test_client, session_factory, model, upload_root = client
    model.label = "tire"
    db = session_factory()
    parent = make_report(reference="KL-PARENT-0005", prediction_label="drain_inlet")
    db.add(parent)
    db.commit()
    db.close()

    response = test_client.post(
        "/api/reports",
        data={
            "captured_at": "2026-04-20T01:00:00.000Z",
            "latitude": "3.13901",
            "longitude": "101.68691",
            "source": "browser",
            **trusted_detected_payload(latitude="3.13901", longitude="101.68691"),
            "stack_parent_reference": "KL-PARENT-0005",
            "public_consent_accepted": "true",
        },
        files={"image": ("sample.jpg", jpeg_bytes(), "image/jpeg")},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "The selected report no longer matches this submission."
    assert not list(upload_root.rglob("*.jpg"))


def test_public_detail_resolves_child_reference_and_omits_notes(client):
    test_client, session_factory, _model, _upload_root = client
    db = session_factory()
    parent = make_report(reference="KL-PARENT-0004")
    child = make_report(reference="KL-CHILD-0004", parent_report_id=parent.id)
    db.add_all([parent, child])
    db.commit()
    db.close()

    response = test_client.get("/api/public/reports/KL-CHILD-0004")

    assert response.status_code == 200
    body = response.json()
    assert body["reference"] == "KL-PARENT-0004"
    assert body["reportCount"] == 2
    assert body["prediction"]["label"] == "tire"
    assert body["prediction"]["detections"][0]["rawLabel"] == "Tire"
    assert body["observations"][0]["prediction"]["topRawLabel"] == "Tire"
    assert "notes" not in body
    assert all("notes" not in observation for observation in body["observations"])


def test_public_reports_hide_legacy_outside_area_parent(client):
    test_client, session_factory, _model, _upload_root = client
    db = session_factory()
    inside = make_report(reference="KL-INSIDE-0001")
    outside = make_report(
        reference="KL-OUTSIDE-0001",
        latitude=2.9264,
        longitude=101.6964,
    )
    db.add_all([inside, outside])
    db.commit()
    db.close()

    response = test_client.get("/api/public/reports")

    assert response.status_code == 200
    body = response.json()
    assert [item["reference"] for item in body] == ["KL-INSIDE-0001"]
    assert body[0]["prediction"]["label"] == "tire"
    assert body[0]["prediction"]["detections"][0]["rawLabel"] == "Tire"


def test_public_upload_path_rejects_paths_outside_upload_root():
    with pytest.raises(HTTPException):
        image_storage.resolve_public_upload_path("/tmp/not-a-public-report-image.jpg")


def test_storage_key_paths_resolve_inside_upload_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    upload_root = tmp_path / "uploads"
    image_path = upload_root / "evidence" / "sample.jpg"
    image_path.parent.mkdir(parents=True)
    image_path.write_bytes(b"image")

    monkeypatch.setattr(image_storage, "settings", replace(settings, upload_root=upload_root))

    assert image_storage.resolve_public_upload_path("evidence/sample.jpg") == image_path


def test_officer_endpoints_require_token_and_update_review_fields(client):
    test_client, session_factory, _model, _upload_root = client
    db = session_factory()
    db.add(make_report(reference="KL-OFFICER-0001"))
    db.commit()
    db.close()

    unauthorized = test_client.get("/api/officer/reports")
    assert unauthorized.status_code == 401

    headers = {"Authorization": "Bearer local-officer-demo-token"}
    list_response = test_client.get("/api/officer/reports", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()[0]["reference"] == "KL-OFFICER-0001"
    assert list_response.json()[0]["notes"] == "Officer-only resident note"

    update_response = test_client.patch(
        "/api/officer/reports/KL-OFFICER-0001",
        headers=headers,
        json={
            "status": "action_recorded",
            "officerNotes": "Verified from dashboard.",
            "followUpAction": "Inspection scheduled.",
            "reviewedBy": "Test officer",
        },
    )

    assert update_response.status_code == 200
    body = update_response.json()
    assert body["status"] == "action_recorded"
    assert body["officerNotes"] == "Verified from dashboard."
    assert body["followUpAction"] == "Inspection scheduled."
    assert body["reviewedBy"] == "Test officer"


def test_officer_hotspot_sync_requires_token_and_returns_status(client, monkeypatch):
    test_client, _session_factory, _model, _upload_root = client
    snapshot = datetime(2026, 4, 20, tzinfo=timezone.utc)

    import app.main as main_module

    monkeypatch.setattr(
        main_module,
        "hotspot_mirror_status",
        lambda db: HotspotMirrorStatus(
            hotspot_count=2,
            latest_snapshot_date=snapshot,
            last_synced_at=snapshot,
            source_label="iDengue hotspot context",
        ),
    )
    monkeypatch.setattr(
        main_module,
        "sync_current_hotspots",
        lambda db: HotspotSyncResult(
            synced_count=2,
            snapshot_date=snapshot,
            source_label="iDengue hotspot context",
            synced_at=snapshot,
        ),
    )

    assert test_client.post("/api/officer/hotspots/sync").status_code == 401
    headers = {"Authorization": "Bearer local-officer-demo-token"}

    status_response = test_client.get("/api/officer/hotspots/status", headers=headers)
    assert status_response.status_code == 200
    assert status_response.json()["hotspotCount"] == 2

    sync_response = test_client.post("/api/officer/hotspots/sync", headers=headers)
    assert sync_response.status_code == 200
    assert sync_response.json()["syncedCount"] == 2
