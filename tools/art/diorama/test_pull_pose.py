"""Checks on the king's lever-pull keys that need no Blender (the solve's reach and clip numbers come from
guard_pose; these guard the setup they rest on). Run: uv run --no-project --with pytest python -m pytest test_pull_pose.py"""
import math
import os

os.environ.setdefault("PULL_SIDE", "far")
import lever_geom as lg  # noqa: E402
import pull_pose as p  # noqa: E402


def test_knob_line_is_the_slot_centre():
    # no base: the handle rises from the middle of the square, so the knob's line is the square's centre line
    assert abs(p.KNOB_X) < 1e-9
    assert abs(p.lever_world(p.lever_ang(0))[0] - p.KNOB_X) < 1e-9


def test_puller_stands_behind_the_lever_by_default():
    # Wesley 2026-11-27: from the game camera he hid the lever, so he pulls from the far side
    assert p.FAR


def test_keys_are_in_order_and_inside_the_clip():
    for v, V in p.VARIANTS.items():
        ts = [t for t, _, _ in V["KEYS"]]
        assert ts == sorted(ts) and len(set(ts)) == len(ts), v
        for side, t0, t1 in V["STEPS"]:
            assert 0 <= t0 < t1 <= ts[-1], (v, side, t0, t1)


def test_one_hand_turns_side_on_before_the_lever_gives():
    # the strain keeps his feet still, so the turn and the step out must be under way by the grip
    g = p.VARIANTS["one"]["GRIP"]
    k = p.knobs_at("one", g)
    assert abs(k["spin"]) >= 20
    assert abs(k["aside"]) > abs(p.knobs_at("one", 0)["aside"])
    landed = [t1 for _, t0, t1 in p.VARIANTS["one"]["STEPS"] if t1 <= g]
    assert len(landed) == 2  # both feet stepped while he reached


def test_feet_follow_the_body_into_the_grip():
    # each step lands the foot where the body's pose at that moment puts it (no leftover offset twisting the legs)
    for v, V in p.VARIANTS.items():
        for side, t0, t1 in V["STEPS"]:
            dx, dy, dz = p.feet(v, t1)[side]
            assert math.hypot(dx, dy) < 1e-6 and dz == 0, (v, side, t1)


def test_grips_are_on_the_handle_below_the_knob():
    for v, V in p.VARIANTS.items():
        for side, s in V["HANDS"].items():
            assert 0.5 * lg.HANDLE_LEN < s < lg.HANDLE_LEN, (v, side)


def test_every_held_frame_sends_a_hand_target():
    v = "one"
    g = p.VARIANTS[v]["GRIP"]
    for f in range(g, g + p.STRAIN + 16):
        kn = p.frame_knobs(v, f)
        assert ("rtx" in kn) or ("ltx" in kn), f


def test_lever_square_has_no_block_left_to_hit():
    # the "block" the solve measures is the flat plate: only a foot can touch it
    x0, x1, y0, y1, z0, z1 = lg.plate_box()
    assert z1 * lg.SIZE * p.S < 0.05   # under his ankle


def test_only_the_one_hand_pull_is_left():
    # Wesley 2026-11-27: the heave (sword planted, both hands) is dropped; no pose kept it clear of the slot's handle
    assert set(p.VARIANTS) == {"one"}
    assert list(p.VARIANTS["one"]["HANDS"]) == ["Left"]   # behind the lever the left hand pulls
