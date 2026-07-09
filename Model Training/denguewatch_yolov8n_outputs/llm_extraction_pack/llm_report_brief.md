# DengueWatch KL YOLOv8n Run Brief\n\n## Dataset processing summary\n\n```json\n{
  "raw_images": 9377,
  "clean_images": 9244,
  "clean_train_images": 7377,
  "clean_valid_images": 933,
  "clean_test_images": 934,
  "auto_split_used": false,
  "remove_exact_duplicates": true,
  "removed_exact_duplicates": 133,
  "exact_duplicate_group_rows": 266,
  "exact_duplicate_label_difference_groups": 88,
  "near_duplicate_phash_candidates": 4688,
  "label_issue_rows": 2,
  "polygon_rows_converted": 394,
  "label_format_counts": {
    "bbox": 10471,
    "polygon_converted": 394
  },
  "background_images": 3940,
  "class_names": [
    "Artificial Container",
    "Drain Inlet",
    "Tire"
  ],
  "raw_absolute_yaml": "/kaggle/working/denguewatch_yolov8n_workspace/report_artifacts/data_raw_absolute.yaml",
  "clean_data_yaml": "/kaggle/working/denguewatch_yolov8n_workspace/clean_yolo_detection_dataset/data.yaml"
}\n```\n\n## YOLOv8n validation metrics\n\n| candidate   | model_name   | weights                                                                    | eval_split   |   model_size_mb |   precision |   recall |   map50 |   map50_95 |   speed_preprocess_ms |   speed_inference_ms |   speed_postprocess_ms |   AP_Artificial Container |   AP_Drain Inlet |   AP_Tire |
|:------------|:-------------|:---------------------------------------------------------------------------|:-------------|----------------:|------------:|---------:|--------:|-----------:|----------------------:|---------------------:|-----------------------:|--------------------------:|-----------------:|----------:|
| yolov8n     | yolov8n.pt   | /kaggle/working/denguewatch_yolov8n_workspace/runs/yolov8n/weights/best.pt | test         |           5.942 |    0.849041 | 0.788518 | 0.81938 |    0.60089 |              0.915368 |               3.5838 |               0.863851 |                  0.525368 |         0.656835 |  0.620466 |\n\n## Per-class AP\n\n| candidate   | class_name           |       AP |
|:------------|:---------------------|---------:|
| yolov8n     | Artificial Container | 0.525368 |
| yolov8n     | Drain Inlet          | 0.656835 |
| yolov8n     | Tire                 | 0.620466 |\n\n## Final report wording note\n\nUse this as the single YOLO nano result. Dataset preparation included Roboflow curation, YAML correction, polygon-to-box conversion, exact duplicate removal, and background/no-class retention.\n