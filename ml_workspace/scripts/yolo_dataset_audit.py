from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

try:
    import yaml
except ImportError as exc:  # pragma: no cover - environment guard
    raise SystemExit("PyYAML is required. Install it in the active Python environment.") from exc


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def load_dataset_yaml(dataset_root: Path) -> dict:
    yaml_path = dataset_root / "data.yaml"
    if not yaml_path.exists():
        raise SystemExit(f"No data.yaml found at {yaml_path}")
    return yaml.safe_load(yaml_path.read_text(encoding="utf-8"))


def resolve_split_path(dataset_root: Path, value: str) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = (dataset_root / path).resolve()
    return path


def split_dir(dataset_root: Path, split_name: str, value: str) -> Path:
    image_dir = resolve_split_path(dataset_root, value)
    if image_dir.exists():
        return image_dir

    split_folder = "valid" if split_name == "val" else split_name
    fallback = dataset_root / split_folder / "images"
    return fallback.resolve()


def label_path_for_image(image_path: Path) -> Path:
    parts = list(image_path.parts)
    if "images" in parts:
        parts[parts.index("images")] = "labels"
    return Path(*parts).with_suffix(".txt")


def audit_split(split_name: str, image_dir: Path, class_names: list[str]) -> dict:
    images = sorted(
        path for path in image_dir.rglob("*") if path.suffix.lower() in IMAGE_EXTENSIONS
    )
    missing_labels: list[str] = []
    empty_labels: list[str] = []
    instances: Counter[str] = Counter()
    invalid_rows: list[str] = []

    for image_path in images:
        label_path = label_path_for_image(image_path)
        if not label_path.exists():
            missing_labels.append(str(image_path))
            continue

        rows = [row.strip() for row in label_path.read_text(encoding="utf-8").splitlines()]
        if not rows:
            empty_labels.append(str(label_path))
            continue

        for row in rows:
            parts = row.split()
            try:
                class_id = int(parts[0])
            except (IndexError, ValueError):
                invalid_rows.append(f"{label_path}: {row}")
                continue

            if class_id < 0 or class_id >= len(class_names):
                invalid_rows.append(f"{label_path}: {row}")
                continue

            instances[class_names[class_id]] += 1

    return {
        "split": split_name,
        "image_dir": str(image_dir),
        "image_count": len(images),
        "missing_label_count": len(missing_labels),
        "empty_label_count": len(empty_labels),
        "invalid_row_count": len(invalid_rows),
        "instances_by_class": dict(instances),
        "missing_labels": missing_labels[:50],
        "empty_labels": empty_labels[:50],
        "invalid_rows": invalid_rows[:50],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit a YOLO-format dataset.")
    parser.add_argument("--dataset", required=True, help="Path to dataset root containing data.yaml")
    parser.add_argument("--out", help="Optional JSON output path")
    args = parser.parse_args()

    dataset_root = Path(args.dataset).expanduser().resolve()
    config = load_dataset_yaml(dataset_root)
    class_names = list(config.get("names", []))

    result = {
        "dataset_root": str(dataset_root),
        "class_count": config.get("nc", len(class_names)),
        "class_names": class_names,
        "splits": [],
    }

    for split in ("train", "val", "valid", "test"):
        if split not in config:
            continue
        image_dir = split_dir(dataset_root, split, config[split])
        if image_dir.exists():
            result["splits"].append(audit_split(split, image_dir, class_names))

    output = json.dumps(result, indent=2)
    if args.out:
        output_path = Path(args.out).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
