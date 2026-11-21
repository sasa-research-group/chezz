# The king in check (Wesley 2026-11-20: "alert, maybe looking left and right, maybe looking a little nervous").
# A 2 s loop he plays while in check, made like the strike (strike_pose.py): key poses as guard_pose.py knobs,
# every frame between solved by guard_pose.py, both hands on the grip. Frame 0 and the last frame are the same pose,
# so it loops.
#   python3 check_pose.py OUT [--keys] [--render] [--jobs 6]
# writes OUT/fNN/guard.json per frame and OUT/check.json {fps, frames: [guard.json, ...], cycle: true}.
import json, os, sys, argparse
from concurrent.futures import ThreadPoolExecutor
import strike_pose as sp

# wary guard: hips a touch lower, more upright (leaning back from the threat), the blade drawn in and raised to
# cover his chest, elbows tucked
# 2026-11-20: blade held out in front (gy -0.44, tipped forward 30 deg); drawn in close it cut through his beard and
# crown as he turned his head (strike_check.py: up to 8 cm deep)
TENSE = dict(nervous=1, hips=0.15, lean=6, chin=6, stance=0.33, gx=-0.06, gy=-0.44, gz=0.52, tilt=22, fwd=30, shoulder=38)
LEFT = dict(TENSE, look=60, twist=-10, gx=-0.02)     # glances to the camera's right (his left)
RIGHT = dict(TENSE, look=-60, twist=10, gx=-0.12)    # snaps to the other side
KEYS = [
    (0, TENSE, "io"),
    (7, LEFT, "io"),      # slow, wary turn
    (15, LEFT, "io"),     # holds, staring
    (19, RIGHT, "in"),    # quick snap the other way: something moved
    (29, RIGHT, "io"),
    (32, dict(RIGHT, look=-48), "out"),  # small double-take
    (36, RIGHT, "io"),
    (47, TENSE, "io"),    # back to center = frame 0
]
FPS = 24
FRAMES = 48


def knobs_at(f):
    full = [(t, {**sp.GUARD, "look": 0, **k}, e) for t, k, e in KEYS]
    f = f % FRAMES
    for (t0, k0, _), (t1, k1, e1) in zip(full, full[1:]):
        if t0 <= f <= t1:
            u = sp.ease((f - t0) / (t1 - t0), e1)
            return {n: k0[n] + (k1[n] - k0[n]) * u for n in k0}
    return full[-1][1]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--keys", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    sp.knobs_at = knobs_at  # strike_pose.solve solves whatever knobs_at gives
    frames = [t for t, _, _ in KEYS] if a.keys else list(range(FRAMES - 1))  # last frame == frame 0
    with ThreadPoolExecutor(a.jobs) as ex:
        res = sorted(ex.map(lambda f: sp.solve(a.out, f, int(a.render)), frames))
    for f, m in res:
        print("frame %2d hand miss L %.3f R %.3f" % (f, *m))
    if not a.keys:
        clip = [json.load(open(os.path.join(a.out, "f%02d" % f, "guard.json"))) for f in frames]
        json.dump(dict(fps=FPS, cycle=True, keys=KEYS, frames=clip), open(os.path.join(a.out, "check.json"), "w"))
        print("WROTE", os.path.join(a.out, "check.json"), len(clip), "frames")
