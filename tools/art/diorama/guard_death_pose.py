# The patrol guard's death when he is taken (enemy pawn; Wesley 2026-11-21 picked "quick back fall": about a
# second, he gets hit, drops the spear, falls flat on his back with X eyes; the king's death, short, since it plays
# on every capture). Made like death_pose.py: key poses as guard_pose.py knobs (spear=1; fall: tip back about the
# heels, let: hands off the shaft, drop: the spear to the floor), every frame solved by guard_pose.py.
#   python3 guard_death_pose.py OUT [--keys] [--render] [--jobs 8]
# writes OUT/fNN/guard.json per frame and OUT/death.json {fps, frames, hit: 0}; rundeath.sh bakes it with
# FIGURE=guard (his rig, the spear, his face: nervous_face.use("guard")).
#
# Reference (the animation-reference skill): the king's death, which Wesley approved after five drafts, is the
# reference for the feel: the blow throws him back with his hands up and the weapon slips away, he teeters, then
# topples stiffly onto his back, bounces once and lies still, face to the camera. Here it is cut to its essentials:
#   frame  0  the blow lands (the game starts this on the taker's hit frame): already reeling, hands off the shaft
#          4  thrown back on his heels, hands up in shock, chin up (woe face)
#          8  a beat on his heels, teetering
#         15  lands flat on his back (X eyes from here), head and shoulders raised so the face reads from above
#         18  a small bounce
#         22  still, head rolled to one side; held to 25
# The spear leaves his hand at frame 0 from where the idle holds it (upright at his right side, pawn_guard.json:
# the death cuts from the idle on the blow) and falls flat by his right side, along him.
import json, os, argparse
from concurrent.futures import ThreadPoolExecutor
import lunge_pose as lp
from mathutils_free import held_knobs

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 24
LAND = 15
# the base: the lunge's two-handed spear setup (his rig, the spear's length and grip), hands already off it
BASE = dict(lp.READY, let=1.0, lx=0.62, ly=0.10, lz=0.92, fall=0.0, look=0.0, nervous=0.0, drop=0.0, clat=0.0,
            sdx=-0.58, sdy=-0.05, slay=172.0, floor=0.0)
KEYS = [
    (0, dict(fall=5, chin=22, lean=4, hips=0.06, lx=0.50, ly=-0.10, lz=1.00), "io"),
    (4, dict(fall=12, chin=30, lean=2, hips=0.10, lx=0.40, ly=-0.20, lz=1.20), "out"),
    (8, dict(fall=16, chin=26, lean=2, hips=0.10, lx=0.55, ly=-0.10, lz=1.30), "io"),
    # topples over backward, stiff as a board, speeding up (ease in) like a falling thing
    (LAND, dict(fall=88, chin=0, lean=24, hips=0.0, lx=0.62, ly=0.10, lz=0.92), "in"),
    (18, dict(fall=80, chin=0, lean=20, hips=0.0), "out"),
    (22, dict(fall=88, chin=0, lean=30, hips=0.0, look=14), "io"),
    (25, dict(fall=88, chin=0, lean=30, hips=0.0, look=14), "io"),
]
RELEASE, FALL_F = 0, 8  # the spear falls (gravity) for FALL_F frames from the blow
HELD = held_knobs(json.load(open(os.path.join(HERE, "pawn_guard.json")))["sword_world"])
# the blow knocks it out of his hand: it starts falling a hand's width further out than the idle holds it (the jump
# hides in the impact frame), so his right arm flung up clears it
HELD["hx"] -= 0.14


def face_at(f):
    """nervous_face mood by number (guard_pose's nervous knob): woe from the blow, dead once he lands"""
    return 2 if f < LAND else 3


def knobs_at(f):
    from strike_pose import ease
    full = [(t, {**BASE, **k}, e) for t, k, e in KEYS]
    k = full[-1][1]
    for (t0, k0, _), (t1, k1, e1) in zip(full, full[1:]):
        if t0 <= f <= t1:
            u = ease((f - t0) / (t1 - t0), e1)
            k = {n: k0[n] + (k1[n] - k0[n]) * u for n in k0}
            break
    drop = min(1.0, max(0.0, (f - RELEASE + 1) / FALL_F))  # already slipping on the blow's frame
    return {**k, "nervous": face_at(f), "drop": drop, "clat": 0.0, **HELD}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--keys", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--jobs", type=int, default=8)
    a = ap.parse_args()
    lp.knobs_at = knobs_at  # lunge_pose.solve solves whatever knobs_at gives, with the guard's rig and spear
    frames = [t for t, _, _ in KEYS] if a.keys else list(range(KEYS[-1][0] + 1))
    with ThreadPoolExecutor(a.jobs) as ex:
        list(ex.map(lambda f: lp.solve(a.out, f, int(a.render)), frames))
    if not a.keys:
        clip = [json.load(open(os.path.join(a.out, "f%02d" % f, "guard.json"))) for f in frames]
        json.dump(dict(fps=FPS, hit=0, land=LAND, keys=KEYS, frames=clip), open(os.path.join(a.out, "death.json"), "w"))
        print("WROTE", os.path.join(a.out, "death.json"), len(clip), "frames")
