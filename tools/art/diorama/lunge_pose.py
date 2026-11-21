# The patrol guard's capture (enemy pawn, Wesley 2026-11-21: "two-handed lunge"): from attention he takes the spear
# in both hands, levels it at the hip, draws back, steps in and drives it forward level, holds, and snaps back to
# attention where he landed. Hand-made key poses as in strike_pose.py; every frame is a whole guard_pose.py solve
# in its spear mode (spear=1: right hand at the rear, left in front, both on the shaft), so the fists never leave it.
#   python3 lunge_pose.py OUT [--keys] [--render] [--jobs 6]
# writes OUT/fNN/guard.json per frame and OUT/strike.json {fps, hit, travel, frames}, which bake_king_sprites.py
# --strike bakes unchanged (CHAR_GLB=the guard rig, PROP=the spear, NOCAPE=1: runlunge.sh).
import json, os, subprocess, sys, argparse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from strike_pose import ease  # noqa: E402

BLENDER = os.environ.get("BLENDER", "/Applications/Blender.app/Contents/MacOS/Blender")
P = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out")
ENV = dict(os.environ, CHAR_GLB=os.environ.get("CHAR_GLB") or P + "/guardrig/rigged_character_glb__rigged_character.glb",
           PROP_GLB=os.environ.get("PROP_GLB") or P + "/spear/model_glb__model.glb")
FPS = 24
# Ready ("port arms"): the spear held diagonally across his chest in both hands, head up at his left. His short arms
# can't reach across to the idle's upright spear (spear_pose.py, right fist at (-0.36, -0.10, 0.80)), so the idle
# cuts to this.
GAP = 0.30
READY = dict(spear=1, plen=2.0, pgrip=0.3, flen=0.10, fist=0.085, mitt=0.12, gap=GAP, gx=-0.05, gy=-0.25, gz=0.85,
             tilt=-30, fwd=0, roll=0, slide=0.0, wrist=0.05, shoulder=10, hips=0.0, lean=0, chin=4,
             stance=0.2, stagger=0.0, twist=0, air=0, ahead=0, tuck=0, step=0)
# the spear level at his hip, pointing ahead (-y; fwd=90 is level): the grip centre by his right hip
LEVEL = dict(gx=-0.16, gy=0.02, gz=0.74, fwd=88, tilt=-6, slide=0.0, hips=0.08, lean=6, chin=6, stance=0.26, stagger=0.06, twist=-12)
# drawn back: the shaft pulled back past his hip, the weight on the back foot, the chest turned away
DRAW = dict(LEVEL, gy=0.16, gz=0.76, twist=-22, lean=2, hips=0.12, stagger=0.10)
# the thrust: a long step in on the front (left) foot, the whole body behind it, the spear driven ahead level
STEP = dict(step=0.22, ahead=0.24)
THRUST = dict(LEVEL, gx=0.02, gy=-0.36, gz=0.80, gap=0.24, fwd=90, tilt=-2, twist=14, lean=24, chin=10, hips=0.16, stance=0.28, stagger=0.14,
              **STEP)
HOLD = dict(THRUST, gy=-0.38, lean=26, hips=0.17, ahead=0.25)
KEYS = [
    (0, {}, "io"),
    (5, LEVEL, "io"),
    (9, DRAW, "out"),
    (12, THRUST, "in"),  # the hit: the spear point arrives as the front foot lands
    (14, HOLD, "out"),
    (18, HOLD, "io"),
    (27, dict(ahead=0.25), "io"),  # back to attention where he landed
]
HIT = 12


def knobs_at(f):
    full = [(t, {**READY, **k}, e) for t, k, e in KEYS]
    for (t0, k0, _), (t1, k1, e1) in zip(full, full[1:]):
        if t0 <= f <= t1:
            u = ease((f - t0) / (t1 - t0), e1)
            return {n: k0[n] + (k1[n] - k0[n]) * u for n in k0}
    return full[-1][1]


def solve(out, f, render):
    d = os.path.join(out, "f%02d" % f)
    args = ["%s=%.5f" % kv for kv in knobs_at(f).items()] + ["render=%d" % render]
    r = subprocess.run([BLENDER, "-b", "--python", os.path.join(HERE, "guard_pose.py"), "--", d] + args,
                       capture_output=True, text=True, env=ENV)
    if not os.path.exists(os.path.join(d, "guard.json")):
        sys.exit("frame %d failed:\n%s" % (f, r.stdout[-2000:] + r.stderr[-2000:]))
    return f, [float(l.rsplit("miss", 1)[1]) for l in r.stdout.splitlines() if l.startswith("REACH")]


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
        json.dump(dict(fps=FPS, hit=HIT, travel=KEYS[-1][1].get("ahead", 0), keys=KEYS, frames=clip),
                  open(os.path.join(a.out, "strike.json"), "w"))
        print("WROTE", os.path.join(a.out, "strike.json"), len(clip), "frames")
