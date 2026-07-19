import hashlib
import json
from pathlib import Path

import pytest

from app.inference import (
    CLASS_DETECTION_FLOORS,
    CLASS_STRONG_EVIDENCE_THRESHOLDS,
)
from scripts.derive_operating_profile import derive_profile


MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
PROFILE_PATH = MODELS_DIR / "denguewatch_yolov8s_operating_profile.json"
METADATA_PATH = MODELS_DIR / "denguewatch_yolov8s_metadata.json"
MODEL_PATH = MODELS_DIR / "denguewatch_yolov8s_best.pt"
CURVE_PATH = MODELS_DIR / "validation_f1_curves.csv"


def f_beta(precision: float, recall: float, beta: float) -> float:
    beta_squared = beta**2
    return (
        (1 + beta_squared) * precision * recall
        / (beta_squared * precision + recall)
    )


def test_operating_profile_identity_matches_promoted_model_and_metadata():
    profile = json.loads(PROFILE_PATH.read_text())
    metadata = json.loads(METADATA_PATH.read_text())

    assert hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest() == profile["checkpoint_sha256"]
    assert metadata["sha256"] == profile["checkpoint_sha256"]
    assert metadata["dataset_fingerprint"] == profile["dataset_fingerprint"]
    assert metadata["operating_profile"] == {
        "artifact": PROFILE_PATH.name,
        "detection_floors": CLASS_DETECTION_FLOORS,
        "stronger_evidence_thresholds": CLASS_STRONG_EVIDENCE_THRESHOLDS,
    }


@pytest.mark.parametrize(
    ("section", "beta", "runtime_values"),
    [
        ("detection_floors", 2.0, CLASS_DETECTION_FLOORS),
        ("stronger_evidence_thresholds", 0.5, CLASS_STRONG_EVIDENCE_THRESHOLDS),
    ],
)
def test_operating_points_record_reproducible_f_beta_values(
    section: str,
    beta: float,
    runtime_values: dict[str, float],
):
    profile = json.loads(PROFILE_PATH.read_text())
    operating_points = profile[section]

    for class_name, expected_threshold in runtime_values.items():
        point = operating_points[class_name]
        assert point["deployed_threshold"] == expected_threshold
        assert point["deployed_threshold"] == round(point["threshold_raw"], 3)
        assert point["f_beta"] == pytest.approx(
            f_beta(point["precision"], point["recall"], beta), abs=1e-12
        )


def test_operating_profile_records_the_authoritative_curve_artifact():
    profile = json.loads(PROFILE_PATH.read_text())

    assert profile["source_curve"] == {
        "filename": "validation_f1_curves.csv",
        "sha256": "1a0274d4742979c248a3f5bce62eb49d17e698710ae75142d722427ee8108510",
        "confidence_grid_points_per_class": 1000,
    }


def test_committed_curve_reproduces_the_complete_operating_profile():
    profile = json.loads(PROFILE_PATH.read_text())

    derived = derive_profile(
        CURVE_PATH,
        checkpoint_sha256=profile["checkpoint_sha256"],
        dataset_fingerprint=profile["dataset_fingerprint"],
        selected_on=profile["selected_on"],
    )

    assert derived == profile
