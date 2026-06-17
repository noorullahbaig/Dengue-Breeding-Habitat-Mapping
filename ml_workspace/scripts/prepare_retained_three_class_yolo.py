from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

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
    0: 0,  # Bottle -> artificial_container
    2: 1,  # Drain-Inlet -> drain_inlet
    3: 2,  # Tire -> tire
    4: 0,  # Vase -> artificial_container
}

EXCLUDED_SOURCE_IDS = {1}  # Coconut-Exocarp is outside the retained KL scope.


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


def parse_yolo_geometry(values: list[float], label_path: Path, line_number: int) -> tuple[list[float] | None, bool, str | None]:
    if len(values) == 4:
        x_center, y_center, width, height = values
        if any(value < 0.0 or value > 1.0 for value in values):
            return None, False, f"{label_path}:{line_number}: bbox value outside 0..1"
        if width <= 0.0 or height <= 0.0:
            return None, False, f"{label_path}:{line_number}: bbox width/height must be positive"
        return [x_center, y_center, width, height], False, None

    if len(values) >= 6 and len(values) % 2 == 0:
        if any(value < 0.0 or value > 1.0 for value in values):
            return None, True, f"{label_path}:{line_number}: polygon value outside 0..1"

        xs = values[0::2]
        ys = values[1::2]
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)
        width = x_max - x_min
        height = y_max - y_min
        if width <= 0.0 or height <= 0.0:
            return None, True, f"{label_path}:{line_number}: polygon bounding box is degenerate"

        return [
            (x_min + x_max) / 2.0,
            (y_min + y_max) / 2.0,
            width,
            height,
        ], True, None

    return None, False, f"{label_path}:{line_number}: expected bbox or YOLO polygon coordinates"


def parse_label_file(label_path: Path) -> dict:
    result = {
        "mapped_rows": [],
        "original_counts": Counter(),
        "excluded_counts": Counter(),
        "invalid_rows": [],
        "original_line_count": 0,
        "retained_line_count": 0,
        "excluded_line_count": 0,
        "polygon_converted_count": 0,
        "invalid_line_count": 0,
    }

    if not label_path.exists():
        return result

    for line_number, raw_row in enumerate(label_path.read_text(encoding="utf-8").splitlines(), start=1):
        row = raw_row.strip()
        if not row:
            continue

        parts = row.split()
        if len(parts) < 5:
            result["invalid_rows"].append(f"{label_path}:{line_number}: expected at least 5 columns")
            result["invalid_line_count"] += 1
            continue

        try:
            source_id = int(parts[0])
            values = [float(value) for value in parts[1:]]
        except ValueError:
            result["invalid_rows"].append(f"{label_path}:{line_number}: non-numeric YOLO row")
            result["invalid_line_count"] += 1
            continue

        source_name = SOURCE_NAMES.get(source_id, f"unknown_{source_id}")
        result["original_counts"][source_name] += 1
        result["original_line_count"] += 1

        coords, is_polygon, error = parse_yolo_geometry(values, label_path, line_number)
        if is_polygon:
            result["polygon_converted_count"] += 1
        if error is not None or coords is None:
            result["invalid_rows"].append(error or f"{label_path}:{line_number}: invalid YOLO geometry")
            result["invalid_line_count"] += 1
            continue

        if source_id in EXCLUDED_SOURCE_IDS:
            result["excluded_counts"][source_name] += 1
            result["excluded_line_count"] += 1
            continue

        if source_id not in SOURCE_TO_TARGET:
            result["invalid_rows"].append(f"{label_path}:{line_number}: unsupported class id {source_id}")
            result["invalid_line_count"] += 1
            continue

        target_id = SOURCE_TO_TARGET[source_id]
        result["mapped_rows"].append(
            " ".join([str(target_id), *(format_float(value) for value in coords)])
        )
        result["retained_line_count"] += 1

    return result


def resolve_data_yaml_path(output_root: Path, explicit_path: str | None) -> str:
    if explicit_path:
        return explicit_path
    try:
        return str(output_root.relative_to(Path.cwd()))
    except ValueError:
        return str(output_root)


def yaml_names() -> str:
    return "\n".join(f"- {name}" for _, name in sorted(TARGET_NAMES.items()))


def write_data_yaml(output_root: Path, dataset_path: str | None = None) -> None:
    content = f"""path: {resolve_data_yaml_path(output_root, dataset_path)}
train: train/images
val: valid/images
test: test/images
nc: {len(TARGET_NAMES)}
names:
{yaml_names()}
"""
    (output_root / "data.yaml").write_text(content, encoding="utf-8")


def write_kaggle_yaml(output_root: Path, kaggle_dataset_dir: str) -> None:
    content = f"""path: {kaggle_dataset_dir}
train: train/images
val: valid/images
test: test/images
nc: {len(TARGET_NAMES)}
names:
{yaml_names()}
"""
    (output_root / "data_kaggle.yaml").write_text(content, encoding="utf-8")


