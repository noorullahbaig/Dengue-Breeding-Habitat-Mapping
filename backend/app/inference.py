from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

RAW_TO_PUBLIC_LABEL = {
    "Bottle": "artificial_container",
    "Vase": "artificial_container",
    "Drain-Inlet": "drain_inlet",
    "Tire": "tire",
    "Artificial Container": "artificial_container",
    "Drain Inlet": "drain_inlet",
    "artificial_container": "artificial_container",
    "drain_inlet": "drain_inlet",
    "tire": "tire",
}

CLASS_CONFIDENCE_THRESHOLDS = {
    "artificial_container": 0.48,
    "drain_inlet": 0.66,
    "tire": 0.62,
}
LOW_ADVISORY_TEXT = "The image is ambiguous; human verification is required."
HIGH_ADVISORY_TEXT = (
    "The model is highly confident in this detection, but final verification is still required."
)


@dataclass(frozen=True)
class Detection:
    raw_label: str
    confidence: float
    bbox: list[float]
    bbox_normalized: list[float] | None = None
    image_width: int | None = None
    image_height: int | None = None


@dataclass(frozen=True)
class PredictionSummary:
    label: str
    confidence: float | None
    confidence_band: str
    top_raw_label: str | None
    detections: list[Detection]
    advisory_text: str = LOW_ADVISORY_TEXT


def confidence_band(label: str, confidence: float | None) -> str:
    threshold = CLASS_CONFIDENCE_THRESHOLDS.get(label)
    if threshold is None or confidence is None:
        return "low"
    return "high" if confidence >= threshold else "low"


def advisory_text_for_band(confidence_band_value: str) -> str:
    return (
        HIGH_ADVISORY_TEXT
        if confidence_band_value == "high"
        else LOW_ADVISORY_TEXT
    )


def normalize_bbox(
    bbox: list[float],
    *,
    image_width: int | None,
    image_height: int | None,
) -> list[float] | None:
    if not image_width or not image_height or len(bbox) < 4:
        return None

    left, top, right, bottom = bbox[:4]

    def clamp(value: float) -> float:
        return min(max(value, 0.0), 1.0)

    return [
        clamp(left / image_width),
        clamp(top / image_height),
        clamp(right / image_width),
        clamp(bottom / image_height),
    ]


def summarize_detections(detections: list[Detection]) -> PredictionSummary:
    top_detection = max(detections, key=lambda item: item.confidence, default=None)
    retained = [
        detection
        for detection in detections
        if detection.raw_label in RAW_TO_PUBLIC_LABEL
    ]
    top_retained = max(retained, key=lambda item: item.confidence, default=None)

    if top_retained is None:
        return PredictionSummary(
            label="unclassified",
            confidence=None,
            confidence_band="low",
            top_raw_label=top_detection.raw_label if top_detection else None,
            detections=detections,
        )

    return PredictionSummary(
        label=RAW_TO_PUBLIC_LABEL[top_retained.raw_label],
        confidence=top_retained.confidence,
        confidence_band=confidence_band(
            RAW_TO_PUBLIC_LABEL[top_retained.raw_label],
            top_retained.confidence,
        ),
        top_raw_label=top_retained.raw_label,
        detections=detections,
        advisory_text=advisory_text_for_band(
            confidence_band(
                RAW_TO_PUBLIC_LABEL[top_retained.raw_label],
                top_retained.confidence,
            )
        ),
    )


class ModelInference:
    def __init__(self, model_path: Path):
        self.model_path = model_path
        self.model = None
        self.names: dict[int, str] = {}
        self.load_error: str | None = None

    @property
    def ready(self) -> bool:
        return self.model is not None and self.load_error is None

    def load(self) -> None:
        try:
            from ultralytics import YOLO

            self.model = YOLO(str(self.model_path))
            self.names = dict(getattr(self.model, "names", {}) or {})
            self.load_error = None
        except Exception as exc:  # pragma: no cover - surfaced through /health
            self.model = None
            self.names = {}
            self.load_error = str(exc)

    def predict(self, image_path: Path) -> PredictionSummary:
        if self.model is None:
            raise RuntimeError(self.load_error or "The detection model is not loaded.")

        results = self.model.predict(str(image_path), verbose=False)
        detections: list[Detection] = []

        for result in results:
            image_height = None
            image_width = None
            orig_shape = getattr(result, "orig_shape", None)
            if orig_shape and len(orig_shape) >= 2:
                image_height = int(orig_shape[0])
                image_width = int(orig_shape[1])

            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue

            for box in boxes:
                class_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())
                xyxy = [float(value) for value in box.xyxy[0].tolist()]
                detections.append(
                    Detection(
                        raw_label=self.names.get(class_id, str(class_id)),
                        confidence=confidence,
                        bbox=xyxy,
                        bbox_normalized=normalize_bbox(
                            xyxy,
                            image_width=image_width,
                            image_height=image_height,
                        ),
                        image_width=image_width,
                        image_height=image_height,
                    )
                )

        return summarize_detections(detections)
