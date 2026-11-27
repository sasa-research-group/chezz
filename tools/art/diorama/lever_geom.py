# The lever square's shapes (Wesley 2026-11-26, look A from ~/.dos/scratch/d84406ef/lever/a-up.png): a big chunky
# floor lever, a stout round oak handle with a dark iron ball knob, pivoting in the slot of a chipped, mossy grey stone
# block; a rusty iron chain runs from the block's foot into a crack in the floor. Pure geometry here (no bpy);
# lever_parts.py builds the meshes, build_lever_cycles.py renders them in the set.
#
# Units as gate_geom: one square = 1, the square's centre at x = y = 0 on the floor (z = 0). x runs left to right on
# screen, y away from the camera (the back), z up. A figure is H = 1 / 1.2 squares tall and stands at the centre.
#
# The block sits in the BACK half of the square, centred left-right, so a figure on the square stands in front of it
# (one sprite layer under the figures will do). The handle pivots on a pin running front to back through the block
# and tips left or right (along x), THROW_DEG from upright; the knob then hangs out to the side, above the figure's
# head on screen.
import math, random

H = 1 / 1.2
HALF = 0.5                    # the square's edges
EL = math.radians(35.0)       # the play camera's elevation (level_camera.EL): for the on-screen checks

# the stone block
BLOCK_W = 0.46                # along x (the throw)
BLOCK_D = 0.32                # front to back
BLOCK_H = 0.28                # its top above the floor
BLOCK_Y = 0.27                # its centre: the back half; its front face at y = 0.11, its back 0.07 off the edge
BLOCK_SINK = 0.02             # sunk this far into the floor, so it never floats on an uneven slab
SLOT_L = 0.35                 # the slot along x
SLOT_W = 0.16                 # the slot across (y)
SLOT_FLOOR = 0.08             # the slot's bottom above the floor

# the handle, on its pivot pin
PIVOT = (0.0, BLOCK_Y, 0.16)  # the pin's middle: inside the block, under the slot
PIN_R = 0.024
HANDLE_R = 0.065              # stout: a dowel about an eighth of the square across (the draft's is chunkier still)
HANDLE_LEN = 0.52             # pivot to the handle's top end (under the knob)
BUTT = 0.05                   # the handle runs on below the pivot, into the slot
KNOB_R = 0.115
KNOB_SINK = 0.25              # the handle's end sits this far (of KNOB_R) into the ball
THROW_DEG = 35.0

# the chain
LINK_L = 0.110                # a link's outside length
LINK_W = 0.090                # its outside width
WIRE = 0.015                  # its wire radius
PITCH = LINK_L - 2 * WIRE     # link to link (each passes through the next's end)
ANCHOR = (-0.15, BLOCK_Y - BLOCK_D / 2 - 0.02, 0.06)  # the eye on the block's front face, low on the left
HOLE = (-0.26, -0.22)         # the crack the chain runs into
HOLE_R = 0.095
HOLE_DEPTH = 0.19             # how far under the floor the last link goes

STATES = {"left": 0.0, "right": 1.0}


CLEARANCE = 0.03              # the handle and knob keep this far (square units) from the set's trees, walls, stones
MIN_THROW_DEG = 15.0          # never less than this, however tight the square: the throw must still read


def throw(t, limits=None):
    """The handle's angle from upright (radians) at t of the throw, t 0 thrown left .. 1 thrown right: negative tips
    it left (toward -x). limits: (left, right) in degrees, for a square where the set is in the way (throw_limits);
    THROW_DEG both ways by default. Placeholder smoothstep; the real timing comes from a reference-clip pass."""
    t = max(0.0, min(1.0, t))
    s = t * t * (3 - 2 * t)
    left, right = limits or (THROW_DEG, THROW_DEG)
    return math.radians(right) * (2 * s - 1) if s >= 0.5 else math.radians(left) * (2 * s - 1)


def handle_gap(ang, dist, n=12):
    """How far the handle and knob, tipped ang, stay from the set: the least of dist(point) - radius along the
    handle's axis and at the knob's centre. dist(x, y, z): distance (square units, about the square's centre) from a
    point to the nearest set mesh (unsigned is enough for throw_limits, which steps out from upright)."""
    gaps = [dist(*axis_point(HANDLE_LEN * k / n, ang)) - HANDLE_R for k in range(n + 1)]
    gaps.append(dist(*knob_centre(ang)) - KNOB_R)
    return min(gaps)


def throw_limits(dist, clearance=CLEARANCE, step=0.5):
    """(left, right): the widest throw each way, up to THROW_DEG, that keeps clearance from the set at every angle on
    the way (dist as handle_gap). A square with a tree trunk at its edge (the near-right corner, 4,0) gets a shorter
    throw on that side only; open squares keep THROW_DEG. Never below MIN_THROW_DEG."""
    out = []
    for side in (-1, 1):
        deg = 0.0
        while deg + step <= THROW_DEG + 1e-9 and handle_gap(side * math.radians(deg + step), dist) >= clearance:
            deg += step
        out.append(max(deg, MIN_THROW_DEG))
    return tuple(out)


