# The snare's thorn roots, without Blender (Wesley 2026-11-26, look "C, thorn roots" from snare/snare-abc.jpg): a ring of
# dark gnarled roots pushing up through the cracks round a square's edge, curled inward like waiting fingers. Sprung
# (a piece stopped on it, docs/puzzles.md: it never moves again), they rise, reach in and wrap round its ankles.
# build_snare_cycles.py turns these into Blender objects.
#
# Square-local frame: the square's centre at the origin, the floor's top at z = 0, S = one square's side.
#   roots(S, t, n, seed)  -> every root's centre line, radii and thorns at grip t (0 = set, 1 = sprung)
#   rim(S, seed)          -> the tangle of half-buried roots round the edge that the standing roots grow from
#   cracks(S, seed)       -> the dark fissures the roots broke in the stone, as jagged polylines
#   grip(k, frames)       -> the grip at frame k of the spring: a fast snap that overshoots and settles
# Plain Python so its test runs with any python3:  python3 tools/art/diorama/test_snare_geom.py
import math
import random

N_PTS = 24        # points along each root
RING = 0.40       # where the roots come up: share of a square from the centre
RING_LEFT = 0.47  # nothing may reach past this (share of S from the centre, per axis): the root stays on its square


def _lerp(a, b, t):
    return a + (b - a) * t


def _root(S, alpha, rho0, z0, L, lean, curl, twist, r0, rng, hook=2.2, tip=0.2):
    """One root's centre line (lengths already in world units): from (rho0, z0) at angle alpha round the centre it
    rises, leans inward and hooks over near its tip. Along its arc the direction in the (outward, up) plane turns from
    lean to lean + curl (mostly in the last part: hook), and it swings round the centre by twist (all roots the same
    way, so sprung they wind round the ankles like a cage). Returns pts, radii and the direction angle at each point."""
    pts, radii, phis = [], [], []
    rho, z, a = rho0, z0, alpha
    ds = L / (N_PTS - 1)
    kn = rng.uniform(0, 6)
    for i in range(N_PTS):
        u = i / (N_PTS - 1)
        pts.append((rho * math.cos(a), rho * math.sin(a), z))
        # thick and knobbly where it breaks the stone, thinning to a blunt hooked tip
        radii.append(r0 * (1 - (1 - tip) * u ** 0.9) * (1 + 0.16 * math.sin(9.1 * u + kn)))
        phi = lean + curl * u ** hook
        phis.append(phi)
        rho = max(rho - math.sin(phi) * ds, 0.02 * S)
        z = max(z + math.cos(phi) * ds, -0.03 * S)
        a += twist * 2 * u / (N_PTS - 1)  # d(twist * u^2)
    return pts, radii, phis


def roots(S, t, n=12, seed=4):
    """The ring's roots at grip t (0 set, 1 sprung; past 1 is the overshoot). Each root: pts (centre line), radii,
    thorns (at, dir, len, r: little cones sticking out of the bark), shoots (side forks: pts, radii). Every root keeps its seed-chosen place and
    character at any t, so the frames of the spring line up."""
    rng = random.Random(seed)
    out = []
    for k in range(n):
        alpha = 2 * math.pi * (k + rng.uniform(-0.3, 0.3)) / n
        # the square's corners are further out than its sides: a root there may stand a little further out
        corner = abs(math.cos(2 * alpha))
        rho0 = RING * (1 + 0.12 * corner) + rng.uniform(-0.025, 0.02)
        big = rng.uniform(0.75, 1.2)  # some roots thick and long, some thin
        len_k = _lerp(0.44, 0.6, t) * _lerp(0.85, 1.1, big - 0.75)
        lean = _lerp(0.05, 0.5, t) + rng.uniform(-0.08, 0.08)
        curl = _lerp(2.0, 1.75, t) + rng.uniform(-0.25, 0.25)
        twist = _lerp(0.05, 0.55, t)
        r0 = 0.068 * big * S  # chunky, clay-thick (judge r1: the 0.05 roots read spindly)
        sub = random.Random(seed * 101 + k)
        pts, radii, phis = _root(S, alpha, rho0 * S, -0.03 * S, len_k * S, lean, curl, twist, r0, sub)
        pts, radii = _keep_on_square(pts, radii, S)
        # one or two side shoots from the upper half, off to either side and hooked, as gnarled roots fork
        shoots = []
        for q in range(1 + (big > 0.95)):
            i0 = sub.randint(8, 13)
            side = 1 if (k + q) % 2 else -1
            x, y, z = pts[i0]
            sp, sr, _ = _root(S, math.atan2(y, x), math.hypot(x, y), z, 0.3 * len_k * S, phis[i0] - 0.8,
                              curl * 1.1, side * 0.22 + twist * 0.4, radii[i0] * 0.6, sub, hook=1.6, tip=0.25)
            sp, sr = _keep_on_square(sp, sr, S)
            shoots.append({"pts": sp, "radii": sr})
        thorns = []
        side = 1
        for i in range(2, N_PTS - 3, 2):
            p, q = pts[i], pts[i + 1]
            tan = _norm((q[0] - p[0], q[1] - p[1], q[2] - p[2]))
            # stick out sideways from the root, alternating, tilted toward the tip like a rose thorn
            ref = (0.0, 0.0, 1.0) if abs(tan[2]) < 0.9 else (1.0, 0.0, 0.0)
            perp = _norm(_cross(tan, ref))
            spin = sub.uniform(-0.6, 0.6) + (0 if side > 0 else math.pi)
            up = _cross(tan, perp)
            d = tuple(math.cos(spin) * perp[j] + math.sin(spin) * up[j] for j in range(3))
            d = _norm(tuple(d[j] + 0.45 * tan[j] for j in range(3)))
            ln = min(radii[i] * sub.uniform(1.1, 1.8), 0.05 * S)  # short and stubby
            end = [p[j] + d[j] * ln for j in range(2)]
            if max(abs(end[0]), abs(end[1])) < RING_LEFT * S:  # a thorn may not poke onto the next square
                thorns.append({"at": p, "dir": d, "len": ln, "r": radii[i] * 0.7})  # wide-based, like a rose thorn
            side = -side
        out.append({"pts": pts, "radii": radii, "thorns": thorns, "alpha": alpha, "shoots": shoots})
    return out


