"""The sludge's bubbling, timed from real mudpots (docs/art/FIGURES.md, "The sludge square"). Pure Python, no bpy, so
it can be tested: build_sludge_cycles.py asks it for the ooze's height at a point and a time.

A loop of LOOP seconds holds a schedule of bubble events. Each event has a vent (where), a size, and three stages:
  swell  - a lumpy skin blister rises (slow at the top, where the skin stretches)
  burst  - the skin tears open into a dark hole and the dome slumps into a crater; a ragged lip of torn skin folds
           back round it, and a bigger bubble flings 2-4 small blobs out on low arcs that land as lumps and melt in
  settle - the crater fills and one slow, wide ring spreads and dies
About 1 in 5 never bursts: it swells and sinks back. Big bubbles are slower in every stage. Events come in surges
round a few fixed vents (one main vent per square), never at the edges. Time wraps, so the loop is seamless.
Tiny still lumps of old splatter dot the surface and bob a little with the loop."""
import math
import random

LOOP = 8.0          # seconds (a 4 s loop read as repetitive to the motion judge)
RATE = 1.1          # events per second per square
BURST_SHARE = 0.8   # the rest swell and sink back


def stage_times(sz, thick=1.0):
    """Swell, burst and settle seconds for a bubble of size sz (0 = a small plip, 1 = the largest). thick > 1 slows
    the burst and the settle: ooze thicker than the mudpot's mud slumps and fills back more slowly."""
    return 0.25 + 0.6 * sz, (0.12 + 0.45 * sz) * thick, (0.2 + 0.7 * sz) * thick


class Event:
    __slots__ = ("x", "y", "r", "t0", "sz", "bursts", "ts", "tb", "tz", "ang", "stretch", "h1", "h2", "s1", "s2", "dome",
                 "drops")

    def __init__(self, x, y, r, t0, sz, bursts, rng, dome, thick=1.0):
        self.x, self.y, self.r, self.t0, self.sz, self.bursts = x, y, r, t0, sz, bursts
        self.ts, self.tb, self.tz = stage_times(sz, thick)
        self.ang = rng.uniform(0, 2 * math.pi)
        self.stretch = rng.uniform(1.0, 1.2)
        self.h1, self.h2 = rng.uniform(0.08, 0.16), rng.uniform(0.04, 0.1)   # lumpiness of the blister's outline
        self.s1, self.s2 = rng.uniform(0, 6.3), rng.uniform(0, 6.3)
        self.dome = dome * rng.uniform(0.8, 1.15)
        self.drops = []
        if bursts and sz >= DROP_MIN_SZ:  # a small splash: a few blobs on low arcs
            n = 2 if sz < 0.7 else rng.randint(3, 4)
            base = rng.uniform(0, 2 * math.pi)
            for i in range(n):
                self.drops.append(Drop(self, base + 2 * math.pi * i / n + rng.uniform(-0.5, 0.5), rng))

    def length(self):
        return self.ts + (self.tb + self.tz if self.bursts else self.ts * 0.8)


DROP_MIN_SZ = 0.3   # smaller bursts only tear; they fling nothing
MERGE, MELT = 0.1, 0.6   # seconds a landed blob takes to sink into the surface, then to melt flat


class Drop:
    """One blob flung by a burst: it leaves the lip as the skin tears, flies a low arc, lands, sinks in and melts."""
    __slots__ = ("x0", "y0", "x1", "y1", "r", "apex", "t0", "tf")

    def __init__(self, e, ang, rng):
        out = rng.uniform(1.3, 2.1) * e.r
        self.x0, self.y0 = e.x + 0.6 * e.r * math.cos(ang), e.y + 0.6 * e.r * math.sin(ang)
        self.x1, self.y1 = e.x + out * math.cos(ang), e.y + out * math.sin(ang)
        self.r = rng.uniform(0.2, 0.3) * e.r
        self.apex = rng.uniform(0.7, 1.2) * e.dome * e.r   # low: about a bubble's height
        self.t0 = (e.t0 + e.ts + rng.uniform(0.05, 0.3) * e.tb)
        self.tf = rng.uniform(0.28, 0.4)

    def end(self):
        return self.tf + MERGE + MELT


def drop_in_air(d, time, loop=LOOP):
    """Where the blob is at this time: (x, y, z above the surface, radius), or None once it has sunk in (or before
    it leaves). It grows out of the lip as it leaves, and shrinks into the surface as it lands."""
    tau = (time - d.t0) % loop
    if tau >= d.tf + MERGE:
        return None
    if tau < d.tf:
        p = tau / d.tf
        x, y = d.x0 + (d.x1 - d.x0) * p, d.y0 + (d.y1 - d.y0) * p
        return x, y, 4 * d.apex * p * (1 - p), d.r * min(1.0, 0.3 + 0.7 * p / 0.2)
    q = (tau - d.tf) / MERGE
    return d.x1, d.y1, -0.4 * d.r * q, d.r * (1 - q)


def drop_height(d, x, y, time, loop=LOOP):
    """The lump the blob leaves on the surface: it rises as the blob sinks in, then spreads and melts flat."""
    tau = (time - d.t0) % loop - d.tf
    if tau <= 0 or tau >= MERGE + MELT:
        return 0.0
    if tau < MERGE:
        peak, spread = 0.7 * d.r * _ease(tau / MERGE), 1.0
    else:
        q = (tau - MERGE) / MELT
        peak, spread = 0.7 * d.r * (1 - _ease(q)), 1.0 + 0.8 * q
    rr = d.r * 1.2 * spread
    d2 = ((x - d.x1) ** 2 + (y - d.y1) ** 2) / (rr * rr)
    return 0.0 if d2 >= 1 else peak * (1 - d2) ** 2


