# Expanded Model Training Assessment

Generated: 2026-06-18

## Executive Summary

- **The 2026-06-17 model has now been promoted into `ml_workspace/models/current_yolo/best.pt`.** The promoted runtime checkpoint hash is `66a2ecb3ce619207437c241d7c11b7e6c9c4897cb63f6463a762345f7b2d736e`.
- **On the updated expanded Kaggle test set, the promoted 2026-06-17 model is a clear upgrade over the previous live checkpoint.** It improves precision from `0.814` to `0.869`, recall from `0.665` to `0.749`, mAP50 from `0.653` to `0.800`, and mAP50-95 from `0.511` to `0.610`.
- **On the older frozen retained local test split, the result is still mixed.** The new checkpoint improves precision from `0.863` to `0.881`, but loses recall from `0.806` to `0.770`, drops mAP50 from `0.885` to `0.852`, and is effectively flat on mAP50-95 (`0.644` vs `0.643`).
- **The promotion is justified by the updated expanded Kaggle benchmark, not by the older retained local split.** The retained split remains a regression check that still shows class-level caveats.
- **Class-wise behavior explains the tension.** On the updated dataset, the previous live checkpoint is especially weak on `artificial_container` recall (`0.455`), while the promoted model's packaged test mAP50-95 improves all three classes versus the previous live checkpoint's mAP50-95 values.

## What Was Evaluated

This assessment compares four checkpoint identities:

| Checkpoint | Path | SHA-256 |
| --- | --- | --- |
| Promoted current live checkpoint | `ml_workspace/models/current_yolo/best.pt` | `66a2ecb3ce619207437c241d7c11b7e6c9c4897cb63f6463a762345f7b2d736e` |
| Previous live checkpoint | `ml_workspace/models/current_yolo/best_replaced_20260618_new_more_data_model_20260522.pt` | `215b16ea72f450839966b22e2d17e342d40bf0cd3c6becb38b048dc21eb888e7` |
| Canonical approved archive for promoted model | `ml_workspace/models/approved/2026-06-17_yolov8n_mosquito-breeding-expanded_v1/best.pt` | `66a2ecb3ce619207437c241d7c11b7e6c9c4897cb63f6463a762345f7b2d736e` |
| Historical Stage 1 checkpoint | `ml_workspace/models/experiments/yolov8n_retained_three_class_v1/weights/best.pt` | `3e27a7e0896a3de81b843011c0be1cc416ecc1e4f2ccbae0efc15524479872b0` |

Three evidence sources were used:

1. Packaged 2026-06-17 Kaggle run artifacts from `ml_workspace/runs/training/2026-06-17_yolov8n_mosquito-breeding-expanded_v1/source_artifacts/mosquito-breeding-expanded_v1_yolov8n_export.zip`
2. Previous-live Kaggle evaluation artifacts from `ml_workspace/runs/evaluation/2026-06-18_previous-live_updated-expanded-test_kaggle/`
3. Fresh same-split local evaluation on `ml_workspace/data/prepared/retained_three_class_yolo_v1/data.yaml`

The updated expanded Kaggle test comparison is the controlling source for judging the newly expanded dataset. The older retained local split remains useful as a backward-compatibility check because it holds the previous retained benchmark constant.

## New Run Training Assessment

### Dataset Scope

The 2026-06-17 packaged run used a much larger three-class dataset:

| Split | Images | Positive images | Negative images | Negative % | Instances |
| --- | ---: | ---: | ---: | ---: | ---: |
| train | 7377 | 4279 | 3098 | 42.00 | 8677 |
| val | 933 | 534 | 399 | 42.77 | 1007 |
| test | 934 | 496 | 438 | 46.90 | 1163 |

Per-class instance counts:

| Split | Artificial Container | Drain Inlet | Tire |
| --- | ---: | ---: | ---: |
| train | 5411 | 1730 | 1536 |
| val | 655 | 214 | 138 |
| test | 749 | 203 | 211 |

Assessment:

