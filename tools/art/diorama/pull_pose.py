# The king pulls a lever (Wesley 2026-11-27: a piece pulls a lever from the square beside it, the side it leans away
# from, and stays put; every figure gets its own pull). One draft, "one": the sword hangs point-down in one hand
# while the other pulls (the signalman's pull). A second draft, "heave" (sword planted, both hands on the handle),
# was dropped 2026-11-27: with the handle in the middle of the square no heave pose kept his body out of its path
# (Wesley: drop it, keep the one-hand pull).
# Reference pass (refclips/pull/TIMING.md, Goathland signal box): reach f13, grip f19, step back and lean f19-35, the
# lever stops f35-39, let go f39-57, about 1.8 s in all; the lever's own travel (~0.7 s) is the 16-frame throw of
# lever_geom.throw_t, which these clips play in step with (the lever sheet's frame = clip frame - GRIP).
#
# Chibi reach (measured, guard_pose POS): shoulders 0.71 up, arm about 0.48 long. The lever has no base (Wesley
# 2026-11-27): its handle comes out of a slot in the middle of its square, the knob at rest at his shoulder.
# From his own square it is out of reach, so he walks onto the edge of the lever's square beside the slot
# (the game walks him there), reaches up for the knob, and steps back as it comes over toward him.
#
# Frame: guard_pose's, his start (the stand-off point) at the origin, facing -y (toward the lever, which is to the
# WEST in the game: world +x is his +y, world +y (the back) his -x). Units: stage units, a square S = 1.2 H.
#   python3 pull_pose.py one OUT [--keys] [--render] [--jobs 6]
# writes OUT/fNN/guard.json per frame (and guard-view.png with --render) and OUT/pull.json.
import json, os, subprocess, sys, argparse, math
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lever_geom as lg

BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
FPS = 24
H = 1.7
S = 1.2 * H
FLOOR = -0.062                       # the standing guard's lowest point (guard_pose `floor`)
# the knob's line (his x): the lever's pin runs front to back through the square's centre (lever_geom.PIVOT), and
# the lever's y is his -x
KNOB_X = -lg.PIVOT[1] * lg.SIZE * S
# where he stands to pull, from the centre of his own square: a square on toward the lever, and 0.49 to the side of
# the knob's line (his +x here; FAR below mirrors it behind), so the handle comes over past his shoulder, not
# through him. (The keys were tuned with the knob's line at x = -0.413, behind the old block lever's back-half pin;
# OFF keeps each key in the same place against the knob.)
OFF = KNOB_X + 0.413
STAND = dict(ahead=S - 0.04, aside=0.08 + OFF)
GUARD = dict(hips=0.1, lean=15, chin=15, stance=0.3, fist=0.09, shoulder=34, gx=-0.08, gy=-0.40, gz=0.42, tilt=28,
             wrist=0.08, fwd=10, gap=0.125, mitt=0.12, twist=0, roll=0, look=0, rfree=0, lfree=0, spin=0, **STAND)
HIP = (0.004, -0.07)                 # his hips' centre in the solve frame (guard_pose POS Hips): what `spin` turns about


def lever_world(ang, s=None):
    """A point on the lever (its knob centre, or s along the handle from the pivot) at handle angle ang, in his
    frame: the lever square's centre is S ahead of his own square's centre."""
    x, y, z = lg.knob_centre(ang) if s is None else lg.axis_point(s, ang)
    wx, wy, wz = (v * lg.SIZE * S for v in (x, y, z))
    return (-wy, -S + wx, wz + FLOOR)


def lever_ang(k):
    """The handle's angle on lever-sheet frame k (thrown right, toward him: it rests leaning left, away)."""
    return lg.throw(lg.throw_frame(max(0, min(lg.THROW_FRAMES - 1, k)), True))


def handle_axis(ang):
    a = lever_world(ang, 0.0); b = lever_world(ang, lg.HANDLE_LEN)
    v = [q - p for p, q in zip(a, b)]; n = math.sqrt(sum(c * c for c in v))
    return [c / n for c in v]


def lever_knobs(ang):
    """guard_pose's stand-in lever (previews only), in the world after his moves."""
    pv = lever_world(ang, 0.0); kb = lever_world(ang)
    # the "block" is the iron plate round the slot, flat in the floor (lever_geom.plate_box): only a foot can touch it
    x0, x1, y0, y1, _, z1 = lg.plate_box()
    return dict(lever=1, lvx=pv[0], lvy=pv[1], lvz=pv[2] - FLOOR, lkx=kb[0], lky=kb[1], lkz=kb[2] - FLOOR,
                lbx=-(y0 + y1) / 2 * lg.SIZE * S, lby=-S + (x0 + x1) / 2 * lg.SIZE * S,
                lbw=(y1 - y0) * lg.SIZE * S, lbd=(x1 - x0) * lg.SIZE * S, lbh=z1 * lg.SIZE * S,
                lhr=lg.HANDLE_R * lg.SIZE * S, lkr=lg.KNOB_R * lg.SIZE * S)