def drops_in_air(events, time, loop=LOOP):
    """Every blob in the air at this time, for the renderer to draw as small balls of ooze."""
    out = []
    for e in events:
        for d in e.drops:
            st = drop_in_air(d, time, loop)
            if st and st[3] > 0:
                out.append(st)
    return out


def tear(e, x, y, time, loop=LOOP):
    """How dark the ooze is here (0..1): the hole the skin tears open, ragged, widening through the burst and
    closing as the crater fills."""
    if not e.bursts:
        return 0.0
    tau = (time - e.t0) % loop - e.ts
    if tau <= 0 or tau >= e.tb + 0.5 * e.tz:
        return 0.0
    if tau < e.tb:
        size = 0.35 + 0.45 * _ease(tau / e.tb)
        dark = min(1.0, 4 * tau / e.tb)
    else:
        q = (tau - e.tb) / (0.5 * e.tz)
        size, dark = 0.8 * (1 - 0.5 * q), 1 - _ease(q)
    dx, dy = x - e.x, y - e.y
    th = math.atan2(dy, dx)
    rag = 1 + 0.18 * math.sin(4 * th + e.s1) + 0.12 * math.sin(7 * th + e.s2)
    rho = math.hypot(dx, dy) / (e.r * size * rag)
    return dark * (1 - _ease(min(1.0, max(0.0, (rho - 0.6) / 0.4))))


def tear_at(events, x, y, time, loop=LOOP):
    return min(1.0, sum(tear(e, x, y, time, loop) for e in events))


def schedule(vents, squares, rng, dome=0.5, loop=LOOP, rate=RATE, thick=1.0):
    """The loop's events. vents: [(x, y, room, main)], where room is how big a bubble fits there (its radius
    limit, kept clear of the edge) and main marks a square's main vent. About rate*squares*loop events, in 2-3
    surges, the main vents taking most and the biggest."""
    n = max(2, round(rate * squares * loop))
    surges = [rng.uniform(0, loop) for _ in range(rng.randint(2, 3))]
    mains = [v for v in vents if v[3]] or vents
    events = []
    for i in range(n):
        for _ in range(40):  # a bubble never rises on top of another still swelling or bursting there
            v = rng.choice(mains) if rng.random() < 0.6 else rng.choice(vents)
            big = v[3] and rng.random() < 0.55
            sz = rng.uniform(0.55, 1.0) if big else rng.uniform(0.0, 0.45)
            r = v[2] * (0.35 + 0.65 * sz)
            jit = 0.35 * v[2] * (1 - sz)   # small ones wander off the vent a little
            x, y = v[0] + rng.uniform(-jit, jit), v[1] + rng.uniform(-jit, jit)
            t0 = (rng.choice(surges) + rng.gauss(0, 0.45)) % loop if rng.random() < 0.75 else rng.uniform(0, loop)
            ts, tb, _tz = stage_times(sz, thick)
            bursts = rng.random() < BURST_SHARE
            if not any(_clash(x, y, r, t0, ts + (tb if bursts else ts * 0.8), o, loop) for o in events):
                events.append(Event(x, y, r, t0, sz, bursts, rng, dome, thick))
                break
    events.sort(key=lambda e: e.t0)
    return events


def busy_time(e):
    """How long the event holds its spot: its swell and burst (another may rise there while it settles)."""
    return e.ts + (e.tb if e.bursts else e.ts * 0.8)


def _clash(x, y, r, t0, dur, o, loop):
    if math.hypot(x - o.x, y - o.y) >= 1.0 * (r + o.r):
        return False
    gap = (o.t0 - t0) % loop   # o starts gap seconds after t0 (round the loop)
    return gap < dur or (loop - gap) < busy_time(o)


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
    r0 = math.hypot(lx, ly) / e.r
    lump = 1 + (e.h1 * math.sin(3 * th + e.s1) + e.h2 * math.sin(5 * th + e.s2)) * min(1.0, r0 * r0 / 0.36)
    rho = r0 / lump   # 1 at the blister's lumpy outline
    H = e.dome * e.r

    def blister(g):  # a skin dome, flattish on top, its footprint growing with it
        d = rho / (0.55 + 0.45 * g)
        return 0.0 if d >= 1 else g * H * (1 - d ** 2.5) ** 0.8

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
        flap = 1 + 0.35 * math.sin(5 * th + e.s2)   # torn skin folds back in a few flaps
        lr = 1 + 0.3 * p + 0.06 * math.sin(3 * th + e.s1)
        lip = 0.4 * H * flap * math.sin(math.pi * p) * math.exp(-((rho - lr) / 0.28) ** 2)
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


def surface_height(z, events, splat, x, y, time, loop=LOOP):
    """The ooze's height at (x, y): the base surface z with every bubble and splatter lump riding on it. Added, not
    blended with a smooth max: a smooth max raises a ridge wherever a bubble's height is tiny but not zero, which
    drew a crisp ring at the edge of every bubble's reach."""
    for s in splat:
        z += splatter_height(s, x, y, time, loop)
    for e in events:
        z += event_height(e, x, y, time, loop)
        for d in e.drops:
            z += drop_height(d, x, y, time, loop)
    return z
