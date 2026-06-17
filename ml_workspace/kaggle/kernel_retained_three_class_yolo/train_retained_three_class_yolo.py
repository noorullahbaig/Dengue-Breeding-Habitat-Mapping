from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


SOURCE_NAMES = {
    0: "Bottle",
    1: "Coconut-Exocarp",
    2: "Drain-Inlet",
    3: "Tire",
    4: "Vase",
}

TARGET_NAMES = {
    0: "artificial_container",
    1: "drain_inlet",
    2: "tire",
}

SOURCE_TO_TARGET = {
    0: 0,  # Bottle
    2: 1,  # Drain-Inlet
    3: 2,  # Tire
    4: 0,  # Vase
}

EXCLUDED_SOURCE_IDS = {1}  # Coconut-Exocarp is outside the retained KL urban scope.
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def ensure_ultralytics() -> None:
    try:
        import ultralytics  # noqa: F401
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "ultralytics"])


def discover_source_root(explicit: str | None) -> Path:
    if explicit:
        root = Path(explicit)
        if root.exists():
            return root
        raise SystemExit(f"Dataset root not found: {root}")

    candidates = [
        Path(
            "/kaggle/input/multi-model-for-mosquito-my-fyp/"
            "VisText-Mosquito A Multimodal Dataset for Mosquito/"
            "Breeding Place Detection"
        ),
        Path("/kaggle/input/vistext-mosquito/Breeding Place Detection"),
        Path("/kaggle/input/mosquito-breeding-detection/Breeding Place Detection"),
    ]
    for candidate in candidates:
        if (candidate / "train" / "images").exists():
            return candidate

    matches = list(Path("/kaggle/input").glob("**/Breeding Place Detection/train/images"))
    if matches:
        return matches[0].parents[1]

    extracted_root = Path("/kaggle/working/extracted_inputs")
    archive_paths = [
        *Path("/kaggle/input").glob("**/*.zip"),
        *Path("/kaggle/input").glob("**/*.tar"),
        *Path("/kaggle/input").glob("**/*.tar.gz"),
        *Path("/kaggle/input").glob("**/*.tgz"),
    ]
    for archive_path in sorted(archive_paths):
        extract_dir = extracted_root / archive_path.stem
        if not extract_dir.exists():
            extract_dir.mkdir(parents=True, exist_ok=True)
            shutil.unpack_archive(str(archive_path), str(extract_dir))

        matches = list(extract_dir.glob("**/Breeding Place Detection/train/images"))
        if matches:
            return matches[0].parents[1]

        matches = list(extract_dir.glob("**/train/images"))
        if matches:
            return matches[0].parents[1]

    raise SystemExit(
        "Could not find the VisText-style Breeding Place Detection dataset under /kaggle/input. "
        "Attach the Kaggle dataset used by the original notebook, or attach an archive containing "
        "the Breeding Place Detection folder, then rerun."
    )


def image_files(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def format_float(value: float) -> str:
    return f"{value:.8f}".rstrip("0").rstrip(".")


def parse_yolo_geometry(values: list[float], label_path: Path, line_number: int) -> tuple[list[float] | None, str | None]:
    if len(values) == 4:
        x_center, y_center, width, height = values
        if any(value < 0.0 or value > 1.0 for value in values):
            return None, f"{label_path}:{line_number}: bbox value outside 0..1"
        if width <= 0.0 or height <= 0.0:
            return None, f"{label_path}:{line_number}: bbox width/height must be positive"
        return [x_center, y_center, width, height], None

    if len(values) >= 6 and len(values) % 2 == 0:
        if any(value < 0.0 or value > 1.0 for value in values):
            return None, f"{label_path}:{line_number}: polygon value outside 0..1"
        xs = values[0::2]
        ys = values[1::2]
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)
        width = x_max - x_min
        height = y_max - y_min
        if width <= 0.0 or height <= 0.0:
            return None, f"{label_path}:{line_number}: polygon bounding box is degenerate"
        return [(x_min + x_max) / 2.0, (y_min + y_max) / 2.0, width, height], None

    return None, f"{label_path}:{line_number}: expected bbox or YOLO polygon coordinates"


