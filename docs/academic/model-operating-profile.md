# DengueWatch YOLOv8s Operating-Threshold Methodology

## Decision status

This document defines the application operating profile for the retrained DengueWatch YOLOv8s checkpoint selected at epoch 44. It supersedes every threshold associated with the retired training run.

The application profile is selected exclusively from the clean validation confidence curves belonging to the following immutable model and dataset identities:

- Checkpoint SHA-256: `af33db97278948b7feb6bddf3ebc351ca757922e47643d05d713b7026eeb3d92`
- Dataset fingerprint: `438a3bed43a94d2ffa0da59e1969a5c130f2851cdf781193a081f6ad6547e215`
- Model: clean YOLOv8s, best checkpoint at epoch 44
- Calibration split: clean validation only
- Confidence-curve resolution: 1,000 points per class
- Image size: 640
- NMS IoU: 0.70
- Augmented inference: disabled

The future independent real-world evaluation is confirmatory and subservient to this locked profile. It may estimate how well the fixed policy transfers to new images, but it must not select, tune, or retrospectively alter these thresholds.

## Why the retired settings cannot be retained

The previous `0.48`, `0.66`, and `0.62` class thresholds were selected for a checkpoint produced by an invalidated training process. Detector confidence distributions are model-specific. Once that checkpoint and its dataset construction were superseded, its thresholds lost their evidential basis even if the application code still functioned technically.

The commonly used Ultralytics prediction default of `0.25` was also not selected from this model's evaluation. Retaining it merely because it was a library default would be an inherited implementation choice, not a result justified by the supplied validation evidence.

## Why the application needs two thresholds per class

DengueWatch makes two different decisions from a model score:

1. **Detection/review decision:** Is the evidence sufficient to return as a possible habitat for human verification?
2. **Stronger-evidence decision:** Is the evidence sufficiently precise to place in the stronger user-facing advisory band?

These decisions have different error costs. A single maximum-F1 threshold treats false positives and false negatives symmetrically and therefore cannot optimally represent both roles.

For precision \(P\), recall \(R\), and a chosen weighting parameter \(\beta\), the selection metric is:

\[
F_\beta = (1 + \beta^2) \frac{P R}{\beta^2 P + R}
\]

- **F2 for detection floors:** \(\beta=2\) gives recall four times the weight of precision. This is appropriate for evidence that remains explicitly uncertain and is sent for human verification.
- **F0.5 for stronger evidence:** \(\beta=0.5\) gives precision four times the weight of recall. This is appropriate before presenting a stronger-evidence statement to a resident.

This objective selection follows the application semantics. It is not based on which values happened to look favorable on the independent evaluation, which has not been used.

## Selected operating points

The exact grid maximum is retained for provenance. Runtime values are rounded to three decimal places, avoiding both unwieldy repeating grid fractions and the larger displacement caused by two-decimal rounding.

### Detection/review floors: maximum F2

| Public class | Exact threshold | Deployed threshold | Precision | Recall | F2 |
|---|---:|---:|---:|---:|---:|
| Artificial Container | 0.316316 | **0.316** | 0.693490 | 0.812925 | 0.785857 |
| Drain Inlet | 0.080080 | **0.080** | 0.802056 | 0.884904 | 0.866993 |
| Tire | 0.448448 | **0.448** | 0.886363 | 0.764703 | 0.786288 |

### Stronger-evidence thresholds: maximum F0.5

| Public class | Exact threshold | Deployed threshold | Precision | Recall | F0.5 |
|---|---:|---:|---:|---:|---:|
| Artificial Container | 0.673674 | **0.674** | 0.868972 | 0.676729 | 0.822255 |
| Drain Inlet | 0.552553 | **0.553** | 0.959990 | 0.827366 | 0.930169 |
| Tire | 0.711712 | **0.712** | 0.935056 | 0.705776 | 0.878009 |

For transparency, the calibration notebook's original maximum-F1 values were approximately `0.547`, `0.486`, and `0.448`. They remain valid descriptions of symmetric validation F1 optima, but they were not adopted as the final application policy because the application has distinct recall-oriented and precision-oriented decisions.

## Runtime decision process

Ultralytics inference runs with a global confidence argument of `0.08`. This is not a universal acceptance threshold; it is the minimum of the three class-specific detection floors and ensures that potentially valid Drain Inlet predictions reach application post-processing.

The application then applies this sequence:

