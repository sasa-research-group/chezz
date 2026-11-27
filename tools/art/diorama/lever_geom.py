# The lever square's shapes. Look A (Wesley 2026-11-26, ~/.dos/scratch/d84406ef/lever/a-up.png): a big chunky floor
# lever, a stout round oak handle with a dark iron ball knob. Base (Wesley 2026-11-27): no stone block. The handle
# comes straight up out of a slot in the middle of the square's own floor, lined by a riveted iron plate; its pin
# runs across the slot just under the floor. (The block's base was why a king pulling it sank his robe into it, and
# the chain and crack hung off the block.) Pure geometry here (no bpy); lever_parts.py builds the meshes,
# build_lever_cycles.py renders them in the set.
#
# Units as gate_geom: one square = 1, the square's centre at x = y = 0 on the floor (z = 0). x runs left to right on
# screen, y away from the camera (the back), z up. A figure is H = 1 / 1.2 squares tall and stands at the centre.
#
# Nobody stands on the lever's square: a piece on the square beside it pulls it (docs/puzzles.md). The handle pivots
# on a pin running front to back and tips left or right (along x), THROW_DEG from upright.
import math, random

H = 1 / 1.2
HALF = 0.5                    # the square's edges
EL = math.radians(35.0)       # the play camera's elevation (level_camera.EL): for the on-screen checks

# the slot in the floor and its iron plate, centred on the square
SLOT_L = 0.30                 # along x (the throw): the handle meets its ends at the full throw (the stop)
SLOT_W = 0.15                 # across (y)
SLOT_DEPTH = 0.20             # its black floor below the floor
PLATE_L = 0.40   # a thin frame round the slot (blind judge 2026-11-27: the 0.50 x 0.30 plate read as a rusty patch)
PLATE_W = 0.23
PLATE_T = 0.022               # how far it stands proud of the floor
PLATE_SINK = 0.02             # how far its edges go down into the slab (an uneven slab never shows a gap under it)
RIVETS = ([(x, sy * (PLATE_W / 2 - 0.02)) for x in (-0.13, 0.0, 0.13) for sy in (-1, 1)]
          + [(sx * (PLATE_L / 2 - 0.025), 0.0) for sx in (-1, 1)])   # eight, on the rim's middle
RIVET_R = 0.018

# the handle, on its pivot pin
PIVOT = (0.0, 0.0, -0.06)     # the pin's middle: across the slot, a little under the floor
PIN_R = 0.024
HANDLE_R = 0.065              # stout: a dowel about an eighth of the square across
HANDLE_LEN = 0.62             # pivot to the handle's top end (under the knob): at rest the knob is at a chibi king's shoulder
BUTT = 0.05                   # the handle runs on below the pivot, into the slot
KNOB_R = 0.115
KNOB_SINK = 0.25              # the handle's end sits this far (of KNOB_R) into the ball
THROW_DEG = 35.0

STATES = {"left": 0.0, "right": 1.0}
SIZE = 0.75                   # the game draws all of the above at this scale, about the square's centre (Wesley 2026-11-27:
                              # "just a little too big"); build_lever_cycles --size


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


def plate_box():
    return (-PLATE_L / 2, PLATE_L / 2, -PLATE_W / 2, PLATE_W / 2, -PLATE_SINK, PLATE_T)


def slot_box():
    return (-SLOT_L / 2, SLOT_L / 2, -SLOT_W / 2, SLOT_W / 2, -SLOT_DEPTH, PLATE_T)


def screen_up(x, y, z):
    """How high a point sits on screen (along the camera's up, in square units, up to a constant): the camera looks
    down EL toward +y, so further back and higher both read higher."""
    return z * math.cos(EL) + y * math.sin(EL)


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


def sheet_t():
    """The baked sheet's frames (build_lever_cycles.py --bake): the throw right (frames 0..THROW_FRAMES-1, from
    resting left), then the throw left (from resting right). Frame 0 shows it resting left, frame THROW_FRAMES resting
    right, so the game shows a lever at rest on its first frame of the way it will next be thrown."""
    return [throw_frame(k, True) for k in range(THROW_FRAMES)] + [throw_frame(k, False) for k in range(THROW_FRAMES)]
