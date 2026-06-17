from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - optional enrichment
    yaml = None


METRIC_ALIASES = {
    "precision": ("metrics/precision(B)", "metrics/precision"),
    "recall": ("metrics/recall(B)", "metrics/recall"),
    "mAP50": ("metrics/mAP50(B)", "metrics/mAP50"),
    "mAP50-95": ("metrics/mAP50-95(B)", "metrics/mAP50-95"),
}

EXPECTED_ARTIFACTS = (
    "confusion_matrix.png",
    "confusion_matrix_normalized.png",
    "F1_curve.png",
    "P_curve.png",
    "PR_curve.png",
    "R_curve.png",
    "results.png",
    "results.csv",
    "args.yaml",
)


def read_last_results_row(results_csv: Path) -> dict[str, str] | None:
    if not results_csv.exists():
        return None

    with results_csv.open(newline="", encoding="utf-8") as handle:
        rows = [
            {key.strip(): value.strip() for key, value in row.items()}
            for row in csv.DictReader(handle)
        ]

    return rows[-1] if rows else None


def float_or_none(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def pick_metric(row: dict[str, str] | None, aliases: tuple[str, ...]) -> float | None:
    if row is None:
        return None
    for key in aliases:
        value = float_or_none(row.get(key))
        if value is not None:
            return value
    return None


def read_args_yaml(path: Path) -> dict:
    if yaml is None or not path.exists():
        return {}
    loaded = yaml.safe_load(path.read_text(encoding="utf-8"))
    return loaded if isinstance(loaded, dict) else {}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Summarize metrics and artifacts from an Ultralytics YOLO run directory."
    )
    parser.add_argument("--run-dir", required=True, help="Path to a YOLO train/val run directory")
    parser.add_argument("--model-name", help="Human-readable model name for comparisons")
    parser.add_argument("--dataset-name", help="Human-readable dataset/split name")
    parser.add_argument("--out", help="Optional JSON output path")
    args = parser.parse_args()

    run_dir = Path(args.run_dir).expanduser().resolve()
    if not run_dir.exists():
        raise SystemExit(f"Run directory does not exist: {run_dir}")

    last_row = read_last_results_row(run_dir / "results.csv")
    run_args = read_args_yaml(run_dir / "args.yaml")
    artifacts = [
        str((run_dir / name).resolve())
        for name in EXPECTED_ARTIFACTS
        if (run_dir / name).exists()
    ]

    result = {
        "run_dir": str(run_dir),
        "model_name": args.model_name or run_dir.name,
        "dataset_name": args.dataset_name or run_args.get("data"),
        "metrics": {
            metric_name: pick_metric(last_row, aliases)
            for metric_name, aliases in METRIC_ALIASES.items()
        },
        "artifacts": artifacts,
        "args": run_args,
    }

    output = json.dumps(result, indent=2)
    if args.out:
        output_path = Path(args.out).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
