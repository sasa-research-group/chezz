# The bronze sun pressure plate's shapes (concept: ~/.dos/scratch/d84406ef/lever/P1.png, a Gemini paint-over of the
# set; the plate on the near-right floor square 4,0). A round worn bronze disc, a sun in relief on it (a domed boss, a
# thin ring, 16 rays: eight long and pointed, eight short and wavy, a raised rim), set into a ring of mossy stone with
# a thin dark gap round its edge showing it can sink. Pure geometry here (no bpy); plate_parts.py builds the meshes,
# build_plate_cycles.py renders them in the set.
#
# Units as lever_geom: one square = 1, the square's centre at x = y = 0 on the floor (z = 0). x runs left to right on
# screen, y away from the camera, z up. Angles about the centre, from +x, counter-clockwise (th, radians).
import math

DISC_R = 0.315                 # the disc's radius: 0.63 of a square across, centred
GAP = 0.015                    # the dark gap between the disc and the stone ring
RING_W = 0.115                 # the stone ring's width (the concept's ring is broad)
RING_H = 0.045                 # how far the ring stands proud of the slab
R_IN = DISC_R + GAP            # the ring's inner edge
R_OUT = R_IN + RING_W          # its outer edge (0.445: 0.055 of a square left to the square's edge)
RISE = 0.03                    # up: the disc's flat top this far over the ring's top
SINK = 0.03                    # pressed: it sinks this far, to about flush with the ring
DISC_T = 0.12                  # the disc's thickness (its underside is in the well)
WELL_DEPTH = 0.22              # the well's black floor under the floor
STONES = 11                    # blocks round the ring
STATES = {"up": 0.0, "down": 1.0}

# the sun on the disc's flat top (heights above the flat, square units)
RIM_W = 0.035                  # the raised rim: from DISC_R - RIM_W to the edge
RIM_H = 0.011
EDGE_DROP = 0.004              # the outer edge rolls down this far below the flat
BOSS_R = 0.115                 # the domed central boss (the sun's face)
BOSS_H = 0.019
FACE_R = 0.066                 # a scribed line round the boss's face
SUN_RING_R0, SUN_RING_R1 = 0.125, 0.142   # the thin raised ring round the boss
SUN_RING_H = 0.007
RAYS = 16                      # alternate long (pointed) and short (wavy)
RAY_R0 = 0.150                 # rays start outside the ring
RAY_TIP = (0.250, 0.222)       # long, short: tip radius
RAY_HW = (0.027, 0.020)        # half width at the foot
RAY_H = 0.009
SCRIBE_R = 0.262               # a scribed circle between the rays and the rim
SCRIBE_W = 0.004
SCRIBE_D = 0.0035
SOFT = 0.007                   # relief edges roll over this far


def disc_z(t):
    """The disc's flat top above the floor, at t of the press (0 up .. 1 pressed down), eased. Up: RING_H + RISE; down:
    RING_H + RISE - SINK, about flush with the ring's top."""
    t = max(0.0, min(1.0, t))
    s = t * t * (3 - 2 * t)
    return RING_H + RISE - SINK * s


def _smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def _wrap(a):
    return (a + math.pi) % (2 * math.pi) - math.pi


def ray_info(k):
    """(centre angle, long?, tip radius, foot half width) of ray k."""
    long_ = k % 2 == 0
    i = 0 if long_ else 1
    return 2 * math.pi * k / RAYS, long_, RAY_TIP[i], RAY_HW[i]


def _centre_off(k, r):
    """How far (arc, square units) ray k's centreline sits off its straight line at radius r: only the short rays are wavy."""
    _, long_, tip, _ = ray_info(k)
    if long_:
        return 0.0
    u = (r - RAY_R0) / (tip - RAY_R0)
    return 0.011 * math.sin(2 * math.pi * 1.5 * u) * min(1.0, 3 * u) * (1 - 0.5 * u)


