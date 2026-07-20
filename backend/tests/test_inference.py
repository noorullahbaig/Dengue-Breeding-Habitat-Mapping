import math
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from app.inference import (
    CLASS_REVIEW_FLOORS,
    INFERENCE_CONFIDENCE_FLOOR,
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
            Detection(raw_label="Vase", confidence=0.80, bbox=[1, 1, 20, 20]),
        ]
    )

    assert summary.label == "artificial_container"
    assert summary.confidence == 0.80
    assert summary.top_raw_label == "Vase"
    assert summary.confidence_band == "high"
    assert summary.advisory_text == (
        "The model produced stronger evidence for this habitat class, but final verification is still required."
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


def test_confidence_bands_use_precision_weighted_stronger_evidence_thresholds():
    assert confidence_band("artificial_container", 0.674) == "high"
    assert confidence_band("artificial_container", 0.675) == "high"
    assert confidence_band("artificial_container", 0.673) == "low"
    assert confidence_band("drain_inlet", 0.553) == "high"
    assert confidence_band("drain_inlet", 0.554) == "high"
    assert confidence_band("drain_inlet", 0.552) == "low"
    assert confidence_band("tire", 0.712) == "high"
    assert confidence_band("tire", 0.713) == "high"
    assert confidence_band("tire", 0.711) == "low"


@pytest.mark.parametrize(
    ("raw_label", "threshold"),
    [
        ("artificial_container", 0.674),
        ("drain_inlet", 0.553),
        ("tire", 0.712),
    ],
)
def test_stronger_evidence_threshold_boundaries(
    raw_label: str,
    threshold: float,
):
    assert confidence_band(raw_label, math.nextafter(threshold, 0.0)) == "low"
    assert confidence_band(raw_label, threshold) == "high"
    assert confidence_band(raw_label, math.nextafter(threshold, 1.0)) == "high"


@pytest.mark.parametrize(
    ("raw_label", "floor"),
    [
        ("artificial_container", 0.547),
        ("drain_inlet", 0.486),
        ("tire", 0.448),
    ],
)
def test_class_review_floors_keep_boundary_evidence_and_exclude_weaker_detections(
    raw_label: str,
    floor: float,
):
    retained = summarize_detections(
        [
            Detection(
                raw_label=raw_label,
                confidence=floor,
                bbox=[0, 0, 10, 10],
            )
        ]
    )
    excluded = summarize_detections(
        [
            Detection(
                raw_label=raw_label,
                confidence=math.nextafter(floor, 0.0),
                bbox=[0, 0, 10, 10],
            )
        ]
    )
    above = summarize_detections(
        [
            Detection(
                raw_label=raw_label,
                confidence=math.nextafter(floor, 1.0),
                bbox=[0, 0, 10, 10],
            )
        ]
    )

    assert retained.label == raw_label
    assert retained.confidence_band == "low"
    assert CLASS_REVIEW_FLOORS[raw_label] == floor
    assert retained.detections[0].confidence == floor
    assert retained.advisory_text == (
        "The model produced uncertain evidence; human verification is required."
    )
    assert excluded.label == "unclassified"
    assert excluded.confidence is None
    assert excluded.detections == []
    assert above.label == raw_label


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

        def predict(self, image_path: str, **kwargs):
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

        def predict(self, image_path: str, **kwargs):
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


def test_model_inference_uses_lowest_class_floor_and_locked_validation_settings():
    class CapturingModel:
        def __init__(self) -> None:
            self.kwargs = None

        def predict(self, image_path: str, **kwargs):
            self.kwargs = kwargs
            return []

    model = CapturingModel()
    inference = ModelInference(Path("unused.pt"))
    inference.model = model

    inference.predict(Path("image.jpg"))

    assert model.kwargs == {
        "verbose": False,
        "imgsz": 640,
        "conf": INFERENCE_CONFIDENCE_FLOOR,
        "iou": 0.70,
        "augment": False,
    }
    assert INFERENCE_CONFIDENCE_FLOOR == 0.448