def write_class_mapping_audit(output_root: Path, original_counts: Counter[str], excluded_counts: Counter[str]) -> None:
    path = output_root / "class_mapping_audit.csv"
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=(
                "old_class_id",
                "old_class_name",
                "action",
                "new_class_id",
                "new_class_name",
                "old_instance_count",
                "excluded_count",
            ),
        )
        writer.writeheader()
        for source_id, source_name in SOURCE_NAMES.items():
            target_id = SOURCE_TO_TARGET.get(source_id)
            writer.writerow(
                {
                    "old_class_id": source_id,
                    "old_class_name": source_name,
                    "action": "excluded" if source_id in EXCLUDED_SOURCE_IDS else "mapped",
                    "new_class_id": "" if target_id is None else target_id,
                    "new_class_name": "" if target_id is None else TARGET_NAMES[target_id],
                    "old_instance_count": original_counts[source_name],
                    "excluded_count": excluded_counts[source_name],
                }
            )


def place_image(source: Path, destination: Path, image_mode: str) -> None:
    if image_mode == "symlink":
        if destination.exists() or destination.is_symlink():
            destination.unlink()
        os.symlink(source, destination)
        return
    if image_mode == "hardlink":
        if destination.exists() or destination.is_symlink():
            destination.unlink()
        try:
            os.link(source, destination)
            return
        except OSError:
            pass
    shutil.copy2(source, destination)


