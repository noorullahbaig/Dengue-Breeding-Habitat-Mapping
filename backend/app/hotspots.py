from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.service_area import is_within_service_area


HOTSPOT_CORE_RADIUS_METERS = 200
HOTSPOT_WARNING_RADIUS_METERS = 400
HOTSPOT_FIELDS = [
    "SPWD.AVT_HOTSPOTMINGGUAN.LOKALITI",
    "SPWD.AVT_HOTSPOTMINGGUAN.DAERAH",
    "SPWD.AVT_HOTSPOTMINGGUAN.KUMULATIF_KES",
    "SPWD.AVT_HOTSPOTMINGGUAN.TEMPOH_WABAK",
    "SPWD.AVT_HOTSPOTMINGGUAN.TARIKH_MULA_WABAK",
    "SPWD.AVT_HOTSPOTMINGGUAN.WEEKNUM",
    "SPWD.AVT_HOTSPOTMINGGUAN.TAHUN",
    "SPWD.AVT_HOTSPOTMINGGUAN.RUNSISDATE",
    "SPWD.DBO_LOKALITI_POINTS.POINT_X",
    "SPWD.DBO_LOKALITI_POINTS.POINT_Y",
]


@dataclass(frozen=True)
class PublicHotspot:
    id: str
    locality: str
    district: str
    latitude: float
    longitude: float
    radius_meters: int
    cumulative_cases: int | None
    outbreak_duration_days: int | None
    outbreak_start_date: datetime
    week_number: int
    year: int
    snapshot_date: datetime
    source_label: str = "iDengue hotspot context"
    report_count_within_warning: int | None = None


@dataclass(frozen=True)
class HotspotPriority:
    snapshot_date: datetime | None
    nearest_hotspot_id: str | None
    nearest_hotspot_locality: str | None
    nearest_hotspot_district: str | None
    nearest_hotspot_distance_meters: float | None
    priority_level: str
    priority_reason: str


@dataclass(frozen=True)
class HotspotSyncResult:
    synced_count: int
    snapshot_date: datetime | None
    source_label: str
    synced_at: datetime


@dataclass(frozen=True)
class HotspotMirrorStatus:
    hotspot_count: int
    latest_snapshot_date: datetime | None
    last_synced_at: datetime | None
    source_label: str


def _get_string(attributes: dict[str, Any], field: str) -> str:
    value = attributes.get(field)
    return value.strip() if isinstance(value, str) else ""


def _get_required_number(attributes: dict[str, Any], field: str) -> float | None:
    value = attributes.get(field)
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None

    return numeric_value


def _get_optional_int(attributes: dict[str, Any], field: str) -> int | None:
    value = attributes.get(field)
    if value in (None, ""):
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _arcgis_date(value: float) -> datetime:
    seconds = value / 1000 if value > 10_000_000_000 else value
    return datetime.fromtimestamp(seconds, timezone.utc)


def _build_hotspot_id(
    district: str,
    locality: str,
    longitude: float,
    latitude: float,
    snapshot_date: datetime,
) -> str:
    segments = [
        district,
        locality,
        f"{longitude:.6f}",
        f"{latitude:.6f}",
        snapshot_date.isoformat(),
    ]
    return "--".join(quote(segment.lower(), safe="") for segment in segments)


def _parse_feature(feature: dict[str, Any]) -> PublicHotspot | None:
    attributes = feature.get("attributes")
    if not isinstance(attributes, dict):
        return None

    locality = _get_string(attributes, "SPWD.AVT_HOTSPOTMINGGUAN.LOKALITI")
    district = _get_string(attributes, "SPWD.AVT_HOTSPOTMINGGUAN.DAERAH")
    runsis_date = _get_required_number(attributes, "SPWD.AVT_HOTSPOTMINGGUAN.RUNSISDATE")
    outbreak_start_date = _get_required_number(
        attributes,
        "SPWD.AVT_HOTSPOTMINGGUAN.TARIKH_MULA_WABAK",
    )
    week_number = _get_required_number(attributes, "SPWD.AVT_HOTSPOTMINGGUAN.WEEKNUM")
    year = _get_required_number(attributes, "SPWD.AVT_HOTSPOTMINGGUAN.TAHUN")
    longitude = _get_required_number(attributes, "SPWD.DBO_LOKALITI_POINTS.POINT_X")
    latitude = _get_required_number(attributes, "SPWD.DBO_LOKALITI_POINTS.POINT_Y")

    if (
        not locality
        or not district
        or runsis_date is None
        or outbreak_start_date is None
        or week_number is None
        or year is None
        or longitude is None
        or latitude is None
    ):
        return None

    snapshot_date = _arcgis_date(runsis_date)
    return PublicHotspot(
        id=_build_hotspot_id(district, locality, longitude, latitude, snapshot_date),
        locality=locality,
        district=district,
        latitude=latitude,
        longitude=longitude,
        radius_meters=HOTSPOT_CORE_RADIUS_METERS,
        cumulative_cases=_get_optional_int(
            attributes,
            "SPWD.AVT_HOTSPOTMINGGUAN.KUMULATIF_KES",
        ),
        outbreak_duration_days=_get_optional_int(
            attributes,
            "SPWD.AVT_HOTSPOTMINGGUAN.TEMPOH_WABAK",
        ),
        outbreak_start_date=_arcgis_date(outbreak_start_date),
        week_number=int(week_number),
        year=int(year),
        snapshot_date=snapshot_date,
    )


