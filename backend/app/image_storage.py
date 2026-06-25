from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
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


def _get_s3_client():
    return boto3.client("s3", region_name=settings.s3_region)


def _upload_to_s3(file_path: Path, storage_key: str) -> None:
    if not settings.s3_bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 bucket not configured.",
        )
    client = _get_s3_client()
    try:
        content_type = "image/jpeg"
        client.upload_file(
            str(file_path),
            settings.s3_bucket,
            storage_key,
            ExtraArgs={"ContentType": content_type},
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload image to S3.",
        ) from exc


def _delete_from_s3(storage_key: str) -> None:
    if not settings.s3_bucket:
        return
    client = _get_s3_client()
    try:
        client.delete_object(Bucket=settings.s3_bucket, Key=storage_key)
    except (BotoCoreError, ClientError):
        pass


def get_s3_presigned_url(storage_key: str) -> str:
    if not settings.s3_bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 bucket not configured.",
        )
    client = _get_s3_client()
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": storage_key},
            ExpiresIn=settings.s3_presigned_url_expires_seconds,
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate image URL.",
        ) from exc


def check_s3_ready() -> bool:
    if not settings.s3_bucket:
        return False
    try:
        client = _get_s3_client()
        client.head_bucket(Bucket=settings.s3_bucket)
        return True
    except (BotoCoreError, ClientError):
        return False


def delete_stored_image(stored_image: StoredImage) -> None:
    for path in (stored_image.image_path, stored_image.thumbnail_path):
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    if settings.storage_backend == "s3":
        if stored_image.image_storage_key:
            _delete_from_s3(stored_image.image_storage_key)
        if stored_image.thumbnail_storage_key:
            _delete_from_s3(stored_image.thumbnail_storage_key)


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

    if settings.storage_backend == "s3":
        try:
            _upload_to_s3(image_path, image_storage_key)
            _upload_to_s3(thumbnail_path, thumbnail_storage_key)
        except Exception:
            try:
                image_path.unlink(missing_ok=True)
                thumbnail_path.unlink(missing_ok=True)
            except OSError:
                pass
            _delete_from_s3(image_storage_key)
            _delete_from_s3(thumbnail_storage_key)
            raise

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