def prepare_split(
    source_root: Path,
    output_root: Path,
    split: str,
    manifest_handle,
    *,
    image_mode: str,
    manifest_csv_writer,
    workers: int,
) -> dict:
    source_image_dir = source_root / split / "images"
    source_label_dir = source_root / split / "labels"
    output_split_dir = output_root / split
    output_image_dir = output_root / split / "images"
    output_label_dir = output_root / split / "labels"
    output_split_dir.mkdir(parents=True, exist_ok=True)
    if image_mode == "directory-symlink":
        if output_image_dir.is_symlink() or output_image_dir.exists():
            if output_image_dir.is_dir() and not output_image_dir.is_symlink():
                shutil.rmtree(output_image_dir)
            else:
                output_image_dir.unlink()
        os.symlink(source_image_dir, output_image_dir)
    else:
        output_image_dir.mkdir(parents=True, exist_ok=True)
    output_label_dir.mkdir(parents=True, exist_ok=True)

    summary = {
        "split": split,
        "image_count": 0,
        "label_file_count": 0,
        "missing_source_label_count": 0,
        "background_label_count": 0,
        "invalid_row_count": 0,
        "original_line_count": 0,
        "retained_line_count": 0,
        "excluded_line_count": 0,
        "polygon_converted_count": 0,
        "original_instances_by_class": Counter(),
        "mapped_instances_by_class": Counter(),
        "excluded_instances_by_class": Counter(),
        "missing_source_labels": [],
        "invalid_rows": [],
    }

    def process_image(image_path: Path) -> dict:
        label_path = source_label_dir / f"{image_path.stem}.txt"
        output_image_path = output_image_dir / image_path.name
        output_label_path = output_label_dir / f"{image_path.stem}.txt"

        if image_mode != "directory-symlink":
            place_image(image_path, output_image_path, image_mode)
        parsed = parse_label_file(label_path)
        mapped_rows = parsed["mapped_rows"]
        original_counts = parsed["original_counts"]
        excluded_counts = parsed["excluded_counts"]
        invalid_rows = parsed["invalid_rows"]

        output_label_path.write_text(
            "\n".join(mapped_rows) + ("\n" if mapped_rows else ""),
            encoding="utf-8",
        )

        mapped_counts = Counter()
        for row in mapped_rows:
            target_id = int(row.split()[0])
            mapped_counts[TARGET_NAMES[target_id]] += 1

        return {
            "image_path": image_path,
            "label_path": label_path,
            "output_image_path": output_image_path,
            "output_label_path": output_label_path,
            "mapped_rows": mapped_rows,
            "original_counts": original_counts,
            "excluded_counts": excluded_counts,
            "invalid_rows": invalid_rows,
            "mapped_counts": mapped_counts,
            "parsed": parsed,
        }

    image_paths = image_files(source_image_dir)
    if workers <= 1:
        records = [process_image(image_path) for image_path in image_paths]
    else:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            records = list(executor.map(process_image, image_paths))

    for record in records:
        image_path = record["image_path"]
        label_path = record["label_path"]
        output_image_path = record["output_image_path"]
        output_label_path = record["output_label_path"]
        mapped_rows = record["mapped_rows"]
        original_counts = record["original_counts"]
        excluded_counts = record["excluded_counts"]
        invalid_rows = record["invalid_rows"]
        mapped_counts = record["mapped_counts"]
        parsed = record["parsed"]

        summary["image_count"] += 1
        summary["label_file_count"] += 1
        summary["original_instances_by_class"].update(original_counts)
        summary["mapped_instances_by_class"].update(mapped_counts)
        summary["excluded_instances_by_class"].update(excluded_counts)
        summary["invalid_row_count"] += parsed["invalid_line_count"]
        summary["original_line_count"] += parsed["original_line_count"]
        summary["retained_line_count"] += parsed["retained_line_count"]
        summary["excluded_line_count"] += parsed["excluded_line_count"]
        summary["polygon_converted_count"] += parsed["polygon_converted_count"]
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
        manifest_csv_writer.writerow(
            {
                "split": split,
                "image_file": image_path.name,
                "raw_label_file": label_path.name,
                "output_label_file": output_label_path.name,
                "original_line_count": parsed["original_line_count"],
                "retained_line_count": parsed["retained_line_count"],
                "excluded_line_count": parsed["excluded_line_count"],
                "polygon_converted_count": parsed["polygon_converted_count"],
                "invalid_line_count": parsed["invalid_line_count"],
                "is_negative_after_mapping": not bool(mapped_rows),
            }
        )

    for key in (
        "original_instances_by_class",
        "mapped_instances_by_class",
        "excluded_instances_by_class",
    ):
        summary[key] = dict(summary[key])

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create the FYP retained three-class YOLO dataset from VisText-style labels."
    )
    parser.add_argument("--source", required=True, help="Raw VisText-style dataset root")
    parser.add_argument("--out", required=True, help="Prepared dataset output root")
    parser.add_argument("--manifest", required=True, help="JSONL manifest output path")
    parser.add_argument("--audit", required=True, help="JSON audit output path")
    parser.add_argument(
        "--kaggle-dataset-dir",
        default="/kaggle/input/retained-three-class-yolo-v1/retained_three_class_yolo_v1",
        help="Absolute dataset directory expected inside Kaggle",
    )
    parser.add_argument(
        "--data-yaml-path",
        help="Optional path value to write into data.yaml. Defaults to a path relative to the current working directory when possible.",
    )
    parser.add_argument(
        "--include-train-tiny",
        action="store_true",
        help="Also prepare train_tiny for smoke tests.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove the output dataset directory before preparing it.",
    )
    parser.add_argument(
        "--image-mode",
        choices=("copy", "hardlink", "symlink", "directory-symlink"),
        default="copy",
        help="How prepared images are placed. Use directory-symlink for fast local staging.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=min(32, os.cpu_count() or 4),
        help="Number of worker threads for label conversion.",
    )
    args = parser.parse_args()

    source_root = Path(args.source).expanduser().resolve()
    output_root = Path(args.out).expanduser().resolve()
    manifest_path = Path(args.manifest).expanduser().resolve()
    audit_path = Path(args.audit).expanduser().resolve()

    if not source_root.exists():
        raise SystemExit(f"Source dataset does not exist: {source_root}")

    if args.clean and output_root.exists():
        shutil.rmtree(output_root)

    output_root.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.parent.mkdir(parents=True, exist_ok=True)

    splits = ["train", "valid", "test"]
    if args.include_train_tiny and (source_root / "train_tiny").exists():
        splits.append("train_tiny")

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

    dataset_manifest_path = output_root / "dataset_manifest.csv"
    manifest_fields = (
        "split",
        "image_file",
        "raw_label_file",
        "output_label_file",
        "original_line_count",
        "retained_line_count",
        "excluded_line_count",
        "polygon_converted_count",
        "invalid_line_count",
        "is_negative_after_mapping",
    )

    with manifest_path.open("w", encoding="utf-8") as manifest_handle, dataset_manifest_path.open(
        "w", newline="", encoding="utf-8"
    ) as dataset_manifest_handle:
        manifest_csv_writer = csv.DictWriter(dataset_manifest_handle, fieldnames=manifest_fields)
        manifest_csv_writer.writeheader()
        for split in splits:
            audit["splits"].append(
                prepare_split(
                    source_root,
                    output_root,
                    split,
                    manifest_handle,
                    image_mode=args.image_mode,
                    manifest_csv_writer=manifest_csv_writer,
                    workers=args.workers,
                )
            )

    aggregate_original_counts = Counter()
    aggregate_excluded_counts = Counter()
    for split_summary in audit["splits"]:
        aggregate_original_counts.update(split_summary["original_instances_by_class"])
        aggregate_excluded_counts.update(split_summary["excluded_instances_by_class"])

    write_data_yaml(output_root, args.data_yaml_path)
    write_kaggle_yaml(output_root, args.kaggle_dataset_dir)
    write_class_mapping_audit(output_root, aggregate_original_counts, aggregate_excluded_counts)
    audit["image_mode"] = args.image_mode
    audit["dataset_manifest_csv"] = str(dataset_manifest_path)
    audit["class_mapping_audit_csv"] = str(output_root / "class_mapping_audit.csv")
    audit_path.write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
