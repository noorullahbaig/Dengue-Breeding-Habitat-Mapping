from __future__ import annotations

import hashlib
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
    image_path: Path
    thumbnail_path: Path


def ensure_upload_dirs() -> None:
    (settings.upload_root / "evidence").mkdir(parents=True, exist_ok=True)
    (settings.upload_root / "thumbnails").mkdir(parents=True, exist_ok=True)


def delete_stored_image(stored_image: StoredImage) -> None:
    for path in (stored_image.image_path, stored_image.thumbnail_path):
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def resolve_public_upload_path(path_value: str) -> Path:
    path = Path(path_value).expanduser().resolve()
    upload_root = settings.upload_root.resolve()

    try:
        path.relative_to(upload_root)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.") from exc

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found.")

    return path


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
    image_path = settings.upload_root / "evidence" / f"{stem}.jpg"
    thumbnail_path = settings.upload_root / "thumbnails" / f"{stem}.jpg"

    try:
        image = Image.open(BytesIO(raw))
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        elif image.mode == "L":
            image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload could not be read as an image.",
        ) from exc

    image.save(image_path, format="JPEG", quality=88, optimize=True)

    thumbnail = image.copy()
    thumbnail.thumbnail((480, 480))
    thumbnail.save(thumbnail_path, format="JPEG", quality=82, optimize=True)

    return StoredImage(
        original_filename=upload.filename or "evidence-image",
        mime_type="image/jpeg",
        size_bytes=len(raw),
        sha256=digest,
        image_path=image_path,
        thumbnail_path=thumbnail_path,
    )
