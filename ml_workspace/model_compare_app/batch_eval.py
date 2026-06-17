from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path
from statistics import mean
from typing import Callable

import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (
    confusion_matrix,
    precision_recall_fscore_support,
)

from core import PUBLIC_CLASSES, YoloRunner


CLASS_ORDER = list(PUBLIC_CLASSES) + ["unclassified"]
INDEX_TO_LABEL = {
    0: "artificial_container",
    1: "drain_inlet",
    2: "tire",
}


def _read_gt_label(label_file: Path) -> str:
    if not label_file.exists():
        return "unclassified"
    classes: list[str] = []
    for line in label_file.read_text(encoding="utf-8").splitlines():
        parts = line.strip().split()
        if not parts:
            continue
        try:
            idx = int(parts[0])
        except ValueError:
            continue
        classes.append(INDEX_TO_LABEL.get(idx, "unclassified"))
    if not classes:
        return "unclassified"
    return Counter(classes).most_common(1)[0][0]


def _plot_confusion(cm: np.ndarray, labels: list[str], title: str, output: Path) -> None:
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="right")
    ax.set_yticklabels(labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Ground Truth")
    ax.set_title(title)
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, int(cm[i, j]), ha="center", va="center")
    fig.tight_layout()
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=180)
    plt.close(fig)


def _plot_classwise_metrics(labels: list[str], p: list[float], r: list[float], f1: list[float], output: Path) -> None:
    x = np.arange(len(labels))
    width = 0.25
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(x - width, p, width, label="Precision")
    ax.bar(x, r, width, label="Recall")
    ax.bar(x + width, f1, width, label="F1")
    ax.set_ylim(0, 1)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=30, ha="right")
    ax.set_title("Class-wise Metrics")
    ax.legend()
    fig.tight_layout()
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=180)
    plt.close(fig)


def _plot_latency(old_latencies: list[float], new_latencies: list[float], output: Path) -> None:
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.boxplot([old_latencies, new_latencies], labels=["Old", "New"])
    ax.set_ylabel("Latency (ms)")
    ax.set_title("Latency Comparison")
    fig.tight_layout()
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, dpi=180)
    plt.close(fig)


def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    return float(np.percentile(np.array(values), 95))


