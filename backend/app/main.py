from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import or_, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.domain import (
    PUBLIC_CONSENT_TEXT,
    PUBLIC_CONSENT_VERSION,
    SAME_SITE_RADIUS_METERS,
    MAX_DETECTED_ACCURACY_METERS,
    allowed_correction_radius_meters,
    build_reference,
    distance_meters,
    is_active_report,
    pick_neighborhood,
    status_message_for,
)
from app.hotspots import (
    HOTSPOT_WARNING_RADIUS_METERS,
    assess_hotspot_priority,
    hotspot_mirror_status,
    stored_hotspots,
    sync_current_hotspots,
)
from app.image_storage import (
    cleanup_precheck_uploads,
    delete_precheck_image,
    delete_stored_image,
    ensure_upload_dirs,
    resolve_public_upload_path,
    store_precheck_image,
    store_upload,
    check_s3_ready,
    get_s3_presigned_url,
)
from app.inference import ModelInference
from app.models import Report
from app.schemas import (
    HealthOut,
    HotspotMirrorStatusOut,
    HotspotSyncOut,
    NearbyCandidatesOut,
    NearbyReportOut,
    OfficerReportOut,
    OfficerReportUpdateIn,
    PublicHotspotOut,
    PublicMapReportOut,
    PublicReportDetailOut,
    StatusReportOut,
    SubmittedReportOut,
)
from app.service_area import ensure_within_service_area, is_within_service_area
from app.serializers import (
    nearby_report_out,
    officer_report_out,
    prediction_summary_out,
    public_hotspot_out,
    public_report_detail_out,
    public_report_out,
    status_report_out,
    submitted_report_out,
    hotspot_mirror_status_out,
    hotspot_sync_out,
)


app = FastAPI(title="Breeding Habitat Watch API")
model_inference = ModelInference(settings.model_path)
STACKABLE_HABITAT_CLASSES = {"tire", "drain_inlet", "artificial_container"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _report_by_reference(db: Session, reference: str) -> Report | None:
    return db.scalar(select(Report).where(Report.reference == reference.strip().upper()))


def _require_officer(
    authorization: str | None = Header(default=None),
) -> None:
    expected = f"Bearer {settings.officer_api_token}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Officer access token is required.",
        )


def _is_postgresql_session(db: Session) -> bool:
    try:
        return db.get_bind().dialect.name == "postgresql"
    except Exception:
        return False


def _store_report_geographies(
    db: Session,
    *,
    report_id: str,
    latitude: float,
    longitude: float,
    public_latitude: float,
    public_longitude: float,
) -> None:
    if not _is_postgresql_session(db):
        return

    db.execute(
        text(
            """
            UPDATE reports
            SET report_location_geog = ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                public_location_geog = ST_SetSRID(
                    ST_MakePoint(:public_longitude, :public_latitude),
                    4326
                )::geography
            WHERE id = :report_id
            """
        ),
        {
            "report_id": report_id,
            "latitude": latitude,
            "longitude": longitude,
            "public_latitude": public_latitude,
            "public_longitude": public_longitude,
        },
    )


def _root_report(report: Report) -> Report:
    return report.parent_report or report


def _stack_members(db: Session, root_report: Report) -> list[Report]:
    return list(
        db.scalars(
            select(Report)
            .where(or_(Report.id == root_report.id, Report.parent_report_id == root_report.id))
            .order_by(Report.created_at.desc())
        ).all()
    )


def _stack_summary(db: Session, root_report: Report) -> tuple[int, datetime, Report]:
    members = _stack_members(db, root_report)
    latest_report = members[0] if members else root_report
    return len(members), latest_report.created_at, latest_report


def _find_stack_parent(
    db: Session,
    stack_parent_reference: str | None,
    latitude: float,
    longitude: float,
    prediction_label: str,
) -> Report | None:
    if not stack_parent_reference or not stack_parent_reference.strip():
        return None

    requested_report = _report_by_reference(db, stack_parent_reference)
    if requested_report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nearby report not found.")

    parent_report = _root_report(requested_report)
    if not is_active_report(parent_report.status):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Closed reports cannot receive stacked submissions.",
        )

    if (
        prediction_label not in STACKABLE_HABITAT_CLASSES
        or parent_report.prediction_label != prediction_label
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected report no longer matches this submission.",
        )

    distance = distance_meters(
        latitude,
        longitude,
        parent_report.latitude,
        parent_report.longitude,
    )
    if distance > SAME_SITE_RADIUS_METERS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected report no longer matches this submission.",
        )

    return parent_report


