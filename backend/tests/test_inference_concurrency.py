import asyncio
import threading
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.inference import PredictionSummary


def empty_prediction() -> PredictionSummary:
    return PredictionSummary(
        label="unclassified",
        confidence=None,
        confidence_band="low",
        top_raw_label=None,
        detections=[],
    )


@pytest.mark.anyio
async def test_prediction_helper_runs_inference_off_the_event_loop(monkeypatch):
    import app.main as main_module

    helper = getattr(main_module, "_run_model_prediction", None)
    assert helper is not None

    event_loop_thread = threading.get_ident()
    inference_threads: list[int] = []

    class ThreadRecordingModel:
        def predict(self, image_path: Path) -> PredictionSummary:
            inference_threads.append(threading.get_ident())
            return empty_prediction()

    monkeypatch.setattr(main_module, "model_inference", ThreadRecordingModel())
    main_module.app.state.inference_semaphore = asyncio.Semaphore(1)

    await helper(Path("image.jpg"))

    assert inference_threads
    assert inference_threads[0] != event_loop_thread


@pytest.mark.anyio
async def test_prediction_helper_serializes_concurrent_requests(monkeypatch):
    import app.main as main_module

    helper = getattr(main_module, "_run_model_prediction", None)
    assert helper is not None

    first_entered = threading.Event()
    release_first = threading.Event()

    class ContendedModel:
        def __init__(self) -> None:
            self.active = 0
            self.calls = 0
            self.max_active = 0
            self.monitor = threading.Lock()

        def predict(self, image_path: Path) -> PredictionSummary:
            with self.monitor:
                self.active += 1
                self.calls += 1
                self.max_active = max(self.max_active, self.active)
                call_number = self.calls
            try:
                if call_number == 1:
                    first_entered.set()
                    assert release_first.wait(timeout=1)
                return empty_prediction()
            finally:
                with self.monitor:
                    self.active -= 1

    model = ContendedModel()
    monkeypatch.setattr(main_module, "model_inference", model)
    main_module.app.state.inference_semaphore = asyncio.Semaphore(1)

    first = asyncio.create_task(helper(Path("first.jpg")))
    assert await asyncio.to_thread(first_entered.wait, 1)
    second = asyncio.create_task(helper(Path("second.jpg")))
    await asyncio.sleep(0.05)

    try:
        assert model.calls == 1
    finally:
        release_first.set()

    await asyncio.gather(first, second)

    assert model.calls == 2
    assert model.max_active == 1


@pytest.mark.anyio
async def test_prediction_helper_releases_semaphore_after_error(monkeypatch):
    import app.main as main_module

    helper = getattr(main_module, "_run_model_prediction", None)
    assert helper is not None

    class FailingOnceModel:
        def __init__(self) -> None:
            self.calls = 0

        def predict(self, image_path: Path) -> PredictionSummary:
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("inference failed")
            return empty_prediction()

    model = FailingOnceModel()
    monkeypatch.setattr(main_module, "model_inference", model)
    main_module.app.state.inference_semaphore = asyncio.Semaphore(1)

    with pytest.raises(RuntimeError, match="inference failed"):
        await helper(Path("first.jpg"))

    summary = await helper(Path("second.jpg"))

    assert summary.label == "unclassified"
    assert model.calls == 2


@pytest.mark.anyio
async def test_create_report_deletes_stored_image_when_inference_is_cancelled(monkeypatch):
    import app.main as main_module

    stored_image = SimpleNamespace(image_path=Path("report.jpg"))
    deleted: list[object] = []

    async def fake_store_upload(image):
        return stored_image

    async def cancel_prediction(image_path: Path):
        raise asyncio.CancelledError

    monkeypatch.setattr(
        main_module,
        "model_inference",
        SimpleNamespace(ready=True, load_error=None),
    )
    monkeypatch.setattr(main_module, "store_upload", fake_store_upload)
    monkeypatch.setattr(main_module, "_run_model_prediction", cancel_prediction)
    monkeypatch.setattr(main_module, "delete_stored_image", deleted.append)

    with pytest.raises(asyncio.CancelledError):
        await main_module.create_report(
            image=object(),
            captured_at=datetime.now(timezone.utc),
            latitude=3.13902,
            longitude=101.68692,
            accuracy_meters=42,
            source="browser",
            detected_latitude=3.13902,
            detected_longitude=101.68692,
            detected_accuracy_meters=42,
            detected_source="browser",
            notes=None,
            stack_parent_reference=None,
            public_consent_accepted=True,
            public_consent_text=None,
            current_user=None,
            db=object(),
        )

    assert deleted == [stored_image]


@pytest.mark.anyio
async def test_precheck_deletes_temporary_image_when_inference_is_cancelled(monkeypatch):
    import app.main as main_module

    stored_image = SimpleNamespace(image_path=Path("precheck.jpg"))
    deleted: list[object] = []

    async def fake_store_precheck_image(image):
        return stored_image

    async def cancel_prediction(image_path: Path):
        raise asyncio.CancelledError

    monkeypatch.setattr(
        main_module,
        "model_inference",
        SimpleNamespace(ready=True, load_error=None),
    )
    monkeypatch.setattr(main_module, "store_precheck_image", fake_store_precheck_image)
    monkeypatch.setattr(main_module, "_run_model_prediction", cancel_prediction)
    monkeypatch.setattr(main_module, "delete_precheck_image", deleted.append)

    with pytest.raises(asyncio.CancelledError):
        await main_module._precheck_report(
            image=object(),
            latitude=3.13902,
            longitude=101.68692,
            detected_latitude=3.13902,
            detected_longitude=101.68692,
            detected_accuracy_meters=42,
            detected_source="browser",
            db=object(),
        )

    assert deleted == [stored_image]
