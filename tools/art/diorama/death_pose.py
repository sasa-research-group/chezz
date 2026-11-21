# The king's death on checkmate (Wesley 2026-11-20: "takes a fatal blow and dies"; he picked the back fall): the
# mating blow hits him, he drops the sword, totters back and topples over onto his back, X eyes (see KEYS). Made like the strike (strike_pose.py): key poses as
# guard_pose.py knobs (fall: tip back about the heels, let: hands off the grip, drop: the sword to the floor), every
# frame solved by guard_pose.py. Plays once and holds the last frame.
#   python3 death_pose.py OUT [--keys] [--render] [--jobs 6]
# writes OUT/fNN/guard.json per frame and OUT/death.json {fps, frames: [guard.json, ...], hit: 0}.
import json, os, argparse
from concurrent.futures import ThreadPoolExecutor
import strike_pose as sp



def feet(b, L, R):
    """knobs that put his body `b` m back and his left/right feet L/R m back of where they stood in the guard
    (guard_pose: a foot's world y = its target y - ahead; the right target moves 0.4*stagger, the left -stagger-step)"""
    ds = (R - b) / 0.4
    return dict(ahead=-b, stagger=STAGGER + ds, step=b - ds - L)


STAGGER = 0.13  # guard_pose's default
# Wesley 2026-11-20 on draft 1: "stammer a little bit, look distraught, and maybe slowly stumble and fall back ...
# dramatic but kind of comedic ... his eyes should turn to X's when he dies". So: hit, a stunned look down at
# himself, the sword slips from his hands, hands up in shock; three tottering steps back with his arms flailing and
# his head wobbling; he teeters on his heels, catches himself for a beat, then slowly topples over backward.
# face: woe (open frown) from the hit, dead (X eyes, tongue out) from the moment he lands.
LAND = 58
KEYS = [
    (0, {}, "io"),
    # the blow lands and in one motion he reels back on his heels, throws his hands up and the sword falls away
    # (Wesley on draft 3: no lean forward in between)
    (3, dict(fall=8, chin=28, lean=6, gz=0.50), "out"),
    (9, dict(let=1, lx=0.38, ly=-0.22, lz=1.18, lean=4, chin=28, fall=10, hips=0.12), "out"),
    (14, dict(let=1, lx=0.40, ly=-0.20, lz=1.22, lean=6, chin=24, fall=8, hips=0.12), "io"),
    # three tottering steps back, arms flailing, head wobbling side to side
    (19, dict(let=1, lx=0.62, ly=0.05, lz=1.00, lean=4, chin=14, fall=10, hips=0.14, twist=12, look=20,
              **feet(0.07, 0.0, 0.16)), "io"),
    (24, dict(let=1, lx=0.50, ly=0.0, lz=1.25, lean=4, chin=22, fall=5, hips=0.12, twist=-12, look=-22,
              **feet(0.15, 0.26, 0.16)), "io"),
    (29, dict(let=1, lx=0.70, ly=0.05, lz=0.95, lean=4, chin=14, fall=13, hips=0.14, twist=10, look=18,
              **feet(0.23, 0.26, 0.34)), "io"),
    # teetering on his heels, arms windmilling up
    (34, dict(let=1, lx=0.55, ly=0.10, lz=1.35, lean=0, chin=34, fall=22, hips=0.10, **feet(0.29, 0.40, 0.34)), "out"),
    # ...catches himself. A beat.
    (38, dict(let=1, lx=0.60, ly=0.05, lz=1.00, lean=4, chin=16, fall=11, hips=0.12, **feet(0.29, 0.40, 0.34)), "out"),
    (44, dict(let=1, lx=0.60, ly=0.05, lz=1.02, lean=4, chin=12, fall=12, hips=0.12, look=-10, **feet(0.29, 0.40, 0.34)), "io"),
    # then slowly topples over backward, stiff as a board
    (54, dict(let=1, lx=0.55, ly=0.10, lz=1.20, lean=0, chin=20, fall=40, hips=0.04, **feet(0.29, 0.37, 0.37)), "in"),
    # lying flat hid his face from the 35 deg play camera (belly and boots in the way): he lands with his head and
    # shoulders a little raised (lean), so the X eyes face the camera
    (LAND, dict(let=1, hips=0.0, lean=24, chin=0, fall=88, **feet(0.29, 0.37, 0.37)), "in"),
    # a small bounce off the floor, then still, his head rolled to one side
    (61, dict(let=1, hips=0.0, lean=20, chin=0, fall=80, **feet(0.29, 0.37, 0.37)), "out"),
    (65, dict(let=1, hips=0.0, lean=30, chin=0, fall=88, look=14, **feet(0.29, 0.37, 0.37)), "io"),
    (77, dict(let=1, hips=0.0, lean=30, chin=0, fall=88, look=14, **feet(0.29, 0.37, 0.37)), "io"),
]
FPS = 24
EXTRA = dict(spin=0, fall=0, let=0, drop=0, look=0, lx=0.62, ly=0.10, lz=0.92, stagger=STAGGER)


