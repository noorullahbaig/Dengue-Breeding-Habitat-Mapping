# Two-Stage Breeding Habitat Training Plan

Updated: 2026-05-13

## Purpose

The next model should not blindly merge all available mosquito-breeding datasets. The available data has two different label granularities:

- A subclass dataset whose labels are close to the retained Investigation Report taxonomy.
- A general habitat dataset whose label is broad, such as `Breeding Place` or `Breeding Habitat`, without subclass detail.

The best training strategy is therefore staged. First, train a reliable subclass detector from the dataset that already has meaningful object categories. Then use that detector to help convert the broad habitat dataset into subclass labels. Only after that should we train a larger final model on the combined data.

## Target Taxonomy

The first implementation should stay aligned with the currently documented retained classes. The current retained operational classes are:

- `artificial_container`
- `drain_inlet`
- `tire`

For the VisText-style Breeding Place Detection dataset, use this mapping:

- `Bottle` -> `artificial_container`
- `Vase` -> `artificial_container`
- `Drain-Inlet` -> `drain_inlet`
- `Tire` -> `tire`
- `Coconut-Exocarp` -> exclude from retained training for now

Do not add extra final classes such as `plastic_container`, `flowerpot`, or `water_drum` unless the documentation taxonomy is updated and there is enough labelled support. If we need more descriptive UI wording later, it can map `artificial_container` to friendly text without changing the training class name.

## Dataset Roles

### Dataset A: Subclass Source Dataset

This dataset is the first training source because it already contains object-level subclasses similar to the report taxonomy.

Expected role:

- Train the first retained-class YOLO detector.
- Provide clean validation and test metrics for the retained classes.
- Teach the model the visual difference between artificial containers, drain inlets, and tires.

Current local candidate:

- `/Users/noorullah/Desktop/FYP/Mosquito_Breeding_Detection/Breeding Place Detection`
- Workspace reference: `ml_workspace/data/raw/vistext_breeding_place_detection_v2`

### Dataset B: General Habitat Dataset

This dataset should not be merged directly into the subclass training set because its broad habitat labels do not tell the model whether a box is a tire, container, drain inlet, or something else.

Expected role:

- Increase scene diversity after relabelling.
- Provide more real-world habitat examples.
- Feed the second-stage larger model only after subclass assignment or manual verification.

Current local candidate:

- `ml_workspace/data/raw/mosquitofusion_yolov8`
- Source labels include broad classes such as `Breeding Place`, plus non-habitat labels like `Mosquito` and `Mosquito Swarm`.

## Stage 1: Train The Subclass Detector

Status: complete.

Train a YOLO detector using only Dataset A, converted to the retained three-class taxonomy.

Training objective:

- Detect and classify retained breeding-habitat subclasses directly.
- Produce a `best.pt` that can localise boxes and output one of the retained subclasses.

Recommended first run:

- Model: `yolov8n.pt` for the first controlled baseline.
- Classes: `artificial_container`, `drain_inlet`, `tire`.
- Image size: `640`.
- Epochs: start with smoke run, then full training.
- Test split: keep frozen and evaluate only after training.

Required outputs:

- Prepared dataset manifest.
- Class mapping audit.
- Per-class instance counts.
- Precision, recall, mAP50, and mAP50-95.
- Per-class AP.
- Confusion matrix.
- False-positive and false-negative sample review.

Success condition:

- The model is good enough to be used as a relabelling assistant for broad `Breeding Place` boxes, not necessarily good enough to replace the app model immediately.

Completed Stage 1 baseline:

- Model: YOLOv8n.
- Classes: `artificial_container`, `drain_inlet`, `tire`.
- Best validation epoch: 48.
- Validation metrics: precision 0.90558, recall 0.84895, mAP50 0.89905, mAP50-95 0.69870.
- Local test rerun metrics: precision 0.863, recall 0.884, mAP50 0.917, mAP50-95 0.690.
- Checkpoint: `ml_workspace/models/experiments/yolov8n_retained_three_class_v1/weights/best.pt`.
- Full handoff: `ml_workspace/reports/stage1_yolov8n_retained_three_class_v1_handoff.md`.

