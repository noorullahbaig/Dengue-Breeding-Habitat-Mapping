import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from app.inference import (
    Detection,
    ModelInference,
    confidence_band,
    normalize_bbox,
    summarize_detections,
)


def test_maps_retained_model_classes_to_public_habitat_classes():
    summary = summarize_detections(
        [
            Detection(raw_label="Coconut-Exocarp", confidence=0.99, bbox=[0, 0, 10, 10]),
            Detection(raw_label="Vase", confidence=0.62, bbox=[1, 1, 20, 20]),
        ]
    )

    assert summary.label == "artificial_container"
    assert summary.confidence == 0.62
    assert summary.top_raw_label == "Vase"
    assert summary.confidence_band == "high"
    assert summary.advisory_text == (
        "The model is highly confident in this detection, but final verification is still required."
    )


def test_unclassified_when_only_excluded_detection_is_present():
    summary = summarize_detections(
        [Detection(raw_label="Coconut-Exocarp", confidence=0.91, bbox=[0, 0, 10, 10])]
    )

    assert summary.label == "unclassified"
    assert summary.confidence is None
    assert summary.top_raw_label == "Coconut-Exocarp"


def test_accepts_new_retained_three_class_model_labels():
    summary = summarize_detections(
        [
            Detection(raw_label="drain_inlet", confidence=0.81, bbox=[0, 0, 10, 10]),
            Detection(raw_label="artificial_container", confidence=0.78, bbox=[1, 1, 20, 20]),
        ]
    )

    assert summary.label == "drain_inlet"
    assert summary.confidence == 0.81
    assert summary.top_raw_label == "drain_inlet"
    assert summary.confidence_band == "high"


def test_confidence_bands_use_class_specific_validation_thresholds():
    assert confidence_band("artificial_container", 0.48) == "high"
    assert confidence_band("artificial_container", 0.479) == "low"
    assert confidence_band("drain_inlet", 0.66) == "high"
    assert confidence_band("drain_inlet", 0.659) == "low"
    assert confidence_band("tire", 0.62) == "high"
    assert confidence_band("tire", 0.619) == "low"


def test_confidence_bands_keep_unknown_and_missing_predictions_low():
    assert confidence_band("unclassified", 0.99) == "low"
    assert confidence_band("future_class", 0.99) == "low"
    assert confidence_band("tire", None) == "low"


def test_normalizes_detection_boxes_against_source_image_dimensions():
    assert normalize_bbox([50, 25, 150, 75], image_width=200, image_height=100) == [
        0.25,
        0.25,
        0.75,
        0.75,
    ]


def test_normalized_boxes_clamp_to_image_area():
    assert normalize_bbox([-5, 10, 210, 120], image_width=200, image_height=100) == [
        0.0,
        0.1,
        1.0,
        1.0,
    ]


def test_model_inference_serializes_concurrent_predict_calls():
    first_entered = threading.Event()
    second_attempting = threading.Event()
    second_entered = threading.Event()
    release_first = threading.Event()

    class ContendedModel:
        def __init__(self) -> None:
            self.calls = 0

        def predict(self, image_path: str, *, verbose: bool):
            self.calls += 1
            if self.calls == 1:
                first_entered.set()
                assert release_first.wait(timeout=1)
            else:
                second_entered.set()
            return []

    inference = ModelInference(Path("unused.pt"))
    inference.model = ContendedModel()

    def run_second_prediction():
        second_attempting.set()
        return inference.predict(Path("second.jpg"))

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(inference.predict, Path("first.jpg"))
        assert first_entered.wait(timeout=1)
        second = executor.submit(run_second_prediction)
        assert second_attempting.wait(timeout=1)

        try:
            assert not second_entered.wait(timeout=0.1)
        finally:
            release_first.set()

        first.result(timeout=1)
        second.result(timeout=1)

    assert inference.model.calls == 2


def test_model_inference_releases_lock_after_prediction_error():
    class FailingOnceModel:
        def __init__(self) -> None:
            self.calls = 0

        def predict(self, image_path: str, *, verbose: bool):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("inference failed")
            return []

    inference = ModelInference(Path("unused.pt"))
    inference.model = FailingOnceModel()

    with pytest.raises(RuntimeError, match="inference failed"):
        inference.predict(Path("first.jpg"))

    summary = inference.predict(Path("second.jpg"))

    assert summary.label == "unclassified"
