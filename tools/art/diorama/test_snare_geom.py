# The snare's roots (snare_geom.py): set, they ring the square and leave its middle clear; sprung, they rise and close
# round where a figure's ankles are; they never leave their square; the spring snaps, overshoots and settles.
#   python3 tools/art/diorama/test_snare_geom.py   (or pytest)
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import snare_geom as g

S = 2.04   # one square (1.2 x the king's 1.7)
H = 1.7


def rho(p):
    return math.hypot(p[0], p[1])


def test_set_rings_the_square_and_leaves_the_middle_clear():
    rs = g.roots(S, 0.0)
    assert len(rs) == 12
    for r in rs:
        assert rho(r["pts"][0]) > 0.35 * S        # comes up near the edge
        assert r["pts"][0][2] < 0                 # out of the stone, not standing on it
        assert min(rho(p) for p in r["pts"]) > 0.15 * S  # a piece can step in
    top = max(p[2] for r in rs for p in r["pts"])
    assert 0.15 * H < top < 0.35 * H              # reads from the high camera, under a figure's knee


def test_sprung_closes_round_the_ankles():
    rs = g.roots(S, 1.0)
    tips = [r["pts"][-1] for r in rs]
    assert max(rho(p) for p in tips) < 0.15 * S   # every tip has reached the feet (a figure stands ~0.3 S wide)
    assert all(0.1 * H < p[2] < 0.4 * H for p in tips)  # at ankle height, not back on the floor
    set_tips = [r["pts"][-1] for r in g.roots(S, 0.0)]
    assert sum(rho(p) for p in tips) < 0.5 * sum(rho(p) for p in set_tips)


def test_roots_wind_the_same_way_when_sprung():
    for r in g.roots(S, 1.0):
        a0 = math.atan2(r["pts"][0][1], r["pts"][0][0])
        a1 = math.atan2(r["pts"][-1][1], r["pts"][-1][0])
        assert (a1 - a0 + math.pi) % (2 * math.pi) - math.pi > 0.2


def test_never_leaves_its_square():
    for t in (-0.06, 0.0, 0.5, 1.0, 1.12):
        for r in g.roots(S, t):
            for p, rad in [*zip(r["pts"], r["radii"])] + [q for sh in r["shoots"] for q in zip(sh["pts"], sh["radii"])]:
                assert abs(p[0]) + rad <= g.RING_LEFT * S + 1e-9 and abs(p[1]) + rad <= g.RING_LEFT * S + 1e-9
            for th in r["thorns"]:
                end = [th["at"][j] + th["dir"][j] * th["len"] for j in range(3)]
                assert abs(end[0]) < g.RING_LEFT * S and abs(end[1]) < g.RING_LEFT * S


def test_roots_taper_and_carry_thorns():
    for r in g.roots(S, 0.0):
        assert r["radii"][0] > 3 * r["radii"][-1]
        assert len(r["thorns"]) >= 4
        for th in r["thorns"]:
            assert abs(math.sqrt(sum(c * c for c in th["dir"])) - 1) < 1e-6


def test_roots_are_chunky_clay():
    """Thick as sculpted clay, not twigs (judges, round 1: 0.05 S roots read spindly from the game camera)."""
    rs = g.roots(S, 0.0)
    assert sum(r["radii"][0] for r in rs) / len(rs) > 0.06 * S
    for r in rs:
        for th in r["thorns"]:
            assert th["len"] < 2.6 * th["r"] * 2  # stubby, wide-based thorns, not needles


def test_same_root_at_every_grip():
    """Each root keeps its place and size through the spring, so the frames line up."""
    a, b = g.roots(S, 0.0), g.roots(S, 1.0)
    for ra, rb in zip(a, b):
        assert ra["alpha"] == rb["alpha"]
        assert ra["pts"][0] == rb["pts"][0]
        assert abs(ra["radii"][0] - rb["radii"][0]) < 0.25 * ra["radii"][0]


def test_rim_and_cracks_stay_on_the_square():
    lim = g.RING_LEFT * S + 1e-9
    for r in g.rim(S):
        assert len(r["pts"]) == len(r["radii"])
        for p, rad in zip(r["pts"], r["radii"]):
            assert abs(p[0]) + rad <= lim and abs(p[1]) + rad <= lim
            assert p[2] < 0.05 * S  # lies low, half sunk
    cs = g.cracks(S)
    assert len(cs) >= 10
    for c in cs:
        for x, y in c["pts"]:
            assert abs(x) <= lim and abs(y) <= lim
        assert c["w"][0] >= c["w"][-1]  # thins toward its end


def test_rim_goes_all_the_way_round():
    """Seen from the middle, the tangle covers every direction, so the ring never shows a gap."""
    angs = sorted(math.atan2(p[1], p[0]) for r in g.rim(S) for p in r["pts"])
    gaps = [b - a for a, b in zip(angs, angs[1:])] + [angs[0] + 2 * math.pi - angs[-1]]
    assert max(gaps) < 0.5


def test_grip_snaps_overshoots_settles():
    f = [g.grip(k, 20) for k in range(20)]
    assert f[0] == 0 and abs(f[-1] - 1) < 1e-9
    assert min(f[:3]) < -0.03                     # draws back first (the flytrap's slow start)
    assert max(f) > 1.05 and f.index(max(f)) <= 8  # snaps by ~0.3 s at 24 fps
    assert f[3] < 0.5 < f[6]                       # the snap itself takes about 4 frames
    assert all(abs(v - 1) < 0.01 for v in f[-5:])


def test_roots_go_off_a_frame_or_two_apart():
    first = [next(k for k, t in enumerate(ts) if t > 0.5) for ts in zip(*[g.root_grips(k, 20) for k in range(20)])]
    assert first[0] == min(first) and 1 <= max(first) - min(first) <= 2
    assert g.root_grips(19, 20) == [1.0] * 12 and g.root_grips(0, 20) == [0.0] * 12
    a = g.roots(S, g.root_grips(5, 20))
    assert len(a) == 12 and a[0]["pts"][0] == g.roots(S, 0.0)[0]["pts"][0]


def test_sprung_roots_wrap_in_front_of_and_behind_the_ankles():
    fwd = (0.0, 0.94, -0.34)  # the play camera looks up the board (+y) and down
    for t in (1.0, 1.12):
        near = [p for r in g.roots(S, t) for p in r["pts"] if rho(p) < 0.2 * S]
        front = [p for p in near if g.in_front(p, fwd)]
        assert 0.25 < len(front) / len(near) < 0.75  # they close round the legs, not in a wall before them
    assert g.in_front((0, -0.1 * S, 0.3 * S), fwd) and not g.in_front((0, 0.05 * S, 0.3 * S), fwd)  # height never counts
    assert g.in_front((0, -0.1, 0), (0, 2.0, -5.0)) == g.in_front((0, -0.1, 0), (0, 1.0, 0))


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
