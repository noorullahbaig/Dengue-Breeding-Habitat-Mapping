# Custom Evaluation Collection Guide

Use this guide to build a **held-out evaluation-only** image set in Google Drive. Do not use these images for training, threshold tuning, or pseudo-labeling.

## Goal

The current model evidence suggests:

- `drain_inlet` still needs stronger coverage
- `artificial_container` needs a balanced evaluation set
- `tire` does **not** need more positive collection right now, but we do need negative checks for tires attached to cars or other vehicles

Recommended evaluation intake target:

- `drain_inlet`: `200` images
- `artificial_container`: `200` images
- `neutral_general`: `200` images
- `neutral_vehicle_tires`: `120` to `150` images
- Optional `tire` positives: only collect opportunistically if you already have clear standalone tire habitat images

Minimum usable evaluation set:

- `120` `drain_inlet`
- `120` `artificial_container`
- `150` neutral images total
- at least `80` of the neutral images should be vehicle-tire negatives

## What Counts As What

- `drain_inlet`: real drain openings, road inlets, curb inlets, grated or open drain features
- `artificial_container`: bottles, pots, buckets, vases, drums, containers that fit the retained habitat taxonomy
- `tire`: only standalone or discarded tires that are the actual habitat object
- `neutral_vehicle_tires`: tires on cars, motorcycles, bicycles, carts, machinery, or any mounted tire that should **not** count as `tire`
- `neutral_general`: any scene with no retained target class

If a tire is attached to a vehicle, treat it as **neutral**, not `tire`.

## Google Drive Folder Layout

Create one top-level folder:

```text
FYP_Custom_Eval_Collection_v1
```

Inside it, create these folders:

```text
00_README
01_drain_inlet
02_artificial_container
03_tire_positive_optional
04_neutral_general
05_neutral_vehicle_tires
06_hold_for_review
07_final_selected_eval_set
08_rejected_duplicates_or_bad_quality
```

Folder purpose:

- `00_README`: this guide and any collection notes
- `01_drain_inlet`: confirmed drain inlet positives
- `02_artificial_container`: confirmed artificial container positives
- `03_tire_positive_optional`: only clear standalone or discarded tire positives
- `04_neutral_general`: ordinary neutral scenes
- `05_neutral_vehicle_tires`: vehicle-mounted tires and other tire false-positive checks
- `06_hold_for_review`: ambiguous images you are not sure how to classify
- `07_final_selected_eval_set`: frozen final evaluation set after review
- `08_rejected_duplicates_or_bad_quality`: blurry, duplicate, cropped badly, or otherwise unusable images

## How To Use The Folder

1. Create the top-level folder in Google Drive.
2. Create the subfolders exactly as listed above.
3. Upload raw images directly into the appropriate class or neutral folder.
4. Put anything uncertain into `06_hold_for_review`.
5. Move only clean, deduplicated, final images into `07_final_selected_eval_set`.
6. Do not delete the raw folders until the final set is frozen.

## File Naming

Use a simple, consistent naming convention:

```text
<class>_<locationcode>_<initials>_<yyyymmdd>_<seq>.jpg
```

Examples:

```text
drain_inlet_KLCC_NB_20260615_001.jpg
artificial_container_PJ01_NB_20260615_014.jpg
neutral_vehicle_tire_CHERAS_FA_20260615_003.jpg
```

Keep the original filename if you can, but rename it if the upload batch would otherwise become hard to sort.

## Collection Rules

- Collect from multiple locations
- Avoid near-duplicate burst shots
- Prefer original full-frame images
- Include hard cases, not just obvious examples
- Keep mounted vehicle tires in neutral folders
- Do not crop first unless the original is unusable
- Do not mix the same scene into multiple folders

For `drain_inlet`, try to include:

- wet and dry scenes
- clean and dirty drains
- open and grated inlets
- partial occlusion from leaves, mud, shadow, or debris

For neutral vehicle tires, try to include:

- cars parked on roads
- motorcycles and bicycles
- taxis, vans, buses, machinery, carts
- scenes where a tire is visible but clearly not a habitat object

## Quality Gate

Before freezing `07_final_selected_eval_set`:

- remove duplicates
- remove blurry images
- remove screenshots and edited collages
- keep the hardest confusing neutral images
- verify that mounted vehicle tires are not labeled as positive `tire`

## Final Note

This evaluation set should answer one question only:

**How well does the model generalize on unseen images, especially for `drain_inlet` and false positives on vehicle tires?**

If an image could help training later, that does not make it valid for final evaluation now.
