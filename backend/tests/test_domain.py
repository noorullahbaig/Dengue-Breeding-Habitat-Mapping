from app.domain import coarsen_location, pick_neighborhood


def test_coarsens_location_for_public_map():
    assert coarsen_location(3.11121, 101.65218) == (3.11, 101.65)


def test_picks_nearest_known_neighborhood():
    assert pick_neighborhood(3.2147, 101.628) == "Kepong"
