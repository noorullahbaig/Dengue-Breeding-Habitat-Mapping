# DengueWatch YOLOv8s Operating-Threshold Methodology

## Decision status

This document defines the application operating profile for the retrained DengueWatch YOLOv8s checkpoint selected at epoch 44. It supersedes every threshold associated with the retired training run.

Both threshold tiers are selected exclusively from the clean validation confidence curves belonging to the following immutable model and dataset identities.

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

The commonly used Ultralytics prediction default of `0.25` is not retained as an application threshold because it is not an optimum selected from this checkpoint's validation evidence. At `0.25`, validation precision was 0.647 for Artificial Container, 0.880 for Drain Inlet, and 0.769 for Tire. The selected F1 review floors increase those values to 0.815, 0.948, and 0.886 respectively, while validation recall changes from 0.820, 0.839, and 0.775 to 0.751, 0.839, and 0.765.

## Why the application uses two class-specific thresholds

DengueWatch makes two different decisions from a model score:

1. **Detection/review decision:** Does the detector score reach its class-specific F1 floor so that the class label is retained for review?
2. **Stronger-evidence decision:** Is the evidence sufficiently precise to place in the stronger user-facing advisory band?

These decisions have different error costs. Maximum F1 balances false classifications and missed classifications before a class label is retained. Maximum F0.5 places greater weight on precision before the result is presented without the dismissible low-confidence warning. Submission continuity does not depend on retaining a class label: classified low-band and unclassified results both allow the resident to retake the image or submit anyway.

For precision \(P\), recall \(R\), and a chosen weighting parameter \(\beta\), the selection metric is:

\[
F_\beta = (1 + \beta^2) \frac{P R}{\beta^2 P + R}
\]

- **F1 for review floors:** \(\beta=1\) weights precision and recall equally. This is appropriate before retaining a predicted class in the advisory response.
- **F0.5 for stronger evidence:** \(\beta=0.5\) gives precision four times the weight of recall. This is appropriate before presenting a stronger-evidence statement without the warning.

This objective selection follows the application semantics. It is not based on which values happened to look favorable on the independent evaluation, which has not been used.

## Selected operating points

The exact grid maximum is retained for provenance. Runtime values are rounded to three decimal places, avoiding both unwieldy repeating grid fractions and the larger displacement caused by two-decimal rounding.

### Detection/review floors: maximum F1

| Public class | Exact threshold | Deployed threshold | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|
| Artificial Container | 0.546547 | **0.547** | 0.815431 | 0.751365 | 0.782088 |
| Drain Inlet | 0.486486 | **0.486** | 0.948047 | 0.839002 | 0.890198 |
| Tire | 0.448448 | **0.448** | 0.886363 | 0.764703 | 0.821051 |

### Stronger-evidence thresholds: maximum F0.5

| Public class | Exact threshold | Deployed threshold | Precision | Recall | F0.5 |
|---|---:|---:|---:|---:|---:|
| Artificial Container | 0.673674 | **0.674** | 0.868972 | 0.676729 | 0.822255 |
| Drain Inlet | 0.552553 | **0.553** | 0.959990 | 0.827366 | 0.930169 |
| Tire | 0.711712 | **0.712** | 0.935056 | 0.705776 | 0.878009 |

Among correctly detected validation objects retained at the F1 floor, the recall difference to the F0.5 point implies that approximately 9.9% of Artificial Container, 1.4% of Drain Inlet, and 7.7% of Tire detections occupy the uncertain band. These object-level estimates are not direct predictions of resident-facing warning frequency, which must be measured through UAT or deployment telemetry.

## Runtime decision process

Ultralytics inference runs with a global confidence argument of `0.448`, the lowest deployed class floor. This value is an inference envelope rather than a universal acceptance threshold; class-specific post-filtering makes the actual review decision.

The application then applies this sequence:

1. Run inference with `imgsz=640`, `conf=0.448`, `iou=0.70`, and `augment=False`.
2. Map raw model labels to the three public habitat classes.
3. Remove each detection that falls below its predicted class's F1 review floor.
4. If no detection remains, return `unclassified`.
5. Otherwise, use the highest-confidence retained detection as the report summary.
6. Assign the stronger band only when that detection reaches its class's F0.5 threshold; otherwise assign the uncertain band.
7. Return all review-floor-qualified detections. A classified uncertain result or an unclassified result opens the same non-blocking warning, so the review floor changes retained categorisation rather than submission eligibility.

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
- external evaluation may reveal generalization limitations, but it cannot be used to tune this already-locked evaluation profile;
- the existing July 17 independent-evaluation artifacts used checkpoint SHA-256 `6d6a5b75ea3913ebd6cf358faccd0ed75b0e38a57eb72edeaa5a2983e01afdc5`, the retired thresholds, and default prediction settings, so they do not evaluate this checkpoint or operating profile.

If thresholds are reconsidered in the future, the change must use a newly declared calibration protocol and a new versioned operating-profile artifact. The independent test or real-world evaluation set must not be repeatedly inspected and used as a tuning set.

## Reproducibility records

The machine-readable profile is stored at `backend/models/denguewatch_yolov8s_operating_profile.json`. It records exact and deployed F1 review floors, F0.5 stronger-evidence thresholds, validation precision and recall, inference settings, and immutable identities.

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
  --selected-on 2026-07-20
```

Selection is deterministic if multiple curve rows have the same objective score. F1 ties prefer higher recall, then higher precision, then the lower threshold. F0.5 ties prefer higher precision, then higher recall, then the higher threshold. The supplied curves have unique selected maxima, but recording the rule prevents row ordering from changing future derivations.

Tests additionally verify that the derived profile, runtime constants, model metadata, dataset fingerprint, and deployed checkpoint hash remain consistent.

## Report-ready justification

The retrained YOLOv8s model uses a validation-derived two-tier operating policy. Class-specific maximum-F1 review floors of 0.547, 0.486, and 0.448 balance false and missed classifications for Artificial Container, Drain Inlet, and Tire. Maximum-F0.5 thresholds of 0.674, 0.553, and 0.712 define the stronger-evidence band to reduce overstatement. Inference uses 0.448 only as the global envelope required to expose candidates for class-specific filtering. Results below a review floor are unclassified, while results between the two class thresholds retain their label in the uncertain band; both outcomes remain submittable through the dismissible warning. The profile was fixed using clean validation only, and the detector scores are not interpreted as calibrated probabilities.