def fetch_current_hotspots() -> list[PublicHotspot]:
    params = {
        "where": "SPWD.AVT_HOTSPOTMINGGUAN.NEGERI='WILAYAH PERSEKUTUAN'",
        "outFields": ",".join(HOTSPOT_FIELDS),
        "returnGeometry": "false",
        "f": "json",
    }
    response = httpx.get(settings.idengue_hotspot_endpoint, params=params, timeout=6)
    response.raise_for_status()
    payload = response.json()
    features = payload.get("features") if isinstance(payload, dict) else None

    if not isinstance(features, list) or not features:
        raise RuntimeError("The iDengue hotspot response was empty.")

    hotspots = [_parse_feature(feature) for feature in features if isinstance(feature, dict)]
    parsed_hotspots = [hotspot for hotspot in hotspots if hotspot is not None]

    if not parsed_hotspots:
        raise RuntimeError("The iDengue hotspot response was malformed.")

    latest_snapshot = max(hotspot.snapshot_date for hotspot in parsed_hotspots)
    latest_hotspots = [
        hotspot for hotspot in parsed_hotspots if hotspot.snapshot_date == latest_snapshot
    ]
    deduped: dict[tuple[str, str, float, float], PublicHotspot] = {}

    for hotspot in latest_hotspots:
        key = (hotspot.locality, hotspot.district, hotspot.longitude, hotspot.latitude)
        deduped.setdefault(key, hotspot)

    return sorted(
        [
            hotspot
            for hotspot in deduped.values()
            if is_within_service_area(hotspot.latitude, hotspot.longitude)
        ],
        key=lambda hotspot: (
            hotspot.outbreak_start_date,
            -(hotspot.cumulative_cases or 0),
            hotspot.locality,
        ),
    )


def unavailable_hotspot_priority(reason: str = "Hotspot context is temporarily unavailable.") -> HotspotPriority:
    return HotspotPriority(
        snapshot_date=None,
        nearest_hotspot_id=None,
        nearest_hotspot_locality=None,
        nearest_hotspot_district=None,
        nearest_hotspot_distance_meters=None,
        priority_level="unavailable",
        priority_reason=reason,
    )


def _hotspot_from_row(row: dict[str, Any]) -> PublicHotspot:
    return PublicHotspot(
        id=row["id"],
        locality=row["locality"],
        district=row["district"],
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        radius_meters=int(row["radius_meters"]),
        cumulative_cases=row["cumulative_cases"],
        outbreak_duration_days=row["outbreak_duration_days"],
        outbreak_start_date=row["outbreak_start_date"],
        week_number=int(row["week_number"]),
        year=int(row["year"]),
        snapshot_date=row["snapshot_date"],
        source_label=row["source_label"],
    )


def priority_from_nearest_hotspot(hotspot: PublicHotspot, distance: float) -> HotspotPriority:
    distance = round(distance, 1)

    if distance <= HOTSPOT_CORE_RADIUS_METERS:
        level = "core"
        reason = f"Within 200 m of current iDengue hotspot context for {hotspot.locality}."
    elif distance <= HOTSPOT_WARNING_RADIUS_METERS:
        level = "warning"
        reason = f"Within 400 m warning buffer of current iDengue hotspot context for {hotspot.locality}."
    else:
        level = "routine"
        reason = "No current iDengue hotspot is within the 400 m warning buffer."

    return HotspotPriority(
        snapshot_date=hotspot.snapshot_date,
        nearest_hotspot_id=hotspot.id,
        nearest_hotspot_locality=hotspot.locality,
        nearest_hotspot_district=hotspot.district,
        nearest_hotspot_distance_meters=distance,
        priority_level=level,
        priority_reason=reason,
    )