- The expanded dataset is materially larger than the older retained dataset.
- It is still imbalanced toward `Artificial Container`.
- The negative-image share is high enough that background separation should be treated as a first-order quality metric, not a side note.

### Training Dynamics

Packaged run configuration:

- Model: `yolov8n.pt`
- Image size: `640`
- Max epochs: `120`
- Patience: `25`
- Seed: `42`
- Recorded epochs: `85`

Best epoch by packaged validation `mAP50-95`:

| Epoch | Precision | Recall | mAP50 | mAP50-95 |
| ---: | ---: | ---: | ---: | ---: |
| 60 | 0.8541 | 0.8006 | 0.8476 | 0.6345 |

Last recorded epoch:

| Epoch | Precision | Recall | mAP50 | mAP50-95 |
| ---: | ---: | ---: | ---: | ---: |
| 85 | 0.8857 | 0.7763 | 0.8430 | 0.6337 |

Interpretation:

- Precision continued rising late in training.
- Recall softened after the best epoch.
- `mAP50-95` stayed nearly flat from epoch `60` to `85`, which suggests the run had largely converged and later epochs mostly traded recall for precision.

### Packaged Run Metrics

Packaged validation metrics:

| Split | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: |
| val | 0.856 | 0.801 | 0.848 | 0.633 |

Packaged test metrics:

| Split | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: |
| test | 0.869 | 0.749 | 0.800 | 0.610 |

Packaged test per-class `mAP50-95`:

| Class | mAP50-95 |
| --- | ---: |
| Artificial Container | 0.489 |
| Drain Inlet | 0.679 |
| Tire | 0.662 |

Interpretation:

- The packaged run generalizes best to `Drain Inlet`.
- `Artificial Container` is the weakest class in the packaged test results.
- The gap between validation and test on `mAP50` and recall suggests the expanded dataset is harder or more distributionally varied than the validation slice alone indicates.

### Packaged Negative-Only Results

The Kaggle export also included a negative-only test summary for `438` negative images:

| Confidence | FP images | FP image rate % | Total FP | FP / negative image |
| --- | ---: | ---: | ---: | ---: |
| 0.25 | 48 | 10.959 | 55 | 0.1256 |
| 0.50 | 20 | 4.566 | 20 | 0.0457 |

At `0.25`, most packaged false positives were `Artificial Container` (`42`), then `Drain Inlet` (`11`), then `Tire` (`2`).

Assessment:

- The expanded run is not background-robust yet.
- Most false-positive pressure still comes from `Artificial Container`.
- The local retained-split negative analysis below is more comparable to the live system because it uses the same frozen retained test set.

## Updated Expanded Dataset Fair Comparison

This is the primary comparison used for the 2026-06-18 live-model promotion. It compares:

- New 17 June model: packaged test metrics from `ml_workspace/runs/training/2026-06-17_yolov8n_mosquito-breeding-expanded_v1/source_artifacts/mosquito-breeding-expanded_v1_yolov8n_export.zip`
- Previous live checkpoint: Kaggle evaluation moved to `ml_workspace/runs/evaluation/2026-06-18_previous-live_updated-expanded-test_kaggle/`

Saved comparison artifacts:

- `ml_workspace/metrics/baselines/current_live_on_expanded_dataset_20260618_kaggle_metrics.json`
- `ml_workspace/metrics/comparisons/expanded_dataset_new_vs_current_live_20260618.md`

### Overall Metrics On Updated Expanded Test Set

| Model | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: |
| New 17 June expanded model | 0.869 | 0.749 | 0.800 | 0.610 |
| Previous live checkpoint | 0.814 | 0.665 | 0.653 | 0.511 |
| Delta, new minus current | +0.056 | +0.085 | +0.147 | +0.099 |

Interpretation:

- The new model is a clear overall improvement on the updated expanded test set.
- The strongest gain is `mAP50`, up `+0.147`, which means the new model is much better at finding the retained classes under the updated data distribution.
- The `mAP50-95` gain of `+0.099` also matters because it shows stricter localization improved, not only loose detection.

### Previous Live Class-Wise Metrics On Updated Test Set

