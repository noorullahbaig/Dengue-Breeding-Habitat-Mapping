# Comparative Model Audit and Live-Metric Recovery

Generated: 2026-06-15

## Status Note

Superseded on 2026-06-18 by the live-model promotion and canonical workspace cleanup.

- The live runtime checkpoint is no longer the model described below.
- The current live checkpoint is `ml_workspace/models/current_yolo/best.pt` with SHA-256 `66a2ecb3ce619207437c241d7c11b7e6c9c4897cb63f6463a762345f7b2d736e`.
- The previous live checkpoint discussed in this report is now archived at `ml_workspace/models/current_yolo/best_replaced_20260618_new_more_data_model_20260522.pt`.
- Use `ml_workspace/reports/expanded_model_training_assessment_2026-06-18.md` for the current deployment decision record.

## Summary

This audit originally compared two different checkpoints:

- Historical Stage 1 checkpoint: `ml_workspace/models/experiments/yolov8n_retained_three_class_v1/weights/best.pt`
- Then-live runtime checkpoint: `ml_workspace/models/current_yolo/best.pt`

The main conclusion is simple:

- Stage 1 is the only model in this workspace with defensible overall and per-class metrics.
- At the time of this audit, the live deployed model was a different checkpoint and had no reproducible quantitative evaluation artifacts in the repo.
- Because of that gap, Stage 1 metrics must not be reported as live-model performance.

## Checkpoint Identity

Confirmed SHA-256 hashes:

| Checkpoint | Path | SHA-256 |
| --- | --- | --- |
| Then-live runtime model | `ml_workspace/models/current_yolo/best.pt` | `215b16ea72f450839966b22e2d17e342d40bf0cd3c6becb38b048dc21eb888e7` |
| Stage 1 best model | `ml_workspace/models/experiments/yolov8n_retained_three_class_v1/weights/best.pt` | `3e27a7e0896a3de81b843011c0be1cc416ecc1e4f2ccbae0efc15524479872b0` |

These are not the same checkpoint.

The then-live runtime checkpoint metadata proved only:

- task: `detect`
- classes: `artificial_container`, `drain_inlet`, `tire`
- checkpoint hash: `215b16ea72f450839966b22e2d17e342d40bf0cd3c6becb38b048dc21eb888e7`

No reproducible overall or per-class evaluation metrics for that then-live checkpoint were found in the workspace.

## Stage 1 Quantitative Performance

### Validation Metrics

Best validation row from training `results.csv`:

| Split | Best epoch | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| validation | 48 | 0.90558 | 0.84895 | 0.89905 | 0.69870 |

Last validation epoch:

| Split | Last epoch | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| validation | 50 | 0.88776 | 0.86002 | 0.89955 | 0.69447 |

Interpretation:

- Validation precision is strong at `0.90558`.
- Validation recall is lower than precision at `0.84895`, indicating missed detections matter more than class confusion.
- mAP50 is high, but mAP50-95 drops to `0.69870`, which suggests box quality and localization strictness remain a limitation.

### Test Metrics

Recovered from the local Ultralytics CPU rerun of the Stage 1 checkpoint against the prepared retained three-class test split:

| Split | Images | Instances | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| test | 183 | 323 | 0.863 | 0.884 | 0.917 | 0.690 |

Interpretation:

- Test recall `0.884` is slightly higher than validation recall.
- Test precision `0.863` is lower than validation precision, consistent with meaningful false positives.
- Test mAP50 is strong at `0.917`, but mAP50-95 remains moderate at `0.690`, again showing a stricter localization gap.

### Per-Class Test Metrics

| Class | Images | Instances | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `artificial_container` | 63 | 154 | 0.890 | 0.842 | 0.894 | 0.707 |
| `drain_inlet` | 48 | 54 | 0.938 | 0.981 | 0.992 | 0.661 |
| `tire` | 30 | 115 | 0.761 | 0.829 | 0.866 | 0.701 |

