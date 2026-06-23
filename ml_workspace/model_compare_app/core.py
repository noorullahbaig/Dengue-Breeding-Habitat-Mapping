from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any

from PIL import Image, ImageDraw, ImageFont


PUBLIC_CLASSES = ("artificial_container", "drain_inlet", "tire")
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


@dataclass(frozen=True)
class Detection:
    raw_label: str
    mapped_label: str | None
    confidence: float
    bbox: list[float]


@dataclass(frozen=True)
class PredictionSummary:
    label: str
    confidence: float | None
    confidence_band: str
    top_raw_label: str | None
    detections: list[Detection]
    latency_ms: float


def confidence_band(confidence: float | None) -> str:
    if confidence is None:
        return "low"
    if confidence >= 0.70:
        return "high"
    if confidence >= 0.40:
        return "moderate"
    return "low"


def summarize_detections(detections: list[Detection], latency_ms: float) -> PredictionSummary:
    top_detection = max(detections, key=lambda d: d.confidence, default=None)
    retained = [d for d in detections if d.mapped_label in PUBLIC_CLASSES]
    top_retained = max(retained, key=lambda d: d.confidence, default=None)
    if top_retained is None:
        return PredictionSummary(
            label="unclassified",
            confidence=None,
            confidence_band="low",
            top_raw_label=top_detection.raw_label if top_detection else None,
            detections=detections,
            latency_ms=latency_ms,
        )
    return PredictionSummary(
        label=top_retained.mapped_label or "unclassified",
        confidence=top_retained.confidence,
        confidence_band=confidence_band(top_retained.confidence),
        top_raw_label=top_retained.raw_label,
        detections=detections,
        latency_ms=latency_ms,
    )


class YoloRunner:
    def __init__(self, model_path: Path):
        from ultralytics import YOLO

        self.model_path = model_path
        self.model = YOLO(str(model_path))
        self.names = dict(getattr(self.model, "names", {}) or {})

    def predict(self, image_path: Path) -> PredictionSummary:
        start = perf_counter()
        results = self.model.predict(str(image_path), verbose=False)
        latency_ms = (perf_counter() - start) * 1000.0
        detections: list[Detection] = []
        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for box in boxes:
                class_id = int(box.cls[0].item())
                raw = self.names.get(class_id, str(class_id))
                detections.append(
                    Detection(
                        raw_label=raw,
                        mapped_label=RAW_TO_PUBLIC_LABEL.get(raw),
                        confidence=float(box.conf[0].item()),
                        bbox=[float(v) for v in box.xyxy[0].tolist()],
                    )
                )
        return summarize_detections(detections, latency_ms=latency_ms)


def prediction_to_dict(summary: PredictionSummary) -> dict[str, Any]:
    return {
        "label": summary.label,
        "confidence": summary.confidence,
        "confidenceBand": summary.confidence_band,
        "topRawLabel": summary.top_raw_label,
        "latencyMs": round(summary.latency_ms, 2),
        "detections": [
            {
                "rawLabel": d.raw_label,
                "mappedLabel": d.mapped_label,
                "confidence": d.confidence,
                "bbox": d.bbox,
            }
            for d in summary.detections
        ],
    }


def render_overlay(source_image: Path, detections: list[Detection], output_path: Path) -> None:
    image = Image.open(source_image).convert("RGB")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    for det in detections:
        left, top, right, bottom = det.bbox
        color = "#16a34a" if det.mapped_label in PUBLIC_CLASSES else "#ef4444"
        draw.rectangle([left, top, right, bottom], outline=color, width=3)
        label = f"{det.raw_label} ({det.confidence:.2f})"
        draw.text((left + 3, max(0, top - 12)), label, fill=color, font=font)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path)


def render_side_by_side(left_image: Path, right_image: Path, output_path: Path) -> None:
    left = Image.open(left_image).convert("RGB")
    right = Image.open(right_image).convert("RGB")
    width = left.width + right.width
    height = max(left.height, right.height)
    merged = Image.new("RGB", (width, height), color=(245, 245, 245))
    merged.paste(left, (0, 0))
    merged.paste(right, (left.width, 0))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    merged.save(output_path)
