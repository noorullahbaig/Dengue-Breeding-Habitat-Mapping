from __future__ import annotations

from urllib.parse import quote

from app.models import Report
from app.inference import PredictionSummary
from app.schemas import (
    DetectionOut,
    LocationPoint,
    PredictionSummaryOut,
    NearbyReportOut,
    PublicReportDetailOut,
    PublicReportObservationOut,
    PublicMapReportOut,
    StatusPredictionOut,
    StatusReportOut,
    SubmittedReportOut,
)


PRIVACY_NOTE = (
    "Citizen-submitted image and exact pin are public because the reporter confirmed publication."
)


def _media_url(report: Report, variant: str) -> str:
    return f"/api/public/reports/{quote(report.reference)}/{variant}"


def _prediction(report: Report) -> PredictionSummaryOut:
    return PredictionSummaryOut(
        label=report.prediction_label,
        confidence=report.prediction_confidence,
        confidenceBand=report.prediction_confidence_band,
        topRawLabel=report.prediction_top_raw_label,
        detections=[
            DetectionOut(
                rawLabel=item["rawLabel"],
                confidence=item["confidence"],
                bbox=item["bbox"],
            )
            for item in report.detections
        ],
        advisoryText=report.prediction_advisory_text,
    )


def prediction_summary_out(prediction: PredictionSummary) -> PredictionSummaryOut:
    return PredictionSummaryOut(
        label=prediction.label,
        confidence=prediction.confidence,
        confidenceBand=prediction.confidence_band,
        topRawLabel=prediction.top_raw_label,
        detections=[
            DetectionOut(
                rawLabel=detection.raw_label,
                confidence=detection.confidence,
                bbox=detection.bbox,
            )
            for detection in prediction.detections
        ],
        advisoryText=prediction.advisory_text,
    )


def submitted_report_out(report: Report) -> SubmittedReportOut:
    stacked_on_reference = report.parent_report.reference if report.parent_report else None

    return SubmittedReportOut(
        id=report.id,
        reference=report.reference,
        createdAt=report.created_at,
        reportLocation=LocationPoint(
            latitude=report.latitude,
            longitude=report.longitude,
            accuracyMeters=report.accuracy_meters,
            source=report.location_source,
        ),
        publicLocation=LocationPoint(
            latitude=report.public_latitude,
            longitude=report.public_longitude,
            source="public",
        ),
        status=report.status,
        prediction=_prediction(report),
        neighborhood=report.neighborhood,
        statusMessage=report.status_message,
        notes=report.notes,
        stackedOnReference=stacked_on_reference,
    )


def status_report_out(report: Report) -> StatusReportOut:
    root_report = report.parent_report or report
    stacked_on_reference = report.parent_report.reference if report.parent_report else None

    return StatusReportOut(
        id=report.id,
        reference=report.reference,
        createdAt=report.created_at,
        status=root_report.status,
        prediction=StatusPredictionOut(
            label=report.prediction_label,
            confidence=report.prediction_confidence,
            confidenceBand=report.prediction_confidence_band,
            advisoryText=report.prediction_advisory_text,
        ),
        neighborhood=root_report.neighborhood,
        statusMessage=(
            f"Added to existing public report {stacked_on_reference}."
            if stacked_on_reference
            else report.status_message
        ),
        stackedOnReference=stacked_on_reference,
    )


def public_report_out(
    report: Report,
    *,
    report_count: int = 1,
    latest_reported_at=None,
    thumbnail_report: Report | None = None,
) -> PublicMapReportOut:
    latest_reported_at = latest_reported_at or report.created_at
    thumbnail_report = thumbnail_report or report

    return PublicMapReportOut(
        id=report.id,
        reference=report.reference,
        publicLocation=LocationPoint(
            latitude=report.latitude,
            longitude=report.longitude,
            source="public",
        ),
        habitatClass=report.prediction_label,
        status=report.status,
        neighborhood=report.neighborhood,
        reportedAt=report.created_at,
        latestReportedAt=latest_reported_at,
        reportCount=report_count,
        thumbnailUrl=_media_url(thumbnail_report, "thumbnail"),
        imageUrl=_media_url(thumbnail_report, "image"),
        privacyNote=PRIVACY_NOTE,
    )


def nearby_report_out(
    report: Report,
    *,
    distance_meters: float,
    report_count: int,
    latest_reported_at,
    thumbnail_report: Report | None = None,
) -> NearbyReportOut:
    thumbnail_report = thumbnail_report or report

    return NearbyReportOut(
        id=report.id,
        reference=report.reference,
        publicLocation=LocationPoint(
            latitude=report.latitude,
            longitude=report.longitude,
            source="public",
        ),
        habitatClass=report.prediction_label,
        status=report.status,
        neighborhood=report.neighborhood,
        distanceMeters=round(distance_meters, 1),
        latestReportedAt=latest_reported_at,
        reportCount=report_count,
        thumbnailUrl=_media_url(thumbnail_report, "thumbnail"),
    )


def public_report_detail_out(root_report: Report, observations: list[Report]) -> PublicReportDetailOut:
    ordered_observations = sorted(observations, key=lambda item: item.created_at, reverse=True)
    latest_observation = ordered_observations[0] if ordered_observations else root_report

    return PublicReportDetailOut(
        id=root_report.id,
        reference=root_report.reference,
        publicLocation=LocationPoint(
            latitude=root_report.latitude,
            longitude=root_report.longitude,
            source="public",
        ),
        habitatClass=root_report.prediction_label,
        status=root_report.status,
        neighborhood=root_report.neighborhood,
        reportedAt=root_report.created_at,
        latestReportedAt=latest_observation.created_at,
        reportCount=len(ordered_observations),
        thumbnailUrl=_media_url(latest_observation, "thumbnail"),
        imageUrl=_media_url(latest_observation, "image"),
        observations=[
            PublicReportObservationOut(
                id=observation.id,
                reference=observation.reference,
                capturedAt=observation.captured_at,
                reportedAt=observation.created_at,
                imageUrl=_media_url(observation, "image"),
                thumbnailUrl=_media_url(observation, "thumbnail"),
                habitatClass=observation.prediction_label,
                confidenceBand=observation.prediction_confidence_band,
            )
            for observation in ordered_observations
        ],
    )
