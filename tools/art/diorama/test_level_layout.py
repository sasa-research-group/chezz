import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_layout import layout_key, layout_of_puzzle

# the same puzzle as tests/levelBake.test.ts's PINNED: both must give PINNED_KEY
PINNED = {"width": 5, "height": 12, "holes": [{"x": 0, "y": 0}], "walls": [{"x": 2, "y": 3}],
          "trapdoors": [{"x": 3, "y": 8}, {"x": 1, "y": 5}],
          "switches": [{"x": 4, "y": 4, "kind": "lever", "effect": {"type": "trapdoors"}}], "pieces": []}
PINNED_KEY = open(os.path.join(os.path.dirname(__file__), "..", "..", "..", "tests", "level-key.txt")).read().strip()


def test_matches_the_game():
    assert layout_key(layout_of_puzzle(PINNED)) == PINNED_KEY


def test_order_does_not_matter():
    a = dict(PINNED, trapdoors=list(reversed(PINNED["trapdoors"])))
    assert layout_key(layout_of_puzzle(a)) == PINNED_KEY


def test_plan_counts_trapdoors_from_the_back():
    from bake_level import plan
    p = plan(PINNED)
    assert p["key"] == PINNED_KEY and (p["w"], p["h"]) == (5, 12)
    assert p["trapdoors"] == [(1, 5), (3, 8)]  # board squares, sorted by y
    assert p["squares"] == [(1, 6), (3, 3)]    # builder squares: j = h-1-y, as trapdoor.ts


def test_one_view_has_no_stops():
    from level_layout import stops
    assert stops(5, 5) == [] and stops(8, 6) == [] and stops(3, 2) == []


def test_stops_reach_both_ends_and_overlap():
    from level_layout import STEP, WINDOW, stop_axis, stops
    assert stops(5, 12) == [(0.0, -3.0), (0.0, 0.0), (0.0, 3.0)]  # 6 deep windows: the front, middle and back
    for n, m in ((12, 6), (24, 6), (24, 8), (9, 8), (7, 6)):
        a = stop_axis(n, m)
        assert a[0] == -(n - m) / 2 and a[-1] == (n - m) / 2          # first and last windows touch the ends
        assert all(0 < b - c <= STEP for c, b in zip(a, a[1:]))        # neighbours at most STEP apart
    s = stops(24, 24)
    assert len(s) == 7 * 7 and s[0] == (-8.0, -9.0)                    # front left first, rows of x


def test_a_stop_sees_its_window():
    from level_layout import sees
    # 5 x 12, the front stop's window is stage rows 0-5 (centred 3 rows in front of the middle)
    assert sees((0, -3), (2, 0), 5, 12) and sees((0, -3), (2, 5), 5, 12) and sees((0, -3), (4, 3), 5, 12)
    assert not sees((0, -3), (2, 6), 5, 12)
    assert sees((0, 0), (2, 3), 5, 12) and sees((0, 0), (2, 8), 5, 12) and not sees((0, 0), (2, 9), 5, 12)


def test_plan_lists_stops_and_who_sees_each_door():
    from bake_level import plan
    p = plan(PINNED)  # 5 x 12: stops at rows -3, 0, +3; doors at stage rows 6 and 3
    assert p["stops"] == [(0.0, -3.0), (0.0, 0.0), (0.0, 3.0)]
    assert p["trapStops"] == [[1, 2], [0, 1]]  # in trapdoors order: (1,5) is stage row 6, (3,8) row 3
    small = plan(dict(PINNED, height=5, holes=[], walls=[], trapdoors=[{"x": 3, "y": 1}], switches=[]))
    assert small["stops"] == [] and small["trapStops"] == []


if __name__ == "__main__":
    for f in [v for k, v in dict(globals()).items() if k.startswith("test_")]:
        f()
    print("ok")
