# Computer Vision Workspace

This workspace keeps the FYP computer-vision assets separate from the web prototype so datasets, models, metrics, and experiment outputs can be managed reproducibly.

## Current Structure

- `data/raw/`: downloaded source datasets, preserved in their original form.
- `data/prepared/`: curated datasets aligned to the FYP retained taxonomy.
- `data/splits/`: frozen split manifests for repeatable train/validation/test runs.
- `models/current_yolo/`: currently integrated model used by the prototype backend.
- `models/approved/`: manually approved model checkpoints archived before promotion into the prototype runtime path.
- `models/experiments/`: training outputs and experimental checkpoints; these are not automatically active in the prototype.
- `metrics/baselines/`: current live-model metadata and dataset audit outputs.
- `metrics/historical/`: historical metric snapshots retained for reference only.
- `metrics/comparisons/`: side-by-side comparison reports across model versions.
- `runs/training/`: training logs and generated artefacts.
- `runs/evaluation/`: evaluation logs, confusion matrices, PR curves, and prediction samples.
- `reports/`: written model and dataset audit reports.
- `scripts/`: repeatable helper scripts for auditing, training, and evaluation.
- `kaggle/`: Kaggle-first preprocessing, training, evaluation, and artifact-export workflow.

Start with `reports/cv_model_dataset_recovery_report.md` for the current model status, dataset recovery notes, and the recommended evaluation/retraining sequence.

For custom evaluation collection, use `reports/custom_evaluation_collection_guide.md`. It explains the Google Drive folder layout, naming convention, and what counts as `drain_inlet`, `artificial_container`, neutral background, and vehicle-tire negatives.

The staged retraining strategy is documented in `reports/two_stage_breeding_habitat_training_plan.md`. It explains how to first train a retained-class subclass detector, then use it to curate broad `Breeding Place` labels before training a larger final model.

Kaggle execution status is tracked in `reports/kaggle_stage1_training_run_log.md`; check it before submitting any remote training job.

Stage 1 has now been consolidated locally. The complete handoff is in `reports/stage1_yolov8n_retained_three_class_v1_handoff.md`.

Key Stage 1 paths:

- `models/experiments/yolov8n_retained_three_class_v1/`: downloaded validation artifacts and Stage 1 checkpoints.
- `runs/evaluation/archives/2026-05-13_stage1_yolov8n_retained_three_class_v1_test_eval_outputs.zip`: archived downloaded Stage 1 test-evaluation ZIP.
- `runs/evaluation/imported/2026-05-13_stage1_yolov8n_retained_three_class_v1_test_eval/`: extracted read-only copy of the downloaded Stage 1 test-evaluation visuals.
- `data/prepared/retained_three_class_yolo_v1/`: regenerated retained three-class labels and metadata.
- `runs/evaluation/yolov8n_retained_three_class_v1_test_eval_local_rerun/`: local test rerun used to recover exact test metrics.
- `metrics/historical/stage1/stage1_yolov8n_retained_three_class_v1_validation_metrics.json`: historical Stage 1 validation best-row metrics.
- `metrics/historical/stage1/stage1_yolov8n_retained_three_class_v1_test_metrics_local_rerun.json`: historical Stage 1 local test metrics.

## Retained FYP Taxonomy

The latest Investigation Report supports a bounded three-class operational taxonomy:

- `artificial_container`: merged from source labels such as `Bottle` and `Vase`.
- `drain_inlet`: mapped from `Drain-Inlet`.
- `tire`: mapped from `Tire`.

Classes such as `Water Drum` and `Flowerpot` remain deferred because the current public datasets do not provide direct enough label support. `Coconut-Exocarp` is present in the current YOLO model but is not retained for the Kuala Lumpur urban reporting scope.

## Recommended Workflow

1. Keep raw downloads unchanged under `data/raw/`.
2. Build a curated retained-class dataset under `data/prepared/` locally only for audits, or under `/kaggle/working/` for GPU training.
3. Freeze train/validation/test membership in `data/splits/`.
4. Evaluate the current model before retraining and store live-model outputs under `metrics/baselines/`; store historical references under `metrics/historical/`.
5. Train new experiments into `models/experiments/<date>_<model>_<dataset>/`.
6. Store all evaluation outputs under `runs/evaluation/` and summarize results in `metrics/comparisons/`.

Useful helper scripts:

- `scripts/yolo_dataset_audit.py`: dataset structure and label audit.
- `scripts/yolo_model_info.py`: checkpoint metadata and class-name recording.
- `scripts/collect_yolo_run_metrics.py`: Ultralytics run metric summary.
- `scripts/build_metrics_comparison.py`: Markdown comparison table generation.

The prototype backend points to `models/current_yolo/best.pt` as the stable runtime model path. Archive approved checkpoints under `models/approved/...`, then promote the selected file into `models/current_yolo/best.pt` instead of pointing the prototype directly at a download or experiment path.

For the first proper retraining run, use `kaggle/train_retained_three_class_yolo.py` so preprocessing and training happen where the Kaggle dataset and GPU are available.

Current integrated model (promoted on 2026-05-25):

- Runtime path: `models/current_yolo/best.pt`
- Approved archive: `models/approved/new_more_data_model_20260522/best.pt`
- Original local source: `/Users/noorullah/Downloads/best.pt`
- Interpretable comparison label: `new_more_data_model`
- SHA-256: `215b16ea72f450839966b22e2d17e342d40bf0cd3c6becb38b048dc21eb888e7`
- Classes: `artificial_container`, `drain_inlet`, `tire`

Current live-model metrics status:

- Live checkpoint metadata is recorded in `metrics/baselines/current_yolo_checkpoint_info.json`.
- No reproducible precision, recall, mAP50, or mAP50-95 metrics are currently recorded in this workspace for the live `models/current_yolo/best.pt` checkpoint.
- Stage 1 metrics under `metrics/historical/stage1/` are historical reference metrics only and must not be reported as live-model performance.

Important safeguards:

- `models/current_yolo/best.pt` is the only model path that the prototype should load by default.
- Stage 1 `models/experiments/yolov8n_retained_three_class_v1/weights/best.pt` must not be overwritten.
- Approved checkpoints under `models/approved/` should not be overwritten; create a new dated folder for another approved model.
- MosquitoFusion remains reserved for Stage 2 relabelling and must not be directly merged into the three-class detector.
- The model should be described as YOLO object detection for visible suspected mosquito breeding habitat objects, not as confirmation of active breeding or dengue risk.
