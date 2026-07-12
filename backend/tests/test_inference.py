from app.inference import Detection, confidence_band, normalize_bbox, summarize_detections


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