def axis_point(s, ang):
    """The point s along the handle's axis from the pivot (negative s: the butt below the pivot), tipped ang."""
    return (PIVOT[0] + s * math.sin(ang), PIVOT[1], PIVOT[2] + s * math.cos(ang))


def knob_centre(ang):
    return axis_point(HANDLE_LEN + KNOB_R * (1 - KNOB_SINK), ang)


def handle_box(ang):
    """The handle and knob's bounds: (xmin, xmax, ymin, ymax, zmin, zmax)."""
    pts = [axis_point(s, ang) for s in (-BUTT, HANDLE_LEN)]
    k = knob_centre(ang)
    xs = [p[0] for p in pts]; zs = [p[2] for p in pts]
    pad_x, pad_z = HANDLE_R * math.cos(ang), HANDLE_R * abs(math.sin(ang))
    return (min(min(xs) - pad_x, k[0] - KNOB_R), max(max(xs) + pad_x, k[0] + KNOB_R),
            PIVOT[1] - KNOB_R, PIVOT[1] + KNOB_R,
            min(min(zs) - pad_z, k[2] - KNOB_R), max(max(zs) + pad_z, k[2] + KNOB_R))


def slot_span(ang, z):
    """Where the handle crosses the height z: (x of its axis, half its width along x)."""
    return PIVOT[0] + (z - PIVOT[2]) * math.tan(ang), HANDLE_R / math.cos(ang)


def block_box():
    return (-BLOCK_W / 2, BLOCK_W / 2, BLOCK_Y - BLOCK_D / 2, BLOCK_Y + BLOCK_D / 2, -BLOCK_SINK, BLOCK_H)


def screen_up(x, y, z):
    """How high a point sits on screen (along the camera's up, in square units, up to a constant): the camera looks
    down EL toward +y, so further back and higher both read higher."""
    return z * math.cos(EL) + y * math.sin(EL)


def _path():
    """The chain's centre line, as a polyline of (x, y, z) in square units, z above the local floor: out of the eye
    on the block, down onto the floor, a slack curve out to the left (across the screen, so the links show their
    holes from above, as the draft's), then forward and down into the crack."""
    ax, ay, az = ANCHOR
    hx, hy = HOLE
    pts = [(ax, ay - 0.012, az), (ax - 0.012, ay - 0.04, 0.035), (ax - 0.035, ay - 0.06, WIRE * 1.2)]
    p0, c, e = (ax - 0.035, ay - 0.06), (-0.47, 0.06), (hx - HOLE_R * 0.1, hy + HOLE_R * 0.5)
    n = 16
    for k in range(1, n + 1):  # a quadratic curve: the slack of a chain dropped on the floor
        u = k / n
        x = (1 - u) ** 2 * p0[0] + 2 * u * (1 - u) * c[0] + u * u * e[0]
        y = (1 - u) ** 2 * p0[1] + 2 * u * (1 - u) * c[1] + u * u * e[1]
        pts.append((x, y, WIRE * 1.2))
    for k in range(1, 5):  # over the lip and down
        u = k / 4
        pts.append((hx + (e[0] - hx) * (1 - u), hy + (e[1] - hy) * (1 - u), WIRE * 1.2 - HOLE_DEPTH * u * u))
    return pts


def chain_links():
    """The chain's links from the eye to the crack: [{"c": (x, y, z), "d": (dx, dy, dz) unit, "roll": 0 | pi/2}],
    z above the local floor (the builder adds the slab's height under each link). Each link is PITCH from the last
    and turned a quarter about its length from its neighbours; roll 0 lies flat (ring in the floor's plane), pi/2
    stands up, lifted onto its edge where it lies on the floor."""
    pts = _path()
    seg = [(pts[k], pts[k + 1]) for k in range(len(pts) - 1)]
    lens = [math.dist(a, b) for a, b in seg]
    total = sum(lens)

    def at(s):
        for (a, b), L in zip(seg, lens):
            if s <= L:
                f = s / L
                return tuple(a[q] + (b[q] - a[q]) * f for q in range(3))
            s -= L
        return pts[-1]

    out, s, k = [], 0.0, 0
    while s + PITCH <= total + 1e-9:
        p0, p1 = at(s), at(s + PITCH)
        c = tuple((p0[q] + p1[q]) / 2 for q in range(3))
        d = tuple(p1[q] - p0[q] for q in range(3)); n = math.sqrt(sum(v * v for v in d)) or 1.0
        roll = 0.0 if k % 2 == 0 else math.pi / 2
        z = c[2]
        if z > 0 and roll:  # an upright link on the floor rests on its edge
            z = max(z, LINK_W / 2)
        out.append({"c": (c[0], c[1], z), "d": tuple(v / n for v in d), "roll": roll})
        s += PITCH; k += 1
    return out


