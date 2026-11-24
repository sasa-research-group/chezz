# The rebel rook's capture (Wesley 2026-11-23, option A of rook/attack/attack-options.jpg: "overhead slam"), one
# hand since v7: from his shoulder carry he reaches back, the hammer head cocked behind his shoulders, swings it over
# the top and slams it down ahead of him in a deep squat, holds, then heaves it back onto his shoulder where he landed.
# The wrist stays in line with the arm through the swing (lock=1, wa: see v8 below).
# Hand-made key poses as lunge_pose.py; every frame is a whole rook_pose.py solve. The hammer's line is set by angles
# (th, psi) and the fists pivot at the wrists (wlx, wly, wlz: the idle's wrist in the left fist's frame), so the hand
# meshes built for frame 0 stay joined to the forearms in every frame.
#   python3 rook_strike.py OUT [--keys] [--render] [--jobs 6] [--only 0,14]
# writes OUT/fNN/rook_pose.json per frame and OUT/strike.json {fps, hit, travel, frames}, which bake_king_sprites.py
# --strike bakes (runrookstrike.sh).
import json, os, subprocess, sys, argparse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from strike_pose import ease  # noqa: E402

BLENDER = os.environ.get("BLENDER", "/Applications/Blender.app/Contents/MacOS/Blender")
FPS = 24
H = 1.7  # his height in the rig's units (rook_pose.py prints HEIGHT)
# the idle (rook_pose.py defaults), its hammer line as angles and its wrist in the left fist's frame
IDLE = dict(gx=0.08, gy=-0.10, gz=0.04, th=161.3, psi=-41.9, wlx=-0.01445, wly=-0.03030, wlz=-0.01997,
            rw=0.0, rs=0.45, px=0.3, py=-0.3, lpz=-1.0, rpx=-0.4, rpy=1.0, rpz=-0.3,
            hips=0.0, lean=0.0, step=0.0, ahead=0.0, chin=0.0, roll=0.0, stance=0.10, sit=0.0, rbx=0.14, rby=0.20, twist=0.0,
            yaw=0.0, look=0.6, rax=0.16, ray=0.04, raz=-0.02, lock=0.0, wa=92.0)
# Reference pass (animation-reference skill, 2026-11-23): YourSportsTrainer "Sledge Hammer Overhead Slam" (side-on
# drill, real speed, 8.4-10.4 s at 24 fps) and "Slow Motion Sledgehammer" (3/4, slowed); clips and sheets in scratch
# rook/attack/ref/. What the reference does, and how the rook adapts it:
# | key   | ref frame (drill) | our frame | body                                   | hands / hammer                          |
# |-------|-------------------|-----------|----------------------------------------|-----------------------------------------|
# | start | 1                 | 0         | standing                               | ours starts in the shoulder carry       |
# | dip   | 1-7               | 4-5       | crouch: knees bend, hips down, lean in | hammer low at his side; OURS: still on  |
# |       |                   |           |                                        | the shoulders (a side swing cuts his    |
# |       |                   |           |                                        | arm: short arms), a push-press load     |
# | lift  | 9-15              | 7         | drives up out of the crouch            | big arc up; top hand slides to the head |
# | peak  | 19-23             | 10-11     | tall, arched back, chin up             | head drops behind; OURS: fists in front |
# |       |                   |           |                                        | of the helm (short arms), 1 f hang      |
# | drive | 23-27 (4-5 f)     | 11-15     | hips shoot BACK, knees bend, back flat | top hand slides down to the bottom hand |
# | hit   | 28-29             | 15        | torso ~40 deg forward, sitting back    | hands together at the butt, arms long   |
# | hold  | 29-35             | 16-19     | small bounce then still                | head on the floor                       |
# | back  | 37-47             | 20-29     | stands                                 | OURS: heaved back onto the shoulders    |
# (Wesley 2026-11-23: the first keys lacked the wind-up; the dip is the reference's frames 1-7.)
# Measured: timing and silhouette. Adapted: his fists are 0.19 long on a 1.19 handle, so the hands can't touch; at
# the hit the right fist sits on the butt end beside the left (stacked fists read as a two-hand grip), and his
# short arms can't get the hands behind the helm at the peak. The step in (ahead) is ours: he lands on the target.
# v7 (Wesley 2026-11-23): one hand. His arms are about half the reach a two-hand sledge swing needs, so with both
# hands on the handle his fists bunch at the belly and the big arms crush together or clip whatever the pose (v5, v6
# rejected). The left hand swings it alone and the whole swing stays on its own (left) side, so the arm never crosses
# his chest; the right arm hangs free for balance. The torso still turns (his note on v5): yaw and twist negative
# turn him to his left, right shoulder forward, for the back swing; he unwinds square for the blow.
L_UP = dict(px=1.0, py=-0.2, lpz=-0.6)  # left elbow out and down: raised arm
L_LOW = dict(px=0.6, py=0.3, lpz=-1.0)
FREE = dict(rw=0.0, rax=0.20, raz=0.02)  # right arm a little out from the hip
# v8 (Wesley 2026-11-23: "the wrist doesn't break from the arm"). Second reference pass, one-handed sledge swings
# (scratch rook/attack/ref/one): the arm stays long and the handle carries on from the forearm like one lever; the
# wrist never folds. One cycle is ~1.6 s: hit with the arm out ahead, the hammer drops and swings back past his side
# (a pendulum, arm straight), up behind and over his head tall, then down into a deep squat for the next hit.
# So every swing key locks the wrist (lock=1): the fist holds the handle at wa=35 deg off the forearm and the hammer
# line follows the arm (th/psi only aim it). A free low hang would put the head through the floor (his handle is
# 0.7 of his height), so the swing goes straight from out ahead to back past his side.
LK = dict(lock=1.0, wa=35.0)
START = dict()
# v9 (Wesley 2026-11-23): no pendulum start. One-handed, he goes straight from the shoulder carry to reaching back,
# the hammer head cocked behind his shoulders, then over the top and down.
COCK = dict(L_UP, **FREE, lock=1.0, wa=45.0, yaw=-35.0, twist=-18.0, lean=-8.0, chin=4.0, gx=0.06, gy=0.16, gz=0.24,
            th=190.0, psi=0.0)  # 190, not -170: interpolation must go the short way round