def _validate_detected_fix(
    *,
    detected_latitude: float | None,
    detected_longitude: float | None,
    detected_accuracy_meters: float | None,
    detected_source: str | None,
    selected_latitude: float,
    selected_longitude: float,
) -> float:
    if detected_latitude is None or detected_longitude is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A detected device location is required before submission.",
        )

    ensure_within_service_area(detected_latitude, detected_longitude)

    if detected_source != "browser" or detected_accuracy_meters is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A verified browser location is required before submission.",
        )

    if detected_accuracy_meters <= 0 or detected_accuracy_meters > MAX_DETECTED_ACCURACY_METERS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Device location accuracy must be {MAX_DETECTED_ACCURACY_METERS} meters or better.",
        )

    allowed_radius = allowed_correction_radius_meters(detected_accuracy_meters)
    distance = distance_meters(
        detected_latitude,
        detected_longitude,
        selected_latitude,
        selected_longitude,
    )
    if distance > allowed_radius:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected site is outside the allowed correction radius for this device location.",
        )

    return allowed_radius


def _nearby_candidates_for_prediction(
    db: Session,
    *,
    latitude: float,
    longitude: float,
    prediction_label: str,
) -> list[NearbyReportOut]:
    if prediction_label not in STACKABLE_HABITAT_CLASSES:
        return []

    parent_reports = db.scalars(
        select(Report).where(
            Report.parent_report_id.is_(None),
            Report.status != "closed",
            Report.prediction_label == prediction_label,
        )
    ).all()
    candidates: list[tuple[Report, float]] = []

    for report in parent_reports:
        distance = distance_meters(latitude, longitude, report.latitude, report.longitude)
        if distance <= SAME_SITE_RADIUS_METERS:
            candidates.append((report, distance))

    candidates.sort(key=lambda item: item[1])

    results: list[NearbyReportOut] = []
    for report, distance in candidates[:3]:
        report_count, latest_reported_at, latest_report = _stack_summary(db, report)
        results.append(
            nearby_report_out(
                report,
                distance_meters=distance,
                report_count=report_count,
                latest_reported_at=latest_reported_at,
                thumbnail_report=latest_report,
            )
        )

    return results


def _hotspot_report_counts_within_warning(
    db: Session,
    hotspots,
) -> dict[str, int]:
    parent_reports = db.scalars(
        select(Report).where(
            Report.parent_report_id.is_(None),
            Report.public_consent_accepted.is_(True),
        )
    ).all()
    counts: dict[str, int] = {}

    for hotspot in hotspots:
        count = 0
        for report in parent_reports:
            if distance_meters(
                hotspot.latitude,
                hotspot.longitude,
                report.public_latitude,
                report.public_longitude,
            ) <= HOTSPOT_WARNING_RADIUS_METERS:
                count += 1
        counts[hotspot.id] = count

    return counts


@app.on_event("startup")
def startup() -> None:
    ensure_upload_dirs()
    cleanup_precheck_uploads()
    model_inference.load()


@app.get("/api/health", response_model=HealthOut)
def health(db: Session = Depends(get_db)) -> HealthOut:
    details: dict[str, str] = {}
    database_ready = False
    postgis_ready = False

    try:
        db.execute(text("select 1"))
        database_ready = True
    except Exception as exc:
        details["database"] = str(exc)
    else:
        try:
            postgis_ready = bool(
                db.scalar(text("select exists(select 1 from pg_extension where extname = 'postgis')"))
            )
        except Exception:
            postgis_ready = False

        if not postgis_ready:
            details["postgis"] = "PostGIS is not enabled locally; migration will enable it when available."

    if model_inference.load_error:
        details["model"] = model_inference.load_error

    upload_ready = settings.upload_root.exists()
    if not upload_ready:
        details["uploads"] = "Upload root does not exist."

    ok = database_ready and postgis_ready and model_inference.ready and upload_ready

    s3_ready = None
    if settings.storage_backend == "s3":
        s3_ready = check_s3_ready()
        ok = ok and s3_ready
        if not s3_ready:
             details["s3"] = "S3 bucket is not accessible."

    return HealthOut(
        ok=ok,
        database=database_ready,
        model=model_inference.ready,
        uploadRoot=str(settings.upload_root),
        modelPath=str(settings.model_path),
        postgis=postgis_ready,
        storageBackend=settings.storage_backend,
        s3Bucket=settings.s3_bucket,
        s3Ready=s3_ready,
        details=details,
    )