def parse_label_file(label_path: Path) -> tuple[list[str], Counter[str], Counter[str], list[str]]:
    mapped_rows: list[str] = []
    original_counts: Counter[str] = Counter()
    excluded_counts: Counter[str] = Counter()
    invalid_rows: list[str] = []

    if not label_path.exists():
        return mapped_rows, original_counts, excluded_counts, invalid_rows

    for line_number, raw_row in enumerate(label_path.read_text(encoding="utf-8").splitlines(), start=1):
        row = raw_row.strip()
        if not row:
            continue
        parts = row.split()
        if len(parts) < 5:
            invalid_rows.append(f"{label_path}:{line_number}: expected at least 5 columns")
            continue
        try:
            source_id = int(parts[0])
            values = [float(value) for value in parts[1:]]
        except ValueError:
            invalid_rows.append(f"{label_path}:{line_number}: non-numeric YOLO row")
            continue

        source_name = SOURCE_NAMES.get(source_id, f"unknown_{source_id}")
        original_counts[source_name] += 1

        coords, error = parse_yolo_geometry(values, label_path, line_number)
        if error is not None or coords is None:
            invalid_rows.append(error or f"{label_path}:{line_number}: invalid YOLO geometry")
            continue

        if source_id in EXCLUDED_SOURCE_IDS:
            excluded_counts[source_name] += 1
            continue
        if source_id not in SOURCE_TO_TARGET:
            invalid_rows.append(f"{label_path}:{line_number}: unsupported class id {source_id}")
            continue

        target_id = SOURCE_TO_TARGET[source_id]
        mapped_rows.append(" ".join([str(target_id), *(format_float(value) for value in coords)]))

    return mapped_rows, original_counts, excluded_counts, invalid_rows


def write_data_yaml(output_root: Path) -> Path:
    names = "\n".join(f"  {class_id}: {name}" for class_id, name in TARGET_NAMES.items())
    data_yaml = output_root / "data.yaml"
    data_yaml.write_text(
        f"""path: {output_root}
train: train/images
val: valid/images
test: test/images
nc: {len(TARGET_NAMES)}
names:
{names}
""",
        encoding="utf-8",
    )
    return data_yaml


def write_source_yaml(source_root: Path, working_root: Path) -> Path:
    names = "\n".join(f"  {class_id}: {name}" for class_id, name in SOURCE_NAMES.items())
    source_yaml = working_root / "source_five_class_data.yaml"
    source_yaml.write_text(
        f"""path: {source_root}
train: train/images
val: valid/images
test: test/images
nc: {len(SOURCE_NAMES)}
names:
{names}
""",
        encoding="utf-8",
    )
    return source_yaml


