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
    assert summary.confidence_band == "moderate"


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


def test_confidence_bands():
    assert confidence_band(0.71) == "high"
    assert confidence_band(0.40) == "moderate"
    assert confidence_band(0.39) == "low"
    assert confidence_band(None) == "low"


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
