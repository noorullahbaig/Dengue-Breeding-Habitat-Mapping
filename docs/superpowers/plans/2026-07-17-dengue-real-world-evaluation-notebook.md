# Dengue Real-World Evaluation Notebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one Colab/Kaggle-ready Jupyter notebook that downloads Roboflow Version 1, accepts a manually uploaded YOLOv8s checkpoint, reproduces production inference behavior, evaluates all 100 images using three locked metric layers, and exports an LLM-ready ZIP package.

**Architecture:** The notebook is sequential and self-contained. Pure functions handle dataset discovery, YOLO parsing, box conversion, thresholding, matching, metrics, auditing, and serialization; orchestration cells call those helpers after dataset and model acquisition. Ultralytics performs the conventional benchmark, while custom functions calculate the coarse IoU 0.30 and operational image-level analyses.

**Tech Stack:** Python 3.10+, Jupyter/nbformat, Ultralytics 8.4.8, Roboflow 1.3.13, PyTorch, pandas, NumPy, Pillow, matplotlib, scikit-learn, PyYAML.

## Global Constraints

- Roboflow dataset: workspace `mosquito-detection-nqnla`, project `dengue-real-world-eval`, version `1`, export format `yolov8`.
- Evaluate all unique images across train, valid/validation, and test; expected total is exactly 100.
- Model input is a manual `.pt` upload in Colab or Kaggle.
- Raw production inference must call `model.predict(source, verbose=False, imgsz=640, conf=0.08, iou=0.70, augment=False)`.
- Required checkpoint SHA-256 is `af33db97278948b7feb6bddf3ebc351ca757922e47643d05d713b7026eeb3d92`; abort on mismatch.
- Detection floors are Artificial Container `0.316`, Drain Inlet `0.080`, Tire `0.448`.
- Stronger-evidence thresholds are Artificial Container `0.674`, Drain Inlet `0.553`, Tire `0.712`.
- The independent evaluation consumes this locked profile and must not tune or revise it.
- Standard benchmark uses Ultralytics validation; coarse localization uses class-aware one-to-one matching at IoU >= 0.30; primary operational evaluation is image-level presence detection without an IoU requirement.
- Roboflow annotations are the reference standard. Audit warnings do not block evaluation unless the dataset cannot be parsed safely.
- API keys and other secrets must never be written to output files.
- No retraining, threshold tuning, annotation editing, or HTML report generation.

---

### Task 1: Define and test notebook helper contracts

**Files:**
- Create: `/mnt/data/test_dengue_evaluation_helpers.py`
- Create: `/mnt/data/dengue_evaluation_helpers.py`

**Interfaces:**
- Produces: `normalize_class_name`, `xywhn_to_xyxy`, `box_iou`, `parse_yolo_row`, `greedy_class_match`, `binary_metrics`, and `sha256_file` for embedding into the notebook.

- [ ] **Step 1: Write failing tests for class normalization, box conversion, IoU, malformed rows, greedy matching, binary zero-division behavior, and SHA-256 hashing.**
- [ ] **Step 2: Run `python -m pytest /mnt/data/test_dengue_evaluation_helpers.py -v` and verify failures are caused by missing helper implementations.**
- [ ] **Step 3: Implement the minimal pure helper functions with typed arguments, deterministic matching, clamped coordinates, and explicit validation errors.**
- [ ] **Step 4: Re-run the helper tests and verify all tests pass.**

### Task 2: Build notebook setup, secure inputs, dataset download, and audit cells

**Files:**
- Create: `/mnt/data/build_dengue_evaluation_notebook.py`
- Create: `/mnt/data/dengue_real_world_evaluation.ipynb`

**Interfaces:**
- Consumes: helper functions from Task 1.
- Produces: notebook variables `CONFIG`, `DATASET_ROOT`, `DATA_YAML`, `IMAGE_DF`, `GT_DF`, `AUDIT_WARNINGS`, and `MODEL_PATH`.

- [ ] **Step 1: Add a notebook contract test asserting the presence and order of the 16 required sections and fixed protocol constants.**
- [ ] **Step 2: Run the contract test and verify it fails before the notebook exists.**
- [ ] **Step 3: Generate markdown and code cells for pinned installation, runtime detection, deterministic seeds, hidden API-key input, Roboflow download, manual model upload, dataset discovery across all splits, data.yaml parsing, and complete annotation audit.**
- [ ] **Step 4: Ensure the audit creates stable image IDs, parses normalized and absolute boxes, detects empty/missing/malformed labels, unknown IDs, invalid boxes, multi-object/multi-class images, duplicate hashes, and actual image/object counts.**
- [ ] **Step 5: Re-run the notebook contract test and verify the setup/audit contract passes.**

### Task 3: Add standard validation and production inference

**Files:**
- Modify: `/mnt/data/build_dengue_evaluation_notebook.py`
- Regenerate: `/mnt/data/dengue_real_world_evaluation.ipynb`

