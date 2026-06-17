# Stage 1 YOLOv8n Retained Three-Class Metrics

| Split | Precision | Recall | mAP50 | mAP50-95 | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Validation best epoch 48 | 0.9056 | 0.8490 | 0.8991 | 0.6987 | Parsed from training `results.csv`; selected by best mAP50-95. |
| Test local rerun | 0.8630 | 0.8840 | 0.9170 | 0.6900 | Regenerated locally from `best.pt` on the prepared test split. |

The downloaded test-evaluation ZIP contains plots and confusion matrices but no metrics CSV/YAML, so the local rerun JSON is the machine-readable test metric source.