def _keep_on_square(pts, radii, S):
    """Squash a root back inside its square if a curl swung it past RING_LEFT (the neighbours' squares are theirs)."""
    lim = RING_LEFT * S
    out = []
    for (x, y, z), r in zip(pts, radii):
        x = max(-lim + r, min(lim - r, x))
        y = max(-lim + r, min(lim - r, y))
        out.append((x, y, z))
    return out, radii


def _ring_point(S, ang, r):
    """A point on the rounded-square ring (superellipse, p = 3) at angle ang, r share of S from the centre: the root
    tangle follows the square's edge, not a circle."""
    c, s = math.cos(ang), math.sin(ang)
    k = (abs(c) ** 3 + abs(s) ** 3) ** (-1 / 3)
    return (r * S * k * c, r * S * k * s)


def rim(S, seed=4, n=7):
    """The tangle round the edge: n roots of different thickness lying in the stone, each running a stretch of the ring,
    wandering in and out, diving under the stone and coming up again, overlapping, so the ring reads as one knotted
    root mass and never as a neat hoop."""
    rng = random.Random(seed * 7 + 1)
    out = []
    for k in range(n):
        a0 = 2 * math.pi * k / n + rng.uniform(-0.35, 0.35)
        span = rng.uniform(1.4, 2.4) * 2 * math.pi / n
        r0 = 0.03 * S * rng.uniform(0.6, 1.3)
        ph, ph2 = rng.uniform(0, 6), rng.uniform(0, 6)
        rr = RING * rng.uniform(0.92, 1.04)
        pts, radii = [], []
        for i in range(N_PTS):
            u = i / (N_PTS - 1)
            ang = a0 + span * u
            r = rr + 0.04 * math.sin(4.1 * ang + ph) + 0.02 * math.sin(9.7 * ang + ph2)
            x, y = _ring_point(S, ang, r)
            z = r0 * (0.6 * math.sin(math.pi * u) * (0.6 + 0.6 * math.sin(5.3 * ang + ph2)) - 0.35)
            pts.append((x, y, z))
            radii.append(r0 * (0.3 + 0.7 * math.sin(math.pi * u) ** 0.5) * (1 + 0.2 * math.sin(13 * u + ph)))
        pts, radii = _keep_on_square(pts, radii, S)
        out.append({"pts": pts, "radii": radii})
    return out


def cracks(S, seed=4, n=12):
    """Fissures from the ring: they start under the root tangle and run in across the stone toward the middle (there
    is no room outside the ring: the square's edge is just past it),
    each a jagged line that forks once and thins. Each crack: pts (x, y) and a width at each point."""
    rng = random.Random(seed * 13 + 5)
    out = []
    for k in range(n):
        ang = 2 * math.pi * (k + rng.uniform(-0.4, 0.4)) / n
        x, y = _ring_point(S, ang, RING * 0.8)  # just inside the roots, so the crack shows on open stone
        heading = ang + math.pi + rng.uniform(-0.6, 0.6)
        steps = rng.randint(2, 5)
        w0 = 0.075 * S * rng.uniform(0.7, 1.2)
        pts, ws = [(x, y)], [w0]
        for s_ in range(steps):
            heading += rng.uniform(-0.7, 0.7)
            ln = rng.uniform(0.025, 0.05) * S
            nx_, ny_ = x + ln * math.cos(heading), y + ln * math.sin(heading)
            if max(abs(nx_), abs(ny_)) > RING_LEFT * S:
                break
            x, y = nx_, ny_
            pts.append((x, y)); ws.append(w0 * (1 - (s_ + 1) / (steps + 1)))
            if s_ == 1 and rng.random() < 0.5:  # one fork
                fh = heading + rng.choice((-1, 1)) * rng.uniform(0.6, 1.0)
                fx, fy = x + 0.03 * S * math.cos(fh), y + 0.03 * S * math.sin(fh)
                if max(abs(fx), abs(fy)) < RING_LEFT * S:
                    out.append({"pts": [(x, y), (fx, fy)], "w": [ws[-1] * 0.8, 0.0]})
        if len(pts) > 1:
            out.append({"pts": pts, "w": ws})
    return out


def grip(k, frames):
    """The spring's grip at frame k of frames: the roots snap up in the first third (ease out), overshoot by 12%, then
    settle with a small wobble, as a sprung trap. 0 at frame 0, 1 at the last."""
    if frames <= 1:
        return 1.0
    u = k / (frames - 1)
    snap = 0.33
    if u < snap:
        v = u / snap
        return 1.12 * (1 - (1 - v) ** 3)
    v = (u - snap) / (1 - snap)
    return 1 + 0.12 * math.exp(-4.5 * v) * math.cos(3 * math.pi * v) * (1 - v)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a):
    m = math.sqrt(sum(c * c for c in a)) or 1.0
    return tuple(c / m for c in a)
