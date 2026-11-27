# python3 -m pytest tools/art/diorama/test_gate_geom.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gate_geom as gg


def test_arch_meets_the_posts_and_stays_under_a_figure_and_a_bit():
    assert abs(gg.intrados(gg.HALF) - gg.SPRING) < 1e-9
    assert abs(gg.intrados(-gg.HALF) - gg.SPRING) < 1e-9
    assert abs(gg.intrados(0) - (gg.SPRING + gg.RISE)) < 1e-9
    # round like the draft but not a tower: the crown stays under 1.2 figure heights
    assert gg.crown() < 1.2 * gg.H
    # and above the posts, so it reads as an arch over the doorway
    assert gg.crown() > gg.POST_TOP


def test_stones_cover_the_span_in_order():
    vs = gg.voussoirs()
    assert len(vs) == gg.STONES
    for a, b in zip(vs, vs[1:]):
        assert a["a1"] < b["a0"]          # a joint between each pair, no overlap
    zc, r = gg.arch_circle()
    xs = [gg.arch_point(v["a0"], r)[0] for v in vs[:1]] + [gg.arch_point(v["a1"], r)[0] for v in vs[-1:]]
    assert xs[0] < -0.48 and xs[1] > 0.48
    assert vs[gg.STONES // 2]["t"] > max(v["t"] for k, v in enumerate(vs) if k != gg.STONES // 2)  # the keystone


def test_leaves_fill_the_doorway_under_the_arch():
    for side in (-1, 1):
        pts = gg.leaf_outline(side)
        xs = [p[0] for p in pts]
        assert min(abs(x) for x in xs) < 0.01        # meets the middle
        assert max(abs(x) for x in xs) > 0.485       # reaches the hinge, a hair off the post
        assert all(x * side >= 0 for x in xs)        # stays on its own half
        for x, z in pts:
            assert z <= gg.intrados(x) + 1e-9        # never into the stones


def test_planks_tile_the_leaf_with_seams():
    for side in (-1, 1):
        ps = sorted(gg.planks(side))
        assert len(ps) == 3
        for (a0, a1), (b0, b1) in zip(ps, ps[1:]):
            assert 0 < b0 - a1 < 0.02  # a visible joint, still far narrower than a board
        assert all(x * side >= 0 for p in ps for x in p)


def test_vines_stay_on_their_leaf():
    for side in (-1, 1):
        for v in gg.vines(side):
            allp = list(v["pts"]) + [p for t in v["twigs"] for p in t["pts"]]
            for x, z in allp:
                assert x * side >= 0 and abs(x) <= gg.HALF
                assert 0 <= z < gg.intrados(x)
            assert v["radii"][0] > v["radii"][-1]   # thick at the root, thin at the tip


def test_open_swings_back_and_shut_is_flat():
    for side in (-1, 1):
        mid = (side * 0.01, gg.LEAF_Y)
        assert all(abs(a - b) < 1e-12 for a, b in zip(gg.swing(mid, 0.0, side), mid))
        x, y = gg.swing(mid, 1.0, side)
        assert y > 0.4                                  # toward the back, away from the camera
        # every corner of the leaf stays behind the arch's back face as it swings (it never cuts the stones)
        for f in [k / 10 for k in range(11)]:
            for p in ((side * 0.003, gg.LEAF_Y - gg.LEAF_T / 2), (side * 0.003, gg.LEAF_Y + gg.LEAF_T / 2)):
                assert gg.swing(p, f, side)[1] >= gg.ARCH_D / 2 - 1e-9
        assert abs(abs(x) - gg.HALF) < 0.05             # folded back along its post
        assert gg.leaf_angle(1.0, side) * side < 0


def test_swing_starts_heavy_knocks_the_posts_and_settles():
    n = gg.SWING_FRAMES
    vals = [gg.swing_open(k, n) for k in range(n)]
    assert vals[0] == 0 and abs(vals[-1] - 1) < 1e-9
    land = gg.SWING_LAND
    assert abs(vals[land] - 1) < 1e-9
    steps = [b - a for a, b in zip(vals, vals[1:])]
    # opening never backs up before the knock, and starts slow (the reference's heavy start)
    assert all(s > 0 for s in steps[:land])
    assert steps[0] < steps[land - 1] / 4
    # it lands with speed, rebounds a little (never past open, so the leaves never cut the posts), then settles
    assert steps[land - 1] > 1 / land
    assert all(v <= 1 + 1e-9 for v in vals) and 0.9 < min(vals[land:]) < 0.99
    assert all(s >= 0 for s in steps[land + 1:])


def test_leaf_angle_lets_an_overshoot_through_only_when_asked():
    assert gg.leaf_angle(1.1, 1) == gg.leaf_angle(1.0, 1)
    assert abs(gg.leaf_angle(1.1, 1, clamp=False)) > abs(gg.leaf_angle(1.0, 1))


def test_bake_runner_and_packer_name_the_gate_layers():
    here = os.path.dirname(os.path.abspath(__file__))
    run = open(os.path.join(here, "rungatebake.sh")).read()
    assert "build_gate_cycles.py" in run and "--bake --posts" in run and "GATE BAKE OK" in run
    pack = open(os.path.join(here, "pack_gate.py")).read()
    assert '("swing", "front")' in pack and "figure=gate" in pack
    src = open(os.path.join(here, "build_gate_cycles.py")).read()
    for f in ("swing0_%s.png", "front0_%s.png", "swing.json", "front.json", "GATE BAKE OK"):
        assert f in src