| Class | Precision | Recall | F1 | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `artificial_container` | 0.838 | 0.455 | 0.589 | 0.498 | 0.371 |
| `drain_inlet` | 0.927 | 0.687 | 0.789 | 0.734 | 0.542 |
| `tire` | 0.677 | 0.853 | 0.755 | 0.729 | 0.621 |

New model packaged test per-class `mAP50-95`:

| Class | New model mAP50-95 | Current live mAP50-95 | Delta |
| --- | ---: | ---: | ---: |
| `Artificial Container` | 0.489 | 0.371 | +0.118 |
| `Drain Inlet` | 0.679 | 0.542 | +0.137 |
| `Tire` | 0.662 | 0.621 | +0.041 |

Interpretation:

- The previous live checkpoint fails hardest on `artificial_container` recall, detecting less than half of updated-test instances (`0.455` recall).
- The new model improves strict AP for every class on the updated test set.
- The smallest new-model class gain is `Tire`, but it still improves mAP50-95 by `+0.041`.

### Updated Dataset Recommendation

The 17 June model has now been promoted into the live runtime path because it improves all four overall metrics and all three class-level mAP50-95 values against the previous live checkpoint on the updated expanded Kaggle benchmark.

## Same-Split Comparison Against The Previous Live Model

Fresh local evaluation was run on:

`ml_workspace/data/prepared/retained_three_class_yolo_v1/data.yaml`

Saved artifacts:

- `ml_workspace/runs/evaluation/2026-06-18_2026-06-17-yolov8n-mosquito-breeding-expanded-v1_retained-three-class-test_local/`
- `ml_workspace/runs/evaluation/2026-06-18_previous-live_retained-three-class-test_local/`
- `ml_workspace/metrics/comparisons/retained_three_class_same_split_comparison_20260618.json`
- `ml_workspace/metrics/comparisons/retained_three_class_same_split_comparison_20260618.md`

### Overall Metrics

| Model | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: |
| New expanded | 0.881 | 0.770 | 0.852 | 0.643 |
| Previous live | 0.863 | 0.806 | 0.885 | 0.644 |
| Stage 1 historical | 0.863 | 0.884 | 0.917 | 0.690 |

New minus current deltas:

| Metric | Delta |
| --- | ---: |
| Precision | `+0.018` |
| Recall | `-0.037` |
| mAP50 | `-0.034` |
| mAP50-95 | `-0.001` |

Interpretation:

- The new model is more conservative overall.
- It improves precision, but gives up too much recall.
- The near-tie on `mAP50-95` hides a more meaningful practical regression in recall and `mAP50`.
- The current live model is still clearly behind Stage 1 on the same test split, mainly because of recall and `mAP50`.

## Class-Wise Comparison

Retained test support:

| Class | Instances |
| --- | ---: |
| artificial_container | 154 |
| drain_inlet | 54 |
| tire | 115 |

### artificial_container

| Model | Precision | Recall | F1 | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| New expanded | 0.795 | 0.730 | 0.761 | 0.809 | 0.640 |
| Previous live | 0.872 | 0.773 | 0.819 | 0.850 | 0.668 |
| Stage 1 historical | 0.890 | 0.842 | 0.865 | 0.894 | 0.707 |

Assessment:

- This is the clearest regression in the new expanded model.
- The new checkpoint loses both precision and recall against the previous live model on the older retained split.
- This class matters because it has the largest support and dominates the dataset, so the regression is operationally important.

### drain_inlet

| Model | Precision | Recall | F1 | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| New expanded | 0.943 | 0.914 | 0.928 | 0.976 | 0.671 |
| Previous live | 0.932 | 0.907 | 0.920 | 0.973 | 0.619 |
| Stage 1 historical | 0.938 | 0.981 | 0.959 | 0.992 | 0.661 |

Assessment:

- This is the strongest class for the new expanded model.
- It improves on the previous live model in every reported metric.
- It even edges above Stage 1 on `mAP50-95`, but Stage 1 still has much stronger recall.
- Support is only `54` instances, so the gain is real but should still be treated cautiously.

