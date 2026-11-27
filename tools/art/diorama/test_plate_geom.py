# python3 -m pytest tools/art/diorama/test_plate_geom.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import plate_geom as pg


def test_disc_sits_inside_the_square_with_room_for_the_ring():
    assert 0.62 <= 2 * pg.DISC_R <= 0.70                   # about two thirds of a square across
    assert pg.R_OUT == pg.DISC_R + pg.GAP + pg.RING_W
    assert 0.07 <= pg.RING_W <= 0.09
    assert pg.R_OUT < 0.5
    assert 0.5 - pg.R_OUT > 0.05                           # a margin of slab round the ring


def test_gap_is_thin_and_positive():
    assert 0.01 <= pg.GAP <= 0.02
    assert abs(pg.R_IN - pg.DISC_R - pg.GAP) < 1e-12


def test_down_is_lower_than_up_but_not_under_the_ring():
    assert pg.disc_z(1) < pg.disc_z(0)
    assert pg.disc_z(0) > pg.RING_H + 0.02                 # up: clearly over the ring
    assert pg.disc_z(1) >= pg.RING_H - 0.005               # down: about flush with it, never sunk below
    assert pg.disc_z(1) <= pg.RING_H + 0.01
    assert abs((pg.disc_z(0) - pg.disc_z(1)) - pg.SINK) < 1e-9
    ts = [k / 20 for k in range(21)]
    zs = [pg.disc_z(t) for t in ts]
    assert all(b <= a + 1e-12 for a, b in zip(zs, zs[1:]))
    assert pg.disc_z(-3) == pg.disc_z(0) and pg.disc_z(7) == pg.disc_z(1)
    assert pg.STATES == {"up": 0, "down": 1}


def test_the_disc_never_touches_the_ring_and_has_somewhere_to_sink():
    assert pg.DISC_T > pg.SINK + pg.RISE
    assert pg.WELL_DEPTH > pg.DISC_T - pg.disc_z(1)         # the sunk disc's underside stays above the well floor


def test_rays_stay_inside_the_disc_clear_of_the_rim():
    for poly in pg.sun_rays():
        assert len(poly) > 10
        for x, y in poly:
            r = math.hypot(x, y)
            assert pg.BOSS_R < r < pg.DISC_R - pg.RIM_W
    assert len(pg.sun_rays(12)) == 12 and len(pg.sun_rays(14)) == 14


def test_rays_are_distinct_and_the_count_is_in_range():
    assert 12 <= pg.RAYS <= 16
    polys = pg.sun_rays()
    # neighbours do not overlap: their angular spans at the foot are apart
    for k in range(pg.RAYS):
        _, _, _, hw0 = pg.ray_info(k)
        _, _, _, hw1 = pg.ray_info((k + 1) % pg.RAYS)
        assert hw0 + hw1 < 2 * math.pi * pg.RAY_R0 / pg.RAYS - 0.005
    assert max(math.hypot(*p) for p in polys[0]) > max(math.hypot(*p) for p in polys[1])   # long, then short


def test_relief_is_raised_on_the_sun_and_level_between():
    assert pg.relief(0.0, 0.0) > 0.012                       # the boss
    assert pg.relief(0.2, 0.0) > 0.005                       # on a ray (ray 0 points along +x)
    between = pg.relief(0.2, 2 * math.pi / pg.RAYS * 0.5 + 0.0)
    assert between < 0.003                                   # between two rays the flat shows
    assert pg.relief(pg.DISC_R - 0.02, 1.0) > 0.005          # the rim
    assert pg.relief(pg.SCRIBE_R, 0.1) < -0.002              # the scribed circle is cut into the flat
    hs = [pg.relief(r / 400, th / 50) for r in range(0, 133) for th in range(0, 315, 7)]
    assert max(hs) < 0.02 and min(hs) >= -pg.EDGE_DROP - 1e-9   # shallow: never a tall plug