# the grip on the handle, just under the knob
TOP = lg.HANDLE_LEN - 0.03
# the sword hanging point-down in his left hand, at his hip (one-hand pull)
SIDE = dict(gx=0.36, gy=-0.10, gz=0.30, tilt=-12, fwd=165, roll=0)

# Judge round 1 (2026-11-27, both drafts): the pull read (6.5/10) but had no weight (2/10): no anticipation, the
# lever gave at once, he stayed upright and his feet slid. So: a dip before the reach, the reference's unstick (he
# grips and strains back STRAIN frames before the lever gives), an overshoot back when it stops, and real steps
# (STEPS: each foot stays planted in the world and steps, lifting, over its own window; `ahead` alone slides them).
STRAIN = 6
VARIANTS = {
    "one": dict(
        GRIP=13, RELEASE=42,
        HANDS={"Right": TOP},
        STEPS=[("Left", 5, 10), ("Right", 8, 13), ("Left", 13, 21), ("Right", 21, 27), ("Left", 28, 34), ("Right", 36, 40)],
        KEYS=[
            (0, {}, "io"),
            # anticipation: a small dip as he sizes it up, the sword dropping to his left side
            (5, dict(SIDE, rfree=0.5, lean=18, chin=20, hips=0.15), "io"),
            # reach up for the knob, onto his toes
            (10, dict(SIDE, rfree=0.85, lean=26, chin=28, twist=-18, hips=0.05, spin=20, aside=STAND["aside"] + 0.04), "io"),
            # grip (GRIP): already half turned and a step out, both feet moved there while he reached (the
            # strain keeps his feet still, so a turn left for the strain only twisted his legs into the handle)
            (13, dict(SIDE, rfree=1, lean=26, chin=26, twist=-20, hips=0.10, spin=25, aside=STAND["aside"] + 0.05), "out"),
            # strain: he sits back against it, the lever holds (it gives at GRIP + STRAIN); from here on he turns
            # side-on (spin) and steps away from the knob's line (SIDESTEP), so the handle coming over toward him
            # passes in front of his robe (slot lever, 2026-11-27: max handle clip 0.064, his sleeve edge for 3 frames
            # at f15-17, hidden behind the handle from the game camera; was 0.096 over 10 frames)
            (19, dict(SIDE, rfree=1, lean=-8, chin=18, twist=-14, hips=0.24, stance=0.36, spin=40, aside=STAND["aside"] + 0.10), "io"),
            # it gives: the knob passes over the top, he comes up with it
            (25, dict(SIDE, rfree=1, lean=14, chin=26, twist=-14, hips=0.03, stance=0.34, spin=20, aside=STAND["aside"] + 0.08, ahead=STAND["ahead"] - 0.18), "io"),
            # drive back, the weight on the back foot
            (30, dict(SIDE, rfree=1, lean=-6, chin=14, twist=-10, hips=0.20, stance=0.36, spin=20, aside=STAND["aside"] + 0.12, ahead=STAND["ahead"] - 0.62), "io"),
            # the lever stops; his body carries on back
            (35, dict(SIDE, rfree=1, lean=-16, chin=8, twist=-8, hips=0.24, stance=0.36, spin=20, aside=STAND["aside"] + 0.16, ahead=STAND["ahead"] - 0.80), "out"),
            # and comes back upright
            (40, dict(SIDE, rfree=1, lean=2, chin=14, twist=-6, hips=0.12, spin=20, aside=STAND["aside"] + 0.16, ahead=STAND["ahead"] - 0.84), "io"),
            # let go: the hand back on the sword, into the guard
            (46, dict(aside=STAND["aside"] + 0.16, ahead=STAND["ahead"] - 0.84), "io"),
            (52, dict(aside=STAND["aside"] + 0.16, ahead=STAND["ahead"] - 0.84), "io"),
        ]),
}

# Judge round 2: it reads (8/10 one hand) but still weightless (2/10); from behind the robe hides the spine's lean.
# So the strain is longer (STRAIN_MORE frames more, every later key and step moved along) and he trembles in it.
STRAIN_MORE, TREMBLE = 4, (0.018, 3.0, 2.5)   # extra frames; tremble's hips drop, lean degrees, period (frames)
for _V in VARIANTS.values():
    _g = _V["GRIP"]
    _V["KEYS"] = [(t + STRAIN_MORE if t > _g else t, k, e) for t, k, e in _V["KEYS"]]
    _V["STEPS"] = [(sd, t0 + STRAIN_MORE, t1 + STRAIN_MORE) if t0 > _g else (sd, t0, t1) for sd, t0, t1 in _V["STEPS"]]
    _V["RELEASE"] += STRAIN_MORE