def sync_current_hotspots(db: Session) -> HotspotSyncResult:
    hotspots = fetch_current_hotspots()
    if not hotspots:
        raise RuntimeError("The iDengue hotspot response did not contain current Kuala Lumpur rows.")

    latest_snapshot = max(hotspot.snapshot_date for hotspot in hotspots)
    synced_at = datetime.now(timezone.utc)

    upsert_statement = text(
        """
        INSERT INTO hotspots (
            id,
            locality,
            district,
            latitude,
            longitude,
            center_geog,
            radius_meters,
            cumulative_cases,
            outbreak_duration_days,
            outbreak_start_date,
            week_number,
            year,
            snapshot_date,
            source_label,
            synced_at
        )
        VALUES (
            :id,
            :locality,
            :district,
            :latitude,
            :longitude,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
            :radius_meters,
            :cumulative_cases,
            :outbreak_duration_days,
            :outbreak_start_date,
            :week_number,
            :year,
            :snapshot_date,
            :source_label,
            :synced_at
        )
        ON CONFLICT (id) DO UPDATE SET
            locality = EXCLUDED.locality,
            district = EXCLUDED.district,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            center_geog = EXCLUDED.center_geog,
            radius_meters = EXCLUDED.radius_meters,
            cumulative_cases = EXCLUDED.cumulative_cases,
            outbreak_duration_days = EXCLUDED.outbreak_duration_days,
            outbreak_start_date = EXCLUDED.outbreak_start_date,
            week_number = EXCLUDED.week_number,
            year = EXCLUDED.year,
            snapshot_date = EXCLUDED.snapshot_date,
            source_label = EXCLUDED.source_label,
            synced_at = EXCLUDED.synced_at
        """
    )

    for hotspot in hotspots:
        db.execute(
            upsert_statement,
            {
                "id": hotspot.id,
                "locality": hotspot.locality,
                "district": hotspot.district,
                "latitude": hotspot.latitude,
                "longitude": hotspot.longitude,
                "radius_meters": hotspot.radius_meters,
                "cumulative_cases": hotspot.cumulative_cases,
                "outbreak_duration_days": hotspot.outbreak_duration_days,
                "outbreak_start_date": hotspot.outbreak_start_date,
                "week_number": hotspot.week_number,
                "year": hotspot.year,
                "snapshot_date": hotspot.snapshot_date,
                "source_label": hotspot.source_label,
                "synced_at": synced_at,
            },
        )

    db.execute(text("DELETE FROM hotspots WHERE snapshot_date <> :snapshot_date"), {"snapshot_date": latest_snapshot})
    db.commit()

    return HotspotSyncResult(
        synced_count=len(hotspots),
        snapshot_date=latest_snapshot,
        source_label=hotspots[0].source_label,
        synced_at=synced_at,
    )


def hotspot_mirror_status(db: Session) -> HotspotMirrorStatus:
    row = db.execute(
        text(
            """
            SELECT
                count(*) AS hotspot_count,
                max(snapshot_date) AS latest_snapshot_date,
                max(synced_at) AS last_synced_at,
                coalesce(max(source_label), 'iDengue hotspot context') AS source_label
            FROM hotspots
            """
        )
    ).mappings().one()

    return HotspotMirrorStatus(
        hotspot_count=int(row["hotspot_count"]),
        latest_snapshot_date=row["latest_snapshot_date"],
        last_synced_at=row["last_synced_at"],
        source_label=row["source_label"],
    )


def stored_hotspots(db: Session) -> list[PublicHotspot]:
    rows = db.execute(
        text(
            """
            SELECT
                id,
                locality,
                district,
                latitude,
                longitude,
                radius_meters,
                cumulative_cases,
                outbreak_duration_days,
                outbreak_start_date,
                week_number,
                year,
                snapshot_date,
                source_label
            FROM hotspots
            WHERE snapshot_date = (SELECT max(snapshot_date) FROM hotspots)
            ORDER BY outbreak_start_date, coalesce(cumulative_cases, 0) DESC, locality
            """
        )
    ).mappings().all()

    return [_hotspot_from_row(dict(row)) for row in rows]


def assess_hotspot_priority(db: Session, latitude: float, longitude: float) -> HotspotPriority:
    try:
        row = db.execute(
            text(
                """
                WITH report_point AS (
                    SELECT ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography AS geog
                )
                SELECT
                    h.id,
                    h.locality,
                    h.district,
                    h.latitude,
                    h.longitude,
                    h.radius_meters,
                    h.cumulative_cases,
                    h.outbreak_duration_days,
                    h.outbreak_start_date,
                    h.week_number,
                    h.year,
                    h.snapshot_date,
                    h.source_label,
                    ST_Distance(h.center_geog, report_point.geog) AS distance_meters,
                    ST_DWithin(h.center_geog, report_point.geog, :core_radius) AS within_core,
                    ST_DWithin(h.center_geog, report_point.geog, :warning_radius) AS within_warning
                FROM hotspots h
                CROSS JOIN report_point
                WHERE h.snapshot_date = (SELECT max(snapshot_date) FROM hotspots)
                ORDER BY ST_Distance(h.center_geog, report_point.geog)
                LIMIT 1
                """
            ),
            {
                "latitude": latitude,
                "longitude": longitude,
                "core_radius": HOTSPOT_CORE_RADIUS_METERS,
                "warning_radius": HOTSPOT_WARNING_RADIUS_METERS,
            },
        ).mappings().first()
    except Exception:
        db.rollback()
        return unavailable_hotspot_priority("Hotspot mirror is temporarily unavailable.")

    if row is None:
        return unavailable_hotspot_priority("Hotspot mirror has not been synced yet.")

    nearest = _hotspot_from_row(dict(row))
    return priority_from_nearest_hotspot(nearest, float(row["distance_meters"]))
