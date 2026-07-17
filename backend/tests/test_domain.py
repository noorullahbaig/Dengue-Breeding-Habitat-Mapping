from app.domain import pick_neighborhood



def test_picks_nearest_known_neighborhood():
    assert pick_neighborhood(3.2147, 101.628) == "Kepong"
