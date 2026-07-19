#!/usr/bin/env python3
"""Derive DengueWatch's two-tier operating thresholds from validation curves."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path


CLASS_KEYS = {
    "Artificial Container": "artificial_container",
    "Drain Inlet": "drain_inlet",
    "Tire": "tire",
}


def f_beta(precision: float, recall: float, beta: float) -> float:
    beta_squared = beta**2
    denominator = beta_squared * precision + recall
    if denominator == 0:
        return 0.0
    return (1 + beta_squared) * precision * recall / denominator


def choose_operating_point(rows: list[dict[str, str]], beta: float) -> dict[str, float]:
    candidates = []
    for row in rows:
        precision = float(row["precision"])
        recall = float(row["recall"])
        threshold = float(row["confidence"])
        candidates.append(
            {
                "threshold_raw": threshold,
                "deployed_threshold": round(threshold, 3),
                "precision": precision,
                "recall": recall,
                "f_beta": f_beta(precision, recall, beta),
            }
        )
    if not candidates:
        raise ValueError("At least one validation-curve row is required.")

    if beta > 1:
        # Recall-oriented floors prefer recall, then precision, then the lower
        # threshold if the exported curve contains otherwise identical maxima.
        tie_breaker = lambda point: (
            point["f_beta"],
            point["recall"],
            point["precision"],
            -point["threshold_raw"],
        )
    else:
        # Precision-oriented advisory points prefer precision, then recall,
        # then the higher threshold. This also defines deterministic F1 ties.
        tie_breaker = lambda point: (
            point["f_beta"],
            point["precision"],
            point["recall"],
            point["threshold_raw"],
        )

    return max(candidates, key=tie_breaker)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def derive_profile(
    curve_path: Path,
    *,
    checkpoint_sha256: str,
    dataset_fingerprint: str,
    selected_on: str,
) -> dict:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    with curve_path.open(newline="") as handle:
        for row in csv.DictReader(handle):
            grouped[row["class_name"]].append(row)

    if set(grouped) != set(CLASS_KEYS):
        raise ValueError(f"Unexpected classes: {sorted(grouped)}")
    if any(len(rows) != 1000 for rows in grouped.values()):
        raise ValueError("Expected exactly 1,000 curve points for every class.")

    detection_floors = {
        CLASS_KEYS[class_name]: choose_operating_point(grouped[class_name], beta=2.0)
        for class_name in CLASS_KEYS
    }
    stronger_thresholds = {
        CLASS_KEYS[class_name]: choose_operating_point(grouped[class_name], beta=0.5)
        for class_name in CLASS_KEYS
    }

    return {
        "profile_name": "denguewatch_yolov8s_two_tier_validation_profile",
        "selected_on": selected_on,
        "selection_split": "clean_validation",
        "checkpoint_sha256": checkpoint_sha256,
        "dataset_fingerprint": dataset_fingerprint,
        "source_curve": {
            "filename": curve_path.name,
            "sha256": sha256_file(curve_path),
            "confidence_grid_points_per_class": 1000,
        },
        "inference": {
            "image_size": 640,
            "global_prediction_confidence": min(
                point["deployed_threshold"] for point in detection_floors.values()
            ),
            "nms_iou": 0.7,
            "augment": False,
        },
        "detection_floor_objective": {
            "metric": "F2",
            "beta": 2.0,
            "purpose": "Favor recall for evidence that remains subject to human verification.",
        },
        "stronger_evidence_objective": {
            "metric": "F0.5",
            "beta": 0.5,
            "purpose": "Favor precision before presenting the stronger-evidence advisory band.",
        },
        "detection_floors": detection_floors,
        "stronger_evidence_thresholds": stronger_thresholds,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("curve_csv", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("--checkpoint-sha256", required=True)
    parser.add_argument("--dataset-fingerprint", required=True)
    parser.add_argument("--selected-on", required=True)
    args = parser.parse_args()

    profile = derive_profile(
        args.curve_csv,
        checkpoint_sha256=args.checkpoint_sha256,
        dataset_fingerprint=args.dataset_fingerprint,
        selected_on=args.selected_on,
    )
    args.output_json.write_text(json.dumps(profile, indent=2) + "\n")


if __name__ == "__main__":
    main()