**Interfaces:**
- Consumes: `DATA_YAML`, `IMAGE_DF`, `GT_DF`, `MODEL_PATH`.
- Produces: `STANDARD_METRICS`, `RAW_PRED_DF`, `PRODUCTION_PRED_DF`, and copied Ultralytics validation artifacts.

- [ ] **Step 1: Extend the contract test to require `model.val(...)`, the exact locked production call, the expected checkpoint SHA, all three detection floors, and all three stronger-evidence thresholds.**
- [ ] **Step 2: Run the test and verify failure before adding the cells.**
- [ ] **Step 3: Add a combined evaluation directory/YAML containing all unique images and labels, preserving split metadata externally while avoiding filename collisions.**
- [ ] **Step 4: Add Ultralytics validation with plots and JSON output, then serialize overall and per-class precision, recall, F1, AP50, and mAP50-95 defensively across Ultralytics result-object variations.**
- [ ] **Step 5: Add sequential per-image production inference using the exact production call, save every raw prediction, apply class-specific floors and advisory bands, and validate model identity and class mapping.**
- [ ] **Step 6: Re-run the contract test and verify all standard-validation and production-inference assertions pass.**

### Task 4: Add coarse-localization and operational metrics

**Files:**
- Modify: `/mnt/data/build_dengue_evaluation_notebook.py`
- Regenerate: `/mnt/data/dengue_real_world_evaluation.ipynb`

**Interfaces:**
- Consumes: `IMAGE_DF`, `GT_DF`, `RAW_PRED_DF`, `PRODUCTION_PRED_DF`.
- Produces: `MATCH_DF`, `COARSE_METRICS`, `IMAGE_RESULTS_DF`, `OPERATIONAL_METRICS`, `PER_CLASS_METRICS_DF`, and `ERROR_CASES_DF`.

- [ ] **Step 1: Extend tests with synthetic datasets covering duplicate predictions, unmatched ground truth, multi-label images, clean backgrounds, and background false alerts.**
- [ ] **Step 2: Verify the new tests fail before orchestration code is added.**
- [ ] **Step 3: Implement one-to-one greedy class-aware matching at IoU >= 0.30 and record TP, FP, FN, duplicate/unmatched outcomes with matched IDs and IoU.**
- [ ] **Step 4: Implement per-class multilabel image metrics: TP, FP, TN, FN, sensitivity, specificity, precision, NPV, F1, balanced accuracy, and accuracy.**
- [ ] **Step 5: Add exact class-set match, any-habitat sensitivity, background rejection specificity, background false-alert rate, and highest-confidence prototype-style outcome.**
- [ ] **Step 6: Re-run all helper and contract tests and verify they pass.**

### Task 5: Add plots, qualitative examples, and structured exports

**Files:**
- Modify: `/mnt/data/build_dengue_evaluation_notebook.py`
- Regenerate: `/mnt/data/dengue_real_world_evaluation.ipynb`

**Interfaces:**
- Consumes: all dataset, prediction, match, and metric tables.
- Produces: timestamped `results/` directory and ZIP with the exact documented directory structure.

- [ ] **Step 1: Extend the contract test to assert all required CSV, JSON, Markdown, PNG, example, and ZIP output paths are declared.**
- [ ] **Step 2: Verify failure before adding export cells.**
- [ ] **Step 3: Add dataset/object charts, operational confusion matrices, per-class metric charts, confidence distributions, and qualitative images with distinguishable ground-truth and prediction boxes.**
- [ ] **Step 4: Add robust writers for `README.md`, `methodology_summary.md`, `evaluation_summary.json`, `run_manifest.json`, `dataset_summary.json`, metric JSON files, all required CSV tables, and copied Ultralytics artifacts.**
- [ ] **Step 5: Ensure methodology output separates planned sampling, observed composition, standard metrics, coarse metrics, operational metrics, limitations, and audit warnings without storing the API key.**
- [ ] **Step 6: Add ZIP creation and Colab download support while printing the Kaggle/local output path.**
- [ ] **Step 7: Re-run the complete contract test and verify all required outputs are represented.**

### Task 6: Verify notebook integrity and deliver

**Files:**
- Verify: `/mnt/data/dengue_real_world_evaluation.ipynb`
- Verify: `/mnt/data/dengue_evaluation_helpers.py`
- Verify: `/mnt/data/test_dengue_evaluation_helpers.py`

**Interfaces:**
- Produces: final downloadable notebook.

- [ ] **Step 1: Parse the notebook with `nbformat.validate` and verify every code cell compiles with `compile(...)`.**
- [ ] **Step 2: Run `python -m pytest /mnt/data/test_dengue_evaluation_helpers.py -v` and verify all tests pass.**
- [ ] **Step 3: Run the notebook contract checker and verify constants, section order, production call, metric layers, output declarations, and secret handling.**
- [ ] **Step 4: Scan the notebook for placeholders, hard-coded API keys, accidental threshold changes, and syntax errors.**
- [ ] **Step 5: Confirm the exact file exists and provide the sandbox download link.**
