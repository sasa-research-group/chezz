# The gate square's shapes (Wesley 2026-11-26, look "Middle 1" from ~/.dos/scratch/d84406ef/gate/gate-b-middle.jpg):
# a pair of arched oak doors under a round stone arch, in the doorway between two wall posts, woody vines creeping over
# the planks and a soft cushion of moss on the arch. Pure geometry here (no bpy); gate_parts.py builds the meshes, build_gate_cycles.py renders and bakes them.
#
# Units: one square = 1. x runs along the wall (the posts' inner faces at x = +-0.5, walls.ts PILLAR_W), y away from
# the camera (the back), z up from the floor. The wall's middle plane is y = 0. A figure is H = 1 / 1.2 squares tall.
import math, random

H = 1 / 1.2
WALL_TOP = 0.65 * H                # walls.ts WALL_H
POST_TOP = 1.25 * WALL_TOP         # walls.ts PILLAR_H
HALF = 0.5                         # the posts' inner faces
SPRING = WALL_TOP + 0.02           # where the arch leaves the posts: just over the wall, so the arch rounds up high
RISE = 0.30                        # the arch's rise over its span: round like the draft; it hides a little of the square behind
ARCH_T = 0.095                     # ring thickness (intrados to extrados)
ARCH_D = 0.22                      # ring depth, front to back
STONES = 11
LEAF_T = 0.035                     # door thickness
GAP = 0.01                        # between the leaves, and at the hinge
OPEN_DEG = 92.0                    # open: swung back past square against the post's back side
LEAF_Y = ARCH_D / 2 + LEAF_T / 2 + 0.003  # the doors hang just behind the arch, so they swing clear of its stones


def arch_circle():
    """The intrados circle through (+-HALF, SPRING) rising RISE at the crown: (centre z, radius)."""
    r = (HALF ** 2 + RISE ** 2) / (2 * RISE)
    return SPRING + RISE - r, r


def intrados(x):
    """Height of the arch's underside above x (|x| <= HALF)."""
    zc, r = arch_circle()
    return zc + math.sqrt(max(0.0, r * r - x * x))


def crown():
    """The top of the arch's stones at the middle."""
    return SPRING + RISE + ARCH_T


def voussoirs(seed=3):
    """The arch stones: each a wedge between two angles on the ring, with a little wobble in thickness and depth, so
    the ring reads as hand-cut stones. Returns [{a0, a1, t, d, dy}] (angles from the circle's centre, radians, a0 <
    a1; t ring thickness; d depth; dy shift front/back)."""
    zc, r = arch_circle()
    amax = math.asin(HALF / r)
    rng = random.Random(seed)
    edges = [-amax + 2 * amax * k / STONES for k in range(STONES + 1)]
    for k in range(1, STONES):
        edges[k] += rng.uniform(-0.18, 0.18) * (2 * amax / STONES)
    gap = 0.003 / r
    out = []
    for k in range(STONES):
        key = k == STONES // 2
        out.append({"a0": edges[k] + gap / 2, "a1": edges[k + 1] - gap / 2,
                    "t": ARCH_T * (1.18 if key else rng.uniform(0.92, 1.06)),
                    "d": ARCH_D * (1.05 if key else rng.uniform(0.94, 1.0)), "dy": rng.uniform(-0.018, 0.018)})
    return out


def arch_point(a, rr):
    """A point on the arch at angle a (0 = straight up, positive toward +x) and distance rr from the circle's centre."""
    zc, _ = arch_circle()
    return (rr * math.sin(a), zc + rr * math.cos(a))


def leaf_outline(side, steps=10):
    """One door leaf's face outline in the xz plane, counter-clockwise from the bottom at the hinge: side -1 the left
    leaf (hinge at x = -HALF), +1 the right. The top follows the arch's underside, a hair below it."""
    x_h = side * (HALF - GAP)
    x_m = side * GAP / 2
    pts = [(x_h, 0.0), (x_m, 0.0)]
    for k in range(steps + 1):
        x = x_m + (x_h - x_m) * k / steps
        pts.append((x, intrados(x) - GAP))
    return pts


def planks(side, n=3, seed=5):
    """The leaf's planks, hinge to middle: [(x0, x1)] with x0 < x1, uneven widths, a thin seam between each."""
    rng = random.Random(seed + (side > 0))
    ws = [rng.uniform(0.85, 1.15) for _ in range(n)]
    span = HALF - GAP - GAP / 2
    seam = 0.015  # visible joints between boards (the judge read 0.009 as painted lines)
    xs, x = [], 0.0
    tot = sum(ws)
    for w in ws:
        w_ = w / tot * span
        xs.append((x + seam / 2, x + w_ - seam / 2)); x += w_
    off = GAP / 2
    return [(off + a, off + b) if side > 0 else (-(off + b), -(off + a)) for a, b in xs]


def straps(side):
    """Iron straps across the leaf: [(z, x0, x1)]; they run from the hinge most of the way to the middle."""
    x_h = side * (HALF - GAP)
    x_e = side * 0.06
    lo, hi = sorted((x_h, x_e))
    return [(0.13, lo, hi), (0.43, lo, hi)]


def ring(side):
    """The ring pull: centre (x, z) and the ring's radius."""
    return (side * 0.1, 0.32), 0.05


