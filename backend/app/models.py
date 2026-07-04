from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    cognito_sub: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # 'cognito' or 'local'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    reports: Mapped[list["Report"]] = relationship("Report", back_populates="user")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    parent_report_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("reports.id"),
        nullable=True,
        index=True,
    )
    reference: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_source: Mapped[str] = mapped_column(String(32), nullable=False)
    public_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    public_longitude: Mapped[float] = mapped_column(Float, nullable=False)

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="submitted")
    neighborhood: Mapped[str] = mapped_column(String(80), nullable=False)
    status_message: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    image_original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    image_mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    image_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    image_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    image_path: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_path: Mapped[str] = mapped_column(Text, nullable=False)
    image_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    thumbnail_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    annotated_image_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    annotated_thumbnail_storage_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    prediction_label: Mapped[str] = mapped_column(String(64), nullable=False)
    prediction_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    prediction_confidence_band: Mapped[str] = mapped_column(String(32), nullable=False)
    prediction_top_raw_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    prediction_advisory_text: Mapped[str] = mapped_column(Text, nullable=False)
    detections: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list)

    public_consent_accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    public_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    public_consent_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    public_consent_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    hotspot_snapshot_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nearest_hotspot_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nearest_hotspot_locality: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nearest_hotspot_district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    nearest_hotspot_distance_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    hotspot_priority_level: Mapped[str] = mapped_column(String(32), nullable=False, default="unassessed")
    hotspot_priority_reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="Hotspot priority has not been assessed yet.",
    )



    user_id: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    claim_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    claim_token_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user: Mapped["User | None"] = relationship("User", back_populates="reports")
    parent_report: Mapped["Report | None"] = relationship(
        "Report",
        remote_side="Report.id",
        back_populates="stacked_reports",
    )
    stacked_reports: Mapped[list["Report"]] = relationship(
        "Report",
        back_populates="parent_report",
    )


Index("ix_reports_public_location", Report.public_latitude, Report.public_longitude)
Index("ix_reports_status_prediction", Report.status, Report.prediction_label)


class Hotspot(Base):
    __tablename__ = "hotspots"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    locality: Mapped[str] = mapped_column(String(255), nullable=False)
    district: Mapped[str] = mapped_column(String(120), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    radius_meters: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    cumulative_cases: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outbreak_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outbreak_start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_label: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="iDengue hotspot context",
    )
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


Index("ix_hotspots_snapshot_date", Hotspot.snapshot_date)
