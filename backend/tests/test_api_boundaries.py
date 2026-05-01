from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.models import Report
from app.serializers import status_report_out


def test_cors_allows_localhost_and_loopback_dev_origins():
    client = TestClient(app)

    for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
        response = client.options(
            "/api/reports",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
            },
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin


def test_status_response_does_not_expose_exact_location_notes_or_raw_detections():
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
    assert "detections" not in response["prediction"]
    assert "topRawLabel" not in response["prediction"]
    assert response["prediction"]["label"] == "tire"