def on_leaf(side, x):
    """x clamped onto the leaf's face, clear of its edges."""
    lo, hi = sorted((side * GAP, side * (HALF - 2 * GAP)))
    return min(hi, max(lo, x))


def vines(side, seed=9):
    """Woody vines on the leaf's front face (y < 0): each a list of (x, z) points and radii, rising from the foot of
    the door, wandering across the planks, thinning to a tip; a few short twigs off each. They stay on the leaf so
    they swing with it. Returns [{"pts": [(x, z)], "radii": [..], "twigs": [{"pts", "radii"}]}]."""
    rng = random.Random(seed + 17 * (side > 0))
    out = []
    starts = [(0.82, 0.0), (0.35, 0.0)] if side < 0 else [(0.2, 0.0), (0.7, 0.0)]
    for k, (u0, _) in enumerate(starts):
        pts, radii = [], []
        u, z = u0, 0.0
        top = 0.62 if k == 0 else 0.42
        n = 14
        drift = rng.choice((-1, 1)) * rng.uniform(0.15, 0.3)
        for q in range(n + 1):
            s = q / n
            x = side * (GAP / 2 + u * (HALF - 1.5 * GAP))
            zz = s * top
            zz = min(zz, intrados(x) - 0.05)
            pts.append((x, zz))
            radii.append(0.02 * (1 - 0.85 * s) + 0.002)  # tapering to a fine tip
            u = min(0.95, max(0.06, u + drift / n + rng.uniform(-0.06, 0.06)))
            if rng.random() < 0.2:
                drift = -drift
        twigs = []
        for q in range(2, n - 1, 4):
            x0, z0 = pts[q]
            ang = rng.uniform(0.5, 1.1) * rng.choice((-1, 1))
            L = rng.uniform(0.05, 0.1)
            tp, tr = [], []
            for m in range(5):
                s = m / 4
                x = on_leaf(side, x0 + math.sin(ang) * L * s)
                tp.append((x, min(z0 + math.cos(ang) * abs(L) * s, intrados(x) - 0.04)))
                tr.append(radii[q] * 0.55 * (1 - 0.7 * s))
            twigs.append({"pts": tp, "radii": tr})
        out.append({"pts": pts, "radii": radii, "twigs": twigs})
    return out


def leaf_angle(open_frac, side, clamp=True):
    """Rotation of a leaf about its hinge (radians, about +z): 0 shut; open swings it back (toward +y), so the left
    leaf turns clockwise seen from above (negative) and the right counter-clockwise. clamp=False lets a swing's
    overshoot through."""
    f = max(0.0, min(1.0, open_frac)) if clamp else open_frac
    return -side * math.radians(OPEN_DEG) * f


# The swing, as baked: SWING_FRAMES frames at 24 fps from shut (frame 0) to open (the last); swing_open is what the
# bake and the game share. Reference pass (2026-11-26, scratch refclips/gate: a castle's single oak leaf pushed open
# and shut by one man, a church door pushed open by hand):
#
# | key            | ref (castle, 24 fps)         | ours        | note                                         |
# |----------------|------------------------------|-------------|----------------------------------------------|
# | lean in        | 0-20 f barely moves          | f0-4        | measured: heavy start, ~5% of the angle      |
# | swing          | ~20-96 f near-steady         | f4-15       | measured shape; time cut ~5x for the game    |
# | land on stop   | eased by hand (no post)      | f15         | guessed: ours hit the post, a soft knock     |
# | rebound/settle | none (hand held)             | f15-19      | guessed: 6% back, settles by f19             |
# | shut (reverse) | slows into the frame, ~7 s   | f19 -> f0   | measured: shutting slows to the frame; the   |
# |                |                              |             | reverse of the heavy start gives that         |
#
# The real gate takes ~4 s to open; a game turn can't wait that long, so the timing is cut to 0.8 s and the shape kept.
SWING_FRAMES = 20
SWING_FPS = 24
SWING_LAND = 15                   # the frame the doors reach the posts
SWING_SETTLE = (0.94, 0.95, 0.98, 1.0)   # the knock's rebound off the posts, frames SWING_LAND+1 ... the last


def swing_open(k, frames=SWING_FRAMES):
    """How far open (0 shut, 1 open) the doors are on frame k of the swing: a heavy start that gathers speed, a knock
    on the posts at SWING_LAND, a small rebound that settles. Other frame counts scale the same shape."""
    land = SWING_LAND * (frames - 1) / (SWING_FRAMES - 1)
    if k >= land:
        tail = (k - land) / max(1e-9, (frames - 1) - land) * len(SWING_SETTLE)
        if tail <= 0:
            return 1.0
        i = min(len(SWING_SETTLE) - 1, int(math.ceil(tail)) - 1)
        lo = 1.0 if i == 0 else SWING_SETTLE[i - 1]
        return lo + (SWING_SETTLE[i] - lo) * (tail - i)
    u = max(0.0, k / land)
    return u * u * (1.6 - 0.6 * u)


def hinge(side):
    """The hinge line's place in plan (x, y)."""
    return side * (HALF - GAP), LEAF_Y


def swing(p, open_frac, side):
    """Where a leaf point (x, y) lands at open_frac, turned about its hinge."""
    hx, hy = hinge(side)
    a = leaf_angle(open_frac, side)
    dx, dy = p[0] - hx, p[1] - hy
    return (hx + dx * math.cos(a) - dy * math.sin(a), hy + dx * math.sin(a) + dy * math.cos(a))
