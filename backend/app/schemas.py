from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LocationPoint(BaseModel):
    latitude: float
    longitude: float
    accuracyMeters: float | None = None
    source: str


class DetectionOut(BaseModel):
    rawLabel: str
    confidence: float
    bbox: list[float]


class PredictionSummaryOut(BaseModel):
    label: str
    confidence: float | None = None
    confidenceBand: str
    topRawLabel: str | None = None
    detections: list[DetectionOut] = Field(default_factory=list)
    advisoryText: str


class StatusPredictionOut(BaseModel):
    label: str
    confidence: float | None = None
    confidenceBand: str
    advisoryText: str


class SubmittedReportOut(BaseModel):
    id: str
    reference: str
    createdAt: datetime
    reportLocation: LocationPoint
    publicLocation: LocationPoint
    status: str
    prediction: PredictionSummaryOut
    neighborhood: str
    statusMessage: str
    notes: str | None = None
    stackedOnReference: str | None = None


class StatusReportOut(BaseModel):
    id: str
    reference: str
    createdAt: datetime
    status: str
    prediction: StatusPredictionOut
    neighborhood: str
    statusMessage: str
    stackedOnReference: str | None = None


class PublicMapReportOut(BaseModel):
    id: str
    reference: str
    publicLocation: LocationPoint
    habitatClass: str
    status: str
    neighborhood: str
    reportedAt: datetime
    latestReportedAt: datetime
    reportCount: int
    thumbnailUrl: str
    imageUrl: str
    privacyNote: str


class NearbyReportOut(BaseModel):
    id: str
    reference: str
    publicLocation: LocationPoint
    habitatClass: str
    status: str
    neighborhood: str
    distanceMeters: float
    latestReportedAt: datetime
    reportCount: int
    thumbnailUrl: str


class NearbyCandidatesOut(BaseModel):
    prediction: PredictionSummaryOut
    candidates: list[NearbyReportOut] = Field(default_factory=list)


class PublicReportObservationOut(BaseModel):
    id: str
    reference: str
    capturedAt: datetime
    reportedAt: datetime
    imageUrl: str
    thumbnailUrl: str
    habitatClass: str
    confidenceBand: str


class PublicReportDetailOut(BaseModel):
    id: str
    reference: str
    publicLocation: LocationPoint
    habitatClass: str
    status: str
    neighborhood: str
    reportedAt: datetime
    latestReportedAt: datetime
    reportCount: int
    thumbnailUrl: str
    imageUrl: str
    observations: list[PublicReportObservationOut]


class HealthOut(BaseModel):
    ok: bool
    database: bool
    model: bool
    uploadRoot: str
    modelPath: str
    details: dict[str, str] = Field(default_factory=dict)
