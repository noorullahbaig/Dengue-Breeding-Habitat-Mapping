from __future__ import annotations

from datetime import datetime
from typing import Literal

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
    bboxNormalized: list[float] | None = None
    imageWidth: int | None = None
    imageHeight: int | None = None


class PredictionSummaryOut(BaseModel):
    label: str
    confidence: float | None = None
    confidenceBand: str
    topRawLabel: str | None = None
    detections: list[DetectionOut] = Field(default_factory=list)
    advisoryText: str


class HotspotPriorityOut(BaseModel):
    snapshotDate: datetime | None = None
    nearestHotspotId: str | None = None
    nearestHotspotLocality: str | None = None
    nearestHotspotDistrict: str | None = None
    nearestHotspotDistanceMeters: float | None = None
    priorityLevel: str
    priorityReason: str


class PublicConsentOut(BaseModel):
    accepted: bool
    acceptedAt: datetime | None = None
    version: str | None = None


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
    publicConsent: PublicConsentOut
    hotspotPriority: HotspotPriorityOut


class StatusReportOut(BaseModel):
    id: str
    reference: str
    createdAt: datetime
    status: str
    prediction: PredictionSummaryOut
    neighborhood: str
    statusMessage: str
    stackedOnReference: str | None = None


class PublicMapReportOut(BaseModel):
    id: str
    reference: str
    publicLocation: LocationPoint
    habitatClass: str
    prediction: PredictionSummaryOut
    status: str
    neighborhood: str
    reportedAt: datetime
    latestReportedAt: datetime
    reportCount: int
    thumbnailUrl: str
    imageUrl: str
    privacyNote: str
    hotspotPriority: HotspotPriorityOut


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
    imageUrl: str | None = None


class PublicReportObservationOut(BaseModel):
    id: str
    reference: str
    capturedAt: datetime
    reportedAt: datetime
    imageUrl: str
    thumbnailUrl: str
    habitatClass: str
    confidenceBand: str
    prediction: PredictionSummaryOut


class PublicReportDetailOut(BaseModel):
    id: str
    reference: str
    publicLocation: LocationPoint
    habitatClass: str
    prediction: PredictionSummaryOut
    status: str
    neighborhood: str
    reportedAt: datetime
    latestReportedAt: datetime
    reportCount: int
    thumbnailUrl: str
    imageUrl: str
    privacyNote: str
    hotspotPriority: HotspotPriorityOut
    observations: list[PublicReportObservationOut]


class PublicHotspotOut(BaseModel):
    id: str
    locality: str
    district: str
    center: LocationPoint
    radiusMeters: int
    cumulativeCases: int | None = None
    outbreakDurationDays: int | None = None
    outbreakStartDate: datetime
    weekNumber: int
    year: int
    snapshotDate: datetime
    sourceLabel: str
    reportCountWithinWarning: int | None = None


class StackParentSummaryOut(BaseModel):
    reference: str
    createdAt: datetime
    status: str
    prediction: PredictionSummaryOut
    imageUrl: str
    thumbnailUrl: str


class HotspotMirrorStatusOut(BaseModel):
    hotspotCount: int
    latestSnapshotDate: datetime | None = None
    lastSyncedAt: datetime | None = None
    sourceLabel: str


class HotspotSyncOut(BaseModel):
    syncedCount: int
    snapshotDate: datetime | None = None
    sourceLabel: str
    syncedAt: datetime



class HealthOut(BaseModel):
    ok: bool
    database: bool
    model: bool
    uploadRoot: str
    modelPath: str
    postgis: bool = False
    storageBackend: str
    s3Bucket: str | None = None
    s3Ready: bool | None = None
    details: dict[str, str] = Field(default_factory=dict)