def run_batch_eval(
    old_model_path: Path,
    new_model_path: Path,
    images_dir: Path,
    labels_dir: Path,
    run_dir: Path,
    progress_cb: Callable[[dict], None] | None = None,
    cancel_check: Callable[[], bool] | None = None,
) -> dict:
    run_dir.mkdir(parents=True, exist_ok=True)

    old_runner = YoloRunner(old_model_path)
    new_runner = YoloRunner(new_model_path)

    image_files = sorted([p for p in images_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}])

    records = []
    y_true: list[str] = []
    y_old: list[str] = []
    y_new: list[str] = []
    old_latencies: list[float] = []
    new_latencies: list[float] = []
    preview_dir = run_dir / "preview"
    preview_dir.mkdir(parents=True, exist_ok=True)
    preview_items: list[dict] = []

    total = len(image_files)
    for idx, image_file in enumerate(image_files):
        if cancel_check and cancel_check():
            raise RuntimeError("Batch job cancelled.")
        label_file = labels_dir / f"{image_file.stem}.txt"
        gt = _read_gt_label(label_file)
        old_pred = old_runner.predict(image_file)
        new_pred = new_runner.predict(image_file)
        from core import render_overlay, render_side_by_side

        old_overlay = preview_dir / f"{image_file.stem}_old.jpg"
        new_overlay = preview_dir / f"{image_file.stem}_new.jpg"
        pair_overlay = preview_dir / f"{image_file.stem}_pair.jpg"
        render_overlay(image_file, old_pred.detections, old_overlay)
        render_overlay(image_file, new_pred.detections, new_overlay)
        render_side_by_side(old_overlay, new_overlay, pair_overlay)

        y_true.append(gt)
        y_old.append(old_pred.label)
        y_new.append(new_pred.label)
        old_latencies.append(old_pred.latency_ms)
        new_latencies.append(new_pred.latency_ms)
        records.append(
            {
                "image": image_file.name,
                "ground_truth": gt,
                "old_label": old_pred.label,
                "new_label": new_pred.label,
                "old_confidence": old_pred.confidence,
                "new_confidence": new_pred.confidence,
                "old_latency_ms": round(old_pred.latency_ms, 2),
                "new_latency_ms": round(new_pred.latency_ms, 2),
            }
        )
        preview_items.append(
            {
                "image": image_file.name,
                "groundTruth": gt,
                "old": {"label": old_pred.label, "confidence": old_pred.confidence, "latencyMs": round(old_pred.latency_ms, 2)},
                "new": {"label": new_pred.label, "confidence": new_pred.confidence, "latencyMs": round(new_pred.latency_ms, 2)},
                "winner": "old" if (old_pred.label == gt and new_pred.label != gt) else "new" if (new_pred.label == gt and old_pred.label != gt) else "tie",
                "overlays": {
                    "old": str(old_overlay),
                    "new": str(new_overlay),
                    "pair": str(pair_overlay),
                },
            }
        )
        if progress_cb:
            progress_cb(
                {
                    "processed": idx + 1,
                    "total": total,
                    "percent": round(((idx + 1) / total) * 100, 2) if total else 100.0,
                    "currentFile": image_file.name,
                    "previewItem": preview_items[-1],
                }
            )

    labels = CLASS_ORDER
    cm_old = confusion_matrix(y_true, y_old, labels=labels)
    cm_new = confusion_matrix(y_true, y_new, labels=labels)

    p_old, r_old, f1_old, _ = precision_recall_fscore_support(y_true, y_old, labels=labels, zero_division=0)
    p_new, r_new, f1_new, _ = precision_recall_fscore_support(y_true, y_new, labels=labels, zero_division=0)

    metrics = {
        "num_images": len(image_files),
        "old": {
            "macro_f1": float(np.mean(f1_old)),
            "micro_f1": float(precision_recall_fscore_support(y_true, y_old, average="micro", zero_division=0)[2]),
            "avg_latency_ms": mean(old_latencies) if old_latencies else 0.0,
            "p95_latency_ms": _p95(old_latencies),
            "class_metrics": {
                label: {
                    "precision": float(p_old[idx]),
                    "recall": float(r_old[idx]),
                    "f1": float(f1_old[idx]),
                }
                for idx, label in enumerate(labels)
            },
        },
        "new": {
            "macro_f1": float(np.mean(f1_new)),
            "micro_f1": float(precision_recall_fscore_support(y_true, y_new, average="micro", zero_division=0)[2]),
            "avg_latency_ms": mean(new_latencies) if new_latencies else 0.0,
            "p95_latency_ms": _p95(new_latencies),
            "class_metrics": {
                label: {
                    "precision": float(p_new[idx]),
                    "recall": float(r_new[idx]),
                    "f1": float(f1_new[idx]),
                }
                for idx, label in enumerate(labels)
            },
        },
        "decision": {
            "macroF1Delta_new_minus_old": float(np.mean(f1_new) - np.mean(f1_old)),
            "p95LatencyDeltaMs_new_minus_old": float(_p95(new_latencies) - _p95(old_latencies)),
            "drainInletFalseNegatives": {
                "old": sum(1 for truth, pred in zip(y_true, y_old) if truth == "drain_inlet" and pred != "drain_inlet"),
                "new": sum(1 for truth, pred in zip(y_true, y_new) if truth == "drain_inlet" and pred != "drain_inlet"),
            },
        },
    }

    csv_path = run_dir / "per_image_results.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(records[0].keys()) if records else ["image"])
        writer.writeheader()
        writer.writerows(records)

    metrics_path = run_dir / "metrics_summary.json"
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    _plot_confusion(cm_old, labels, "Old Model Confusion Matrix", run_dir / "confusion_old.png")
    _plot_confusion(cm_new, labels, "New Model Confusion Matrix", run_dir / "confusion_new.png")
    _plot_classwise_metrics(labels, list(p_old), list(r_old), list(f1_old), run_dir / "class_metrics_old.png")
    _plot_classwise_metrics(labels, list(p_new), list(r_new), list(f1_new), run_dir / "class_metrics_new.png")
    _plot_latency(old_latencies, new_latencies, run_dir / "latency_comparison.png")

    preview_path = run_dir / "preview_items.json"
    preview_path.write_text(json.dumps(preview_items, indent=2), encoding="utf-8")
    return {"runDir": str(run_dir), "metrics": metrics, "previewItems": preview_items}
