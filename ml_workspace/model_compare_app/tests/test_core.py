from core import Detection, confidence_band, summarize_detections


def test_confidence_band_thresholds():
    assert confidence_band(None) == "low"
    assert confidence_band(0.39) == "low"
    assert confidence_band(0.40) == "moderate"
    assert confidence_band(0.70) == "high"


def test_unclassified_when_no_retained_detection():
    summary = summarize_detections(
        [Detection(raw_label="Coconut-Exocarp", mapped_label=None, confidence=0.9, bbox=[0, 0, 1, 1])],
        latency_ms=12.0,
    )
    assert summary.label == "unclassified"
    assert summary.confidence is None
    assert summary.confidence_band == "low"
    assert summary.top_raw_label == "Coconut-Exocarp"


def test_label_mapping_selects_highest_retained_confidence():
    summary = summarize_detections(
        [
            Detection(raw_label="Bottle", mapped_label="artificial_container", confidence=0.55, bbox=[0, 0, 1, 1]),
            Detection(raw_label="Drain-Inlet", mapped_label="drain_inlet", confidence=0.71, bbox=[0, 0, 1, 1]),
        ],
        latency_ms=3.0,
    )
    assert summary.label == "drain_inlet"
    assert summary.confidence == 0.71
    assert summary.confidence_band == "high"
