Stage 1 YOLOv8n retained three-class model export.

Model:
YOLOv8n

Classes:
0 artificial_container
1 drain_inlet
2 tire

Best validation result:
Best epoch: 48
Precision: 0.90558
Recall: 0.84895
mAP50: 0.89905
mAP50-95: 0.69870

Important files:
- weights/best.pt: best checkpoint
- weights/last.pt: final checkpoint
- results.csv: epoch metrics
- confusion_matrix.png: validation confusion matrix
- BoxPR_curve.png, BoxF1_curve.png, BoxP_curve.png, BoxR_curve.png: validation curves
- prepared_dataset_metadata/data.yaml: YOLO dataset configuration
- class_mapping_audit.csv: original-to-retained class mapping
- dataset_manifest.csv: prepared dataset audit

This is Stage 1 only. MosquitoFusion has not been used yet.