@app.post("/api/reports", response_model=SubmittedReportOut, status_code=status.HTTP_201_CREATED)
async def create_report(
    image: UploadFile = File(...),
    captured_at: datetime = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy_meters: float | None = Form(default=None),
    source: str = Form(default="browser"),
    detected_latitude: float | None = Form(default=None),
    detected_longitude: float | None = Form(default=None),
    detected_accuracy_meters: float | None = Form(default=None),
    detected_source: str | None = Form(default=None),
    notes: str | None = Form(default=None),
    stack_parent_reference: str | None = Form(default=None),
    public_consent_accepted: bool = Form(default=False),
    public_consent_text: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> SubmittedReportOut:
    ensure_within_service_area(latitude, longitude)
    _validate_detected_fix(
        detected_latitude=detected_latitude,
        detected_longitude=detected_longitude,
        detected_accuracy_meters=detected_accuracy_meters,
        detected_source=detected_source,
        selected_latitude=latitude,
        selected_longitude=longitude,
    )

    if not public_consent_accepted:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Confirm public image and exact-pin publication before submitting.",
        )

    if not model_inference.ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The detection model is not ready.",
        )

    stored_image = await store_upload(image)
    try:
        prediction = model_inference.predict(stored_image.image_path)
    except Exception as exc:
        delete_stored_image(stored_image)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The detection model could not process the uploaded image.",
        ) from exc

    try:
        stack_parent = _find_stack_parent(
            db,
            stack_parent_reference,
            latitude,
            longitude,
            prediction.label,
        )
    except HTTPException:
        delete_stored_image(stored_image)
        raise
    except Exception as exc:
        delete_stored_image(stored_image)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The selected report could not be validated. The uploaded files were removed.",
        ) from exc

    public_latitude, public_longitude = latitude, longitude
    now = datetime.now(timezone.utc)
    reference = build_reference(db)
    report_status = "submitted"
    hotspot_priority = assess_hotspot_priority(db, latitude, longitude)
    accepted_consent_text = (
        public_consent_text.strip()
        if public_consent_text and public_consent_text.strip()
        else PUBLIC_CONSENT_TEXT
    )

    detections = [
        {
            "rawLabel": detection.raw_label,
            "confidence": detection.confidence,
            "bbox": detection.bbox,
            "bboxNormalized": detection.bbox_normalized,
            "imageWidth": detection.image_width,
            "imageHeight": detection.image_height,
        }
        for detection in prediction.detections
    ]

    report = Report(
        id=str(uuid4()),
        parent_report_id=stack_parent.id if stack_parent else None,
        reference=reference,
        created_at=now,
        captured_at=captured_at,
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=accuracy_meters,
        location_source=source,
        public_latitude=public_latitude,
        public_longitude=public_longitude,
        status=report_status,
        neighborhood=stack_parent.neighborhood if stack_parent else pick_neighborhood(latitude, longitude),
        status_message=(
            f"Added to existing public report {stack_parent.reference}."
            if stack_parent
            else status_message_for(report_status)
        ),
        notes=notes.strip() if notes and notes.strip() else None,
        image_original_filename=stored_image.original_filename,
        image_mime_type=stored_image.mime_type,
        image_size_bytes=stored_image.size_bytes,
        image_sha256=stored_image.sha256,
        image_path=str(stored_image.image_path),
        thumbnail_path=str(stored_image.thumbnail_path),
        image_storage_key=stored_image.image_storage_key,
        thumbnail_storage_key=stored_image.thumbnail_storage_key,
        prediction_label=prediction.label,
        prediction_confidence=prediction.confidence,
        prediction_confidence_band=prediction.confidence_band,
        prediction_top_raw_label=prediction.top_raw_label,
        prediction_advisory_text=prediction.advisory_text,
        detections=detections,
        public_consent_accepted=True,
        public_consent_at=now,
        public_consent_version=PUBLIC_CONSENT_VERSION,
        public_consent_text=accepted_consent_text,
        hotspot_snapshot_date=hotspot_priority.snapshot_date,
        nearest_hotspot_id=hotspot_priority.nearest_hotspot_id,
        nearest_hotspot_locality=hotspot_priority.nearest_hotspot_locality,
        nearest_hotspot_district=hotspot_priority.nearest_hotspot_district,
        nearest_hotspot_distance_meters=hotspot_priority.nearest_hotspot_distance_meters,
        hotspot_priority_level=hotspot_priority.priority_level,
        hotspot_priority_reason=hotspot_priority.priority_reason,
    )

    try:
        db.add(report)
        db.flush()
        _store_report_geographies(
            db,
            report_id=report.id,
            latitude=latitude,
            longitude=longitude,
            public_latitude=public_latitude,
            public_longitude=public_longitude,
        )
        db.commit()
        db.refresh(report)
        if stack_parent:
            report.parent_report = stack_parent
    except Exception as exc:
        db.rollback()
        delete_stored_image(stored_image)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The report could not be stored. The uploaded files were removed.",
        ) from exc

    return submitted_report_out(report)


