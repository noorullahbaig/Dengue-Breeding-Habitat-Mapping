from io import BytesIO
from pathlib import Path
from time import sleep

from fastapi.testclient import TestClient
from PIL import Image

import app as app_module
from core import Detection, PredictionSummary


class FakeRunner:
    def __init__(self, label: str):
        self.label = label

    def predict(self, _image_path: Path) -> PredictionSummary:
        return PredictionSummary(
            label=self.label,
            confidence=0.88,
            confidence_band="high",
            top_raw_label="Drain-Inlet",
            latency_ms=11.2,
            detections=[
                Detection(
                    raw_label="Drain-Inlet",
                    mapped_label="drain_inlet",
                    confidence=0.88,
                    bbox=[10, 10, 50, 50],
                )
            ],
        )


def _sample_image_bytes() -> bytes:
    image = Image.new("RGB", (64, 64), color=(200, 200, 200))
    buf = BytesIO()
    image.save(buf, format="JPEG")
    return buf.getvalue()


def test_compare_response_schema(monkeypatch):
    monkeypatch.setattr(app_module, "old_runner", FakeRunner("drain_inlet"))
    monkeypatch.setattr(app_module, "new_runner", FakeRunner("artificial_container"))
    client = TestClient(app_module.app)
    payload = _sample_image_bytes()
    response = client.post("/compare", files={"image": ("sample.jpg", payload, "image/jpeg")})
    assert response.status_code == 200
    body = response.json()
    assert "sessionId" in body
    assert body["old"]["label"] == "drain_inlet"
    assert body["new"]["label"] == "artificial_container"
    assert "latencyMs" in body["old"]
    assert body["images"]["sideBySide"].endswith(".jpg")
    assert body["upload"]["storedAs"] == "source.jpg"


def test_compare_invalid_image_returns_structured_400():
    client = TestClient(app_module.app)
    response = client.post("/compare", files={"image": ("bad.txt", b"not-an-image", "text/plain")})
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["code"] == "INVALID_IMAGE"
    assert "traceId" in detail


def test_compare_accepts_unknown_extension_if_readable(monkeypatch):
    monkeypatch.setattr(app_module, "old_runner", FakeRunner("drain_inlet"))
    monkeypatch.setattr(app_module, "new_runner", FakeRunner("artificial_container"))
    client = TestClient(app_module.app)
    response = client.post("/compare", files={"image": ("phone_upload.heic", _sample_image_bytes(), "application/octet-stream")})
    assert response.status_code == 200
    body = response.json()
    assert body["upload"]["originalFilename"] == "phone_upload.heic"


def test_batch_job_lifecycle(monkeypatch, tmp_path):
    images_dir = tmp_path / "images"
    labels_dir = tmp_path / "labels"
    images_dir.mkdir()
    labels_dir.mkdir()
    (images_dir / "a.jpg").write_bytes(_sample_image_bytes())
    (labels_dir / "a.txt").write_text("1 0.5 0.5 0.3 0.3\n", encoding="utf-8")

    def fake_run_batch_eval(**kwargs):
        cb = kwargs.get("progress_cb")
        if cb:
            cb(
                {
                    "processed": 1,
                    "total": 1,
                    "percent": 100.0,
                    "currentFile": "a.jpg",
                    "previewItem": {
                        "image": "a.jpg",
                        "groundTruth": "drain_inlet",
                        "old": {"label": "drain_inlet", "confidence": 0.7, "latencyMs": 10},
                        "new": {"label": "drain_inlet", "confidence": 0.9, "latencyMs": 11},
                        "winner": "tie",
                        "overlays": {
                            "old": str(kwargs["run_dir"] / "preview" / "a_old.jpg"),
                            "new": str(kwargs["run_dir"] / "preview" / "a_new.jpg"),
                            "pair": str(kwargs["run_dir"] / "preview" / "a_pair.jpg"),
                        },
                    },
                }
            )
        preview = kwargs["run_dir"] / "preview"
        preview.mkdir(parents=True, exist_ok=True)
        for n in ["a_old.jpg", "a_new.jpg", "a_pair.jpg", "confusion_old.png", "confusion_new.png", "class_metrics_old.png", "class_metrics_new.png", "latency_comparison.png", "per_image_results.csv", "metrics_summary.json"]:
            p = kwargs["run_dir"] / n if not n.startswith("a_") else preview / n
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b"x")
        return {"runDir": str(kwargs["run_dir"]), "metrics": {"decision": {"macroF1Delta_new_minus_old": 0.1, "p95LatencyDeltaMs_new_minus_old": -2.0, "drainInletFalseNegatives": {"old": 1, "new": 0}}}}

    monkeypatch.setattr(app_module, "run_batch_eval", fake_run_batch_eval)
    client = TestClient(app_module.app)
    create = client.post("/batch-jobs", json={"imagesDir": str(images_dir), "labelsDir": str(labels_dir)})
    assert create.status_code == 200
    job_id = create.json()["jobId"]

    # Wait for background thread
    for _ in range(30):
        status = client.get(f"/batch-jobs/{job_id}")
        if status.json()["status"] == "completed":
            break
        sleep(0.05)
    assert status.json()["status"] == "completed"
    assert "imagesPerMinute" in status.json()
    assert "lastHeartbeatAt" in status.json()

    preview = client.get(f"/batch-jobs/{job_id}/preview")
    assert preview.status_code == 200
    assert len(preview.json()["items"]) == 1
    assert "?v=" in preview.json()["items"][0]["overlays"]["pair"]

    result = client.get(f"/batch-jobs/{job_id}/result")
    assert result.status_code == 200
    assert "artifacts" in result.json()


def test_health_self_test():
    client = TestClient(app_module.app)
    response = client.get("/health/self-test")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
