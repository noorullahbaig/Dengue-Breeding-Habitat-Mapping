from __future__ import annotations

import argparse
import json
from pathlib import Path


METRIC_COLUMNS = ("precision", "recall", "mAP50", "mAP50-95")


def format_metric(value: float | None) -> str:
    if value is None:
        return "not recorded"
    return f"{value:.4f}"


def load_summary(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a Markdown comparison table from metric JSON files.")
    parser.add_argument("summaries", nargs="+", help="Metric summary JSON files")
    parser.add_argument("--out", required=True, help="Markdown output path")
    args = parser.parse_args()

    rows = [load_summary(Path(item).expanduser().resolve()) for item in args.summaries]

    lines = [
        "# YOLO Metrics Comparison",
        "",
        "| Model | Dataset | Precision | Recall | mAP50 | mAP50-95 | Run directory |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ]

    for row in rows:
        metrics = row.get("metrics", {})
        lines.append(
            "| {model} | {dataset} | {precision} | {recall} | {map50} | {map5095} | `{run}` |".format(
                model=row.get("model_name") or "unnamed",
                dataset=row.get("dataset_name") or "unknown",
                precision=format_metric(metrics.get("precision")),
                recall=format_metric(metrics.get("recall")),
                map50=format_metric(metrics.get("mAP50")),
                map5095=format_metric(metrics.get("mAP50-95")),
                run=row.get("run_dir") or "unknown",
            )
        )

    output_path = Path(args.out).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
