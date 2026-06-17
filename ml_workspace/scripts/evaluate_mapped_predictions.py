from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

OLD_MODEL_TO_TARGET = {
    "Bottle": "artificial_container",
    "Vase": "artificial_container",
    "Drain-Inlet": "drain_inlet",
    "Tire": "tire",
}

TARGET_CLASS_IDS = {
    0: "artificial_container",
    1: "drain_inlet",
    2: "tire",
}


def image_files(directory: Path) -> list[Path]:
    return sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def label_path_for_image(image_path: Path) -> Path:
    parts = list(image_path.parts)
    if "images" in parts:
        parts[parts.index("images")] = "labels"
    return Path(*parts).with_suffix(".txt")


def ground_truth_classes(image_path: Path) -> set[str]:
    label_path = label_path_for_image(image_path)
    classes: set[str] = set()
    if not label_path.exists():
        return classes

    for row in label_path.read_text(encoding="utf-8").splitlines():
        row = row.strip()
        if not row:
            continue
        try:
            class_id = int(row.split()[0])
        except (IndexError, ValueError):
            continue
        if class_id in TARGET_CLASS_IDS:
            classes.add(TARGET_CLASS_IDS[class_id])
    return classes


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate app-style mapped image-level predictions from a YOLO checkpoint."
    )
    parser.add_argument("--model", required=True, help="Path to YOLO checkpoint")
    parser.add_argument("--images", required=True, help="Prepared YOLO split image directory")
    parser.add_argument("--out", required=True, help="JSON output path")
    parser.add_argument("--conf", type=float, default=0.25, help="YOLO prediction confidence threshold")
    args = parser.parse_args()

    try:
        from ultralytics import YOLO
    except ImportError as exc:  # pragma: no cover - environment guard
        raise SystemExit("ultralytics is required in the active Python environment.") from exc

    model_path = Path(args.model).expanduser().resolve()
    image_dir = Path(args.images).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    model = YOLO(str(model_path))
    images = image_files(image_dir)

    confusion: Counter[str] = Counter()
    class_counts = {
        class_name: Counter({"tp": 0, "fp": 0, "fn": 0})
        for class_name in TARGET_CLASS_IDS.values()
    }
    samples = []

    for image_path in images:
        truth = ground_truth_classes(image_path)
        results = model.predict(str(image_path), conf=args.conf, verbose=False)
        predicted: set[str] = set()

        for result in results:
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            names = dict(getattr(result, "names", {}) or {})
            for box in boxes:
                raw_label = names.get(int(box.cls[0].item()), str(int(box.cls[0].item())))
                mapped = OLD_MODEL_TO_TARGET.get(raw_label, raw_label if raw_label in TARGET_CLASS_IDS.values() else None)
                if mapped in class_counts:
                    predicted.add(mapped)

        for class_name in class_counts:
            if class_name in truth and class_name in predicted:
                class_counts[class_name]["tp"] += 1
            elif class_name not in truth and class_name in predicted:
                class_counts[class_name]["fp"] += 1
            elif class_name in truth and class_name not in predicted:
                class_counts[class_name]["fn"] += 1

        confusion[(tuple(sorted(truth)), tuple(sorted(predicted)))] += 1
        if len(samples) < 100 and truth != predicted:
            samples.append(
                {
                    "image": str(image_path),
                    "truth": sorted(truth),
                    "predicted": sorted(predicted),
                }
            )

    metrics = {}
    for class_name, counts in class_counts.items():
        tp, fp, fn = counts["tp"], counts["fp"], counts["fn"]
        precision = tp / (tp + fp) if tp + fp else None
        recall = tp / (tp + fn) if tp + fn else None
        metrics[class_name] = {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "precision": precision,
            "recall": recall,
        }

    out_path.write_text(
        json.dumps(
            {
                "model": str(model_path),
                "images": str(image_dir),
                "confidence_threshold": args.conf,
                "image_count": len(images),
                "class_metrics": metrics,
                "confusion_image_level": [
                    {
                        "truth": list(truth),
                        "predicted": list(predicted),
                        "count": count,
                    }
                    for (truth, predicted), count in confusion.items()
                ],
                "mismatch_samples": samples,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