def prepare_split(source_root: Path, output_root: Path, split: str, manifest_handle) -> dict:
    source_image_dir = source_root / split / "images"
    source_label_dir = source_root / split / "labels"
    output_image_dir = output_root / split / "images"
    output_label_dir = output_root / split / "labels"
    output_image_dir.mkdir(parents=True, exist_ok=True)
    output_label_dir.mkdir(parents=True, exist_ok=True)

    summary = {
        "split": split,
        "image_count": 0,
        "label_file_count": 0,
        "missing_source_label_count": 0,
        "background_label_count": 0,
        "invalid_row_count": 0,
        "original_instances_by_class": Counter(),
        "mapped_instances_by_class": Counter(),
        "excluded_instances_by_class": Counter(),
        "missing_source_labels": [],
        "invalid_rows": [],
    }

    for image_path in image_files(source_image_dir):
        label_path = source_label_dir / f"{image_path.stem}.txt"
        output_image_path = output_image_dir / image_path.name
        output_label_path = output_label_dir / f"{image_path.stem}.txt"
        shutil.copy2(image_path, output_image_path)

        mapped_rows, original_counts, excluded_counts, invalid_rows = parse_label_file(label_path)
        output_label_path.write_text(
            "\n".join(mapped_rows) + ("\n" if mapped_rows else ""),
            encoding="utf-8",
        )

        mapped_counts = Counter()
        for row in mapped_rows:
            target_id = int(row.split()[0])
            mapped_counts[TARGET_NAMES[target_id]] += 1

        summary["image_count"] += 1
        summary["label_file_count"] += 1
        summary["original_instances_by_class"].update(original_counts)
        summary["mapped_instances_by_class"].update(mapped_counts)
        summary["excluded_instances_by_class"].update(excluded_counts)
        summary["invalid_row_count"] += len(invalid_rows)
        summary["invalid_rows"].extend(invalid_rows[:50])

        if not label_path.exists():
            summary["missing_source_label_count"] += 1
            if len(summary["missing_source_labels"]) < 50:
                summary["missing_source_labels"].append(str(label_path))
        if not mapped_rows:
            summary["background_label_count"] += 1

        manifest_handle.write(
            json.dumps(
                {
                    "split": split,
                    "source_image": str(image_path),
                    "source_label": str(label_path),
                    "prepared_image": str(output_image_path),
                    "prepared_label": str(output_label_path),
                    "original_instances_by_class": dict(original_counts),
                    "mapped_instances_by_class": dict(mapped_counts),
                    "excluded_instances_by_class": dict(excluded_counts),
                    "is_background_after_mapping": not bool(mapped_rows),
                    "invalid_rows": invalid_rows,
                },
                sort_keys=True,
            )
            + "\n"
        )

    for key in (
        "original_instances_by_class",
        "mapped_instances_by_class",
        "excluded_instances_by_class",
    ):
        summary[key] = dict(summary[key])

    return summary


def prepare_dataset(source_root: Path, output_root: Path, manifest_path: Path, audit_path: Path) -> Path:
    if output_root.exists():
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    audit = {
        "source_root": str(source_root),
        "output_root": str(output_root),
        "source_class_names": SOURCE_NAMES,
        "target_class_names": TARGET_NAMES,
        "source_to_target_mapping": {
            SOURCE_NAMES[source_id]: TARGET_NAMES[target_id]
            for source_id, target_id in SOURCE_TO_TARGET.items()
        },
        "excluded_source_classes": [SOURCE_NAMES[source_id] for source_id in sorted(EXCLUDED_SOURCE_IDS)],
        "splits": [],
    }

    with manifest_path.open("w", encoding="utf-8") as manifest_handle:
        for split in ("train", "valid", "test"):
            audit["splits"].append(prepare_split(source_root, output_root, split, manifest_handle))

    data_yaml = write_data_yaml(output_root)
    audit_path.write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return data_yaml


def metric_summary(metrics) -> dict:
    results = dict(getattr(metrics, "results_dict", {}) or {})
    names = dict(getattr(metrics, "names", {}) or {})
    box = getattr(metrics, "box", None)
    per_class_maps = getattr(box, "maps", None)
    per_class_map_values = [] if per_class_maps is None else list(per_class_maps)
    return {
        "results_dict": results,
        "class_names": names,
        "per_class_map50_95": {
            str(names.get(index, index)): float(value)
            for index, value in enumerate(per_class_map_values)
        },
    }


