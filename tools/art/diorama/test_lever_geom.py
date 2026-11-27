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
    # as the game draws it (SIZE about the centre): the knob leans out past the plate, never off the square
    for a in ANGLES:
        x0, x1, y0, y1, z0, z1 = (v * lg.SIZE for v in lg.handle_box(a))
        assert -lg.HALF + 0.03 < x0 and x1 < lg.HALF - 0.03
        assert -lg.HALF < y0 and y1 < lg.HALF
    px0, px1, py0, py1, _, _ = lg.plate_box()
    assert -lg.HALF < px0 and px1 < lg.HALF and -lg.HALF < py0 and py1 < lg.HALF


def test_no_base_the_handle_comes_out_of_the_floor_at_the_centre():
    # Wesley 2026-11-27: no block; the plate lies flat in the floor, centred, and nothing else stands on the square
    x0, x1, y0, y1, z0, z1 = lg.plate_box()
    assert abs(x0 + x1) < 1e-9 and abs(y0 + y1) < 1e-9
    assert z0 < 0 < z1 < 0.03
    assert lg.PIVOT[0] == 0 and lg.PIVOT[1] == 0 and lg.PIVOT[2] < 0
    assert not hasattr(lg, "block_box") and not hasattr(lg, "chain_links")


def test_handle_runs_in_the_slot_and_stops_at_its_ends():
    s0, s1, w0, w1, d0, d1 = lg.slot_box()
    for a in ANGLES:
        # through the slot's mouth with room to spare at every angle
        x, hw = lg.slot_span(a, lg.PLATE_T)
        assert abs(x) + hw < lg.SLOT_L / 2
        assert lg.HANDLE_R < lg.SLOT_W / 2 - 0.005
        # the butt stays above the slot's floor
        bx, by, bz = lg.axis_point(-lg.BUTT, a)
        assert bz - lg.HANDLE_R > d0
    # at the full throw the handle comes up against the slot's end (the stop the throw's timing hits)
    x, hw = lg.slot_span(math.radians(lg.THROW_DEG), lg.PLATE_T)
    assert lg.SLOT_L / 2 - (x + hw) < 0.03
    # the pin is under the floor, its ends in the slot's walls, and the slot inside the plate
    assert lg.PIVOT[2] + lg.PIN_R < 0 and lg.PIVOT[2] - lg.PIN_R > d0
    assert lg.SLOT_L < lg.PLATE_L - 0.06 and lg.SLOT_W < lg.PLATE_W - 0.06
    # every rivet sits whole on the rim, off the slot's mouth and inside the plate's edge
    for rx, ry in lg.RIVETS:
        on_slot = abs(rx) < lg.SLOT_L / 2 + lg.RIVET_R and abs(ry) < lg.SLOT_W / 2 + lg.RIVET_R
        assert not on_slot, (rx, ry)
        assert abs(rx) + lg.RIVET_R < lg.PLATE_L / 2 and abs(ry) + lg.RIVET_R < lg.PLATE_W / 2, (rx, ry)
    for rx, ry in lg.RIVETS:
        assert abs(rx) + lg.RIVET_R < lg.PLATE_L / 2 and abs(ry) + lg.RIVET_R < lg.PLATE_W / 2
        assert abs(rx) > lg.SLOT_L / 2 + lg.RIVET_R or abs(ry) > lg.SLOT_W / 2 + lg.RIVET_R


def test_knob_at_rest_is_at_a_pullers_shoulder_and_out_to_the_side():
    # the king's shoulders are 0.71 stage units up (guard_pose POS), a square is 2.04: a hand reaches it level
    shoulder = 0.71 / 2.04
    for t in (0.0, 1.0):
        kx, ky, kz = (v * lg.SIZE for v in lg.knob_centre(lg.throw(t)))
        assert abs(kz - shoulder) < 0.08
        assert abs(kx) > 0.25   # leaning out over the plate, toward the far side of the square


def _trunk(x0, r):
    """A tree trunk standing at x0 on the square's back-right, radius r: a signed distance."""
    return lambda x, y, z: math.hypot(x - x0, y - lg.PIVOT[1]) - r


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


def test_knob_rust_is_lighter_than_full_rust():
    full = (0.46, 0.6)
    assert lg.rust_band(full, 1.0) == full
    lo, hi = lg.rust_band(full, lg.KNOB_RUST)
    assert lo > full[0] and hi > full[1] and abs((hi - lo) - (full[1] - full[0])) < 1e-12  # less rust, same softness
    assert 0 < lg.KNOB_RUST < 1


def test_throw_unsticks_gathers_speed_stops_hard_and_settles():
    ts = [lg.throw_t(k) for k in range(lg.THROW_FRAMES)]
    assert ts[0] == 0 and ts[-1] == 1 and ts[lg.THROW_STOP] == 1
    assert min(ts) >= 0 and max(ts[:4]) < 0.02                      # never past the slot's end; a slow start
    travel = ts[3:lg.THROW_STOP + 1]
    steps = [b - a for a, b in zip(travel, travel[1:])]
    assert all(s > 0 for s in steps) and steps[-1] > 2 * steps[0]   # speeds up into the stop
    assert all(0.9 < t <= 1 for t in ts[lg.THROW_STOP + 1:])         # rebound off the stop, then rest


def test_throw_left_mirrors_throw_right():
    for k in range(lg.THROW_FRAMES):
        assert abs(lg.throw_frame(k, True) + lg.throw_frame(k, False) - 1) < 1e-12
    assert lg.throw_frame(0, False) == 1 and lg.throw_frame(lg.THROW_FRAMES - 1, False) == 0


def test_sheet_throws_right_then_left_and_each_ends_where_the_other_starts():
    ts = lg.sheet_t()
    n = lg.THROW_FRAMES
    assert len(ts) == 2 * n
    assert ts[0] == 0.0 and ts[n - 1] == 1.0          # right: from resting left to resting right
    assert ts[n] == 1.0 and ts[2 * n - 1] == 0.0      # left: back again
    assert ts[n:] == [1 - t for t in ts[:n]]
