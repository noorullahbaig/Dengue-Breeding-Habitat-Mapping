# Computer Vision Model and Dataset Recovery Report

Generated: 2026-05-11

Workspace: `/Users/noorullah/Desktop/FYP CODEX`

## Executive Summary

The computer-vision model is implemented in the prototype and is actively used by the reporting workflow. It is not just a placeholder: uploaded images are passed through the backend YOLO inference service, the prediction is returned to the frontend, and the prediction is stored with each public report.

The current model performance problem is real, but the project does not yet have defensible evaluation metrics for the currently integrated model. The live runtime checkpoint is now the retained three-class model at `ml_workspace/models/current_yolo/best.pt` with classes `artificial_container`, `drain_inlet`, and `tire`, confirmed by SHA-256 `215b16ea72f450839966b22e2d17e342d40bf0cd3c6becb38b048dc21eb888e7`. Historical five-class metadata is preserved separately for reference only.

The biggest blocker is dataset alignment. The Investigation Report supports a three-class operational scope, while the local datasets are in mixed states:

- The current model appears aligned with VisText-style source labels, but the full VisText-Mosquito dataset is not locally present.
- MosquitoFusion is locally available and well-formed, but its labels are broad (`Breeding Place`, `Mosquito`, `Mosquito Swarm`) and do not directly match the retained FYP classes.
- The Stagnant Water and Wet Surface dataset is locally available, but it is a flat two-class dataset (`water`, `wet surface`) and needs inspection before it can support habitat-specific training.

I moved the relevant local assets out of Downloads and into `ml_workspace/` so evaluation, training, retraining, and comparisons can now happen in one controlled project area.

## Source Documents Reviewed

The model and dataset interpretation was checked against the current FYP document source-of-truth and the latest Investigation Report candidate:

- `/Users/noorullah/Desktop/FYP CODEX/FYP DOC - CODEX.docx`
- `/Users/noorullah/Desktop/MUHAMMAD NOORULLAH BAIG-TP077979-APD3F2511CS(AI)-IR.docx`

Key CV-related findings from those documents:

- The retained operational classes are `artificial_container`, `drain_inlet`, and `tire`.
- `Bottle` and `Vase` are merged into `artificial_container`.
- `Drain-Inlet` maps to `drain_inlet`.
- `Tire` maps to `tire`.
- `Water Drum` and `Flowerpot` are deferred because current public dataset support is not direct enough.
- `Coconut-Exocarp` is excluded from the Kuala Lumpur urban reporting scope, even though the current model can detect it as a source label.
- VisText-Mosquito is the stronger dataset candidate for class-level structure.
- MosquitoFusion is supplementary because its labels are too broad for direct retained-class training.
- AI output is advisory evidence. Officer review remains the decision authority.

## Current Model Implementation

The integrated model file is now stored here:

```text
ml_workspace/models/current_yolo/best.pt
```

Recorded metadata:

```text
SHA-256: 44499d7de36675cd117398c439f3967ae24ae865feb72794f50d90b8326c4d70
Task: detect
Raw classes: Bottle, Coconut-Exocarp, Drain-Inlet, Tire, Vase
```

The backend loads the model on startup through `ModelInference(settings.model_path)`. The model path now resolves from:

```text
prototype/backend/.env
prototype/backend/.env.local
prototype/backend/app/config.py default fallback
```

The backend health endpoint currently verifies this integration:

```json
{
  "ok": true,
  "database": true,
  "model": true,
  "modelPath": "/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/current_yolo/best.pt",
  "postgis": true
}
```

### Label Mapping Used by the App

The live backend maps raw YOLO labels into public operational labels:

| Raw YOLO label | Public app label | Retained? |
| --- | --- | --- |
| `Bottle` | `artificial_container` | Yes |
| `Vase` | `artificial_container` | Yes |
| `Drain-Inlet` | `drain_inlet` | Yes |
| `Tire` | `tire` | Yes |
| `Coconut-Exocarp` | `unclassified` if no retained detection is present | No |

Confidence bands are assigned in the backend:

| Confidence | Band |
| ---: | --- |
| `>= 0.70` | `high` |
| `>= 0.40` and `< 0.70` | `moderate` |
| `< 0.40` or no retained detection | `low` |

