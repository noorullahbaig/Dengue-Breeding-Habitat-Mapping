from pathlib import Path

import pytest
from fastapi import HTTPException

from app.image_storage import StoredImage, delete_stored_image, store_upload


class FakeUpload:
    def __init__(self, content: bytes, content_type: str = "text/plain"):
        self.content_type = content_type
        self.filename = "sample.txt"
        self._content = content

    async def read(self) -> bytes:
        return self._content


@pytest.mark.anyio
async def test_rejects_non_image_upload():
    with pytest.raises(HTTPException) as exc_info:
        await store_upload(FakeUpload(b"not an image"))

    assert exc_info.value.status_code == 400


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
            image_path=evidence,
            thumbnail_path=thumbnail,
        )
    )

    assert not evidence.exists()
    assert not thumbnail.exists()
