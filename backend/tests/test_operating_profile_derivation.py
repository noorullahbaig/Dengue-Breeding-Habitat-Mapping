from scripts.derive_operating_profile import choose_operating_point, f_beta


def test_f_beta_weights_recall_for_detection_floor():
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


def test_f2_tie_prefers_recall_then_the_lower_detection_floor():
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