## Stage 2: Use The Subclass Detector To Relabel General Habitat Data

Run the Stage 1 model on Dataset B and use it to propose subclass labels for broad breeding-habitat annotations.

Relabelling logic:

- For each broad `Breeding Place` box, crop or compare detections inside the box.
- If the Stage 1 detector predicts a retained subclass with sufficient confidence and overlap, assign that subclass to the broad box.
- If multiple subclass detections overlap the same broad box, keep the highest-confidence valid match or split into multiple boxes if the visual evidence supports it.
- If no subclass is confidently found, mark the sample as `needs_review` rather than forcing it into a class.
- Ignore `Mosquito` and `Mosquito Swarm` labels for habitat subclass training.

Quality controls:

- Use conservative confidence and IoU thresholds for automatic labels.
- Save low-confidence and conflict cases for manual review.
- Keep a manifest that records whether each new subclass label came from direct source labels, model pseudo-labels, or human review.
- Do not train the final model on unreviewed low-confidence pseudo-labels.

Recommended label states:

- `direct_label`: from Dataset A original subclass labels.
- `pseudo_label_high_confidence`: from Stage 1 model with strong agreement.
- `manual_verified`: checked and corrected by a human.
- `needs_review`: excluded from final training until resolved.

## Stage 3: Train The Larger Final Model

After Dataset B has been converted into reliable subclass labels, train a larger detector on the combined retained-class data.

Training objective:

- Improve real-world robustness using both precise subclass labels and broader habitat imagery.
- Keep the final output compatible with the app's box-overlay workflow.
- Keep the final class names aligned with the retained documentation taxonomy.

Recommended final dataset composition:

- Dataset A retained three-class labels.
- Dataset B high-confidence pseudo-labels.
- Dataset B manually verified labels.
- Optional hard negatives from Dataset B where broad habitat boxes were rejected after review.

Recommended final model candidates:

- `yolov8n.pt` as a direct comparison baseline.
- `yolov8s.pt` if Kaggle GPU time allows and the baseline proves the data quality is acceptable.

Required evaluation:

- Evaluate Stage 1 and Stage 3 on the same frozen Dataset A test split.
- Create a separate reviewed Dataset B holdout set for measuring general-data improvement.
- Compare old app model, Stage 1 model, and Stage 3 model side by side.
- Review false positives and false negatives before promoting any checkpoint.

## What Not To Do

- Do not directly train a three-class model using Dataset B's broad `Breeding Place` label as if it were a subclass.
- Do not treat `Mosquito` or `Mosquito Swarm` as habitat labels.
- Do not expand the final class list casually just because examples exist; class expansion must match the FYP documentation and have enough labels.
- Do not replace the live backend model until metrics and qualitative sample reviews are acceptable.

## Proposed Workspace Outputs

```text
ml_workspace/data/prepared/retained_three_class_yolo_v1/
ml_workspace/data/prepared/general_habitat_subclass_candidates_v1/
ml_workspace/data/prepared/combined_retained_subclass_yolo_v1/

ml_workspace/models/experiments/yolov8n_retained_three_class_v1/
ml_workspace/models/experiments/yolov8s_combined_retained_subclass_v1/

ml_workspace/metrics/comparisons/stage1_vs_stage3_retained_classes.md
ml_workspace/reports/two_stage_breeding_habitat_training_plan.md
```

## Decision Summary

The plan is a teacher-to-curation-to-final-model workflow:

1. Train a clean retained-subclass detector on the dataset that already has subclass labels.
2. Use that detector to propose subclasses for the broad breeding-habitat dataset.
3. Manually review uncertain or conflicting pseudo-labels.
4. Train a larger final YOLO detector on the combined verified retained-class dataset.

This keeps the model faithful to the documentation while still using the larger general habitat dataset to improve coverage.