Per-class interpretation:

- `drain_inlet` is the strongest class by recall and mAP50, with `0.981` recall and `0.992` mAP50.
- `artificial_container` is solid overall, but its recall `0.842` is weaker than its precision `0.890`, so misses are still relevant.
- `tire` is the weakest class by precision at `0.761`, making it the main false-positive pressure point among retained classes.
- `drain_inlet` has the fewest test instances at `54`, so its excellent numbers should still be treated cautiously because support is materially smaller than the other retained classes.

## Dataset Support and Audit Context

Prepared retained three-class dataset support from the audit artifacts:

### Train Split

| Class | Instances |
| --- | ---: |
| `artificial_container` | 3387 |
| `drain_inlet` | 1164 |
| `tire` | 1635 |

Additional train audit context:

- images: `3871`
- backgrounds: `944`
- excluded `Coconut-Exocarp` instances: `1939`
- polygon rows converted to boxes: `150`

### Validation Split

| Class | Instances |
| --- | ---: |
| `artificial_container` | 306 |
| `drain_inlet` | 135 |
| `tire` | 119 |

Additional validation audit context:

- images: `371`
- backgrounds: `81`
- excluded `Coconut-Exocarp` instances: `171`
- polygon rows converted to boxes: `7`

### Test Split

| Class | Instances |
| --- | ---: |
| `artificial_container` | 154 |
| `drain_inlet` | 54 |
| `tire` | 115 |

Additional test audit context:

- images: `183`
- backgrounds: `48`
- excluded `Coconut-Exocarp` instances: `101`
- polygon rows converted to boxes: `4`

Dataset support interpretation:

- The retained dataset is materially imbalanced.
- `artificial_container` dominates all splits.
- `drain_inlet` has the smallest support in every split, especially on test.
- The number of intentional background images is non-trivial, which makes false-positive behavior important operationally.

## Confusion-Matrix Findings

The Stage 1 normalized confusion matrix shows these main patterns:

- `artificial_container`: about `0.85` correctly detected, with about `0.14` missed to background.
- `drain_inlet`: about `0.98` correctly detected, with very little confusion or miss rate.
- `tire`: about `0.85` correctly detected, with about `0.15` missed to background.
- Background false positives are meaningful:
  - about `0.35` of background false positives are predicted as `artificial_container`
  - about `0.60` of background false positives are predicted as `tire`
  - about `0.05` of background false positives are predicted as `drain_inlet`

The raw confusion matrix reinforces the same pattern:

- true `artificial_container`: `131` correct, `22` missed to background
- true `drain_inlet`: `53` correct, `1` confused as `artificial_container`
- true `tire`: `98` correct, `17` missed to background
- background false positives: `22` as `artificial_container`, `3` as `drain_inlet`, `38` as `tire`

Confusion interpretation:

- Stage 1 does not have a major class-to-class confusion problem between retained classes.
- The more important failure mode is object-vs-background separation.
- `tire` is the most operationally risky retained class from a false-positive perspective.

## Live Runtime Model: What Is Known and Unknown

### Proven Facts

The current live runtime checkpoint:

- path: `ml_workspace/models/current_yolo/best.pt`
- hash: `215b16ea72f450839966b22e2d17e342d40bf0cd3c6becb38b048dc21eb888e7`
- classes: `artificial_container`, `drain_inlet`, `tire`
- is not the same checkpoint as the Stage 1 best model

### Unknown Because the Workspace Lacks Evidence

The following are not currently defensible for the live runtime model:

- overall precision
- overall recall
- overall mAP50
- overall mAP50-95
- per-class precision
- per-class recall
- per-class AP / mAP
- confusion-matrix behavior
- false-positive vs false-negative balance on the retained test split

That absence is the main deployment-risk issue in the current ML workspace.

## Critical Issues

### Critical

**Live deployed model has no reproducible quantitative evaluation in the repo**

