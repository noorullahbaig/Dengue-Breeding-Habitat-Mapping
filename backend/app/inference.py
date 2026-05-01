from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.domain import ADVISORY_TEXT


RAW_TO_PUBLIC_LABEL = {
    "Bottle": "artificial_container",
    "Vase": "artificial_container",
    "Drain-Inlet": "drain_inlet",
    "Tire": "tire",
}


@dataclass(frozen=True)
class Detection:
    raw_label: str
    confidence: float
    bbox: list[float]


@dataclass(frozen=True)
class PredictionSummary:
    label: str
    confidence: float | None
    confidence_band: str
    top_raw_label: str | None
    detections: list[Detection]
    advisory_text: str = ADVISORY_TEXT


def confidence_band(confidence: float | None) -> str:
    if confidence is None:
        return "low"
    if confidence >= 0.70:
        return "high"
    if confidence >= 0.40:
        return "moderate"
    return "low"


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
        confidence_band=confidence_band(top_retained.confidence),
        top_raw_label=top_retained.raw_label,
        detections=detections,
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
                    )
                )

        return summarize_detections(detections)
