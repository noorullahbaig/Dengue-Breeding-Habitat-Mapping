from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings


ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


@dataclass(frozen=True)
class StoredImage:
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    image_storage_key: str
    thumbnail_storage_key: str
    image_path: Path
    thumbnail_path: Path


@dataclass(frozen=True)
class PrecheckImage:
    storage_key: str
    image_path: Path


def ensure_upload_dirs() -> None:
    (settings.upload_root / "evidence").mkdir(parents=True, exist_ok=True)
    (settings.upload_root / "thumbnails").mkdir(parents=True, exist_ok=True)
    (settings.upload_root / "prechecks").mkdir(parents=True, exist_ok=True)


def delete_stored_image(stored_image: StoredImage) -> None:
    for path in (stored_image.image_path, stored_image.thumbnail_path):
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def delete_precheck_image(precheck_image: PrecheckImage) -> None:
    try:
        precheck_image.image_path.unlink(missing_ok=True)
    except OSError:
        pass


def _path_from_storage_key(storage_key: str) -> Path:
    if not storage_key or storage_key.startswith("/") or ".." in Path(storage_key).parts:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")

    return (settings.upload_root / storage_key).resolve()


def resolve_public_upload_path(path_value: str | None) -> Path:
    if not path_value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")

    raw_path = Path(path_value).expanduser()
    path = raw_path.resolve() if raw_path.is_absolute() else _path_from_storage_key(path_value)
    upload_root = settings.upload_root.resolve()

    try:
        path.relative_to(upload_root)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.") from exc

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")

    return path


def cleanup_precheck_uploads(max_age_seconds: int = 24 * 60 * 60) -> int:
    precheck_root = settings.upload_root / "prechecks"
    if not precheck_root.exists():
        return 0

    now = datetime.now(timezone.utc).timestamp()
    deleted = 0

    for path in precheck_root.glob("*.jpg"):
        try:
            age_seconds = now - path.stat().st_mtime
        except OSError:
            continue

        if age_seconds <= max_age_seconds:
            continue

        try:
            path.unlink(missing_ok=True)
            deleted += 1
        except OSError:
            pass

    return deleted


def _load_image(raw: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(raw))
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        elif image.mode == "L":
            image = image.convert("RGB")
        return image
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload could not be read as an image.",
        ) from exc


def _save_jpeg(image: Image.Image, path: Path, *, quality: int) -> None:
    image.save(path, format="JPEG", quality=quality, optimize=True)


async def store_upload(upload: UploadFile) -> StoredImage:
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload must be a JPEG, PNG, or WebP image.",
        )

    raw = await upload.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload is empty.")

    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Upload is larger than the local demo limit.",
        )

    ensure_upload_dirs()
    digest = hashlib.sha256(raw).hexdigest()
    stem = f"{uuid4().hex}-{digest[:12]}"
    image_storage_key = f"evidence/{stem}.jpg"
    thumbnail_storage_key = f"thumbnails/{stem}.jpg"
    image_path = settings.upload_root / image_storage_key
    thumbnail_path = settings.upload_root / thumbnail_storage_key

    image = _load_image(raw)

    _save_jpeg(image, image_path, quality=88)

    thumbnail = image.copy()
    thumbnail.thumbnail((480, 480))
    _save_jpeg(thumbnail, thumbnail_path, quality=82)

    return StoredImage(
        original_filename=upload.filename or "evidence-image",
        mime_type="image/jpeg",
        size_bytes=len(raw),
        sha256=digest,
        image_storage_key=image_storage_key,
        thumbnail_storage_key=thumbnail_storage_key,
        image_path=image_path,
        thumbnail_path=thumbnail_path,
    )


async def store_precheck_image(upload: UploadFile) -> PrecheckImage:
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload must be a JPEG, PNG, or WebP image.",
        )

    raw = await upload.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload is empty.")

    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Upload is larger than the local demo limit.",
        )

    ensure_upload_dirs()
    digest = hashlib.sha256(raw).hexdigest()
    stem = f"{uuid4().hex}-{digest[:12]}"
    storage_key = f"prechecks/{stem}.jpg"
    image_path = settings.upload_root / storage_key

    image = _load_image(raw)
    _save_jpeg(image, image_path, quality=88)

    return PrecheckImage(storage_key=storage_key, image_path=image_path)
