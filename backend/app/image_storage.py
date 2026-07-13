from __future__ import annotations

import hashlib
import logging
from collections.abc import Iterator
from datetime import datetime, timezone
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError

from app.inference import Detection

from app.config import settings


logger = logging.getLogger(__name__)

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
    annotated_image_storage_key: str = ""
    annotated_thumbnail_storage_key: str = ""
    annotated_image_path: Path | None = None
    annotated_thumbnail_path: Path | None = None


@dataclass(frozen=True)
class PrecheckImage:
    storage_key: str
    image_path: Path


def ensure_upload_dirs() -> None:
    (settings.upload_root / "evidence").mkdir(parents=True, exist_ok=True)
    (settings.upload_root / "thumbnails").mkdir(parents=True, exist_ok=True)
    (settings.upload_root / "prechecks").mkdir(parents=True, exist_ok=True)
    (settings.upload_root / "annotated").mkdir(parents=True, exist_ok=True)
    (settings.upload_root / "annotated-thumbnails").mkdir(parents=True, exist_ok=True)


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
    except (BotoCoreError, ClientError) as exc:
        logger.warning(f"Failed to delete S3 object {storage_key}: {exc}")
        # Don't raise - this is cleanup, we'll log for manual intervention


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


def stream_s3_object(storage_key: str) -> tuple[Iterator[bytes], str]:
    if not settings.s3_bucket:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 bucket not configured.",
        )

    try:
        response = _get_s3_client().get_object(Bucket=settings.s3_bucket, Key=storage_key)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found in S3.",
        ) from exc

    body = response["Body"]

    def chunks() -> Iterator[bytes]:
        try:
            yield from body.iter_chunks(chunk_size=1024 * 1024)
        finally:
            body.close()

    return chunks(), response.get("ContentType") or "image/jpeg"


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
    for path in (
        stored_image.image_path,
        stored_image.thumbnail_path,
        stored_image.annotated_image_path,
        stored_image.annotated_thumbnail_path,
    ):
        if path is None:
            continue
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    if settings.storage_backend == "s3":
        if stored_image.image_storage_key:
            _delete_from_s3(stored_image.image_storage_key)
        if stored_image.thumbnail_storage_key:
            _delete_from_s3(stored_image.thumbnail_storage_key)
        if stored_image.annotated_image_storage_key:
            _delete_from_s3(stored_image.annotated_image_storage_key)
        if stored_image.annotated_thumbnail_storage_key:
            _delete_from_s3(stored_image.annotated_thumbnail_storage_key)


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


def render_annotated_image(
    source_path: Path,
    annotated_path: Path,
    thumbnail_path: Path,
    detections: list[Detection],
) -> None:
    with Image.open(source_path) as source:
        image = source.convert("RGB")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    line_width = max(2, round(min(image.size) * 0.008))

    for detection in detections:
        if len(detection.bbox) < 4:
            continue
        left, top, right, bottom = detection.bbox[:4]
        box = (
            max(0, round(left)),
            max(0, round(top)),
            min(image.width - 1, round(right)),
            min(image.height - 1, round(bottom)),
        )
        if box[2] <= box[0] or box[3] <= box[1]:
            continue
        color = (0, 70, 79)
        draw.rectangle(box, outline=color, width=line_width)
        label = f"{detection.raw_label} {detection.confidence:.0%}"
        label_box = draw.textbbox((box[0], box[1]), label, font=font)
        label_height = label_box[3] - label_box[1] + 6
        label_top = max(0, box[1] - label_height)
        label_width = label_box[2] - label_box[0] + 8
        draw.rectangle((box[0], label_top, box[0] + label_width, box[1]), fill=color)
        draw.text((box[0] + 4, label_top + 2), label, fill="white", font=font)

    _save_jpeg(image, annotated_path, quality=90)
    thumbnail = image.copy()
    thumbnail.thumbnail((480, 480))
    _save_jpeg(thumbnail, thumbnail_path, quality=84)


def persist_stored_image(stored_image: StoredImage, detections: list[Detection]) -> StoredImage:
    render_annotated_image(
        stored_image.image_path,
        stored_image.annotated_image_path or stored_image.image_path,
        stored_image.annotated_thumbnail_path or stored_image.thumbnail_path,
        detections,
    )
    if settings.storage_backend == "s3":
        keys_and_paths = (
            (stored_image.image_storage_key, stored_image.image_path),
            (stored_image.thumbnail_storage_key, stored_image.thumbnail_path),
            (stored_image.annotated_image_storage_key, stored_image.annotated_image_path),
            (stored_image.annotated_thumbnail_storage_key, stored_image.annotated_thumbnail_path),
        )
        try:
            for key, path in keys_and_paths:
                if key and path:
                    _upload_to_s3(path, key)
        except Exception:
            for key, _path in keys_and_paths:
                if key:
                    _delete_from_s3(key)
            raise
    return stored_image


def cleanup_local_stored_image(stored_image: StoredImage) -> None:
    for path in (
        stored_image.image_path,
        stored_image.thumbnail_path,
        stored_image.annotated_image_path,
        stored_image.annotated_thumbnail_path,
    ):
        if path:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                logger.warning("Failed to remove local image scratch file %s", path)


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
    annotated_image_storage_key = f"annotated/{stem}.jpg"
    annotated_thumbnail_storage_key = f"annotated-thumbnails/{stem}.jpg"
    image_path = settings.upload_root / image_storage_key
    thumbnail_path = settings.upload_root / thumbnail_storage_key
    annotated_image_path = settings.upload_root / annotated_image_storage_key
    annotated_thumbnail_path = settings.upload_root / annotated_thumbnail_storage_key

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
        annotated_image_storage_key=annotated_image_storage_key,
        annotated_thumbnail_storage_key=annotated_thumbnail_storage_key,
        annotated_image_path=annotated_image_path,
        annotated_thumbnail_path=annotated_thumbnail_path,
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
