# DengueWatch KL YOLOv8s Run Brief\n\n## Dataset processing summary\n\n```json\n{
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
  "raw_absolute_yaml": "/kaggle/working/denguewatch_yolov8s_workspace/report_artifacts/data_raw_absolute.yaml",
  "clean_data_yaml": "/kaggle/working/denguewatch_yolov8s_workspace/clean_yolo_detection_dataset/data.yaml"
}\n```\n\n## YOLOv8s validation metrics\n\n| candidate   | model_name   | weights                                                                    | eval_split   |   model_size_mb |   precision |   recall |    map50 |   map50_95 |   speed_preprocess_ms |   speed_inference_ms |   speed_postprocess_ms |   AP_Artificial Container |   AP_Drain Inlet |   AP_Tire |
|:------------|:-------------|:---------------------------------------------------------------------------|:-------------|----------------:|------------:|---------:|---------:|-----------:|----------------------:|---------------------:|-----------------------:|--------------------------:|-----------------:|----------:|
| yolov8s     | yolov8s.pt   | /kaggle/working/denguewatch_yolov8s_workspace/runs/yolov8s/weights/best.pt | test         |          21.457 |    0.858852 | 0.783834 | 0.828141 |   0.632445 |              0.906675 |              8.43613 |               0.819833 |                  0.558548 |         0.699983 |  0.638805 |\n\n## Per-class AP\n\n| candidate   | class_name           |       AP |
|:------------|:---------------------|---------:|
| yolov8s     | Artificial Container | 0.558548 |
| yolov8s     | Drain Inlet          | 0.699983 |
| yolov8s     | Tire                 | 0.638805 |\n\n## Final report wording note\n\nUse this as the single YOLO small result. Dataset preparation included Roboflow curation, YAML correction, polygon-to-box conversion, exact duplicate removal, and background/no-class retention.\n