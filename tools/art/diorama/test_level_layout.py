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


if __name__ == "__main__":
    test_matches_the_game(); test_order_does_not_matter(); test_plan_counts_trapdoors_from_the_back(); print("ok")
