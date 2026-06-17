# Scripts

## `yolo_dataset_audit.py`

Audits a YOLO-format dataset by reading `data.yaml`, counting images, checking labels, and summarising class-instance counts.

Example:

```bash
prototype/.venv/bin/python ml_workspace/scripts/yolo_dataset_audit.py \
  --dataset ml_workspace/data/raw/mosquitofusion_yolov8 \
  --out ml_workspace/metrics/baselines/mosquitofusion_raw_audit.json
```

Use this before training or evaluation so each experiment starts from a known dataset state.

## `yolo_model_info.py`

Records checkpoint metadata, class names, and SHA-256 so model versions can be compared without guessing which `best.pt` was used.

Example:

```bash
prototype/.venv/bin/python ml_workspace/scripts/yolo_model_info.py \
  --model ml_workspace/models/current_yolo/best.pt \
  --out ml_workspace/metrics/baselines/current_yolo_checkpoint_info.json
```

## `collect_yolo_run_metrics.py`

Summarizes an Ultralytics train or validation run directory. It reads `results.csv` when available and records common artifacts such as confusion matrices and PR curves.

Example:

```bash
prototype/.venv/bin/python ml_workspace/scripts/collect_yolo_run_metrics.py \
  --run-dir ml_workspace/runs/evaluation/current_yolo_retained_test \
  --model-name current_yolo \
  --dataset-name retained_three_class_test \
  --out ml_workspace/metrics/baselines/current_yolo_retained_test.json
```

## `build_metrics_comparison.py`

Builds a Markdown comparison table from metric summary JSON files.

Example:

```bash
prototype/.venv/bin/python ml_workspace/scripts/build_metrics_comparison.py \
  ml_workspace/metrics/baselines/current_yolo_retained_test.json \
  ml_workspace/metrics/comparisons/retrained_yolo_retained_test.json \
  --out ml_workspace/metrics/comparisons/model_comparison.md
```

## `prepare_retained_three_class_yolo.py`

Builds the FYP-retained YOLO dataset from the VisText-style five-class source labels.

Mapping:

- `Bottle` and `Vase` -> `artificial_container`
- `Drain-Inlet` -> `drain_inlet`
- `Tire` -> `tire`
- `Coconut-Exocarp` -> excluded from labels

The script accepts both normal YOLO detection rows and YOLO segmentation-style polygon rows. Polygon rows are converted into detection bounding boxes before class remapping.

Example:

```bash
prototype/.venv/bin/python ml_workspace/scripts/prepare_retained_three_class_yolo.py \
  --source ml_workspace/data/raw/vistext_breeding_place_detection_v2 \
  --out ml_workspace/data/prepared/retained_three_class_yolo_v1 \
  --manifest ml_workspace/data/splits/retained_three_class_yolo_v1_manifest.jsonl \
  --audit ml_workspace/metrics/baselines/retained_three_class_yolo_v1_audit.json \
  --include-train-tiny \
  --image-mode symlink \
  --clean
```

For local evaluation, prefer real files or hardlinks for the split being evaluated. Ultralytics may resolve directory-level symlinks back to the raw source labels, which is not suitable for evaluating the prepared three-class labels.

## `evaluate_mapped_predictions.py`

Runs an app-style image-level check by mapping raw YOLO predictions into the retained three-class taxonomy. Use this as a supplementary baseline for the old five-class checkpoint; it does not replace YOLO mAP evaluation.

Historical metric snapshots such as Stage 1 validation/test summaries should be stored under `ml_workspace/metrics/historical/` so they are not confused with live-model baselines.
