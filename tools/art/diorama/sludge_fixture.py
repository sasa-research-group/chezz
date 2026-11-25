"""Reference numbers for tests/sludge-bubbles.test.ts: a seeded schedule from sludge_bubbles.py and its heights, tears
and blobs at sample points and times, so the browser port must give the same answers.

    python3 tools/art/diorama/sludge_fixture.py > tests/fixtures/sludge-bubbles.json"""
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sludge_bubbles as sb

rng = random.Random(7)
S = 2.04
vents = [(0.0, 0.0, 0.13 * S, True), (0.3 * S, 0.1 * S, 0.065 * S, False), (-0.25 * S, -0.2 * S, 0.065 * S, False)]
events = sb.schedule(vents, 1, rng, dome=1.2, loop=8.0, thick=1.7)
splat = sb.splatter([(rng.uniform(-0.4, 0.4) * S, rng.uniform(-0.4, 0.4) * S, 0.02 * S) for _ in range(40)], rng, 10, 1)


def ev(e):
    d = {k: getattr(e, k) for k in ("x", "y", "r", "t0", "sz", "bursts", "ts", "tb", "tz", "ang", "stretch",
                                    "h1", "h2", "s1", "s2", "dome")}
    d["drops"] = [{k: getattr(q, k) for k in ("x0", "y0", "x1", "y1", "r", "apex", "t0", "tf")} for q in e.drops]
    return d


samples = []
for e in events[:6]:
    for k in range(5):
        t = e.t0 + (e.length() + 0.3) * k / 4
        for dx, dy in ((0, 0), (0.5, 0.2), (1.1, -0.4), (-1.8, 0.9)):
            x, y = e.x + dx * e.r, e.y + dy * e.r
            samples.append({"x": x, "y": y, "t": t,
                            "h": sb.surface_height(0.0, events, splat, x, y, t, 8.0),
                            "tear": sb.tear_at(events, x, y, t, 8.0)})
drops = [{"t": t, "air": [list(d) for d in sb.drops_in_air(events, t, 8.0)]} for t in [0.25 * k for k in range(32)]]
json.dump({"loop": 8.0, "events": [ev(e) for e in events], "splat": [list(s) for s in splat],
           "samples": samples, "drops": drops}, sys.stdout)
