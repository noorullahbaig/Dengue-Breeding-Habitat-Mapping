from __future__ import annotations

import random
import string
from math import atan2, cos, radians, sin, sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Report


ADVISORY_TEXT = (
    "Advisory only. Officers still review the image, location, and hotspot context "
    "before any action is recorded."
)
PUBLIC_CONSENT_VERSION = "public-image-pin-ai-v2"
PUBLIC_CONSENT_TEXT = (
    "I confirm this image, exact pin, computer-vision advisory result, confidence, "
    "and detection evidence can be shown publicly on the prototype map as crowdsourced "
    "dengue habitat evidence. Optional notes remain for officer review."
)
SAME_SITE_RADIUS_METERS = 30
MAX_DETECTED_ACCURACY_METERS = 250
MIN_ALLOWED_CORRECTION_RADIUS_METERS = 75
EARTH_RADIUS_METERS = 6_371_000


def coarsen_location(latitude: float, longitude: float) -> tuple[float, float]:
    return round(latitude * 200) / 200, round(longitude * 200) / 200


def distance_meters(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    delta_latitude = radians(latitude_b - latitude_a)
    delta_longitude = radians(longitude_b - longitude_a)
    start_latitude = radians(latitude_a)
    end_latitude = radians(latitude_b)

    haversine = (
        sin(delta_latitude / 2) ** 2
        + cos(start_latitude) * cos(end_latitude) * sin(delta_longitude / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * atan2(sqrt(haversine), sqrt(1 - haversine))


def allowed_correction_radius_meters(accuracy_meters: float) -> float:
    return min(max(accuracy_meters, MIN_ALLOWED_CORRECTION_RADIUS_METERS), MAX_DETECTED_ACCURACY_METERS)


def is_active_report(status: str) -> bool:
    return status != "closed"


def pick_neighborhood(latitude: float, longitude: float) -> str:
    candidates = [
        ("Bukit Jalil", 3.0589, 101.6846),
        ("Cheras", 3.0928, 101.7436),
        ("Kepong", 3.2146, 101.6278),
        ("Sentul", 3.1745, 101.6953),
        ("Wangsa Maju", 3.2052, 101.7329),
    ]

    return min(
        candidates,
        key=lambda candidate: abs(latitude - candidate[1]) + abs(longitude - candidate[2]),
    )[0]


def build_reference(db: Session) -> str:
    for _ in range(20):
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        numeric = "".join(random.choices(string.digits, k=4))
        reference = f"KL-{suffix}-{numeric}"
        existing = db.scalar(select(Report.id).where(Report.reference == reference))
        if existing is None:
            return reference

    raise RuntimeError("Could not create a unique report reference.")


def status_message_for(status: str) -> str:
    messages = {
        "submitted": "Received and awaiting officer review.",
        "under_review": "Queued for officer review with map context.",
        "prioritized": "Flagged for faster follow-up because the area aligns with active hotspot context.",
        "action_recorded": "An officer logged follow-up activity for this report.",
        "closed": "The report lifecycle has been completed for this prototype.",
    }
    return messages.get(status, messages["submitted"])