- The deployed checkpoint is different from Stage 1.
- The repo contains no reproducible overall or per-class metrics for that live checkpoint.
- Any claim about live-model performance would currently be ungrounded.

### High

**Comparison-app saved artifacts are internally inconsistent and cannot be trusted as model evidence**

Ten saved `compare_result.json` files under `ml_workspace/model_compare_app/outputs/single_runs/` show:

- `new.label = artificial_container`
- while the top detection still has `mappedLabel = drain_inlet`
- and `rawLabel = Drain-Inlet`

Affected sessions:

- `20260524_221040_692570`
- `20260524_221315_664225`
- `20260524_222100_452419`
- `20260524_224614_528712`
- `20260525_091843_181412`
- `20260525_091843_296203`
- `20260525_094743_757444`
- `20260525_094743_757462`
- `20260525_094743_758843`
- `20260525_094743_761459`

This means those comparison artifacts cannot be used as reliable proof of model improvement or regression until serialization or response-integrity is fixed.

### High

**Class support is imbalanced, and `tire` is the weakest retained class by precision**

- Test support is uneven: `artificial_container 154`, `drain_inlet 54`, `tire 115`
- `drain_inlet` has the fewest test instances.
- `tire` has the lowest precision at `0.761`.
- This combination increases the risk of unstable conclusions and operational false positives.

### Medium

**Stage 1 shows meaningful false positives on background, especially for `tire`**

- Background false positives are concentrated most heavily in `tire`.
- This is likely to matter in officer-facing workflows because the model is used as evidence, not a final decision.

### Medium

**Prepared dataset image placement is adequate for recovered evaluation but weak for broad reproducibility**

- The prepared dataset uses mixed reference symlinks for train/valid and real copied files for test.
- That setup was acceptable for the recovered local test rerun.
- It is still a reproducibility hazard for broader local evaluation and training unless image placement is normalized.

## Follow-Up Spec: Live-Metric Recovery

The next quantitative evaluation task should be executed exactly as follows.

### Goal

Generate defensible overall and per-class metrics for the live runtime checkpoint:

- `ml_workspace/models/current_yolo/best.pt`

### Required Preconditions

- Verify the evaluated checkpoint SHA-256 is exactly `215b16ea72f450839966b22e2d17e342d40bf0cd3c6becb38b048dc21eb888e7` before publishing any metrics.
- Use the prepared retained three-class test split already used for the recovered Stage 1 evaluation.
- Keep the evaluated dataset and checkpoint identity frozen in the output artifacts.

### Required Output Locations

- Evaluation run directory:
  - `ml_workspace/runs/evaluation/current_yolo_retained_three_class_test_eval/`
- Machine-readable metric summary:
  - `ml_workspace/metrics/baselines/current_yolo_retained_three_class_test_metrics.json`
- Optional comparison markdown:
  - `ml_workspace/metrics/comparisons/current_vs_stage1_retained_three_class_test.md`

### Required Captures

The live-model evaluation must capture:

- overall precision
- overall recall
- overall mAP50
- overall mAP50-95
- per-class precision
- per-class recall
- per-class mAP50
- per-class mAP50-95
- confusion matrix
- normalized confusion matrix
- PR, P, R, and F1 curves
- prediction samples
- artifact provenance including checkpoint path, hash, dataset path, and run directory

### Publication Rule

Do not report any live-model performance number unless:

- the evaluated checkpoint hash matches the runtime checkpoint hash
- the dataset split is explicitly identified
- machine-readable metrics and evaluation artifacts are both present

## Bottom Line

The best supported model-performance evidence in this workspace is still the historical Stage 1 checkpoint, which performs well overall but has a clear false-positive weakness on background, especially for `tire`, and a class-support imbalance that limits confidence for `drain_inlet`.

The current live deployed model may be better, worse, or similar, but this workspace does not currently prove that. Until the live checkpoint is evaluated directly, the absence of reproducible metrics for the deployed model remains the most serious issue.
