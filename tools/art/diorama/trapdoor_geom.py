# The trapdoor's layout, without Blender (Wesley 2026-11-25: oak planks with iron straps, swinging DOWN into the pit
# so a figure falling through never meets the door). build_trapdoor_cycles.py turns these into Blender objects.
#
# The door's own frame: the hinge line is the x axis at the door's back edge, the door lies in front of it (y from 0
# to -L), its top at z = 0, planks th thick below that. Turning it by +deg about x swings the front edge down.
#   planks(W, L, th, n, seed)   -> n boards side by side, long along y, a little uneven
#   ironwork(W, L, th)          -> straps, nails, hinge knuckles, the ring and its plate, as simple shapes
#   hung(L, th, deg)            -> where the door's far edge ends up (y, z) after the swing
#   clear_share(W, L, th, deg, hw) -> how much of the opening the hanging door leaves free (1 = all)
# Plain Python so its test runs with any python3:  python3 tools/art/diorama/test_trapdoor_geom.py
import math
import random

FALLEN_DEG = 88.0  # hung open for good: just short of plumb, so it never cuts into the pit's back wall


def planks(W, L, th, n=4, seed=5):
    """Boards across the door's width with thin dark gaps, each a touch different (width, length, height, twist), as
    a hand-built door. Each: centre (x, y, z), size (length along y, width along x, thickness), twist (rx, ry)."""
    rng = random.Random(seed)
    gap = 0.022 * W  # wide enough to read as separate boards, and for moss to sit in
    raw = [1 + rng.uniform(-0.1, 0.1) for _ in range(n)]
    usable = W - gap * (n - 1)
    ws = [r / sum(raw) * usable for r in raw]
    out, x = [], -W / 2
    for w in ws:
        trim = rng.uniform(0.0, 0.025) * L  # ends not quite flush
        ln = L - trim
        y = -L / 2 - rng.uniform(-0.5, 0.5) * trim
        out.append({"at": (x + w / 2, y, -th / 2 + rng.uniform(-0.2, 0.1) * th),
                    "size": (ln, w, th * rng.uniform(0.92, 1.05)),
                    "twist": (rng.uniform(-1.5, 1.5), rng.uniform(-2.0, 2.0))})  # degrees: along, across
        x += w + gap
    return out


def ironwork(W, L, th, n_planks=4):
    """Two iron straps across the planks with a nail on each board, two hinge knuckles on the back edge, a round plate
    with a drop ring at the front. Shapes: box (centre, size), cyl (centre, radius, length, axis), dome (centre, r),
    torus (centre, R, r, tilt degrees about x)."""
    st_w, st_t = 0.085 * L, 0.024 * W  # straps thick enough to cast a shadow on the wood
    rng = random.Random(13)  # hand-set nails: a little off-centre, not all the same size
    parts = []
    for yf in (0.2, 0.74):
        y = -yf * L
        parts.append({"kind": "box", "at": (0.0, y, st_t / 2), "size": (W * 0.97, st_w, st_t), "warp": True})
        for sx in (-1, 1):  # the strap's ends bent down over the door's side edges
            parts.append({"kind": "box", "at": (sx * (W * 0.97 / 2 + st_t / 2), y, -th / 2 + st_t / 2),
                          "size": (st_t, st_w, th + st_t)})
        for k in range(n_planks):
            x = -W / 2 + (k + 0.5) * W / n_planks + rng.uniform(-0.15, 0.15) * st_w
            parts.append({"kind": "dome", "at": (x, y + rng.uniform(-0.12, 0.12) * st_w, st_t),
                          "r": 0.3 * st_w * rng.uniform(0.85, 1.12)})
    # hinge knuckles: pins along x on the back edge, where the straps would wrap round
    for xs in (-0.3, 0.3):
        parts.append({"kind": "cyl", "at": (xs * W, 0.0, -th / 2), "r": 0.55 * th, "len": 0.14 * W, "axis": "x"})
        parts.append({"kind": "box", "at": (xs * W, -0.07 * L, st_t / 2), "size": (0.12 * W, 0.14 * L, st_t)})
    # the ring pull at the front, lying nearly flat on its plate
    py = -0.9 * L
    parts.append({"kind": "cyl", "at": (0.0, py, st_t / 2), "r": 0.06 * W, "len": st_t, "axis": "z"})
    parts.append({"kind": "torus", "at": (0.0, py - 0.035 * W, st_t + 0.012 * W), "R": 0.055 * W, "r": 0.012 * W,
                  "tilt": 8.0})
    return parts