def zip_directory(source_dir: Path, zip_path: Path) -> None:
    if zip_path.exists():
        zip_path.unlink()
    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as archive:
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source_dir.parent))


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare, train, evaluate, and export the FYP 3-class YOLO model on Kaggle.")
    parser.add_argument("--source-root", help="Kaggle input dataset root. Auto-discovered when omitted.")
    parser.add_argument("--run-name", default="yolov8n_retained_three_class_v1")
    parser.add_argument("--base-model", default="yolov8n.pt")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--patience", type=int, default=20)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", default="16")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", default="0")
    parser.add_argument("--baseline-model", help="Optional old five-class best.pt to evaluate on source test split.")
    parser.add_argument("--prepare-only", action="store_true", help="Only prepare dataset and write audit files.")
    args = parser.parse_args()

    ensure_ultralytics()
    from ultralytics import YOLO

    working_root = Path("/kaggle/working")
    source_root = discover_source_root(args.source_root)
    prepared_root = working_root / "retained_three_class_yolo_v1"
    manifest_path = working_root / "retained_three_class_yolo_v1_manifest.jsonl"
    audit_path = working_root / "retained_three_class_yolo_v1_audit.json"
    artifact_root = working_root / "artifacts" / args.run_name
    artifact_root.mkdir(parents=True, exist_ok=True)

    data_yaml = prepare_dataset(source_root, prepared_root, manifest_path, audit_path)
    source_yaml = write_source_yaml(source_root, working_root)

    if args.prepare_only:
        print(f"Prepared retained dataset at {prepared_root}")
        print(f"Audit: {audit_path}")
        return

    batch = int(args.batch) if str(args.batch).isdigit() else args.batch
    model = YOLO(args.base_model)
    train_results = model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        patience=args.patience,
        imgsz=args.imgsz,
        batch=batch,
        seed=args.seed,
        device=args.device,
        project=str(working_root / "runs" / "training"),
        name=args.run_name,
        exist_ok=True,
    )

    train_dir = Path(getattr(train_results, "save_dir", working_root / "runs" / "training" / args.run_name))
    best_model_path = train_dir / "weights" / "best.pt"
    last_model_path = train_dir / "weights" / "last.pt"

    trained_model = YOLO(str(best_model_path))
    test_metrics = trained_model.val(
        data=str(data_yaml),
        split="test",
        imgsz=args.imgsz,
        batch=batch,
        device=args.device,
        project=str(working_root / "runs" / "evaluation"),
        name=f"{args.run_name}_test",
        exist_ok=True,
    )
    eval_dir = Path(getattr(test_metrics, "save_dir", working_root / "runs" / "evaluation" / f"{args.run_name}_test"))

    summary = {
        "run_name": args.run_name,
        "source_root": str(source_root),
        "prepared_root": str(prepared_root),
        "train_dir": str(train_dir),
        "eval_dir": str(eval_dir),
        "best_model_path": str(best_model_path),
        "test_metrics": metric_summary(test_metrics),
    }

    if args.baseline_model and Path(args.baseline_model).exists():
        baseline = YOLO(args.baseline_model)
        baseline_metrics = baseline.val(
            data=str(source_yaml),
            split="test",
            imgsz=args.imgsz,
            batch=batch,
            device=args.device,
            project=str(working_root / "runs" / "evaluation"),
            name="baseline_current_yolo_five_class_test",
            exist_ok=True,
        )
        summary["baseline_five_class_test_metrics"] = metric_summary(baseline_metrics)

    shutil.copy2(best_model_path, artifact_root / "best.pt")
    if last_model_path.exists():
        shutil.copy2(last_model_path, artifact_root / "last.pt")
    for artifact in (data_yaml, source_yaml, manifest_path, audit_path):
        shutil.copy2(artifact, artifact_root / artifact.name)

    summary_path = artifact_root / "metrics_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    for directory, name in ((train_dir, "training_run"), (eval_dir, "test_eval_run")):
        target = artifact_root / name
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(directory, target)

    zip_path = working_root / f"{args.run_name}_artifacts.zip"
    zip_directory(artifact_root, zip_path)
    print(f"Artifacts ready: {artifact_root}")
    print(f"Download zip: {zip_path}")


if __name__ == "__main__":
    main()
