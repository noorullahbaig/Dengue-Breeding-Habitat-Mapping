# Dengue Real-World Evaluation Notebook Design

**Date:** 2026-07-17

## Objective

Create a single Jupyter notebook that runs directly in Google Colab or Kaggle and evaluates the frozen production YOLOv8s model against the independent 100-image Roboflow dataset `mosquito-detection-nqnla/dengue-real-world-eval`, Version 1.

The notebook must download the images and YOLO annotations through a user-supplied Roboflow API key, accept the `.pt` model through manual upload, reproduce the production inference behavior, calculate conventional object-detection metrics and application-level presence-detection metrics, and export a structured result package suitable for later report writing by an LLM.

## Evaluation status and academic framing

The 100 images were not used for model training, validation, checkpoint selection, or threshold selection. The dataset is therefore treated as an independent real-world external evaluation set.

The planned collection design was 100 images: 25 intentionally collected for each of three target habitat categories and 25 background images. The final Roboflow annotations are the evaluation reference standard. The notebook must distinguish the planned image sampling design from the observed annotation inventory because an image may contain multiple objects and the current Roboflow class counts represent bounding-box instances rather than necessarily image counts.

The notebook will evaluate the current Roboflow annotations immediately. Annotation-audit findings will be documented but will not block metric calculation.

## Fixed inputs

- Roboflow workspace slug: `mosquito-detection-nqnla`
- Roboflow project slug: `dengue-real-world-eval`
- Roboflow version: `1`
- Dataset format: YOLOv8
- Evaluate all exported images across `train`, `valid`, and `test`
- Expected unique image count: `100`
- Model input method: manual `.pt` file upload
- Required model SHA-256: `af33db97278948b7feb6bddf3ebc351ca757922e47643d05d713b7026eeb3d92`
- Ultralytics version: `8.4.8`
- Model architecture expected: YOLOv8s
- Production public classes:
  - `Artificial Container`
  - `Drain Inlet`
  - `Tire`

## Production inference behavior

The notebook must reproduce the deployed prototype behavior rather than inventing new tuning settings.

Raw inference uses the locked application settings:

```python
model.predict(source, verbose=False, imgsz=640, conf=0.08, iou=0.70, augment=False)
```

The global `0.08` confidence argument is the minimum class-specific detection floor. Predictions are subsequently filtered by predicted class.

Production class-specific detection floors and stronger-evidence thresholds are:

```python
DETECTION_FLOORS = {
    "Artificial Container": 0.316,
    "Drain Inlet": 0.080,
    "Tire": 0.448,
}
STRONGER_EVIDENCE_THRESHOLDS = {
    "Artificial Container": 0.674,
    "Drain Inlet": 0.553,
    "Tire": 0.712,
}
```

A prediction is returned only when it reaches its class's detection floor. A returned prediction receives the stronger-evidence band only when it also reaches its class's stronger-evidence threshold; otherwise it remains uncertain evidence. These values are locked before independent evaluation and cannot be tuned from its results.

## Dataset ingestion and audit

The notebook must:

1. Request the Roboflow API key through a hidden input field.
2. Download Version 1 in YOLOv8 format.
3. Discover and combine all images and labels from train, validation, and test folders.
4. Preserve original Roboflow split membership in all image-level exports.
5. Verify unique filenames or generate a stable unique identifier when duplicate base filenames exist.
6. Confirm the number of unique evaluated images and prominently flag any value other than 100.
7. Parse every YOLO annotation into absolute and normalized coordinates.
8. Record image width, image height, file size, image hash, split, annotation count, and classes present.
9. Identify images with zero annotations, multi-object images, multi-class images, missing label files, malformed annotation rows, unknown class IDs, invalid or out-of-bounds boxes, and duplicate image hashes.
10. Report both image-level class occurrence counts and object-level bounding-box counts.
11. Treat zero-annotation images as reference background images for immediate evaluation, while flagging them in the audit because original collection folders were not authoritative ground truth.

## Metric design

The notebook must report three complementary evaluation layers. These layers are fixed before results are inspected.

### 1. Conventional object-detection benchmark

Use the standard Ultralytics validation pipeline on a combined evaluation dataset containing all 100 images.

Report precision, recall, F1 where derivable, AP50, mAP50-95, per-class precision, recall, AP50 and mAP50-95, the standard confusion matrix, and precision-recall curves when produced by Ultralytics.

The standard benchmark remains the academically comparable localization result.

### 2. Coarse-localization analysis

Run custom class-aware matching at IoU >= 0.30 using detection-floor-filtered predictions.

Use one-to-one greedy matching within each image and class, ordered by prediction confidence. Report object-level TP, FP, FN, precision, recall, and F1 overall and per class.

This result must be labelled as a study-specific coarse-localization analysis, not a standard object-detection benchmark.

### 3. Primary application-level evaluation

The application only needs to determine whether a target habitat class is present in an image. Its operational evaluation is therefore image-level and does not require box overlap.