STRAIN += STRAIN_MORE

# Wesley 2026-11-27, after the first drafts: from the game camera (in front of the row) he stood between the camera
# and the lever and hid it. So he pulls from BEHIND it: the keys above are written for the front side and FAR
# mirrors them across the knob's line (x = KNOB_X): `aside` mirrors, `spin` turns the other way, the hands swap (the
# LEFT hand pulls, the sword stays in his right).
FAR = os.environ.get("PULL_SIDE", "far") == "far"   # PULL_SIDE=near: the old front-side drafts
assert abs(KNOB_X - lever_world(lever_ang(0))[0]) < 1e-9
SIDE_R = dict(gx=-0.36, gy=-0.10, gz=0.30, tilt=-12, fwd=165, roll=0)   # the sword point-down in his right hand


def _mirror(k):
    k = dict(k)
    if all(k.get(n) == SIDE[n] for n in SIDE):
        k.update(SIDE_R)
    if "aside" in k:
        k["aside"] = 2 * KNOB_X - k["aside"]
    if "spin" in k:
        k["spin"] = -k["spin"]
    if "rfree" in k or "lfree" in k:
        k["rfree"], k["lfree"] = k.pop("lfree", 0), k.pop("rfree", 0)
    return k


if FAR:
    STAND["aside"] = 2 * KNOB_X - STAND["aside"]
    GUARD["aside"] = STAND["aside"]
    for _V in VARIANTS.values():
        _V["KEYS"] = [(t, _mirror(k), e) for t, k, e in _V["KEYS"]]
        _V["HANDS"] = {("Left" if sd == "Right" else "Right"): s for sd, s in _V["HANDS"].items()}


def ease(u, kind):
    if kind == "in":
        return u * u
    if kind == "out":
        return 1 - (1 - u) * (1 - u)
    return u * u * (3 - 2 * u)


def knobs_at(v, f):
    keys = VARIANTS[v]["KEYS"]
    full = [(t, {**GUARD, **k}, e) for t, k, e in keys]
    kn = full[-1][1]
    for (t0, k0, _), (t1, k1, e1) in zip(full, full[1:]):
        if t0 <= f <= t1:
            u = ease((f - t0) / (t1 - t0), e1)
            kn = {n: k0[n] + (k1[n] - k0[n]) * u for n in k0}
            break
    kn = dict(kn); g = VARIANTS[v]["GRIP"]
    if g < f < g + STRAIN:  # the tremble, fading in and out
        w = math.sin(math.pi * (f - g) / STRAIN) * math.sin(2 * math.pi * (f - g) / TREMBLE[2])
        kn["hips"] += TREMBLE[0] * abs(w); kn["lean"] += TREMBLE[1] * w
    return kn


FOOT0_Y, STAGGER, LIFT = -0.067, 0.13, 0.07   # guard_pose's rest feet (POS) and its default stagger; a step's lift


def foot_home(kn, side):
    """Where guard_pose puts this foot by itself (his frame before the moves)."""
    sx = 1 if side == "Left" else -1
    return (sx * kn["stance"], FOOT0_Y + (-STAGGER if side == "Left" else 0.4 * STAGGER))


def to_world(kn, p):
    """A point in his frame before the moves, where the moves (spin about his hips, then ahead / aside) put it."""
    a = math.radians(kn["spin"]); ca, sa = math.cos(a), math.sin(a)
    x, y = p[0] - HIP[0], p[1] - HIP[1]
    return (HIP[0] + ca * x - sa * y + kn["aside"], HIP[1] + sa * x + ca * y - kn["ahead"])


def from_world(kn, w):
    a = math.radians(-kn["spin"]); ca, sa = math.cos(a), math.sin(a)
    x, y = w[0] - kn["aside"] - HIP[0], w[1] + kn["ahead"] - HIP[1]
    return (HIP[0] + ca * x - sa * y, HIP[1] + sa * x + ca * y)


