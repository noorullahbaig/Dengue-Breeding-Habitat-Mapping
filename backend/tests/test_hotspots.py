from datetime import datetime, timezone

from app.hotspots import PublicHotspot, priority_from_nearest_hotspot, unavailable_hotspot_priority


def test_assesses_core_hotspot_priority_from_nearest_row():
    snapshot = datetime(2026, 4, 20, tzinfo=timezone.utc)
    hotspot = PublicHotspot(
        id="hotspot-1",
        locality="Demo Locality",
        district="Wilayah Persekutuan",
        latitude=3.139,
        longitude=101.6869,
        radius_meters=200,
        cumulative_cases=8,
        outbreak_duration_days=12,
        outbreak_start_date=snapshot,
        week_number=17,
        year=2026,
        snapshot_date=snapshot,
    )

    priority = priority_from_nearest_hotspot(hotspot, 1.8)

    assert priority.priority_level == "core"
    assert priority.nearest_hotspot_id == "hotspot-1"
    assert priority.nearest_hotspot_locality == "Demo Locality"
    assert priority.nearest_hotspot_distance_meters == 1.8


def test_builds_unavailable_hotspot_priority():
    priority = unavailable_hotspot_priority("Hotspot mirror has not been synced yet.")

    assert priority.priority_level == "unavailable"
    assert priority.nearest_hotspot_id is None
    assert priority.priority_reason == "Hotspot mirror has not been synced yet."