def hole_outline(seed=11, n=14):
    """The crack's jagged mouth round HOLE: [(x, y)] counter-clockwise, radius HOLE_R give or take a third."""
    rng = random.Random(seed)
    out = []
    for k in range(n):
        a = 2 * math.pi * k / n + rng.uniform(-0.15, 0.15)
        r = HOLE_R * rng.uniform(0.7, 1.3) * (1.25 if k % 4 == 0 else 1.0)
        out.append((HOLE[0] + r * math.cos(a), HOLE[1] + r * math.sin(a) * 0.85))
    return out


def cracks(seed=12):
    """Hairline cracks running out of the hole across the slab: [{"pts": [(x, y)], "w": [width]}], tapering."""
    rng = random.Random(seed)
    out = []
    for ang, L in ((2.6, 0.2), (-2.2, 0.16), (0.5, 0.24), (-0.9, 0.14), (1.7, 0.12)):
        x, y = HOLE[0] + HOLE_R * math.cos(ang), HOLE[1] + HOLE_R * 0.8 * math.sin(ang)
        pts, ws = [(x, y)], [0.04]
        n = 7
        for q in range(1, n + 1):
            ang += rng.uniform(-0.45, 0.45)
            x += math.cos(ang) * L / n; y += math.sin(ang) * L / n
            x = max(-HALF + 0.02, min(HALF - 0.02, x)); y = max(-HALF + 0.02, min(HALF - 0.02, y))
            pts.append((x, y)); ws.append(0.04 * (1 - q / (n + 1)) + 0.006)
        out.append({"pts": pts, "w": ws})
    return out


KNOB_RUST = 0.6  # the knob's rust amount (Wesley 2026-11-26: the chain's full rust was "a little too rusty" on the ball)


def rust_band(rust_at, amount):
    """damp_iron's rust thresholds for a rust amount (1: full, the chain's; less: the patches shrink as both edges of
    the noise ramp move up, 0.12 per unit taken off)."""
    less = 1.0 - amount
    return (rust_at[0] + 0.12 * less, rust_at[1] + 0.12 * less)


# ---------------- the throw, as baked ----------------
# Reference pass (2026-11-26, scratch refclips/lever): "Pulling levers, Ropley signal box" (YouTube 9KoCm06IIEo,
# handheld, 30 fps; a signalman pulls a heavy frame lever toward him, s 30.0-31.3). A second clip (Banbury north
# interlocking, ElMxCLxROiw) shows only the locking bars under the floor: no use. Measured by eye on cropped sheets,
# the camera pans, so the times are rough:
#
# | key            | ref (s, 30 fps)   | ours (24 fps)  | lever                               |
# |----------------|-------------------|----------------|-------------------------------------|
# | grip, catch    | 0.0-0.4 (f 0-11)  | f 0-3          | barely moves; ours unsticks 1.5%     |
# | heave          | 0.4-0.6 (f 12-17) | f 3-6          | starts to tip, slow                  |
# | travel         | 0.6-0.95 (f 18-28)| f 6-12         | gathers speed as his weight goes back|
# | stop           | ~0.95 (f 28-30)   | f 12           | hard stop at the end of the slot     |
# | settle         | (still)           | f 13-15        | ours rebounds 4% and settles         |
#
# Ours is about 0.65 s against the clip's 1 s: the catch is shortened (no hand on our lever yet) and the gate it
# works waits for it. Either way of throwing has the same shape: throw_t(k) runs 0 -> 1 from the side it rests on.
THROW_FRAMES = 16
THROW_FPS = 24
THROW_COCK = (0.0, 0.0, 0.006, 0.015)     # frames 0-3: the catch frees and the handle unsticks (it rests against the
                                          # end of the slot, so it cannot cock back)
THROW_STOP = 12                           # the frame it hits the end of the slot
THROW_SETTLE = (0.96, 0.98, 1.0)          # frames 13-15


def throw_t(k):
    """How far through its throw (0 where it rested, 1 at the far end of the slot) the handle is on frame k."""
    if k < len(THROW_COCK):
        return THROW_COCK[k]
    if k >= THROW_STOP:
        return THROW_SETTLE[k - THROW_STOP - 1] if k > THROW_STOP else 1.0
    u = (k - (len(THROW_COCK) - 1)) / (THROW_STOP - (len(THROW_COCK) - 1))   # 0 at the cock's last frame .. 1 at the stop
    return THROW_COCK[-1] + (1 - THROW_COCK[-1]) * u * u * (1.6 - 0.6 * u)


def throw_frame(k, to_right):
    """The throw's t (0 thrown left .. 1 thrown right, as throw()) on frame k, throwing right or left."""
    return throw_t(k) if to_right else 1 - throw_t(k)
