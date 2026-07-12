from datetime import datetime, timezone
from inspect import signature

from fastapi.testclient import TestClient

from app.main import _precheck_report, app
from app.models import Report
from app.serializers import (
    owner_report_detail_out,
    public_report_detail_out,
    public_report_out,
    status_report_out,
)


def test_cors_allows_localhost_and_loopback_dev_origins():
    client = TestClient(app)

    for origin in (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ):
        response = client.options(
            "/api/reports",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
            },
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin


def test_owner_detail_and_media_require_authentication():
    client = TestClient(app)

    detail = client.get("/api/my-reports/KL-PRIVATE-0001")
    image = client.get("/api/my-reports/KL-PRIVATE-0001/image")
    thumbnail = client.get("/api/my-reports/KL-PRIVATE-0001/thumbnail")

    assert detail.status_code == 401
    assert image.status_code == 401
    assert thumbnail.status_code == 401


def test_precheck_helper_accepts_concrete_values_not_fastapi_param_defaults():
    for parameter in signature(_precheck_report).parameters.values():
        assert parameter.default is parameter.empty


def test_status_response_hides_private_fields_but_exposes_public_model_evidence():
    report = Report(
        id="report-1",
        reference="KL-TEST-0001",
        created_at=datetime.now(timezone.utc),
        captured_at=datetime.now(timezone.utc),
        latitude=3.11121,
        longitude=101.65218,
        accuracy_meters=12,
        location_source="browser",
        public_latitude=3.11,
        public_longitude=101.65,
        status="submitted",
        neighborhood="Bukit Jalil",
        status_message="Received and awaiting officer review.",
        notes="Resident note",
        image_original_filename="private.jpg",
        image_mime_type="image/jpeg",
        image_size_bytes=123,
        image_sha256="a" * 64,
        image_path="/private/evidence.jpg",
        thumbnail_path="/private/thumb.jpg",
        prediction_label="tire",
        prediction_confidence=0.91,
        prediction_confidence_band="high",
        prediction_top_raw_label="Tire",
        prediction_advisory_text="Advisory only.",
        detections=[{"rawLabel": "Tire", "confidence": 0.91, "bbox": [1, 2, 3, 4]}],
    )

    response = status_report_out(report).model_dump()

    assert "reportLocation" not in response
    assert "publicLocation" not in response
    assert "notes" not in response
    assert response["prediction"]["label"] == "tire"
    assert response["prediction"]["confidence"] == 0.91
    assert response["prediction"]["topRawLabel"] == "Tire"
    assert response["prediction"]["detections"] == [
        {
            "rawLabel": "Tire",
            "confidence": 0.91,
            "bbox": [1.0, 2.0, 3.0, 4.0],
            "bboxNormalized": None,
            "imageWidth": None,
            "imageHeight": None,
        }
    ]


def test_owner_detail_includes_private_note_and_linkable_public_cluster():
    report = Report(
        id="report-owner-detail",
        reference="KL-OWNER-0001",
        created_at=datetime.now(timezone.utc),
        captured_at=datetime.now(timezone.utc),
        latitude=3.11121,
        longitude=101.65218,
        accuracy_meters=12,
        location_source="browser",
        public_latitude=3.11,
        public_longitude=101.65,
        status="submitted",
        neighborhood="Bukit Jalil",
        status_message="Received and awaiting officer review.",
        notes="Resident note",
        image_original_filename="private.jpg",
        image_mime_type="image/jpeg",
        image_size_bytes=123,
        image_sha256="a" * 64,
        image_path="/private/evidence.jpg",
        thumbnail_path="/private/thumb.jpg",
        prediction_label="tire",
        prediction_confidence=0.91,
        prediction_confidence_band="high",
        prediction_top_raw_label="Tire",
        prediction_advisory_text="Advisory only.",
        detections=[],
        public_consent_accepted=True,
    )

    response = owner_report_detail_out(report).model_dump()

    assert response["reference"] == "KL-OWNER-0001"
    assert response["notes"] == "Resident note"
    assert response["statusMessage"] == "Received and awaiting officer review."
    assert response["imageUrl"] == "/api/my-reports/KL-OWNER-0001/image"
    assert response["thumbnailUrl"] == "/api/my-reports/KL-OWNER-0001/thumbnail"
    assert response["publicReportReference"] == "KL-OWNER-0001"
    assert response["publicLocation"] == {
        "latitude": 3.11,
        "longitude": 101.65,
        "accuracyMeters": None,
        "source": "public",
    }


def test_public_detail_includes_additive_privacy_and_hotspot_context():
    report = Report(
        id="report-2",
        reference="KL-TEST-2000",
        created_at=datetime.now(timezone.utc),
        captured_at=datetime.now(timezone.utc),
        latitude=3.1411,
        longitude=101.6892,
        accuracy_meters=10,
        location_source="browser",
        public_latitude=3.1411,
        public_longitude=101.6892,
        status="submitted",
        neighborhood="Sentul",
        status_message="Received and awaiting officer review.",
        image_original_filename="public.jpg",
        image_mime_type="image/jpeg",
        image_size_bytes=123,
        image_sha256="b" * 64,
        image_path="/private/public.jpg",
        thumbnail_path="/private/public-thumb.jpg",
        prediction_label="drain_inlet",
        prediction_confidence=0.73,
        prediction_confidence_band="moderate",
        prediction_top_raw_label="Drain-Inlet",
        prediction_advisory_text="Advisory only.",
        detections=[],
        hotspot_priority_level="warning",
        hotspot_priority_reason="Within warning buffer.",
    )

    response = public_report_detail_out(report, [report]).model_dump()

    assert "privacyNote" in response
    assert response["hotspotPriority"]["priorityLevel"] == "warning"


def test_public_map_report_includes_stored_hotspot_priority_without_private_location():
	created_at = datetime.now(timezone.utc)
	report = Report(
		id="report-map-priority",
		reference="KL-MAP-0001",
		created_at=created_at,
		captured_at=created_at,
		latitude=3.1411,
		longitude=101.6892,
		accuracy_meters=10,
		location_source="browser",
		public_latitude=3.14,
		public_longitude=101.69,
		status="submitted",
		neighborhood="Sentul",
		status_message="Report submitted.",
		image_original_filename="public.jpg",
		image_mime_type="image/jpeg",
		image_size_bytes=123,
		image_sha256="e" * 64,
		image_path="/private/public.jpg",
		thumbnail_path="/private/public-thumb.jpg",
		prediction_label="drain_inlet",
		prediction_confidence=0.73,
		prediction_confidence_band="moderate",
		prediction_top_raw_label="Drain-Inlet",
		prediction_advisory_text="Advisory only.",
		detections=[],
		hotspot_priority_level="core",
		hotspot_priority_reason="Within core radius.",
		nearest_hotspot_distance_meters=184.2,
	)

	response = public_report_out(report).model_dump()

	assert response["hotspotPriority"]["priorityLevel"] == "core"
	assert response["hotspotPriority"]["nearestHotspotDistanceMeters"] == 184.2
	assert "reportLocation" not in response
	assert response["publicLocation"]["latitude"] == 3.14