Important interpretation: the displayed confidence score is not a proper model metric. It is only the detector confidence for a specific image. It does not replace mAP, precision, recall, class-level AP, or confusion-matrix evaluation.

## Where Model Output Is Shown and Used

### Citizen Report Flow

The frontend sends an uploaded image and coordinates to the backend pre-check endpoint:

```text
POST /api/reports/precheck
```

The backend temporarily stores the image, runs YOLO inference, returns the prediction summary, and deletes the temporary pre-check image. In the UI, this appears in the report flow as the "AI pre-check" panel with:

- suggested habitat label
- confidence score
- confidence band
- top raw YOLO label
- detection count
- bounding-box overlay
- raw detection list
- advisory warning text

If the model is unavailable, submission is blocked until the backend can produce an advisory result.

### Final Report Submission

Final report submission uses:

```text
POST /api/reports
```

The backend runs inference again on the stored evidence image and saves the model output in the report record:

- `prediction_label`
- `prediction_confidence`
- `prediction_confidence_band`
- `prediction_top_raw_label`
- `prediction_advisory_text`
- `detections`

The stored detections include raw label, confidence, absolute box, normalized box, and source image dimensions. This is enough for later qualitative review of false positives and false negatives if the original image is retained.

### Same-Site Stacking

The app uses `prediction.label` when searching for nearby same-class reports. Only retained stackable classes are considered:

```text
tire
drain_inlet
artificial_container
```

This means poor classification can affect whether a new report is suggested as part of an existing public report cluster.

### Public Map and Status Views

Public-facing views show model output as advisory evidence:

- public map popup
- public report detail
- report status lookup

They display the habitat label, confidence, detection count, and a statement that officer review determines follow-up action.

### Officer Review View

The officer placeholder page shows:

- AI advisory class
- confidence band
- image with bounding-box overlay
- raw detections
- hotspot priority context
- public consent status

The officer workflow uses the AI result as evidence, not as a final decision.

## Current Metrics Status

### Current Model Metrics

No reproducible precision, recall, mAP50, mAP50-95, class AP, or confusion matrix for the currently integrated `best.pt` model was found in the project.

This is the main evaluation gap. The model can run, but the project cannot yet honestly say "the model achieves X mAP" on the retained FYP task because there is no frozen retained-class evaluation split available locally.

### Model Metadata Baseline

Created:

```text
ml_workspace/metrics/baselines/current_yolo_checkpoint_info.json
```

This records the live retained three-class model path, checksum, task, and class names so future comparisons can prove which checkpoint was evaluated.

### MosquitoFusion Dataset Audit

Created:

```text
ml_workspace/metrics/baselines/mosquitofusion_raw_audit.json
```

Audit result:

| Split | Images | Missing labels | Empty labels | Invalid rows |
| --- | ---: | ---: | ---: | ---: |
| Train | 1,053 | 0 | 0 | 0 |
| Validation | 100 | 0 | 0 | 0 |
| Test | 51 | 0 | 0 | 0 |

Instance counts:

| Split | Breeding Place | Mosquito | Mosquito Swarm |
| --- | ---: | ---: | ---: |
| Train | 2,168 | 416 | 57 |
| Validation | 223 | 36 | 6 |
| Test | 81 | 36 | 1 |

Interpretation:

- MosquitoFusion is clean enough to audit and train on technically.
- It is not directly aligned to the retained FYP habitat taxonomy.
- `Breeding Place` may contain useful habitat imagery but needs manual relabelling into `artificial_container`, `drain_inlet`, `tire`, or exclusion.
- `Mosquito` and `Mosquito Swarm` are organism labels, not habitat labels, so they should not be used directly for the retained habitat detector.

### Stagnant Water and Wet Surface Dataset

Moved asset:

```text
ml_workspace/data/raw/stagnant_water_wet_surface
```

Observed local structure:

```text
2,000 .jpeg files
2,001 .txt files
classes.txt: water, wet surface
```

Interpretation:

- This dataset may help with visual water/wet-surface context.
- It is not a direct habitat class dataset.
- It should not be mixed into the retained detector until label format, box quality, and relevance are inspected.

### VisText-Mosquito Status

Moved asset:

```text
ml_workspace/data/raw/vistext_mosquito_incomplete_download
```

