from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import TypeAlias

from fastapi import HTTPException, status


SERVICE_AREA_ERROR = "Reports can only be submitted within Kuala Lumpur."
Coordinate: TypeAlias = tuple[float, float]
Ring: TypeAlias = list[Coordinate]
Polygon: TypeAlias = list[Ring]


def _boundary_path() -> Path:
    return Path(__file__).resolve().parents[2] / "src" / "data" / "kuala-lumpur-boundary.geojson"


@lru_cache(maxsize=1)
def _load_polygons() -> list[Polygon]:
    payload = json.loads(_boundary_path().read_text(encoding="utf-8"))
    features = payload.get("features", [])
    polygons: list[Polygon] = []

    for feature in features:
        geometry = feature.get("geometry", {})
        geometry_type = geometry.get("type")
        coordinates = geometry.get("coordinates", [])

        if geometry_type == "Polygon":
            polygons.append(_to_polygon(coordinates))
        elif geometry_type == "MultiPolygon":
            polygons.extend(_to_polygon(polygon) for polygon in coordinates)

    if not polygons:
        raise RuntimeError("Kuala Lumpur service-area boundary could not be loaded.")

    return polygons


def _to_polygon(coordinates: list) -> Polygon:
    return [
        [(float(longitude), float(latitude)) for longitude, latitude in ring]
        for ring in coordinates
    ]


def _point_on_segment(
    longitude: float,
    latitude: float,
    start: Coordinate,
    end: Coordinate,
) -> bool:
    start_longitude, start_latitude = start
    end_longitude, end_latitude = end
    cross_product = (latitude - start_latitude) * (end_longitude - start_longitude) - (
        longitude - start_longitude
    ) * (end_latitude - start_latitude)

    if abs(cross_product) > 1e-10:
        return False

    return (
        min(start_longitude, end_longitude) - 1e-10
        <= longitude
        <= max(start_longitude, end_longitude) + 1e-10
        and min(start_latitude, end_latitude) - 1e-10
        <= latitude
        <= max(start_latitude, end_latitude) + 1e-10
    )


def _point_in_ring(longitude: float, latitude: float, ring: Ring) -> bool:
    inside = False
    previous = ring[-1]

    for current in ring:
        if _point_on_segment(longitude, latitude, previous, current):
            return True

        current_longitude, current_latitude = current
        previous_longitude, previous_latitude = previous
        crosses_latitude = (current_latitude > latitude) != (previous_latitude > latitude)

        if crosses_latitude:
            intersection_longitude = (
                (previous_longitude - current_longitude)
                * (latitude - current_latitude)
                / (previous_latitude - current_latitude)
                + current_longitude
            )
            if longitude < intersection_longitude:
                inside = not inside

        previous = current

    return inside


def _point_in_polygon(longitude: float, latitude: float, polygon: Polygon) -> bool:
    if not polygon or not _point_in_ring(longitude, latitude, polygon[0]):
        return False

    return not any(_point_in_ring(longitude, latitude, hole) for hole in polygon[1:])


def is_within_service_area(latitude: float, longitude: float) -> bool:
    return any(
        _point_in_polygon(longitude, latitude, polygon)
        for polygon in _load_polygons()
    )


def ensure_within_service_area(latitude: float, longitude: float) -> None:
    if not is_within_service_area(latitude, longitude):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=SERVICE_AREA_ERROR,
        )
