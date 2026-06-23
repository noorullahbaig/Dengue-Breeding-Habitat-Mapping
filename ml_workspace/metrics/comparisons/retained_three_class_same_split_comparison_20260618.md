# Retained Three-Class Same-Split Comparison (2026-06-18)

| Model | Precision | Recall | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: |
| new_expanded_20260617 | 0.881 | 0.770 | 0.852 | 0.643 |
| current_live | 0.863 | 0.806 | 0.885 | 0.644 |
| stage1_historical | 0.863 | 0.884 | 0.917 | 0.690 |

## New Minus Current
- precision: +0.018180
- recall: -0.036823
- mAP50: -0.033680
- mAP50_95: -0.001023

## artificial_container

| Model | P | R | F1 | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| new_expanded_20260617 | 0.795 | 0.730 | 0.761 | 0.809 | 0.640 |
| current_live | 0.872 | 0.773 | 0.819 | 0.850 | 0.668 |
| stage1_historical | 0.890 | 0.842 | 0.865 | 0.894 | 0.707 |

## drain_inlet

| Model | P | R | F1 | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| new_expanded_20260617 | 0.943 | 0.914 | 0.928 | 0.976 | 0.671 |
| current_live | 0.932 | 0.907 | 0.920 | 0.973 | 0.619 |
| stage1_historical | 0.938 | 0.981 | 0.959 | 0.992 | 0.661 |

## tire

| Model | P | R | F1 | mAP50 | mAP50-95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| new_expanded_20260617 | 0.905 | 0.665 | 0.767 | 0.770 | 0.618 |
| current_live | 0.784 | 0.739 | 0.761 | 0.833 | 0.645 |
| stage1_historical | 0.761 | 0.829 | 0.794 | 0.866 | 0.701 |

## Negative-Only False Positives at Conf 0.25

| Model | FP images | FP image rate % | Total FP | FP / negative image |
| --- | ---: | ---: | ---: | ---: |
| new_expanded_20260617 | 11 | 22.917 | 12 | 0.2500 |
| current_live | 19 | 39.583 | 26 | 0.5417 |
| stage1_historical | 2 | 4.167 | 2 | 0.0417 |