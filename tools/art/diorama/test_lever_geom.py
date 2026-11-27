# python3 -m pytest tools/art/diorama/test_lever_geom.py
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lever_geom as lg

ANGLES = [lg.throw(k / 20) for k in range(21)]


def test_throw_runs_left_to_right_through_upright():
    assert abs(lg.throw(0) + math.radians(lg.THROW_DEG)) < 1e-9
    assert abs(lg.throw(1) - math.radians(lg.THROW_DEG)) < 1e-9
    assert abs(lg.throw(0.5)) < 1e-9
    assert all(b > a for a, b in zip(ANGLES, ANGLES[1:]))
    assert lg.throw(-1) == lg.throw(0) and lg.throw(2) == lg.throw(1)
    # left really is left: the knob is on the -x side thrown left, +x thrown right
    assert lg.knob_centre(lg.throw(lg.STATES["left"]))[0] < -0.2
    assert lg.knob_centre(lg.throw(lg.STATES["right"]))[0] > 0.2


def test_everything_stays_inside_the_square_at_every_angle():
    for a in ANGLES:
        x0, x1, y0, y1, z0, z1 = lg.handle_box(a)
        assert -lg.HALF + 0.03 < x0 and x1 < lg.HALF - 0.03
        assert -lg.HALF < y0 and y1 < lg.HALF
    bx0, bx1, by0, by1, _, _ = lg.block_box()
    assert -lg.HALF < bx0 and bx1 < lg.HALF and -lg.HALF < by0 and by1 < lg.HALF - 0.05
    for p in lg.hole_outline():
        assert abs(p[0]) < lg.HALF - 0.05 and abs(p[1]) < lg.HALF - 0.05
    for c in lg.cracks():
        assert all(abs(x) < lg.HALF and abs(y) < lg.HALF for x, y in c["pts"])


def test_block_sits_in_the_back_half_centred():
    x0, x1, y0, y1, z0, z1 = lg.block_box()
    assert abs(x0 + x1) < 1e-9
    assert y0 > 0.08            # a figure at the centre stands in front of it
    assert z0 < 0 < z1          # sunk into the floor, never floating


def test_handle_runs_in_the_slot_and_the_knob_clears_the_block():
    for a in ANGLES:
        # through the slot's mouth with room to spare at every angle
        x, hw = lg.slot_span(a, lg.BLOCK_H)
        assert abs(x) + hw < lg.SLOT_L / 2 - 0.005
        assert lg.HANDLE_R < lg.SLOT_W / 2 - 0.01
        # the butt stays above the slot's floor
        bx, by, bz = lg.axis_point(-lg.BUTT, a)
        assert bz - lg.HANDLE_R * abs(math.sin(a)) > lg.SLOT_FLOOR
        # the ball is well clear of the block's top
        kx, ky, kz = lg.knob_centre(a)
        assert kz - lg.KNOB_R > lg.BLOCK_H + 0.2
    # the pivot pin is inside the block, above the slot's floor and under its mouth
    assert lg.SLOT_FLOOR < lg.PIVOT[2] - lg.PIN_R and lg.PIVOT[2] + lg.PIN_R < lg.BLOCK_H


def test_knob_reads_above_a_figures_head_on_screen_when_thrown():
    head = lg.screen_up(0, 0, lg.H)
    for t in (0.0, 1.0):
        kx, ky, kz = lg.knob_centre(lg.throw(t))
        assert lg.screen_up(kx, ky, kz + lg.KNOB_R) > head
        assert abs(kx) > 0.25   # out to the side, not straight over the figure


def test_chain_runs_from_the_block_into_the_floor():
    links = lg.chain_links()
    assert len(links) >= 7
    first, last = links[0], links[-1]
    # starts at the eye on the block's front face
    assert math.dist(first["c"], lg.ANCHOR) < lg.LINK_L
    # ends below the floor, inside the hole
    assert last["c"][2] < -lg.LINK_L / 2
    assert math.dist(last["c"][:2], lg.HOLE) < lg.HOLE_R
    # every link inside the square, never through the block, never under the floor before the hole
    bx0, bx1, by0, by1, _, _ = lg.block_box()
    for L in links:
        x, y, z = L["c"]
        assert abs(x) < lg.HALF - 0.03 and abs(y) < lg.HALF - 0.03
        assert not (bx0 < x < bx1 and by0 < y < by1)
        if math.dist((x, y), lg.HOLE) > lg.HOLE_R * 0.9:
            assert z > 0
    # each link a pitch from the last, turning a quarter about its length each time
    for a, b in zip(links, links[1:]):
        # (over the lip and down into the hole the step along the floor shortens)
        assert abs(math.dist(a["c"][:2], b["c"][:2]) - lg.PITCH) < 0.02 or math.dist(b["c"][:2], lg.HOLE) < lg.HOLE_R
        assert a["roll"] != b["roll"]


def test_chain_stays_clear_of_a_figure_at_the_centre():
    for L in lg.chain_links():
        assert math.hypot(*L["c"][:2]) > 0.15


def _trunk(x0, r):
    """A tree trunk standing at x0 on the square's back-right, radius r: a signed distance."""
    return lambda x, y, z: math.hypot(x - x0, y - lg.BLOCK_Y) - r


def test_open_square_keeps_the_full_throw():
    assert lg.throw_limits(lambda x, y, z: 9.0) == (lg.THROW_DEG, lg.THROW_DEG)
    assert lg.throw(1, (lg.THROW_DEG, lg.THROW_DEG)) == lg.throw(1)


def test_a_trunk_in_the_way_shortens_that_side_only_and_never_touches():
    dist = _trunk(0.62, 0.22)           # as the birch in the near-right corner (4,0): it reaches into the square
    assert lg.handle_gap(math.radians(lg.THROW_DEG), dist) < 0   # the full throw would go into it
    left, right = lg.throw_limits(dist)
    assert left == lg.THROW_DEG and lg.MIN_THROW_DEG <= right < lg.THROW_DEG
    for k in range(41):                 # clear at every point of the throw, not just at its ends
        assert lg.handle_gap(lg.throw(k / 40, (left, right)), dist) >= lg.CLEARANCE - 1e-9
    assert abs(lg.throw(1, (left, right)) - math.radians(right)) < 1e-9
    assert abs(lg.throw(0, (left, right)) + math.radians(left)) < 1e-9
    assert abs(lg.throw(0.5, (left, right))) < 1e-9


def test_knob_rust_is_lighter_than_the_chain_and_full_rust_is_unchanged():
    full = (0.46, 0.6)
    assert lg.rust_band(full, 1.0) == full  # the chain keeps its look
    lo, hi = lg.rust_band(full, lg.KNOB_RUST)
    assert lo > full[0] and hi > full[1] and abs((hi - lo) - (full[1] - full[0])) < 1e-12  # less rust, same softness
    assert 0 < lg.KNOB_RUST < 1