# overhead, tall, arm long, the hammer carrying on straight up from it
TOP = dict(L_UP, **FREE, **LK, yaw=-30.0, twist=-15.0, lean=-6.0, chin=6.0, gx=0.04, gy=0.04, gz=0.34, th=110.0,
           psi=0.0, ahead=0.06)
# the blow: square again, deep squat, arm long and forward-down, the head on the floor ahead of him
HIT_ = dict(L_LOW, **FREE, **LK, lean=32.0, chin=-8.0, hips=0.08, sit=0.06, step=0.05, gx=-0.02, gy=-0.32, gz=-0.08,
            th=-35.0, psi=0.0, ahead=0.25, stance=0.13)
SNAP = dict(HIT_, lean=35.0, hips=0.09)  # one frame of overshoot sells the weight
HOLD = dict(HIT_, lean=30.0, hips=0.075)
# heaving it back up and onto the shoulder: the wrist eases back to the carry's square grip (wa 92)
HEAVE = dict(L_UP, **FREE, lock=1.0, wa=92.0, gx=-0.02, gy=-0.30, gz=0.10, th=140.0, psi=10.0, rs=0.30, lean=-2.0,
             chin=3.0, ahead=0.25, stance=0.12)
REST = dict(ahead=0.25)
KEYS = [
    (0, START, "io"),
    (4, COCK, "out"),  # off the shoulder and back: the head cocked behind his shoulders
    (7, COCK, "io"),  # hold the load
    (10, TOP, "io"),  # over the top, tall
    (14, HIT_, "in"),  # the hit: 4 frames of drive, accelerating
    (15, SNAP, "out"),
    (18, HOLD, "io"),
    (23, HEAVE, "io"),
    (24, HEAVE, "io"),
    (28, REST, "io"),  # back in his carry where he landed
]
HIT = 14


def knobs_at(f):
    full = [(t, {**IDLE, **k}, e) for t, k, e in KEYS]
    for (t0, k0, _), (t1, k1, e1) in zip(full, full[1:]):
        if t0 <= f <= t1:
            u = ease((f - t0) / (t1 - t0), e1)
            return {n: k0[n] + (k1[n] - k0[n]) * u for n in k0}
    return full[-1][1]


def solve(out, f, render):
    d = os.path.join(out, "f%02d" % f)
    args = ["%s=%.5f" % kv for kv in knobs_at(f).items()] + ["render=%d" % render]
    r = subprocess.run([BLENDER, "-b", "--python", os.path.join(HERE, "rook_pose.py"), "--", d] + args,
                       capture_output=True, text=True, env=os.environ)
    if not os.path.exists(os.path.join(d, "rook_pose.json")):
        sys.exit("frame %d failed:\n%s" % (f, r.stdout[-2000:] + r.stderr[-2000:]))
    keep = ("REACH", "WRIST", "LOCK", "CLIP_MAX", "FLOOR", "CLIP ")
    return f, [l for l in r.stdout.splitlines() if l.startswith(keep)]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--keys", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    frames = ([int(x) for x in a.only.split(",")] if a.only else [t for t, _, _ in KEYS] if a.keys
              else list(range(KEYS[-1][0] + 1)))
    with ThreadPoolExecutor(a.jobs) as ex:
        res = sorted(ex.map(lambda f: solve(a.out, f, int(a.render)), frames))
    for f, lines in res:
        print("frame %2d | %s" % (f, " | ".join(lines)))
    if not (a.keys or a.only):
        clip = [json.load(open(os.path.join(a.out, "f%02d" % f, "rook_pose.json"))) for f in frames]
        json.dump(dict(fps=FPS, hit=HIT, travel=KEYS[-1][1].get("ahead", 0) * H, keys=KEYS, frames=clip),
                  open(os.path.join(a.out, "strike.json"), "w"))
        print("WROTE", os.path.join(a.out, "strike.json"), len(clip), "frames")
