from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Record metadata for a YOLO model checkpoint.")
    parser.add_argument("--model", required=True, help="Path to a YOLO .pt checkpoint")
    parser.add_argument("--out", help="Optional JSON output path")
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    if not model_path.exists():
        raise SystemExit(f"Model checkpoint does not exist: {model_path}")

    try:
        from ultralytics import YOLO
    except ImportError as exc:  # pragma: no cover - environment guard
        raise SystemExit("ultralytics is required in the active Python environment.") from exc

    model = YOLO(str(model_path))
    names = getattr(model, "names", {}) or {}

    result = {
        "model_path": str(model_path),
        "sha256": sha256_file(model_path),
        "task": getattr(model, "task", None),
        "class_names": {str(key): value for key, value in dict(names).items()},
    }

    output = json.dumps(result, indent=2)
    if args.out:
        output_path = Path(args.out).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