async def _precheck_report(
    *,
    image: UploadFile,
    latitude: float,
    longitude: float,
    detected_latitude: float | None,
    detected_longitude: float | None,
    detected_accuracy_meters: float | None,
    detected_source: str | None,
    db: Session,
) -> NearbyCandidatesOut:
    ensure_within_service_area(latitude, longitude)
    _validate_detected_fix(
        detected_latitude=detected_latitude,
        detected_longitude=detected_longitude,
        detected_accuracy_meters=detected_accuracy_meters,
        detected_source=detected_source,
        selected_latitude=latitude,
        selected_longitude=longitude,
    )

    if not model_inference.ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The detection model is not ready.",
        )

    stored_image = await store_precheck_image(image)
    try:
        prediction = model_inference.predict(stored_image.image_path)
        return NearbyCandidatesOut(
            prediction=prediction_summary_out(prediction),
            candidates=_nearby_candidates_for_prediction(
                db,
                latitude=latitude,
                longitude=longitude,
                prediction_label=prediction.label,
            ),
            imageUrl=f"/api/reports/precheck-images/{stored_image.storage_key}",
        )
    except Exception as exc:
        delete_precheck_image(stored_image)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The detection model could not process the uploaded image.",
        ) from exc


@app.post("/api/reports/precheck", response_model=NearbyCandidatesOut)
async def precheck_report(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    detected_latitude: float | None = Form(default=None),
    detected_longitude: float | None = Form(default=None),
    detected_accuracy_meters: float | None = Form(default=None),
    detected_source: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> NearbyCandidatesOut:
    return await _precheck_report(
        image=image,
        latitude=latitude,
        longitude=longitude,
        detected_latitude=detected_latitude,
        detected_longitude=detected_longitude,
        detected_accuracy_meters=detected_accuracy_meters,
        detected_source=detected_source,
        db=db,
    )


@app.post("/api/reports/nearby-candidates", response_model=NearbyCandidatesOut)
async def nearby_report_candidates(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    detected_latitude: float | None = Form(default=None),
    detected_longitude: float | None = Form(default=None),
    detected_accuracy_meters: float | None = Form(default=None),
    detected_source: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> NearbyCandidatesOut:
    return await _precheck_report(
        image=image,
        latitude=latitude,
        longitude=longitude,
        detected_latitude=detected_latitude,
        detected_longitude=detected_longitude,
        detected_accuracy_meters=detected_accuracy_meters,
        detected_source=detected_source,
        db=db,
    )


@app.get("/api/reports/precheck-images/{storage_key:path}")
def precheck_image(storage_key: str) -> FileResponse:
    return FileResponse(resolve_public_upload_path(storage_key))


@app.get("/api/reports/status/{reference}", response_model=StatusReportOut | None)
def report_status(reference: str, db: Session = Depends(get_db)) -> StatusReportOut | None:
    report = _report_by_reference(db, reference)
    return status_report_out(report) if report else None


@app.get("/api/hotspots/current", response_model=list[PublicHotspotOut])
def current_hotspots(db: Session = Depends(get_db)) -> list[PublicHotspotOut]:
    hotspots = stored_hotspots(db)
    report_counts = _hotspot_report_counts_within_warning(db, hotspots)
    return [
        public_hotspot_out(replace(hotspot, report_count_within_warning=report_counts.get(hotspot.id, 0)))
        for hotspot in hotspots
    ]


@app.get("/api/public/reports", response_model=list[PublicMapReportOut])
def public_reports(
    status_filter: str | None = Query(default=None, alias="status"),
    habitat_class: str | None = Query(default=None),
    north: float | None = None,
    south: float | None = None,
    east: float | None = None,
    west: float | None = None,
    db: Session = Depends(get_db),
) -> list[PublicMapReportOut]:
    statement = select(Report).where(
        Report.parent_report_id.is_(None),
        Report.public_consent_accepted.is_(True),
    )

    if status_filter and status_filter != "all":
        statement = statement.where(Report.status == status_filter)

    if habitat_class and habitat_class != "all":
        statement = statement.where(Report.prediction_label == habitat_class)

    if None not in (north, south, east, west):
        statement = statement.where(
            Report.latitude <= north,
            Report.latitude >= south,
            Report.longitude <= east,
            Report.longitude >= west,
        )

    statement = statement.order_by(Report.created_at.desc())
    results: list[PublicMapReportOut] = []

    for report in db.scalars(statement).all():
        if not is_within_service_area(report.latitude, report.longitude):
            continue

        report_count, latest_reported_at, latest_report = _stack_summary(db, report)
        results.append(
            public_report_out(
                report,
                report_count=report_count,
                latest_reported_at=latest_reported_at,
                thumbnail_report=latest_report,
            )
        )
        if len(results) >= 250:
            break

    return results


@app.get("/api/public/reports/{reference}/thumbnail")
def public_report_thumbnail(reference: str, db: Session = Depends(get_db)) -> FileResponse:
    report = _report_by_reference(db, reference)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    if not report.public_consent_accepted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    if not is_within_service_area(report.latitude, report.longitude):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if settings.storage_backend == "s3":
        storage_key = report.thumbnail_storage_key
        if not storage_key:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found in S3.")
        url = get_s3_presigned_url(storage_key)
        return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)

    return FileResponse(
        resolve_public_upload_path(report.thumbnail_storage_key or report.thumbnail_path),
        media_type="image/jpeg",
    )


@app.get("/api/public/reports/{reference}/image")
def public_report_image(reference: str, db: Session = Depends(get_db)) -> FileResponse:
    report = _report_by_reference(db, reference)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    if not report.public_consent_accepted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    if not is_within_service_area(report.latitude, report.longitude):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    if settings.storage_backend == "s3":
        storage_key = report.image_storage_key
        if not storage_key:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found in S3.")
        url = get_s3_presigned_url(storage_key)
        return RedirectResponse(url=url, status_code=status.HTTP_302_FOUND)

    return FileResponse(
        resolve_public_upload_path(report.image_storage_key or report.image_path),
        media_type="image/jpeg",
    )


@app.get("/api/public/reports/{reference}", response_model=PublicReportDetailOut | None)
def public_report_detail(
    reference: str,
    db: Session = Depends(get_db),
) -> PublicReportDetailOut | None:
    report = _report_by_reference(db, reference)
    if report is None:
        return None

    root_report = _root_report(report)
    if not root_report.public_consent_accepted:
        return None
    if not is_within_service_area(root_report.latitude, root_report.longitude):
        return None

    return public_report_detail_out(root_report, _stack_members(db, root_report))


@app.get("/api/officer/reports", response_model=list[OfficerReportOut])
def officer_reports(
    _officer: None = Depends(_require_officer),
    db: Session = Depends(get_db),
) -> list[OfficerReportOut]:
    reports = db.scalars(select(Report).order_by(Report.created_at.desc()).limit(250)).all()
    return [officer_report_out(report) for report in reports]


@app.get("/api/officer/hotspots/status", response_model=HotspotMirrorStatusOut)
def officer_hotspot_status(
    _officer: None = Depends(_require_officer),
    db: Session = Depends(get_db),
) -> HotspotMirrorStatusOut:
    return hotspot_mirror_status_out(hotspot_mirror_status(db))


@app.post("/api/officer/hotspots/sync", response_model=HotspotSyncOut)
def officer_hotspot_sync(
    _officer: None = Depends(_require_officer),
    db: Session = Depends(get_db),
) -> HotspotSyncOut:
    try:
        return hotspot_sync_out(sync_current_hotspots(db))
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Hotspot context could not be synced from iDengue.",
        ) from exc


@app.get("/api/officer/reports/{reference}", response_model=OfficerReportOut | None)
def officer_report_detail(
    reference: str,
    _officer: None = Depends(_require_officer),
    db: Session = Depends(get_db),
) -> OfficerReportOut | None:
    report = _report_by_reference(db, reference)
    return officer_report_out(report) if report else None


@app.patch("/api/officer/reports/{reference}", response_model=OfficerReportOut)
def update_officer_report(
    reference: str,
    payload: OfficerReportUpdateIn,
    _officer: None = Depends(_require_officer),
    db: Session = Depends(get_db),
) -> OfficerReportOut:
    report = _report_by_reference(db, reference)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    now = datetime.now(timezone.utc)
    report.status = payload.status
    report.status_message = status_message_for(payload.status)
    report.officer_notes = payload.officerNotes.strip() if payload.officerNotes else None
    report.follow_up_action = payload.followUpAction.strip() if payload.followUpAction else None
    report.reviewed_by = payload.reviewedBy.strip() if payload.reviewedBy else "Local officer demo"
    report.reviewed_at = now

    db.add(report)
    db.commit()
    db.refresh(report)
    return officer_report_out(report)
