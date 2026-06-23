# Dataset Inventory

Generated from locally available downloads on 2026-05-11.

Updated on 2026-06-18 after canonical workspace cleanup and live-model promotion.

## Moved Assets

| Asset | New location | Local size | Notes |
| --- | --- | ---: | --- |
| MosquitoFusion Dataset | `ml_workspace/data/raw/mosquitofusion_yolov8` | 93 MB | Complete Roboflow YOLO export with `train`, `valid`, and `test` folders. Source classes are `Breeding Place`, `Mosquito`, and `Mosquito Swarm`. |
| Stagnant water and Wet surface Dataset | `ml_workspace/data/raw/stagnant_water_wet_surface` | 46 MB | Flat image/text dataset with 2,000 `.jpeg` files and 2,001 `.txt` files. Requires format inspection before use. |
| VisText-Mosquito folder | `ml_workspace/data/raw/vistext_mosquito_incomplete_download` | 8 KB | Incomplete local download; only `.DS_Store` was present. The full dataset still needs to be obtained before VisText-based validation or retraining can be reproduced locally. |
| VisText-style Breeding Place Detection | `ml_workspace/data/raw/vistext_breeding_place_detection_v2` | Symlink | Points to `/Users/noorullah/Desktop/FYP/Mosquito_Breeding_Detection/Breeding Place Detection`. Use as a local reference only; the first proper training run should preprocess from the Kaggle input copy. |
| Current YOLO model | `ml_workspace/models/current_yolo/best.pt` | 6 MB | Current model integrated by the backend. Promoted on 2026-06-18 from the canonical approved archive. Confirmed SHA-256 is `66a2ecb3ce619207437c241d7c11b7e6c9c4897cb63f6463a762345f7b2d736e`. Model class names are `Artificial Container`, `Drain Inlet`, and `Tire`. |
| Previous live YOLO model | `ml_workspace/models/current_yolo/best_replaced_20260618_new_more_data_model_20260522.pt` | 6 MB | Archived previous live checkpoint preserved during promotion. Confirmed SHA-256 is `215b16ea72f450839966b22e2d17e342d40bf0cd3c6becb38b048dc21eb888e7`. |
| 2026-06-17 expanded training record | `ml_workspace/runs/training/2026-06-17_yolov8n_mosquito-breeding-expanded_v1` | 183 MB+ | Canonical training record containing the original downloaded zip, extracted Kaggle export contents, named checkpoints, and training metadata. |
| Stage 1 retained YOLOv8n outputs | `ml_workspace/models/experiments/yolov8n_retained_three_class_v1` | 139 MB | Downloaded weights, validation metrics, plots, and training artifacts from the Kaggle Stage 1 run. |
| Stage 1 archived test-eval ZIP | `ml_workspace/runs/evaluation/archives/2026-05-13_stage1_yolov8n_retained_three_class_v1_test_eval_outputs.zip` | 6 MB | Downloaded test-evaluation ZIP preserved unchanged as a source artifact. |
| Stage 1 imported test-eval plots | `ml_workspace/runs/evaluation/imported/2026-05-13_stage1_yolov8n_retained_three_class_v1_test_eval` | 6 MB | Extracted read-only copy of the downloaded test-evaluation plots and prediction images. Numeric metrics were not included in the ZIP and were regenerated locally. |
| Stage 1 prepared retained dataset | `ml_workspace/data/prepared/retained_three_class_yolo_v1` | local labels plus image references | Regenerated local labels/metadata from the raw Breeding Place Detection source. Train/valid images are source-directory symlinks for reference; test images are local copies for Ultralytics evaluation against prepared labels. |

## MosquitoFusion Split Counts

| Split | Images | Label files |
| --- | ---: | ---: |
| Train | 1,053 | 1,053 |
| Validation | 100 | 100 |
| Test | 51 | 51 |
| Total | 1,204 | 1,204 |

## Immediate Interpretation

MosquitoFusion is useful as supplementary breeding-site imagery, but it does not directly match the retained FYP classes because its labels are broader than the required `artificial_container`, `drain_inlet`, and `tire` taxonomy.

The current `best.pt` model is the promoted 2026-06-17 retained three-class checkpoint. The previous live model is preserved under a dated archival filename so old evaluations can still point to the exact file they measured.

## Stage 1 Prepared Dataset Verification

The retained three-class dataset was regenerated locally after fixing polygon conversion in the preparation script.

| Split | Images | Labels | Non-empty labels | Empty labels |
| --- | ---: | ---: | ---: | ---: |
| train | 3,871 | 3,871 | 2,927 | 944 |
| valid | 371 | 371 | 290 | 81 |
| test | 183 | 183 | 135 | 48 |

Retained object counts:

| Class | Count |
| --- | ---: |
| `artificial_container` | 3,847 |
| `drain_inlet` | 1,353 |
| `tire` | 1,869 |
| Total | 7,069 |

Conversion audit:

- YOLO segmentation-style polygon rows converted to detection boxes: 161.
- Invalid lines after conversion: 0.
- Empty label files are intentional negatives/backgrounds after `Coconut-Exocarp` exclusion and must be preserved.

The local `data.yaml` now uses:

```yaml
path: ml_workspace/data/prepared/retained_three_class_yolo_v1
```

Do not use this local prepared folder for new training until train/valid image placement is converted from reference symlinks to real files, hardlinks, or a Kaggle dataset. The current local image arrangement is sufficient for the completed test rerun because the test images were copied locally.
