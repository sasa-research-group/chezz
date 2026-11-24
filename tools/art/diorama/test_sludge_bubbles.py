"""Tests for sludge_bubbles.py: the loop is seamless, the timing follows the mudpot table, and no two bubbles act alike.
Run: python3 tools/art/diorama/test_sludge_bubbles.py"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sludge_bubbles as sb


def vents_for(n_squares, rng):
    out = []
    for k in range(n_squares):
        out.append((k * 1.0, 0.0, 0.12, True))
        out += [(k * 1.0 + rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0.06, False) for _ in range(2)]
    return out


def test_timing_matches_table():
    s, b, z = sb.stage_times(0.0)
    assert 0.1 <= s <= 0.4 and b < 0.15 and z <= 0.25, (s, b, z)
    s, b, z = sb.stage_times(1.0)
    assert 0.8 <= s <= 0.9 and 0.5 <= b <= 0.6 and 0.7 <= z <= 0.9, (s, b, z)
    for k in range(11):  # bigger is slower in every stage
        a_, c_ = sb.stage_times(k / 10), sb.stage_times(min(1, k / 10 + 0.1))
        assert all(x <= y for x, y in zip(a_, c_))


def test_every_event_fits_the_loop():
    rng = random.Random(1)
    ev = sb.schedule(vents_for(4, rng), 4, rng)
    assert all(e.length() < sb.LOOP for e in ev)


def test_rate_and_mix():
    rng = random.Random(2)
    ev = sb.schedule(vents_for(1, rng), 1, rng)
    assert 3 <= len(ev) <= 6, len(ev)
    ev = [e for s in range(40) for e in sb.schedule(vents_for(1, random.Random(s)), 1, random.Random(s + 100))]
    share = sum(e.bursts for e in ev) / len(ev)
    assert 0.65 < share < 0.92, share
    assert any(e.sz > 0.55 for e in ev) and any(e.sz < 0.3 for e in ev)
    assert len({round(e.ts, 4) for e in ev}) > len(ev) * 0.8   # not one timing for all


def test_loop_is_seamless():
    rng = random.Random(3)
    ev = sb.schedule(vents_for(2, rng), 2, rng)
    for e in ev:
        for t in (0.0, 0.37, 1.9, 3.99):
            for x, y in ((e.x, e.y), (e.x + 0.5 * e.r, e.y), (e.x, e.y + 1.4 * e.r)):
                assert abs(sb.event_height(e, x, y, t) - sb.event_height(e, x, y, t + sb.LOOP)) < 1e-12


def test_height_is_continuous_across_stages():
    rng = random.Random(4)
    for e in sb.schedule(vents_for(3, rng), 3, rng):
        for x, y in ((e.x, e.y), (e.x + 0.8 * e.r, e.y), (e.x, e.y + 1.5 * e.r)):
            prev = sb.event_height(e, x, y, e.t0)
            n = 400
            for i in range(1, n + 1):
                h = sb.event_height(e, x, y, e.t0 + e.length() * i / n)
                assert abs(h - prev) < 0.25 * e.dome * e.r, (e.sz, i, prev, h)
                prev = h
            assert abs(sb.event_height(e, x, y, e.t0 + e.length() - 1e-6)) < 0.02 * e.dome * e.r


def test_stages_in_order():
    rng = random.Random(5)
    e = next(e for e in sb.schedule(vents_for(2, rng), 2, rng) if e.bursts)
    seen = []
    for i in range(200):
        s = sb.stage_of(e, e.t0 + sb.LOOP * i / 200)
        if s and (not seen or seen[-1] != s):
            seen.append(s)
    assert seen == ["swell", "burst", "settle"], seen
    peak = sb.event_height(e, e.x, e.y, e.t0 + e.ts - 1e-6)
    assert peak > 0.4 * e.dome * e.r
    dip = min(sb.event_height(e, e.x, e.y, e.t0 + e.ts + e.tb * f) for f in (0.8, 0.9, 1.0, 1.1))
    assert dip < 0, "a burst leaves a crater"


def test_stays_local():
    rng = random.Random(6)
    for e in sb.schedule(vents_for(2, rng), 2, rng):
        for t in (e.t0 + e.ts * 0.9, e.t0 + e.ts + e.tb * 0.5):
            assert sb.event_height(e, e.x + 2.7 * e.r, e.y, t) == 0.0


def test_splatter():
    rng = random.Random(7)
    spots = [(i * 0.1, 0.0, 0.02) for i in range(50)]
    sp = sb.splatter(spots, rng, 12, 2)
    assert len(sp) == 24
    s = sp[0]
    assert sb.splatter_height(s, s[0], s[1], 0.3) > 0 and sb.splatter_height(s, s[0] + s[2], s[1], 0.3) == 0
    assert abs(sb.splatter_height(s, s[0], s[1], 1.0) - sb.splatter_height(s, s[0], s[1], 1.0 + sb.LOOP)) < 1e-12


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("SLUDGE BUBBLE TESTS OK")
