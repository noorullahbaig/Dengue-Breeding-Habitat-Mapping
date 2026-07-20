from scripts.derive_operating_profile import (
    choose_operating_point,
    derive_profile,
    f_beta,
)


def test_f_beta_weights_recall_when_beta_is_greater_than_one():
    assert f_beta(precision=0.60, recall=0.90, beta=2.0) > f_beta(
        precision=0.90, recall=0.60, beta=2.0
    )


def test_f_beta_weights_precision_for_stronger_evidence():
    assert f_beta(precision=0.90, recall=0.60, beta=0.5) > f_beta(
        precision=0.60, recall=0.90, beta=0.5
    )


def test_choose_operating_point_selects_maximum_and_rounds_only_for_deployment():
    rows = [
        {"confidence": "0.1001001", "precision": "0.60", "recall": "0.90"},
        {"confidence": "0.2002002", "precision": "0.75", "recall": "0.85"},
        {"confidence": "0.3003003", "precision": "0.90", "recall": "0.60"},
    ]

    point = choose_operating_point(rows, beta=1.0)

    assert point["threshold_raw"] == 0.2002002
    assert point["deployed_threshold"] == 0.200
    assert point["precision"] == 0.75
    assert point["recall"] == 0.85
    assert point["f_beta"] == f_beta(0.75, 0.85, 1.0)


def test_recall_weighted_tie_prefers_recall_then_the_lower_threshold():
    rows = [
        {"confidence": "0.4", "precision": "0.75", "recall": "0.85"},
        {"confidence": "0.3", "precision": "0.75", "recall": "0.85"},
    ]

    assert choose_operating_point(rows, beta=2.0)["threshold_raw"] == 0.3


def test_f_half_tie_prefers_precision_then_the_higher_stronger_threshold():
    rows = [
        {"confidence": "0.6", "precision": "0.90", "recall": "0.70"},
        {"confidence": "0.7", "precision": "0.90", "recall": "0.70"},
    ]

    assert choose_operating_point(rows, beta=0.5)["threshold_raw"] == 0.7


def test_derived_profile_uses_class_f1_review_floors_and_lowest_inference_envelope(
    tmp_path,
):
    curve_path = tmp_path / "curves.csv"
    rows = [
        "class_name,confidence,precision,recall",
    ]
    for class_name in ("Artificial Container", "Drain Inlet", "Tire"):
        rows.extend(
            f"{class_name},{index / 999:.12f},0.9,0.8" for index in range(1000)
        )
    curve_path.write_text("\n".join(rows) + "\n")

    profile = derive_profile(
        curve_path,
        checkpoint_sha256="checkpoint",
        dataset_fingerprint="dataset",
        selected_on="2026-07-20",
    )

    assert set(profile["review_floors"]) == {
        "artificial_container",
        "drain_inlet",
        "tire",
    }
    assert all(point["deployed_threshold"] == 0.0 for point in profile["review_floors"].values())
    assert profile["inference"]["global_prediction_confidence"] == 0.0
    assert profile["review_floor_objective"]["metric"] == "F1"
