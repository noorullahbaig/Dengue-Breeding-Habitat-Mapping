from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import or_, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.domain import (
    SAME_SITE_RADIUS_METERS,
    build_reference,
    distance_meters,
    is_active_report,
    pick_neighborhood,
    status_message_for,
)
from app.image_storage import (
    delete_stored_image,
    ensure_upload_dirs,
    resolve_public_upload_path,
    store_upload,
)
from app.inference import ModelInference
from app.models import Report
from app.schemas import (
    HealthOut,
    NearbyCandidatesOut,
    NearbyReportOut,
    PublicMapReportOut,
    PublicReportDetailOut,
    StatusReportOut,
    SubmittedReportOut,
)
from app.service_area import ensure_within_service_area, is_within_service_area
from app.serializers import (
    nearby_report_out,
    prediction_summary_out,
    public_report_detail_out,
    public_report_out,
    status_report_out,
    submitted_report_out,
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


@app.on_event("startup")
def startup() -> None:
    ensure_upload_dirs()
    model_inference.load()


@app.get("/api/health", response_model=HealthOut)
def health(db: Session = Depends(get_db)) -> HealthOut:
    details: dict[str, str] = {}
    database_ready = False

    try:
        db.execute(text("select 1"))
        database_ready = True
    except Exception as exc:
        details["database"] = str(exc)

    if model_inference.load_error:
        details["model"] = model_inference.load_error

    upload_ready = settings.upload_root.exists()
    if not upload_ready:
        details["uploads"] = "Upload root does not exist."

    ok = database_ready and model_inference.ready and upload_ready
    return HealthOut(
        ok=ok,
        database=database_ready,
        model=model_inference.ready,
        uploadRoot=str(settings.upload_root),
        modelPath=str(settings.model_path),
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
    notes: str | None = Form(default=None),
    stack_parent_reference: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> SubmittedReportOut:
    ensure_within_service_area(latitude, longitude)

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

    detections = [
        {
            "rawLabel": detection.raw_label,
            "confidence": detection.confidence,
            "bbox": detection.bbox,
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
        prediction_label=prediction.label,
        prediction_confidence=prediction.confidence,
        prediction_confidence_band=prediction.confidence_band,
        prediction_top_raw_label=prediction.top_raw_label,
        prediction_advisory_text=prediction.advisory_text,
        detections=detections,
    )

    try:
        db.add(report)
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


@app.post("/api/reports/nearby-candidates", response_model=NearbyCandidatesOut)
async def nearby_report_candidates(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    db: Session = Depends(get_db),
) -> NearbyCandidatesOut:
    ensure_within_service_area(latitude, longitude)

    if not model_inference.ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The detection model is not ready.",
        )

    stored_image = await store_upload(image)
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
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The detection model could not process the uploaded image.",
        ) from exc
    finally:
        delete_stored_image(stored_image)


@app.get("/api/reports/status/{reference}", response_model=StatusReportOut | None)
def report_status(reference: str, db: Session = Depends(get_db)) -> StatusReportOut | None:
    report = _report_by_reference(db, reference)
    return status_report_out(report) if report else None


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
    statement = select(Report).where(Report.parent_report_id.is_(None))

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
    if not is_within_service_area(report.latitude, report.longitude):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    return FileResponse(resolve_public_upload_path(report.thumbnail_path), media_type="image/jpeg")


@app.get("/api/public/reports/{reference}/image")
def public_report_image(reference: str, db: Session = Depends(get_db)) -> FileResponse:
    report = _report_by_reference(db, reference)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")
    if not is_within_service_area(report.latitude, report.longitude):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    return FileResponse(resolve_public_upload_path(report.image_path), media_type="image/jpeg")


@app.get("/api/public/reports/{reference}", response_model=PublicReportDetailOut | None)
def public_report_detail(
    reference: str,
    db: Session = Depends(get_db),
) -> PublicReportDetailOut | None:
    report = _report_by_reference(db, reference)
    if report is None:
        return None

    root_report = _root_report(report)
    if not is_within_service_area(root_report.latitude, root_report.longitude):
        return None

    return public_report_detail_out(root_report, _stack_members(db, root_report))