Observed local structure:

```text
.DS_Store only
```

Interpretation:

- The full VisText-Mosquito dataset is missing locally.
- This is likely the most important dataset to restore because the current model labels match the VisText-style class structure.
- Without it, baseline evaluation of the current model is incomplete.

## Assets Moved Into Structured Workspace

Created workspace:

```text
ml_workspace/
```

Moved assets:

| Asset | New location | Purpose |
| --- | --- | --- |
| MosquitoFusion Dataset | `ml_workspace/data/raw/mosquitofusion_yolov8` | Supplementary raw YOLO data |
| Stagnant Water and Wet Surface Dataset | `ml_workspace/data/raw/stagnant_water_wet_surface` | Possible contextual water/wet-surface support |
| VisText-Mosquito local folder | `ml_workspace/data/raw/vistext_mosquito_incomplete_download` | Placeholder showing incomplete local download |
| Current `best.pt` model | `ml_workspace/models/current_yolo/best.pt` | Backend-integrated model |

I also searched the remaining downloaded archive files for likely hidden mosquito, VisText, fusion, stagnant-water, YOLO, and `best.pt` assets. No additional relevant mosquito-breeding dataset archive was found. The remaining matches were unrelated assignment or defect-evaluation archives.

Created structure:

```text
ml_workspace/
  data/raw/
  data/prepared/
  data/splits/
  metrics/baselines/
  metrics/comparisons/
  models/current_yolo/
  models/experiments/
  reports/
  runs/evaluation/
  runs/training/
  scripts/
```

## Why Current Performance Is Likely Bad

The poor practical performance likely comes from a combination of these issues:

1. The app taxonomy and model taxonomy are not identical. The model predicts five source labels, while the app retains three operational labels and discards `Coconut-Exocarp`.
2. There is no frozen local test set for the retained three-class task, so performance has not been measured in the same shape the app actually uses.
3. The strongest matching dataset, VisText-Mosquito, is not currently available locally.
4. MosquitoFusion has a broad `Breeding Place` label, so direct training on it would teach a generic breeding-place concept rather than the specific retained classes.
5. Field or user-submitted images may differ from training data in angle, lighting, clutter, distance, and surrounding context.
6. If the model is under-detecting retained classes, the app may produce `unclassified` even when the raw image contains a real habitat.
7. If the model over-detects common object shapes, the public map and stacking workflow can receive wrong class suggestions.

## Recommended Evaluation and Retraining Workflow

### Stage 1: Restore the Most Relevant Dataset

Restore the complete VisText-Mosquito dataset into:

```text
ml_workspace/data/raw/vistext_mosquito/
```

Keep the incomplete folder as evidence of what was found locally:

```text
ml_workspace/data/raw/vistext_mosquito_incomplete_download/
```

### Stage 2: Build a Curated Retained-Class Dataset

Create:

```text
ml_workspace/data/prepared/retained_three_class_yolo/
```

Expected YOLO structure:

```text
retained_three_class_yolo/
  data.yaml
  train/images/
  train/labels/
  valid/images/
  valid/labels/
  test/images/
  test/labels/
```

Recommended class order:

```yaml
names:
  0: artificial_container
  1: drain_inlet
  2: tire
```

Mapping:

- `Bottle` and `Vase` to `artificial_container`
- `Drain-Inlet` to `drain_inlet`
- `Tire` to `tire`
- `Coconut-Exocarp` excluded
- MosquitoFusion `Breeding Place` manually reviewed before inclusion
- MosquitoFusion `Mosquito` and `Mosquito Swarm` excluded from habitat-class training

### Stage 3: Freeze Evaluation Splits

Save split manifests under:

```text
ml_workspace/data/splits/
```

Each split manifest should record:

- dataset version
- source image path
- prepared image path
- assigned retained class
- original source label
- whether the sample came from VisText, MosquitoFusion, or another source
- whether the sample was excluded and why

### Stage 4: Evaluate Current Model Before Retraining

The current checkpoint must be evaluated first to create a baseline.

Example command after the retained dataset exists:

```bash
yolo detect val \
  model=ml_workspace/models/current_yolo/best.pt \
  data=ml_workspace/data/prepared/retained_three_class_yolo/data.yaml \
  project=ml_workspace/runs/evaluation \
  name=current_yolo_retained_three_class
```