def feet(v, f):
    """Each foot's offset from where guard_pose would put it: planted where it last landed, and on its steps moving
    (eased, lifted) to where the body's pose at the step's end puts it."""
    V = VARIANTS[v]; kn = knobs_at(v, f); out = {}
    for side in ("Left", "Right"):
        land = to_world(knobs_at(v, 0), foot_home(knobs_at(v, 0), side)); w, lift = land, 0.0
        for sd, t0, t1 in V["STEPS"]:
            if sd != side or f < t0:
                continue
            k1 = knobs_at(v, t1); end = to_world(k1, foot_home(k1, side))
            if f >= t1:
                land = end; w = end; continue
            u = ease((f - t0) / (t1 - t0), "io")
            w = (land[0] + (end[0] - land[0]) * u, land[1] + (end[1] - land[1]) * u)
            lift = LIFT * math.sin(math.pi * (f - t0) / (t1 - t0))
            break
        else:
            w = land
        p = from_world(kn, w); h = foot_home(kn, side)
        out[side] = (p[0] - h[0], p[1] - h[1], lift)
    return out


def frame_knobs(v, f):
    """Everything guard_pose needs on clip frame f: the eased key knobs, then the hands on the lever (they follow
    its handle frame by frame while he holds it) and the stand-in lever."""
    V = VARIANTS[v]
    kn = knobs_at(v, f)
    k = f - V["GRIP"] - STRAIN  # lever_ang clamps: at rest until it gives
    ang = lever_ang(k)
    shift = (kn["aside"], -kn["ahead"])
    # spin turns his whole body (hands, sword and fists with it) about his hips after the solve, so every world
    # target is turned back by -spin about that centre before it goes to the solve
    cx, cy = shift[0] + HIP[0], shift[1] + HIP[1]
    ca, sa = math.cos(math.radians(-kn["spin"])), math.sin(math.radians(-kn["spin"]))
    def unspin(x, y):
        return cx + ca * (x - cx) - sa * (y - cy) - shift[0], cy + sa * (x - cx) + ca * (y - cy) - shift[1]
    ax = handle_axis(ang)
    ax = (ca * ax[0] - sa * ax[1], sa * ax[0] + ca * ax[1], ax[2])
    for side, s in V["HANDS"].items():
        c = "r" if side == "Right" else "l"
        p = lever_world(ang, s)
        tx, ty = unspin(p[0], p[1])
        kn.update({c + "tx": tx, c + "ty": ty, c + "tz": p[2], c + "ax": ax[0], c + "ay": ax[1], c + "az": ax[2]})
    kn["fgr"] = lg.HANDLE_R * lg.SIZE * S
    for side, (dx, dy, dz) in feet(v, f).items():
        c = "r" if side == "Right" else "l"
        kn.update({c + "fx": dx, c + "fy": dy, c + "fz": dz})
    kn.update(lever_knobs(ang))
    # the game view of a west-facing figure: the camera at his left (+x), aimed between him and the lever
    kn.update(cam_az=90, cam_tx=(-0.45 if FAR else 0.4), cam_ty=-S + 0.5, cam_d=5.2)
    return kn


def solve(v, out, f, render):
    d = os.path.join(out, "f%02d" % f)
    kn = frame_knobs(v, f)
    args = ["%s=%.5f" % kv for kv in kn.items()] + ["render=%d" % (2 if render else 0)]
    r = subprocess.run([BLENDER, "-b", "--python", os.path.join(HERE, "guard_pose.py"), "--", d] + args,
                       capture_output=True, text=True)
    miss = [l for l in r.stdout.splitlines() if l.startswith("REACH")]
    if not os.path.exists(os.path.join(d, "guard.json")):
        sys.exit("frame %d failed:\n%s" % (f, r.stdout[-2000:] + r.stderr[-2000:]))
    clip = [l for l in r.stdout.splitlines() if l.startswith("CLIP")]
    return f, [float(l.rsplit("miss", 1)[1]) for l in miss] + [float(x) for x in clip[0].split()[2::2]]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("variant", choices=sorted(VARIANTS))
    ap.add_argument("out")
    ap.add_argument("--keys", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    V = VARIANTS[a.variant]
    frames = [t for t, _, _ in V["KEYS"]] if a.keys else list(range(V["KEYS"][-1][0] + 1))
    with ThreadPoolExecutor(a.jobs) as ex:
        res = sorted(ex.map(lambda f: solve(a.variant, a.out, f, a.render), frames))
    for f, m in res:
        print("frame %2d hand miss L %.3f R %.3f  clip block %.3f handle %.3f knob %.3f" % (f, *m))
    if not a.keys:
        clip = [json.load(open(os.path.join(a.out, "f%02d" % f, "guard.json"))) for f in frames]
        end = V["KEYS"][-1][1]
        json.dump(dict(fps=FPS, variant=a.variant, grip=V["GRIP"], release=V["RELEASE"], stand=STAND,
                       back=STAND["ahead"] - end.get("ahead", STAND["ahead"]), keys=V["KEYS"], frames=clip),
                  open(os.path.join(a.out, "pull.json"), "w"))
        print("WROTE", os.path.join(a.out, "pull.json"), len(clip), "frames")
