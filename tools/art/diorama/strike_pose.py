# The king's two-handed sword strike (his capture), as hand-made key poses (Wesley 2026-11-19: keyframed, not
# library mocap; both hands always on the grip). Each key is a set of guard_pose.py knobs; every frame between
# keys gets eased knobs and is solved by guard_pose.py itself, so both fists stay on the grip in every frame
# (slerping bone rotations between keys would let the hands drift off the sword).
#   python3 strike_pose.py OUT [--keys] [--render] [--jobs 6]
# writes OUT/fNN/guard.json per frame and OUT/strike.json {fps, frames: [guard.json, ...], hit: frame}.
# --keys solves only the key poses (to tune them), --render adds guard_pose's quick EEVEE views per frame.
import json, os, subprocess, sys, argparse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
FPS = 24
# the shipped idle guard (king_guard.json): the strike starts and ends here, so it cuts in and out cleanly
GUARD = dict(hips=0.1, lean=15, chin=15, stance=0.3, fist=0.09, shoulder=34, gx=-0.08, gy=-0.40, gz=0.42, tilt=28,
             wrist=0.08, fwd=10, gap=0.125, mitt=0.12, twist=0, roll=0, air=0, ahead=0, tuck=0, step=0)
# (frame, knobs changed from the guard, ease into this key). Ease: "io" smooth, "in" speeds up (the chop), "out"
# slows down (settling).
# Wesley 2026-11-20: "putting his whole body into it ... maybe even jump into the swing". So: crouch, leap with
# the blade raised behind his head, land into the chop with his whole weight (knees deep, leaning in), hold, rise.
# He ends AHEAD of where he started (the leap carries him): strike.json "travel" tells the game how far.
JUMP = dict(air=0, ahead=0.30, tuck=0, step=0.08)
CHOP = dict(gx=-0.04, gy=-0.58, gz=0.50, tilt=4, fwd=112, roll=90, lean=34, chin=10, hips=0.20, twist=0, **JUMP)
FOLLOW = dict(CHOP, gy=-0.52, gz=0.42, fwd=124, lean=36, hips=0.22, ahead=0.32)
KEYS = [
    (0, {}, "io"),
    # crouch to spring: knees deep, leaning in, the blade lifted upright in front of his face (so it never sweeps
    # back through his head, strike_check.py)
    (5, dict(gx=-0.20, gy=-0.46, gz=0.62, tilt=32, fwd=0, roll=20, lean=22, chin=22, hips=0.20, stance=0.32), "io"),
    # top of the leap: off the ground, feet tucked, back arched, the blade raised high and upright beside his head
    (9, dict(gx=-0.27, gy=-0.40, gz=0.98, tilt=14, fwd=-14, roll=30, lean=-6, chin=22, hips=0.0, twist=20, air=0.28, ahead=0.12,
             tuck=0.16), "out"),
    # landing on the hit: the blade chops down in front of him as his feet land, whole body into it
    (12, CHOP, "in"),
    # follow-through: he sinks deeper and the tip drops toward the floor; held for a beat
    (14, FOLLOW, "out"),
    (19, FOLLOW, "io"),
    # rises back into the guard where he landed
    (28, dict(ahead=0.32), "io"),
]
HIT = 12


def ease(u, kind):
    if kind == "in":
        return u * u
    if kind == "out":
        return 1 - (1 - u) * (1 - u)
    return u * u * (3 - 2 * u)


def knobs_at(f):
    full = [(t, {**GUARD, **k}, e) for t, k, e in KEYS]
    for (t0, k0, _), (t1, k1, e1) in zip(full, full[1:]):
        if t0 <= f <= t1:
            u = ease((f - t0) / (t1 - t0), e1)
            return {n: k0[n] + (k1[n] - k0[n]) * u for n in k0}
    return full[-1][1]


def solve(out, f, render):
    d = os.path.join(out, "f%02d" % f)
    kn = knobs_at(f)
    args = ["%s=%.5f" % kv for kv in kn.items()] + ["render=%d" % render]
    r = subprocess.run([BLENDER, "-b", "--python", os.path.join(HERE, "guard_pose.py"), "--", d] + args,
                       capture_output=True, text=True)
    miss = [l for l in r.stdout.splitlines() if l.startswith("REACH")]
    if not os.path.exists(os.path.join(d, "guard.json")):
        sys.exit("frame %d failed:\n%s" % (f, r.stdout[-2000:] + r.stderr[-2000:]))
    return f, [float(l.rsplit("miss", 1)[1]) for l in miss]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--keys", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    frames = [t for t, _, _ in KEYS] if a.keys else list(range(KEYS[-1][0] + 1))
    with ThreadPoolExecutor(a.jobs) as ex:
        res = sorted(ex.map(lambda f: solve(a.out, f, int(a.render)), frames))
    for f, m in res:
        print("frame %2d hand miss L %.3f R %.3f" % (f, *m))
    if not a.keys:
        clip = [json.load(open(os.path.join(a.out, "f%02d" % f, "guard.json"))) for f in frames]
        json.dump(dict(fps=FPS, hit=HIT, travel=KEYS[-1][1].get("ahead", 0), keys=KEYS, frames=clip), open(os.path.join(a.out, "strike.json"), "w"))
        print("WROTE", os.path.join(a.out, "strike.json"), len(clip), "frames")
