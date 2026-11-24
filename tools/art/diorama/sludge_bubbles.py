"""The sludge's bubbling, timed from real mudpots (docs/art/FIGURES.md, "The sludge square"). Pure Python, no bpy, so
it can be tested: build_sludge_cycles.py asks it for the ooze's height at a point and a time.

A loop of LOOP seconds holds a schedule of bubble events. Each event has a vent (where), a size, and three stages:
  swell  - a lumpy skin blister rises (slow at the top, where the skin stretches)
  burst  - the skin tears and the dome slumps into a crater; a lip of torn skin folds back round it
  settle - the crater fills and one slow, wide ring spreads and dies
About 1 in 5 never bursts: it swells and sinks back. Big bubbles are slower in every stage. Events come in surges
round a few fixed vents (one main vent per square), never at the edges. Time wraps, so the loop is seamless.
Tiny still lumps of old splatter dot the surface and bob a little with the loop."""
import math
import random

LOOP = 8.0          # seconds (a 4 s loop read as repetitive to the motion judge)
RATE = 1.1          # events per second per square
BURST_SHARE = 0.8   # the rest swell and sink back


def stage_times(sz):
    """Swell, burst and settle seconds for a bubble of size sz (0 = a small plip, 1 = the largest)."""
    return 0.25 + 0.6 * sz, 0.12 + 0.45 * sz, 0.2 + 0.7 * sz


class Event:
    __slots__ = ("x", "y", "r", "t0", "sz", "bursts", "ts", "tb", "tz", "ang", "stretch", "h1", "h2", "s1", "s2", "dome")

    def __init__(self, x, y, r, t0, sz, bursts, rng, dome):
        self.x, self.y, self.r, self.t0, self.sz, self.bursts = x, y, r, t0, sz, bursts
        self.ts, self.tb, self.tz = stage_times(sz)
        self.ang = rng.uniform(0, 2 * math.pi)
        self.stretch = rng.uniform(1.0, 1.2)
        self.h1, self.h2 = rng.uniform(0.08, 0.16), rng.uniform(0.04, 0.1)   # lumpiness of the blister's outline
        self.s1, self.s2 = rng.uniform(0, 6.3), rng.uniform(0, 6.3)
        self.dome = dome * rng.uniform(0.8, 1.15)

    def length(self):
        return self.ts + (self.tb + self.tz if self.bursts else self.ts * 0.8)


def schedule(vents, squares, rng, dome=0.5, loop=LOOP, rate=RATE):
    """The loop's events. vents: [(x, y, room, main)], where room is how big a bubble fits there (its radius
    limit, kept clear of the edge) and main marks a square's main vent. About rate*squares*loop events, in 2-3
    surges, the main vents taking most and the biggest."""
    n = max(2, round(rate * squares * loop))
    surges = [rng.uniform(0, loop) for _ in range(rng.randint(2, 3))]
    mains = [v for v in vents if v[3]] or vents
    events = []
    for i in range(n):
        v = rng.choice(mains) if rng.random() < 0.6 else rng.choice(vents)
        big = v[3] and rng.random() < 0.55
        sz = rng.uniform(0.55, 1.0) if big else rng.uniform(0.0, 0.45)
        r = v[2] * (0.35 + 0.65 * sz)
        jit = 0.35 * v[2] * (1 - sz)   # small ones wander off the vent a little
        x, y = v[0] + rng.uniform(-jit, jit), v[1] + rng.uniform(-jit, jit)
        t0 = (rng.choice(surges) + rng.gauss(0, 0.45)) % loop if rng.random() < 0.75 else rng.uniform(0, loop)
        events.append(Event(x, y, r, t0, sz, rng.random() < BURST_SHARE, rng, dome))
    events.sort(key=lambda e: e.t0)
    return events


FAR, FADE = 3.0, 2.2   # an event touches nothing beyond FAR radii; it fades out from FADE


def _ease(p):
    return p * p * (3 - 2 * p)


def event_height(e, x, y, time, loop=LOOP):
    """The event's height above the surface at (x, y) and time (seconds, any value: it wraps)."""
    tau = (time - e.t0) % loop
    if tau >= e.length():
        return 0.0
    dx, dy = x - e.x, y - e.y
    d2 = dx * dx + dy * dy
    if d2 >= (FAR * e.r) ** 2:
        return 0.0
    # everything fades to nothing before FAR, so no edge shows as a groove in the surface
    w = 1 - _ease(min(1.0, max(0.0, (math.sqrt(d2) / e.r - FADE) / (FAR - FADE))))
    ca, sa = math.cos(e.ang), math.sin(e.ang)
    lx, ly = (dx * ca + dy * sa) / e.stretch, -dx * sa + dy * ca
    th = math.atan2(ly, lx)
    lump = 1 + e.h1 * math.sin(3 * th + e.s1) + e.h2 * math.sin(5 * th + e.s2)
    rho = math.hypot(lx, ly) / (e.r * lump)   # 1 at the blister's lumpy outline
    H = e.dome * e.r

    def blister(g):  # a skin dome, flattish on top, its footprint growing with it
        d = rho / (0.55 + 0.45 * g)
        return 0.0 if d >= 1 else g * H * (1 - d * d) ** 0.75

    if tau < e.ts:  # swell: fast at first, slowing as the skin stretches
        p = tau / e.ts
        return blister(1 - (1 - p) ** 2)
    tau -= e.ts
    if not e.bursts:  # sinks back
        return blister(1 - _ease(tau / (e.ts * 0.8)))
    if tau < e.tb:  # burst: the dome slumps, a crater opens, the torn skin folds back into a lip
        p = tau / e.tb
        dome = blister(1.0) * (1 - p) ** 2
        crater = -0.35 * H * _ease(p) * math.exp(-(rho / 0.6) ** 2)
        lip = 0.4 * H * math.sin(math.pi * p) * math.exp(-((rho - (1 + 0.3 * p)) / 0.28) ** 2)
        return (dome + crater + lip) * w
    q = (tau - e.tb) / e.tz  # settle: the crater fills, one wide ring spreads and dies
    crater = -0.35 * H * (1 - _ease(q)) * math.exp(-(rho / 0.6) ** 2)
    ring = 0.07 * H * (1 - q) ** 2 * math.sin(math.pi * min(1.0, 4 * q)) ** 0.5 * math.exp(-((rho - (1.2 + 0.6 * q)) / 0.5) ** 2)
    return (crater + ring) * w


def splatter(spots, rng, per_square, squares):
    """Tiny still lumps of old splatter: [(x, y, r, phase)] picked from spots, a list of (x, y, r) candidates that
    already fit the pool."""
    want = min(len(spots), per_square * squares)
    return [(x, y, r, rng.uniform(0, 1)) for x, y, r in rng.sample(spots, want)]


def splatter_height(s, x, y, time, loop=LOOP):
    sx, sy, r, ph = s
    d2 = ((x - sx) ** 2 + (y - sy) ** 2) / (r * r)
    if d2 >= 1:
        return 0.0
    bob = 1 + 0.15 * math.sin(2 * math.pi * (time / loop + ph))
    return 0.45 * r * bob * (1 - d2) ** 1.5


def stage_of(e, time, loop=LOOP):
    """Which stage the event is in at this time: 'swell', 'sink', 'burst', 'settle' or None (between)."""
    tau = (time - e.t0) % loop
    if tau >= e.length():
        return None
    if tau < e.ts:
        return "swell"
    tau -= e.ts
    if not e.bursts:
        return "sink"
    return "burst" if tau < e.tb else "settle"