# the sword (guard_pose drop/clat): still in his grip on RELEASE, then it falls for FALL_F frames (gravity), hits
# the floor and clatters for CLAT_F frames. Timed here by frame, not by the keys: an eased key made it slow down
# into the floor. HELD: the sword's world pose on the release frame, solved first, so it falls from where it
# left his hands rather than following them up.
RELEASE, FALL_F, CLAT_F = 4, 9, 6
HELD = {}


def sword_at(f):
    drop = min(1.0, max(0.0, (f - RELEASE) / FALL_F))
    clat = min(1.0, max(0.0, (f - RELEASE - FALL_F) / CLAT_F))
    return dict(drop=drop, clat=clat, **(HELD if f > RELEASE else {}))


def face_at(f):
    """nervous_face mood by number (guard_pose's nervous knob): none until the blow, woe, then dead on landing"""
    return 0 if f < 2 else 2 if f < LAND else 3


def knobs_at(f):
    full = [(t, {**sp.GUARD, **EXTRA, **k}, e) for t, k, e in KEYS]
    for (t0, k0, _), (t1, k1, e1) in zip(full, full[1:]):
        if t0 <= f <= t1:
            u = sp.ease((f - t0) / (t1 - t0), e1)
            return {**{n: k0[n] + (k1[n] - k0[n]) * u for n in k0}, "nervous": face_at(f), **sword_at(f)}
    return {**full[-1][1], "nervous": face_at(f), **sword_at(f)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--keys", action="store_true")
    ap.add_argument("--render", action="store_true")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    sp.knobs_at = knobs_at  # strike_pose.solve solves whatever knobs_at gives
    sp.solve(a.out, RELEASE, int(a.render))  # the sword's pose as his hands open: it falls from there
    from mathutils_free import held_knobs
    HELD.update(held_knobs(json.load(open(os.path.join(a.out, "f%02d" % RELEASE, "guard.json")))["sword_world"]))
    frames = [t for t, _, _ in KEYS] if a.keys else list(range(KEYS[-1][0] + 1))
    with ThreadPoolExecutor(a.jobs) as ex:
        res = sorted(ex.map(lambda f: sp.solve(a.out, f, int(a.render)), frames))
    for f, m in res:
        print("frame %2d hand miss L %.3f R %.3f" % (f, *(m + [0, 0])[:2]))
    if not a.keys:
        clip = [json.load(open(os.path.join(a.out, "f%02d" % f, "guard.json"))) for f in frames]
        json.dump(dict(fps=FPS, hit=0, keys=KEYS, frames=clip), open(os.path.join(a.out, "death.json"), "w"))
        print("WROTE", os.path.join(a.out, "death.json"), len(clip), "frames")
