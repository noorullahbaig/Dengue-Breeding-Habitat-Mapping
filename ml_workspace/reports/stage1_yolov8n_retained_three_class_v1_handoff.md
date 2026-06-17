# Stage 1 YOLOv8n Retained Three-Class Handoff

Updated: 2026-05-13

## Status

Stage 1 is complete and consolidated locally. The model is a YOLO object detector for visible suspected mosquito breeding habitat objects. It outputs bounding boxes, class labels, and confidence scores for advisory officer review. It must not be described as confirming active mosquito breeding, dengue risk, larvae presence, water presence, or field action.

Retained classes:

| ID | Class |
| ---: | --- |
| 0 | `artificial_container` |
| 1 | `drain_inlet` |
| 2 | `tire` |

Stage status:

| Stage | Status | Notes |
| --- | --- | --- |
| Stage 1 | Complete | Trained from the VisText-style Breeding Place Detection source after mapping to the retained three-class taxonomy. |
| Stage 2 | Not started | MosquitoFusion must be relabelled or manually verified before use. |
| Stage 3 | Future | Final detector should use direct labels plus verified or high-confidence MosquitoFusion subclass labels. |

## Dataset Mapping

Source dataset: VisText-Mosquito, Breeding Place Detection / Roboflow-style Breeding Place Detection export.

Mapping:

| Original class | Stage 1 action | Retained class |
| --- | --- | --- |
| `Bottle` | mapped | `artificial_container` |
| `Vase` | mapped | `artificial_container` |
| `Drain-Inlet` | mapped | `drain_inlet` |
| `Tire` | mapped | `tire` |
| `Coconut-Exocarp` | excluded | none |

Local prepared dataset:

```text
ml_workspace/data/prepared/retained_three_class_yolo_v1/
```

Prepared split verification:

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

Label conversion audit:

| Check | Result |
| --- | ---: |
| YOLO polygon rows converted to detection boxes | 161 |
| Invalid label lines after conversion | 0 |
| Negative/background label files after mapping | 1,073 |

Empty label files are intentional negatives/backgrounds after `Coconut-Exocarp` exclusion. Do not remove them.

## Artifacts

Downloaded ZIPs:

| ZIP | SHA-256 |
| --- | --- |
| `stage1_yolov8n_retained_three_class_v1_required_outputs.zip` | `69b2d16d161ef375afa3e677f6a5cc9258b413c3382608afdd27a745dfd724be` |
| `stage1_yolov8n_retained_three_class_v1_test_eval_outputs.zip` | `7a59344c2d8707a52db8f06892df0405c402aa91dc44ba9c25abdbea90afcb15` |

Local Stage 1 training artifacts:

```text
ml_workspace/models/experiments/yolov8n_retained_three_class_v1/
```

Important checkpoint hashes:

| File | SHA-256 |
| --- | --- |
| `weights/best.pt` | `3e27a7e0896a3de81b843011c0be1cc416ecc1e4f2ccbae0efc15524479872b0` |
| `weights/last.pt` | `a4c3ccc1da56974b2ada6a983f823c34c24e0d53dece38cd82fded053e8d982c` |

Downloaded Kaggle test-evaluation plots:

```text
ml_workspace/runs/evaluation/imported/2026-05-13_stage1_yolov8n_retained_three_class_v1_test_eval/
```

Local regenerated test-evaluation metrics and artifacts:

```text
ml_workspace/runs/evaluation/yolov8n_retained_three_class_v1_test_eval_local_rerun/
```

The downloaded test-evaluation ZIP did not include `results.csv` or `args.yaml`, so exact numeric test metrics are recorded from the local rerun.

## Metrics

Validation best row from `results.csv`:

| Best epoch | Precision | Recall | mAP50 | mAP50-95 |
| ---: | ---: | ---: | ---: | ---: |
| 48 | 0.90558 | 0.84895 | 0.89905 | 0.69870 |

Local test rerun using Stage 1 `best.pt`:

| Split | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: |
| test | 0.863 | 0.884 | 0.917 | 0.690 |

Per-class local test results:

| Class | Images | Instances | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `artificial_container` | 63 | 154 | 0.890 | 0.842 | 0.894 | 0.707 |
| `drain_inlet` | 48 | 54 | 0.938 | 0.981 | 0.992 | 0.661 |
| `tire` | 30 | 115 | 0.761 | 0.829 | 0.866 | 0.701 |

Machine-readable metric files:

```text
ml_workspace/metrics/historical/stage1/stage1_yolov8n_retained_three_class_v1_validation_metrics.json
ml_workspace/metrics/historical/stage1/stage1_yolov8n_retained_three_class_v1_test_metrics_local_rerun.json
ml_workspace/metrics/comparisons/stage1_yolov8n_retained_three_class_v1_summary.md
```

## Safeguards

- `ml_workspace/models/current_yolo/best.pt` was not replaced.
- Prototype backend configuration was not changed.
- `FYP DOC - CODEX.docx`, PDFs, and text exports were not edited.
- MosquitoFusion was not merged, trained on, or relabelled during this consolidation.
- Do not use MosquitoFusion broad `Breeding Place` labels directly as `artificial_container`, `drain_inlet`, or `tire`.
- Do not tune Stage 1 from test metrics.
- Do not overwrite Stage 1 `weights/best.pt`; create a new experiment folder for any later model.
