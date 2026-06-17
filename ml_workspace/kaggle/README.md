# Kaggle Training Workflow

Use Kaggle for preprocessing and training because the primary dataset is already available there and GPU training is faster than local Mac training.

## Kaggle Dataset

Attach the same Kaggle input used by the original notebook:

```text
/kaggle/input/multi-model-for-mosquito-my-fyp/VisText-Mosquito A Multimodal Dataset for Mosquito/Breeding Place Detection
```

The script can also auto-discover a folder named `Breeding Place Detection` under `/kaggle/input`.

## Run Smoke Test

Upload or paste `train_retained_three_class_yolo.py` into a Kaggle notebook, then run:

```bash
python /kaggle/working/train_retained_three_class_yolo.py \
  --run-name smoke_retained_three_class \
  --epochs 1 \
  --patience 1 \
  --batch 16 \
  --device 0
```

Confirm the script creates:

```text
/kaggle/working/retained_three_class_yolo_v1
/kaggle/working/artifacts/smoke_retained_three_class
/kaggle/working/smoke_retained_three_class_artifacts.zip
```

## Run Full Training

```bash
python /kaggle/working/train_retained_three_class_yolo.py \
  --run-name yolov8n_retained_three_class_v1 \
  --base-model yolov8n.pt \
  --epochs 100 \
  --patience 20 \
  --imgsz 640 \
  --batch 16 \
  --seed 42 \
  --device 0
```

Optional five-class baseline evaluation if the old `best.pt` is attached as a Kaggle input:

```bash
python /kaggle/working/train_retained_three_class_yolo.py \
  --run-name yolov8n_retained_three_class_v1 \
  --epochs 100 \
  --patience 20 \
  --baseline-model /kaggle/input/current-yolo-best/best.pt
```

## Bring Results Back

Download:

```text
/kaggle/working/yolov8n_retained_three_class_v1_artifacts.zip
```

Expected important files inside the artifact bundle:

```text
yolov8n_retained_three_class_v1/best.pt
yolov8n_retained_three_class_v1/metrics_summary.json
yolov8n_retained_three_class_v1/retained_three_class_yolo_v1_audit.json
yolov8n_retained_three_class_v1/retained_three_class_yolo_v1_manifest.jsonl
yolov8n_retained_three_class_v1/training_run/
yolov8n_retained_three_class_v1/test_eval_run/
```

After downloading, place `best.pt` under:

```text
ml_workspace/models/experiments/yolov8n_retained_three_class_v1/best.pt
```

Do not replace `ml_workspace/models/current_yolo/best.pt` until the test metrics and qualitative false-positive/false-negative examples are reviewed.