def moss_tufts(W, L, n=8, seed=9):
    """Little moss clumps in the gaps between boards and along the hinge, as in draft A: each (x, y, radius)."""
    rng = random.Random(seed)
    ps = planks(W, L, 1.0, seed=5)
    gaps = [(ps[k]["at"][0] + ps[k]["size"][1] / 2 + ps[k + 1]["at"][0] - ps[k + 1]["size"][1] / 2) / 2
            for k in range(len(ps) - 1)]
    out = []
    for k in range(n):
        x = gaps[k % len(gaps)] + rng.uniform(-0.01, 0.01) * W
        y = -L * rng.choice((rng.uniform(0.04, 0.16), rng.uniform(0.32, 0.62), rng.uniform(0.8, 0.95)))
        out.append((x, y, W * rng.uniform(0.03, 0.055)))
    return out


def hung(L, th, deg):
    """The door's front edge (top face) after turning deg about the hinge: (y, z) in the hinge frame."""
    t = math.radians(deg)
    y, z = -L, 0.0
    return (y * math.cos(t) - z * math.sin(t), y * math.sin(t) + z * math.cos(t))


def clear_share(W, L, th, deg, hw):
    """The share of the square opening (2hw wide, hinge on its back edge at y = 0) not covered from above by the
    hanging door: its footprint reaches from the hinge to the furthest of its four section corners."""
    t = math.radians(deg)
    ys = []
    for y, z in ((0.0, 0.0), (-L, 0.0), (0.0, -th), (-L, -th)):
        ys.append(y * math.cos(t) - z * math.sin(t))
    reach = max(0.0, -min(ys))  # how far in front of the hinge line it shows
    return max(0.0, 1.0 - reach / (2 * hw))


def wall_deg(L, th, inset=1.2):
    """The swing (degrees) at which the door's back face meets the pit's back wall, inset*th behind the hinge."""
    lo, hi = 90.0, 120.0
    for _ in range(60):
        mid = (lo + hi) / 2
        t = math.radians(mid)
        if -L * math.cos(t) + th * math.sin(t) < inset * th:
            lo = mid
        else:
            hi = mid
    return lo


# The drop, timed by a reference pass (docs/art/FIGURES.md, "Trapdoor drop"): two model gallows trapdoors open in
# about 2 frames at 24 fps, which a hinged board falling under gravity predicts for a 3-5 cm door, so the same
# physics times ours at full size (a door about 1.9 m long, one square, by the figures' height): 16 frames to the
# wall. Then it bangs on the pit's back wall and rocks back twice (a cheat: real swings that size take a second).
DOOR_M = 1.9
BOUNCES = ((14.0, 8), (4.0, 5))  # (degrees back off the wall, frames) per rock
SETTLE_F = 4


def fall_curve(L_m=DOOR_M, fps=24, wall=91.0, rest=FALLEN_DEG, g=9.81):
    """The door's angle on each frame of the drop, frame 0 shut (0) to the last at rest."""
    out, th, w, t, dt, f = [0.0], 0.0, 0.0, 0.0, 1e-5, 1
    while True:  # a uniform board hinged at one edge: th'' = (3g / 2L) cos th
        w += 1.5 * g / L_m * math.cos(th) * dt
        th += w * dt
        t += dt
        if math.degrees(th) >= wall:
            break
        if t >= f / fps:
            out.append(math.degrees(th))
            f += 1
    out.append(wall)  # the frame it hits
    for amp, n in BOUNCES:
        out += [wall - amp * math.sin(math.pi * k / n) for k in range(1, n + 1)]
    out += [wall + (rest - wall) * (1 - math.cos(math.pi * k / SETTLE_F)) / 2 for k in range(1, SETTLE_F + 1)]
    return out


def inside(dx, dy, h):
    """Whether a point (dx, dy) from the square's centre is within h of it on both axes."""
    return abs(dx) < h and abs(dy) < h