1. Run inference with `imgsz=640`, `conf=0.08`, `iou=0.70`, and `augment=False`.
2. Map raw model labels to the three public habitat classes.
3. Remove each detection that falls below its predicted class's F2 detection floor.
4. If no detection remains, return `unclassified`.
5. Otherwise, use the highest-confidence retained detection as the report summary.
6. Assign the stronger band only when that detection reaches its class's F0.5 threshold; otherwise assign the uncertain band.
7. Return all detection-floor-qualified detections. The stronger threshold changes advisory interpretation, not whether the evidence is returned.

The public API continues to use `high` and `low` as stable internal band identifiers. User-facing language is deliberately evidence-oriented rather than probability-like:

- Stronger band: “The model produced stronger evidence for this habitat class, but final verification is still required.”
- Uncertain band: “The model produced uncertain evidence; human verification is required.”

The application must not describe these scores as calibrated probabilities. A confidence of 0.80 is a detector score, not proof of an 80% probability that the habitat is correct.

## Evidence quality and limitations

The calibration dataset was constructed with leakage controls and no reported cross-split overlap by exact image hash, source family, perceptual-hash component, or leakage component. The validation split contains 541 images. Its object support is 294 Artificial Container, 87 Drain Inlet, and 102 Tire annotations.

The selected values are consequently authoritative for the current validation-derived application policy, but they are not population-wide public-health guarantees. Relevant limitations are:

- the curves are empirical estimates from one validation split;
- observations from the same image are not fully independent;
- the exported curves do not provide bootstrap confidence intervals;
- the curve precision and recall values use the detector evaluation's object-matching definition;
- deployment images may differ from the curated dataset;
- external evaluation may reveal generalization limitations, but it cannot be used to tune this already-locked evaluation profile.

If thresholds are reconsidered in the future, the change must use a newly declared calibration protocol and a new versioned operating-profile artifact. The independent test or real-world evaluation set must not be repeatedly inspected and used as a tuning set.

## Reproducibility records

The machine-readable profile is stored at `backend/models/denguewatch_yolov8s_operating_profile.json`. It records exact thresholds, deployed thresholds, precision, recall, F-beta results, inference settings, and immutable identities.

The authoritative source curve from the supplied `threshold_calibration` package is versioned at `backend/models/validation_f1_curves.csv`, making the deployed selection reproducible without relying on an external desktop folder:

- Curve CSV SHA-256: `1a0274d4742979c248a3f5bce62eb49d17e698710ae75142d722427ee8108510`
- Original maximum-F1 JSON SHA-256: `8b16607e2a6bb1fbffc1f37866c7db62588cbc168d4cab21b6e294d1c4e01a33`

The derivation can be reproduced with:

```bash
python backend/scripts/derive_operating_profile.py \
  backend/models/validation_f1_curves.csv \
  /tmp/denguewatch_yolov8s_operating_profile.json \
  --checkpoint-sha256 af33db97278948b7feb6bddf3ebc351ca757922e47643d05d713b7026eeb3d92 \
  --dataset-fingerprint 438a3bed43a94d2ffa0da59e1969a5c130f2851cdf781193a081f6ad6547e215 \
  --selected-on 2026-07-19
```

Selection is deterministic if multiple curve rows have the same F-beta score. For the recall-oriented F2 floor, ties are resolved by higher recall, then higher precision, then the lower confidence threshold. For the precision-oriented F0.5 advisory point, ties are resolved by higher precision, then higher recall, then the higher confidence threshold. The supplied curves do not require these final tie-break steps at the selected maxima, but recording the rule prevents row ordering from changing future derivations.

Tests additionally verify that the derived profile, runtime constants, model metadata, dataset fingerprint, and deployed checkpoint hash remain consistent.

## Report-ready justification

The retrained YOLOv8s model uses a two-tier, class-specific operating policy derived exclusively from its clean validation confidence curves. Recall-weighted F2 maxima were selected as minimum detection floors because retained detections remain subject to human verification, whereas precision-weighted F0.5 maxima were selected for the stronger-evidence advisory band to reduce overstatement in resident-facing output. This produced detection floors of 0.316, 0.080, and 0.448 and stronger-evidence thresholds of 0.674, 0.553, and 0.712 for Artificial Container, Drain Inlet, and Tire respectively. A global inference confidence of 0.08 is used only to expose candidates for subsequent class-specific filtering. The thresholds were fixed using clean validation evidence before independent real-world evaluation and are not interpreted as calibrated probabilities.