Then collect metrics:

```bash
prototype/.venv/bin/python ml_workspace/scripts/collect_yolo_run_metrics.py \
  --run-dir ml_workspace/runs/evaluation/current_yolo_retained_three_class \
  --model-name current_yolo \
  --dataset-name retained_three_class_yolo \
  --out ml_workspace/metrics/baselines/current_yolo_retained_three_class.json
```

### Stage 5: Retrain Only Against the Frozen Dataset

Example:

```bash
yolo detect train \
  model=yolov8n.pt \
  data=ml_workspace/data/prepared/retained_three_class_yolo/data.yaml \
  epochs=100 \
  imgsz=640 \
  project=ml_workspace/runs/training \
  name=yolov8n_retained_three_class_v1
```

Copy or reference the best trained checkpoint under:

```text
ml_workspace/models/experiments/yolov8n_retained_three_class_v1/best.pt
```

Then evaluate it on the same frozen test split used for the baseline.

### Stage 6: Compare Models

Use the comparison helper:

```bash
prototype/.venv/bin/python ml_workspace/scripts/build_metrics_comparison.py \
  ml_workspace/metrics/baselines/current_yolo_retained_three_class.json \
  ml_workspace/metrics/comparisons/yolov8n_retained_three_class_v1.json \
  --out ml_workspace/metrics/comparisons/model_comparison.md
```

Comparison should include:

- precision
- recall
- mAP50
- mAP50-95
- per-class AP
- confusion matrix
- false-positive examples
- false-negative examples
- qualitative officer-review notes
- inference speed if deployment performance matters

### Stage 7: Promote a Model Only If It Improves the App Task

A retrained model should only replace the backend checkpoint if:

- it improves retained-class mAP and recall on the frozen test split
- it does not regress badly on `drain_inlet`, which is likely visually harder than tires and containers
- its class names match the backend mapping or the backend mapping is updated at the same time
- the report UI still shows boxes correctly
- `/api/health` reports model readiness after restart

## Repeatable Commands Now Available

Audit a YOLO dataset:

```bash
prototype/.venv/bin/python ml_workspace/scripts/yolo_dataset_audit.py \
  --dataset ml_workspace/data/raw/mosquitofusion_yolov8 \
  --out ml_workspace/metrics/baselines/mosquitofusion_raw_audit.json
```

Record model metadata:

```bash
prototype/.venv/bin/python ml_workspace/scripts/yolo_model_info.py \
  --model ml_workspace/models/current_yolo/best.pt \
  --out ml_workspace/metrics/baselines/current_yolo_checkpoint_info.json
```

Collect YOLO run metrics:

```bash
prototype/.venv/bin/python ml_workspace/scripts/collect_yolo_run_metrics.py \
  --run-dir ml_workspace/runs/evaluation/current_yolo_retained_three_class \
  --model-name current_yolo \
  --dataset-name retained_three_class_yolo \
  --out ml_workspace/metrics/baselines/current_yolo_retained_three_class.json
```

Build a model comparison table:

```bash
prototype/.venv/bin/python ml_workspace/scripts/build_metrics_comparison.py \
  ml_workspace/metrics/baselines/current_yolo_retained_three_class.json \
  ml_workspace/metrics/comparisons/yolov8n_retained_three_class_v1.json \
  --out ml_workspace/metrics/comparisons/model_comparison.md
```

## Immediate Next Actions

1. Restore the full VisText-Mosquito dataset.
2. Create the retained three-class prepared YOLO dataset.
3. Freeze train, validation, and test splits.
4. Run a baseline evaluation of the current model.
5. Review false positives and false negatives before retraining.
6. Retrain with one controlled experiment at a time.
7. Compare baseline and retrained checkpoints using the same frozen split.
8. Only then consider replacing `ml_workspace/models/current_yolo/best.pt` in the backend.

## Bottom Line

The CV model is implemented and wired into the app, but its current performance is not yet scientifically measured for the retained FYP task. The project now has the correct workspace structure, dataset inventory, model metadata, audit tooling, and comparison tooling to fix that properly. The next decisive step is restoring or rebuilding the retained three-class labelled dataset, then evaluating the current checkpoint before any retraining.
