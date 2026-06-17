# Model Compare App (Parallel Evaluation Lane)

This app compares two YOLO checkpoints side-by-side without modifying the existing prototype.

## Default model paths
- Old: `/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/current_yolo/best.pt`
- New: `/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/experiments/yolov8n_retained_three_class_v1/weights/best.pt`

## Setup
```bash
cd "/Users/noorullah/Desktop/FYP CODEX/ml_workspace/model_compare_app"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run web app
```bash
uvicorn app:app --reload --port 8092
```
Open: `http://localhost:8092`

## Run batch evaluation from CLI
```bash
python run_batch.py \
  --images-dir "/Users/noorullah/Desktop/FYP CODEX/ml_workspace/data/prepared/retained_three_class_yolo_v1/test/images" \
  --labels-dir "/Users/noorullah/Desktop/FYP CODEX/ml_workspace/data/prepared/retained_three_class_yolo_v1/test/labels"
```

Artifacts are written under:
- `/Users/noorullah/Desktop/FYP CODEX/ml_workspace/model_compare_app/outputs/single_runs/*`
- `/Users/noorullah/Desktop/FYP CODEX/ml_workspace/model_compare_app/outputs/batch_runs/*`

## Tests
```bash
pytest -q
```
