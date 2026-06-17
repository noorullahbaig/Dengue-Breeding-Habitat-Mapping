from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from batch_eval import run_batch_eval


def main() -> None:
    parser = argparse.ArgumentParser(description="Run old vs new batch model evaluation.")
    parser.add_argument("--images-dir", required=True)
    parser.add_argument("--labels-dir", required=True)
    parser.add_argument(
        "--old-model",
        default="/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/current_yolo/best.pt",
    )
    parser.add_argument(
        "--new-model",
        default="/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/experiments/yolov8n_retained_three_class_v1/weights/best.pt",
    )
    parser.add_argument(
        "--output-root",
        default="/Users/noorullah/Desktop/FYP CODEX/ml_workspace/model_compare_app/outputs",
    )
    args = parser.parse_args()

    result = run_batch_eval(
        old_model_path=Path(args.old_model),
        new_model_path=Path(args.new_model),
        images_dir=Path(args.images_dir),
        labels_dir=Path(args.labels_dir),
        run_dir=Path(args.output_root) / "batch_runs" / datetime.now().strftime("%Y%m%d_%H%M%S"),
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