def ray_half_width(k, r):
    """Ray k's half width at radius r (0 outside its length); tapers to a point."""
    _, long_, tip, hw = ray_info(k)
    if r <= RAY_R0 or r >= tip:
        return 0.0
    u = (r - RAY_R0) / (tip - RAY_R0)
    return hw * (1 - u) ** (0.85 if long_ else 0.75) * (1 - 0.15 * u * u)


def sun_rays(n=RAYS, steps=24):
    """The ray outlines: n polygons of (x, y) points, ray k's centred on angle 2 pi k / n (n = RAYS gives the rays the
    disc carries, long and short alternating; fewer or more repeat that pattern). Down one side from the foot to the
    tip and back up the other."""
    out = []
    for k in range(n):
        kk = k % RAYS
        th = 2 * math.pi * k / n
        tip = ray_info(kk)[2]
        rs = [RAY_R0 + (tip - RAY_R0) * s / steps for s in range(steps + 1)]
        pts = []
        for sgn, seq in ((1, rs), (-1, rs[::-1])):   # one side out to the tip, the other back
            for r in seq:
                a = th + (_centre_off(kk, r) + sgn * ray_half_width(kk, r)) / r
                pts.append((r * math.cos(a), r * math.sin(a)))
        out.append(pts)
    return out


def relief(r, th):
    """The sun's height (square units) above the disc's flat top at radius r, angle th: a rim, a scribed circle, rays, a
    ring, a domed boss with a scribed face line. Negative where engraved."""
    if r >= DISC_R:
        return -EDGE_DROP
    if r > DISC_R - RIM_W:   # the rim: a raised lip, rolled over at the outer edge
        u = (r - (DISC_R - RIM_W)) / RIM_W
        h = RIM_H * _smooth(u / 0.25) * (1 - 0.35 * _smooth((u - 0.5) / 0.5))
        e = max(0.0, (r - (DISC_R - 0.008)) / 0.008)
        return h * (1 - e * e) - EDGE_DROP * e * e
    # hand-sculpted, not turned on a lathe (judge 2026-11-27: "razor-sharp, mathematically perfect"): a slow wobble
    # scaled by r, so the boss stays round (a fixed wobble made it an octagon)
    w_ = min(1.0, r / DISC_R) ** 2
    r = r + w_ * (0.0035 * math.sin(3 * th + 0.7) + 0.0025 * math.sin(7 * th + 2.1))
    th = th + w_ * 0.02 * math.sin(31 * r + 0.4)
    h = -SCRIBE_D * (1 - _smooth(abs(r - SCRIBE_R) / SCRIBE_W))   # the scribed circle
    k0 = int(round(th / (2 * math.pi / RAYS)))
    best = 0.0
    for k in (k0 - 1, k0, k0 + 1):   # the rays: only the nearest can reach
        kk = k % RAYS
        hw = ray_half_width(kk, r)
        if hw <= 0:
            continue
        d = _wrap(th - 2 * math.pi * kk / RAYS) * r - _centre_off(kk, r)
        best = max(best, RAY_H * _smooth((hw - abs(d)) / (1.8 * SOFT)) * (0.8 + 0.2 * min(1.0, (r - RAY_R0) / 0.03)))   # rays rounded over, not razor-cut
    h += best
    if SUN_RING_R0 < r < SUN_RING_R1:   # the thin ring round the boss
        m = (SUN_RING_R0 + SUN_RING_R1) / 2
        h += SUN_RING_H * math.sqrt(max(0.0, 1 - ((r - m) / ((SUN_RING_R1 - SUN_RING_R0) / 2)) ** 2))
    if r < BOSS_R + SOFT:   # the boss: a dome with a scribed face line
        d = math.sqrt(max(0.0, 1 - (r / (BOSS_R + SOFT)) ** 2))
        h += BOSS_H * d * _smooth((BOSS_R + SOFT - r) / SOFT) - 0.001 * (1 - _smooth(abs(r - FACE_R) / 0.005))   # a true dome (d ** 0.6 read as a flat cylinder), the face line only a hint
    return h
