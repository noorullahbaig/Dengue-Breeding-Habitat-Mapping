# Local Breeding Place Detection Source Check

Checked: 2026-05-12

## Source Compared

- GitHub repository: `https://github.com/adnanul-islam-jisun/VisText-Mosquito/tree/main`
- GitHub-linked dataset page: `https://data.mendeley.com/datasets/rtsfh7jh7p/3`
- Local folder: `/Users/noorullah/Desktop/FYP/Mosquito_Breeding_Detection/Breeding Place Detection`

## Conclusion

The local folder is a valid YOLO Breeding Place Detection dataset with the expected five source classes, but it is not an exact copy of the canonical GitHub/Mendeley VisText-Mosquito release.

Reason:

- GitHub/Mendeley describes Breeding Place Detection as 1,828 images and 3,752 annotations.
- The local folder contains 4,425 image/label pairs and 9,280 annotations.
- The local README states it is a Roboflow export with brightness augmentation producing three versions of source images.

Interpretation:

- The local folder appears to be an augmented Roboflow export from the same or closely related Breeding Place Detection project/class taxonomy.
- It should be usable for the retained-class YOLO Stage 1 training workflow.
- It should not be documented as a byte-identical or count-identical copy of the GitHub/Mendeley release.

## Local Dataset Integrity

Structure:

```text
Breeding Place Detection/
  train/images
  train/labels
  valid/images
  valid/labels
  test/images
  test/labels
  train_tiny/images
  train_tiny/labels
```

Image/label pair counts:

| Split | Images | Labels | Missing labels | Orphan labels |
| --- | ---: | ---: | ---: | ---: |
| train | 3,871 | 3,871 | 0 | 0 |
| valid | 371 | 371 | 0 | 0 |
| test | 183 | 183 | 0 | 0 |
| train_tiny | 50 | 50 | 0 | 0 |

Class order from local `data.yaml`:

```text
0 Bottle
1 Coconut-Exocarp
2 Drain-Inlet
3 Tire
4 Vase
```

Annotation counts across train/valid/test:

| Class ID | Class | Count |
| ---: | --- | ---: |
| 0 | Bottle | 1,344 |
| 1 | Coconut-Exocarp | 2,211 |
| 2 | Drain-Inlet | 1,353 |
| 3 | Tire | 1,869 |
| 4 | Vase | 2,503 |
|  | Total | 9,280 |

Roboflow/export notes found locally:

- Dataset name: `Mosquito Beeding Place - v2 Mosquito Possible Bradding Site`.
- Exported via Roboflow on 2024-09-18.
- Local README reports 4,425 images.
- Preprocessing: auto-orientation and resize to 640x640.
- Augmentation: random brightness adjustment.

## GitHub/Mendeley Comparison

GitHub repo contents:

- The GitHub repo does not include the raw Breeding Place Detection image/label folders.
- It includes code notebooks, result plots, model weights, and README documentation.
- The object detection notebook trains from Kaggle path `/kaggle/input/mosquito-breading-possible-site/data.yaml`.
- That Kaggle dataset is currently not searchable/accesssible from the current Kaggle CLI token.

Canonical GitHub/Mendeley dataset description:

- Breeding Place Detection: 1,828 images.
- Annotations: 3,752.
- Classes: `Coconut-Exocarp`, `Vase`, `Tire`, `Drain-Inlet`, `Bottle`.

Local folder:

- Breeding Place Detection: 4,425 image/label pairs.
- Annotations: 9,280.
- Classes: `Bottle`, `Coconut-Exocarp`, `Drain-Inlet`, `Tire`, `Vase`.
- Unique canonical source-like image names after removing Roboflow augmentation suffixes: 1,846.

## Kaggle Upload Recommendation

If the goal is strict reproduction of the GitHub/Mendeley dataset, do not upload this as "the exact VisText-Mosquito canonical dataset"; first obtain the Mendeley/Kaggle original.

If the goal is practical Stage 1 retained-class YOLO training using the available subclass labels, this local folder is acceptable to upload, with two cautions:

- Remove `.DS_Store` and `*.cache` files before upload.
- Replace the stale Colab-path `data.yaml` during Kaggle preprocessing/training.

Upload candidate path:

```text
/Users/noorullah/Desktop/FYP/Mosquito_Breeding_Detection/Breeding Place Detection
```

Workspace symlink to the same folder:

```text
/Users/noorullah/Desktop/FYP CODEX/ml_workspace/data/raw/vistext_breeding_place_detection_v2
```

Prefer uploading the real folder path, not the symlink.
