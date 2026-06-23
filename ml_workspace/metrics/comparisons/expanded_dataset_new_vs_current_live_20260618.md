# Expanded Dataset: New 2026-06-17 Model vs Previous Live Checkpoint

Generated: 2026-06-18

This comparison uses the updated expanded Kaggle test dataset. It compares the new 17 June training run against the checkpoint that was live before the 2026-06-18 promotion.

## Sources

- New model metrics: `ml_workspace/runs/training/2026-06-17_yolov8n_mosquito-breeding-expanded_v1/source_artifacts/mosquito-breeding-expanded_v1_yolov8n_export.zip` -> `training_run/final_metrics_summary.json`
- Previous live metrics: `ml_workspace/runs/evaluation/2026-06-18_previous-live_updated-expanded-test_kaggle/current_live_eval_summary.json`
- Previous live artifact folder: `ml_workspace/runs/evaluation/2026-06-18_previous-live_updated-expanded-test_kaggle`

## Overall Metrics

| Model | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: |
| New 17 June expanded model | 0.869 | 0.749 | 0.800 | 0.610 |
| Previous live checkpoint | 0.814 | 0.665 | 0.653 | 0.511 |
| Delta, new minus current | +0.056 | +0.085 | +0.147 | +0.099 |

## Previous Live Class-Wise Metrics On Updated Test Set

| Class | Precision | Recall | F1 | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `artificial_container` | 0.838 | 0.455 | 0.589 | 0.498 | 0.371 |
| `drain_inlet` | 0.927 | 0.687 | 0.789 | 0.734 | 0.542 |
| `tire` | 0.677 | 0.853 | 0.755 | 0.729 | 0.621 |

## New Model Per-Class mAP50-95 On Updated Test Set

| Class | mAP50-95 |
| --- | ---: |
| `Artificial Container` | 0.489 |
| `Drain Inlet` | 0.679 |
| `Tire` | 0.662 |

## Interpretation

- On the updated expanded Kaggle test set, the new 17 June model is a clear overall improvement over the previous live checkpoint.
- The largest overall gain is mAP50, up by `+0.147`, followed by mAP50-95, up by `+0.099`.
- The current live checkpoint is especially weak on `artificial_container` recall at `0.455`, which explains a large part of its updated-dataset underperformance.
- This result should be interpreted separately from the older retained local test split, where the new model was more mixed.