For each target class independently:

- Ground-truth positive: at least one annotation of that class exists in the image.
- Predicted positive: at least one prediction of that class passes its class-specific detection floor.
- Calculate TP, FP, TN, FN, sensitivity/recall, specificity, precision, negative predictive value, F1, balanced accuracy, and accuracy.

Also report exact image-level class-set match, any-habitat detection sensitivity, background rejection specificity, false alert rate on zero-annotation background images, image-level multilabel confusion data, and a single-label prototype-style outcome based on the highest-confidence detection-floor-qualified prediction, with `background/unclassified` when no prediction passes. Stratify retained predictions by uncertain and stronger-evidence advisory band without changing the locked thresholds.

For multi-class ground-truth images, the multilabel metrics are authoritative. The prototype-style single-label summary is a secondary operational description.

## Prediction and matching records

The notebook must save every raw model prediction emitted at the global `0.08` inference setting and every prediction retained after class-specific detection-floor filtering.

Each prediction record must include image ID and filename, Roboflow split, predicted class ID and name, confidence, class-specific detection floor, stronger-evidence threshold, floor pass/fail, advisory band, normalized and absolute bounding box, matched ground-truth record when applicable, IoU when matched, and outcome category such as TP, FP, duplicate prediction, class error, or unmatched.

Ground-truth records must include equivalent image, class, and bounding-box fields.

## Reproducibility records

The notebook must capture execution platform, Python version, operating system/runtime details, GPU name and CUDA availability, package versions, exact Ultralytics version, Roboflow workspace/project/version/export format/download timestamp, dataset YAML content, dataset image count and annotation inventory, uploaded model filename/size/SHA-256/task/class names/architecture information available from Ultralytics, random seed, both locked threshold tiers, standard and coarse IoU criteria, and notebook execution timestamp.

Secrets must never be written to output files.

## Visual outputs

Create readable PNG outputs without requiring an HTML report:

- object-count bar chart
- image-level class-occurrence chart
- images-per-annotation-count chart
- standard confusion matrix
- image-level operational confusion matrix or matrices
- per-class operational metric chart
- confidence distributions by class and outcome
- example annotated images for true positives, false positives, false negatives, class errors, and background false alerts

Ground-truth and prediction boxes must be visually distinguishable, and captions must state the confidence, class detection floor, stronger-evidence threshold, and assigned advisory band.

## Export package

Create a timestamped results directory and a downloadable ZIP containing at least:

```text
results/
  README.md
  methodology_summary.md
  evaluation_summary.json
  run_manifest.json
  dataset_summary.json
  metrics/
    standard_metrics.json
    coarse_iou_030_metrics.json
    operational_image_metrics.json
    per_class_metrics.csv
  tables/
    dataset_audit.csv
    image_level_results.csv
    ground_truth_boxes.csv
    raw_prediction_boxes.csv
    production_prediction_boxes.csv
    matched_detections_iou_030.csv
    error_cases.csv
  plots/
    *.png
  examples/
    true_positives/
    false_positives/
    false_negatives/
    class_errors/
    background_false_alerts/
  ultralytics_standard_validation/
    ...
```

`methodology_summary.md` and `evaluation_summary.json` must be written for downstream LLM consumption. They must explicitly separate planned sampling design, observed dataset composition, standard localization metrics, coarse-localization metrics, primary operational image-level metrics, limitations, and audit warnings.

No HTML report will be generated.

## Notebook experience

The notebook must be sequential and runnable from top to bottom in both Colab and Kaggle.

Sections:

1. Purpose and fixed protocol
2. Install pinned dependencies
3. Detect runtime and configure paths
4. Enter Roboflow API key securely
5. Download dataset Version 1
6. Upload model file
7. Audit dataset and annotations
8. Build combined 100-image evaluation YAML
9. Run standard Ultralytics validation
10. Run production inference and save raw predictions
11. Apply class-specific detection floors and stronger-evidence bands
12. Calculate coarse IoU 0.30 metrics
13. Calculate image-level operational metrics
14. Generate charts and qualitative examples
15. Write structured documentation files
16. ZIP and download outputs

The notebook must fail clearly with actionable messages when the API key is invalid, dataset download fails, the model cannot load, model class names do not map to the expected classes, image count is not 100, annotations are malformed, or output creation fails. Nonfatal audit issues should produce warnings and continue.

## Out of scope

- Retraining or fine-tuning the model
- Changing either tier of the locked production operating profile
- Selecting a different checkpoint based on these results
- Editing Roboflow annotations
- Treating Google Drive folder categories as authoritative labels
- Generating an HTML report
- Claiming that 100 images establish population-wide clinical or public-health performance

## Success criteria

The design is complete when one notebook can be opened in Colab or Kaggle, run from top to bottom with a hidden Roboflow API key and the required `.pt` file, evaluate all 100 Version 1 images, reproduce the locked two-tier production behavior without tuning it, report the three evaluation layers, and produce the complete ZIP package without leaking secrets.
