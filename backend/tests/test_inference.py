from app.inference import Detection, confidence_band, summarize_detections


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
    assert summary.confidence_band == "moderate"


def test_unclassified_when_only_excluded_detection_is_present():
    summary = summarize_detections(
        [Detection(raw_label="Coconut-Exocarp", confidence=0.91, bbox=[0, 0, 10, 10])]
    )

    assert summary.label == "unclassified"
    assert summary.confidence is None
    assert summary.top_raw_label == "Coconut-Exocarp"


def test_confidence_bands():
    assert confidence_band(0.71) == "high"
    assert confidence_band(0.40) == "moderate"
    assert confidence_band(0.39) == "low"
    assert confidence_band(None) == "low"
