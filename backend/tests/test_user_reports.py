from __future__ import annotations

from datetime import datetime, timedelta, timezone
from dataclasses import replace

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app import main
from app.main import (
    claim_my_report,
    list_my_reports,
    owner_report_detail,
    owner_report_image,
    public_report_image,
)
from app.models import Report, User
from app.schemas import ClaimReportIn
from app.claims import create_claim_token, hash_claim_token
from app.config import settings


def make_user(user_id: str) -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=user_id,
        cognito_sub=user_id.removeprefix("cognito:"),
        email=f"{user_id}@example.com",
        display_name=user_id,
        provider="cognito",
        created_at=now,
        updated_at=now,
    )


def make_report(reference: str, created_at: datetime, *, user_id: str | None = None, notes: str | None = None) -> Report:
    return Report(
        id=f"id-{reference}",
        reference=reference,
        created_at=created_at,
        captured_at=created_at,
        latitude=3.139,
        longitude=101.6869,
        location_source="browser",
        public_latitude=3.139,
        public_longitude=101.6869,
        status="submitted",
        neighborhood="Kuala Lumpur",
        status_message="Report received.",
        notes=notes,
        image_original_filename="evidence.jpg",
        image_mime_type="image/jpeg",
        image_size_bytes=10,
        image_sha256="a" * 64,
        image_path="/tmp/evidence.jpg",
        thumbnail_path="/tmp/thumb.jpg",
        prediction_label="tire",
        prediction_confidence=0.9,
        prediction_confidence_band="high",
        prediction_advisory_text="Advisory only.",
        detections=[],
        public_consent_accepted=True,
        hotspot_priority_level="routine",
        hotspot_priority_reason="No hotspot context.",
        user_id=user_id,
    )


@pytest.fixture
def db() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_my_reports_returns_only_current_users_reports_newest_first(db: Session):
    user = make_user("cognito:one")
    other = make_user("cognito:two")
    now = datetime.now(timezone.utc)
    db.add_all(
        [
            user,
            other,
            make_report("KL-OLD-0001", now - timedelta(days=1), user_id=user.id),
            make_report("KL-NEW-0002", now, user_id=user.id, notes="Water beneath drain cover"),
            make_report("KL-OTHER-0003", now + timedelta(days=1), user_id=other.id),
        ]
    )
    db.commit()

    reports = list_my_reports(current_user=user, db=db)

    assert [report.reference for report in reports] == ["KL-NEW-0002", "KL-OLD-0001"]
    assert reports[0].notes == "Water beneath drain cover"
    assert reports[1].notes is None


def test_anonymous_report_can_be_claimed_once_by_its_private_token(db: Session):
    user = make_user("cognito:one")
    report = make_report("KL-CLAIM-0001", datetime.now(timezone.utc))
    token = create_claim_token()
    report.claim_token_hash = hash_claim_token(token)
    report.claim_token_created_at = datetime.now(timezone.utc)
    db.add_all([user, report])
    db.commit()

    claimed = claim_my_report(
        payload=ClaimReportIn(reference=report.reference, claimToken=token),
        current_user=user,
        db=db,
    )

    assert claimed.reference == report.reference
    assert report.user_id == user.id
    assert report.claim_token_hash is None

    repeated = claim_my_report(
        payload=ClaimReportIn(reference=report.reference, claimToken=token),
        current_user=user,
        db=db,
    )
    assert repeated.reference == report.reference


def test_claim_rejects_invalid_token_and_competing_owner(db: Session):
    owner = make_user("cognito:owner")
    other = make_user("cognito:other")
    report = make_report("KL-CLAIM-0002", datetime.now(timezone.utc))
    token = create_claim_token()
    report.claim_token_hash = hash_claim_token(token)
    db.add_all([owner, other, report])
    db.commit()

    with pytest.raises(HTTPException) as invalid:
        claim_my_report(
            payload=ClaimReportIn(reference=report.reference, claimToken="wrong-token-that-is-long-enough"),
            current_user=owner,
            db=db,
        )
    assert invalid.value.status_code == 403

    report.user_id = owner.id
    report.claim_token_hash = None
    db.commit()

    with pytest.raises(HTTPException) as conflict:
        claim_my_report(
            payload=ClaimReportIn(reference=report.reference, claimToken=token),
            current_user=other,
            db=db,
        )
    assert conflict.value.status_code == 409


def test_owner_detail_hides_another_users_report(db: Session):
    owner = make_user("cognito:owner")
    other = make_user("cognito:other")
    report = make_report("KL-PRIVATE-0001", datetime.now(timezone.utc), user_id=owner.id)
    db.add_all([owner, other, report])
    db.commit()

    detail = owner_report_detail(report.reference, current_user=owner, db=db)
    assert detail.reference == report.reference

    with pytest.raises(HTTPException) as hidden:
        owner_report_detail(report.reference, current_user=other, db=db)
    assert hidden.value.status_code == 404


def test_owner_media_allows_private_evidence_only_for_owner(db: Session):
    owner = make_user("cognito:owner")
    other = make_user("cognito:other")
    report = make_report("KL-PRIVATE-0002", datetime.now(timezone.utc), user_id=owner.id)
    image_path = settings.upload_root / "test-private-owner-evidence.jpg"
    image_path.write_bytes(b"private evidence")
    report.image_path = str(image_path)
    report.public_consent_accepted = False
    db.add_all([owner, other, report])
    db.commit()

    try:
        response = owner_report_image(report.reference, current_user=owner, db=db)
        assert response.path == image_path

        with pytest.raises(HTTPException) as hidden:
            owner_report_image(report.reference, current_user=other, db=db)
        assert hidden.value.status_code == 404

        with pytest.raises(HTTPException) as public_hidden:
            public_report_image(report.reference, db=db)
        assert public_hidden.value.status_code == 404
    finally:
        image_path.unlink(missing_ok=True)


@pytest.mark.anyio
async def test_owner_media_streams_s3_object_through_authenticated_api(db: Session, monkeypatch):
    owner = make_user("cognito:s3-owner")
    report = make_report("KL-S3-PRIVATE-0001", datetime.now(timezone.utc), user_id=owner.id)
    report.image_storage_key = "evidence/private.jpg"
    db.add_all([owner, report])
    db.commit()

    monkeypatch.setattr(main, "settings", replace(settings, storage_backend="s3", s3_bucket="test-bucket"))
    monkeypatch.setattr(main, "stream_s3_object", lambda key: (iter([b"private evidence"]), "image/jpeg"))

    response = main.owner_report_image(report.reference, current_user=owner, db=db)

    assert response.media_type == "image/jpeg"
    chunks = [chunk async for chunk in response.body_iterator]
    assert b"".join(chunks) == b"private evidence"
