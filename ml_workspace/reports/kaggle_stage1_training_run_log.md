# Kaggle Stage 1 Training Run Log

## 2026-05-12 Gate 0: Kaggle Data Access

Status: blocked before training.

Purpose:

- Confirm Kaggle CLI authentication.
- Confirm broad/general dataset access for later Stage 2/3 work.
- Confirm whether the subclass Dataset A is accessible on Kaggle.
- Stop before smoke/full training unless Dataset A is available.

Commands run:

```bash
kaggle --version
kaggle kernels list --mine --page-size 10
kaggle datasets list --mine
kaggle datasets files faiyazabdullah/mosquitofusion-dataset
kaggle datasets files noorullahbaig/multi-model-for-mosquito-my-fyp
kaggle datasets list --search "multi model mosquito fyp"
kaggle datasets list --search "multi-model-for-mosquito-my-fyp"
kaggle datasets list --search "VisText Mosquito"
kaggle datasets list --search "Breeding Place Detection"
kaggle datasets list --search "mosquito beeding place"
kaggle datasets list --search "Bottle Coconut-Exocarp Drain-Inlet Tire Vase"
```

Results:

- Kaggle CLI works: `Kaggle CLI 2.1.2`.
- Current account datasets show only `noorullahbaig/test-pic`.
- Current account kernels include `noorullahbaig/retained-three-class-yolo-v1`, but its latest revision is a failed throwaway smoke attempt from 2026-05-11.
- MosquitoFusion is accessible as `faiyazabdullah/mosquitofusion-dataset`.
- `noorullahbaig/multi-model-for-mosquito-my-fyp` is not accessible through the current CLI token: Kaggle returns `403 Forbidden`.
- Public Kaggle CLI searches did not find the required subclass dataset with `Bottle`, `Coconut-Exocarp`, `Drain-Inlet`, `Tire`, and `Vase`.
- Searching `Breeding Place Detection` only surfaced MosquitoFusion and an unrelated water-quality dataset, not the VisText-style retained-class source.

Gate decision:

- Gate 0 failed for Stage 1 because Dataset A is not accessible on Kaggle.
- No training was started.
- Do not proceed to Gate 2 smoke notebook or Gate 3 smoke training until Dataset A is made available on Kaggle.

Next required input:

- Provide a Kaggle dataset slug for the subclass `Breeding Place Detection` dataset, or explicitly approve uploading the verified local copy as a private Kaggle dataset.

Known local Dataset A candidate:

```text
/Users/noorullah/Desktop/FYP/Mosquito_Breeding_Detection/Breeding Place Detection
```

Known required structure:

```text
train/images
train/labels
valid/images
valid/labels
test/images
test/labels
```

Known source labels:

```text
Bottle
Coconut-Exocarp
Drain-Inlet
Tire
Vase
```

## 2026-05-13 Stage 1 Training Output Consolidation

Status: complete.

The Kaggle Stage 1 run outputs were downloaded as two ZIP files and consolidated into the local ML workspace.

Downloaded ZIP hashes:

| ZIP | SHA-256 |
| --- | --- |
| `stage1_yolov8n_retained_three_class_v1_required_outputs.zip` | `69b2d16d161ef375afa3e677f6a5cc9258b413c3382608afdd27a745dfd724be` |
| `stage1_yolov8n_retained_three_class_v1_test_eval_outputs.zip` | `7a59344c2d8707a52db8f06892df0405c402aa91dc44ba9c25abdbea90afcb15` |

Local outputs:

```text
ml_workspace/models/experiments/yolov8n_retained_three_class_v1/
ml_workspace/runs/evaluation/imported/2026-05-13_stage1_yolov8n_retained_three_class_v1_test_eval/
ml_workspace/data/prepared/retained_three_class_yolo_v1/
ml_workspace/runs/evaluation/yolov8n_retained_three_class_v1_test_eval_local_rerun/
```

Validation best row from Kaggle `results.csv`:

| Best epoch | Precision | Recall | mAP50 | mAP50-95 |
| ---: | ---: | ---: | ---: | ---: |
| 48 | 0.90558 | 0.84895 | 0.89905 | 0.69870 |

The downloaded test-eval ZIP did not contain `results.csv` or `args.yaml`. A local CPU rerun was therefore performed using `weights/best.pt` against the regenerated prepared test split.

Local test rerun:

| Precision | Recall | mAP50 | mAP50-95 |
| ---: | ---: | ---: | ---: |
| 0.863 | 0.884 | 0.917 | 0.690 |

Per-class local test rerun:

| Class | Instances | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `artificial_container` | 154 | 0.890 | 0.842 | 0.894 | 0.707 |
| `drain_inlet` | 54 | 0.938 | 0.981 | 0.992 | 0.661 |
| `tire` | 115 | 0.761 | 0.829 | 0.866 | 0.701 |

Important correction made locally:

- `ml_workspace/scripts/prepare_retained_three_class_yolo.py`
- `ml_workspace/kaggle/train_retained_three_class_yolo.py`
- `ml_workspace/kaggle/kernel_retained_three_class_yolo/train_retained_three_class_yolo.py`

These scripts now convert YOLO segmentation-style polygon rows into detection bounding boxes instead of reading only the first four coordinates.

Safeguards:

- `ml_workspace/models/current_yolo/best.pt` was not changed.
- Prototype backend configuration was not changed.
- MosquitoFusion was not merged or trained on.
- The source DOCX and derived document exports were not edited.
