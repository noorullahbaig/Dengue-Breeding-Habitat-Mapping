from io import BytesIO
from dataclasses import replace
from pathlib import Path
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from PIL import Image

from app import image_storage
from app.config import settings
from app.image_storage import (
    StoredImage,
    cleanup_precheck_uploads,
    delete_precheck_image,
    delete_stored_image,
    store_precheck_image,
    store_upload,
    render_annotated_image,
)
from app.inference import Detection


class FakeUpload:
    def __init__(self, content: bytes, content_type: str = "text/plain"):
        self.content_type = content_type
        self.filename = "sample.txt"
        self._content = content

    async def read(self) -> bytes:
        return self._content


def jpeg_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (24, 24), color=(120, 80, 40)).save(output, format="JPEG")
    return output.getvalue()


@pytest.mark.anyio
async def test_rejects_non_image_upload():
    with pytest.raises(HTTPException) as exc_info:
        await store_upload(FakeUpload(b"not an image"))

    assert exc_info.value.status_code == 400


@pytest.mark.anyio
async def test_store_precheck_image_persists_backend_processed_image(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(image_storage, "settings", replace(settings, upload_root=tmp_path / "uploads"))

    stored = await store_precheck_image(FakeUpload(jpeg_bytes(), "image/jpeg"))

    assert stored.storage_key.startswith("prechecks/")
    assert stored.image_path.exists()
    assert stored.image_path.parent.name == "prechecks"

    delete_precheck_image(stored)

    assert not stored.image_path.exists()


def test_cleanup_precheck_uploads_removes_old_temp_images(tmp_path: Path, monkeypatch):
    upload_root = tmp_path / "uploads"
    prechecks = upload_root / "prechecks"
    prechecks.mkdir(parents=True)
    old_image = prechecks / "old.jpg"
    recent_image = prechecks / "recent.jpg"
    old_image.write_bytes(b"old")
    recent_image.write_bytes(b"recent")

    monkeypatch.setattr(image_storage, "settings", replace(settings, upload_root=upload_root))

    now = datetime.now(timezone.utc).timestamp()
    old_mtime = now - (60 * 60 * 25)
    recent_mtime = now
    import os

    os.utime(old_image, (old_mtime, old_mtime))
    os.utime(recent_image, (recent_mtime, recent_mtime))

    deleted = cleanup_precheck_uploads(max_age_seconds=60 * 60 * 24)

    assert deleted == 1
    assert not old_image.exists()
    assert recent_image.exists()


def test_delete_stored_image_removes_evidence_and_thumbnail(tmp_path: Path):
    evidence = tmp_path / "evidence.jpg"
    thumbnail = tmp_path / "thumbnail.jpg"
    evidence.write_bytes(b"evidence")
    thumbnail.write_bytes(b"thumbnail")

    delete_stored_image(
        StoredImage(
            original_filename="evidence.jpg",
            mime_type="image/jpeg",
            size_bytes=8,
            sha256="a" * 64,
            image_storage_key="evidence/evidence.jpg",
            thumbnail_storage_key="thumbnails/thumbnail.jpg",
            image_path=evidence,
            thumbnail_path=thumbnail,
        )
    )

    assert not evidence.exists()
    assert not thumbnail.exists()


def test_render_annotated_image_draws_detection_and_thumbnail(tmp_path: Path):
    source = tmp_path / "source.jpg"
    annotated = tmp_path / "annotated.jpg"
    thumbnail = tmp_path / "annotated-thumbnail.jpg"
    Image.new("RGB", (200, 100), color=(255, 255, 255)).save(source, format="JPEG")

    render_annotated_image(
        source,
        annotated,
        thumbnail,
        [
            Detection(
                raw_label="tire",
                confidence=0.91,
                bbox=[20, 10, 160, 80],
                bbox_normalized=[0.1, 0.1, 0.8, 0.8],
                image_width=200,
                image_height=100,
            )
        ],
    )

    assert annotated.exists()
    assert thumbnail.exists()
    with Image.open(annotated) as result:
        assert result.size == (200, 100)
        assert result.getpixel((20, 10)) != (255, 255, 255)
    with Image.open(thumbnail) as result:
        assert result.width <= 480
        assert result.height <= 480


def test_render_annotated_image_keeps_no_detection_image_visually_unchanged(tmp_path: Path):
    source = tmp_path / "source.jpg"
    annotated = tmp_path / "annotated.jpg"
    thumbnail = tmp_path / "annotated-thumbnail.jpg"
    Image.new("RGB", (32, 32), color=(120, 80, 40)).save(source, format="JPEG")

    render_annotated_image(source, annotated, thumbnail, [])

    with Image.open(source) as original, Image.open(annotated) as result:
        assert result.size == original.size
        assert result.getpixel((16, 16)) == pytest.approx(original.getpixel((16, 16)), abs=3)