### tire

| Model | Precision | Recall | F1 | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| New expanded | 0.905 | 0.665 | 0.767 | 0.770 | 0.618 |
| Previous live | 0.784 | 0.739 | 0.761 | 0.833 | 0.645 |
| Stage 1 historical | 0.761 | 0.829 | 0.794 | 0.866 | 0.701 |

Assessment:

- The new model substantially increases `tire` precision.
- It pays for that with a major recall drop, from `0.739` to `0.665`.
- That means fewer false `tire` alerts, but more missed true `tire` cases.
- If the operational priority is not missing tire-related reports, this trade is unfavorable.

## Background False-Positive Comparison

The retained test split contains `48` negative-only images. This is the most directly useful measure of how noisy each checkpoint is in real deployment-like background scenes.

### Confidence 0.25

| Model | FP images | FP image rate % | Total FP | FP / negative image |
| --- | ---: | ---: | ---: | ---: |
| New expanded | 11 | 22.917 | 12 | 0.2500 |
| Previous live | 19 | 39.583 | 26 | 0.5417 |
| Stage 1 historical | 2 | 4.167 | 2 | 0.0417 |

Per-class false detections at `0.25`:

- New expanded: `artificial_container 8`, `tire 2`, `drain_inlet 2`
- Previous live: `artificial_container 21`, `tire 4`, `drain_inlet 1`
- Stage 1 historical: `artificial_container 2`

### Confidence 0.50

| Model | FP images | FP image rate % | Total FP | FP / negative image |
| --- | ---: | ---: | ---: | ---: |
| New expanded | 3 | 6.250 | 3 | 0.0625 |
| Previous live | 10 | 20.833 | 12 | 0.2500 |
| Stage 1 historical | 1 | 2.083 | 1 | 0.0208 |

Assessment:

- The new expanded model is meaningfully less noisy than the previous live model on background images.
- Most of the previous live model's noise comes from `artificial_container`.
- The new model does not yet recover the background cleanliness of the historical Stage 1 checkpoint.
- This is the strongest argument in favor of the new expanded model, but it is still not enough to offset the class-recall regressions.

## Recommended Next Steps

1. Keep the updated expanded Kaggle test set as the primary decision benchmark because it is the benchmark used for the 2026-06-18 live-model promotion.
2. Keep the older retained local split as a regression test, not as the sole deployment gate.
3. Preserve the previous live checkpoint archive and its evaluation records so later audits can reproduce the pre-promotion state exactly.
4. Run the promoted model through the same app-level smoke checks: representative uploaded photos, advisory label mapping, confidence bands, and nearby-report stacking behavior.
5. Investigate why the older retained local split still shows weaker `artificial_container` and `tire` behavior for the promoted model, because that may indicate a distribution shift between the old retained benchmark and the expanded dataset.

Concrete tuning priorities:

- Review whether the expanded dataset should fully replace the old retained benchmark as the source of truth.
- Check confidence calibration for the new model before deployment, especially for `Artificial Container`.
- Preserve both comparison frames in documentation: updated Kaggle test set for current performance, older retained split for backward compatibility.
- Consider threshold tuning after checkpoint selection, not as a substitute for model comparison.

## Further Questions

- Is the operational goal to minimize false alarms, or to maximize detection coverage for officer review?
- Are the newly added expanded-dataset labels for `Artificial Container` noisier or broader than the retained test taxonomy?
- Does the current live system use a confidence threshold closer to `0.25` or `0.50` in practice, and should that threshold now be tuned for the promoted model?

## Caveats and Assumptions

- The updated expanded Kaggle comparison and the frozen retained local comparison are not directly interchangeable because they use different test sets.
- The updated expanded Kaggle comparison is the fairest source for judging the new dataset update.
- The same-split retained comparison is still useful for backward compatibility and regression analysis.
- Historical Stage 1 metrics come from the stored local rerun JSON for overall and per-class scores, while its negative-only background sweep in this report was recomputed locally for consistency with the new and current checkpoints.
- No deployment change was made during this assessment.
