# The rebel rook's death when he is taken (Wesley 2026-11-23 OK'd the reference pass, scratch rook/death/REFERENCE.md):
# the blow snaps him back, the hammer slips off his shoulder, he reels a step back and is knocked off his feet onto
# his back, legs up, bounces once and lies still with X eyes (white, in his visor: his helm has no face). Made like
# guard_death_pose.py: key poses as rook_pose.py knobs (let: hands off the handle, fall: tip back about the heels,
# kick: legs up, drop: the hammer to the floor), every frame one rook_pose.py solve (rook_strike.solve).
#   python3 rook_death.py OUT [--keys] [--only 0,16] [--jobs 6]
# writes OUT/fNN/rook_pose.json per frame and OUT/death.json {fps, hit: 0, land, frames}; runrookdeath.sh bakes it.
#
# Reference (measured at 24 fps; frame 0 = the taker's hit frame, where the game starts it):
# | key         | ref           | ours | body                                         | hands / hammer                   |
# |-------------|---------------|------|----------------------------------------------|----------------------------------|
# | blow        | head hit f0   | 0    | chest and head thrown back                   | hand lets go of the handle       |
# | snap peak   | head hit f8   | 5    | arched back, chin up, woe face               | fists flung up to his helm       |
# | reel        | push front f4 | 8    | a stumbling step back, on his heels          | arms still up                    |
# | hammer thud | (falls first) | 10   | teeters                                      | hammer hits the floor, his right |
# | land        | push f12      | 16   | flat on his back, legs kick up (X eyes)      | arms out                         |
# | legs down   | side f8       | 20   | legs drop, a small bounce (he is heavy)      |                                  |
# | still       | push f20      | 24   | head and shoulders raised: the face reads    | hammer beside him                |
# | hold        |               | 28   |                                              |                                  |
# A little slower than real (land f16, not f12) so the chibi reads on a small sprite: the guard's pace (land f15).
import json, os, sys, argparse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rook_strike as rs  # noqa: E402
from strike_pose import ease  # noqa: E402
from mathutils_free import held_knobs  # noqa: E402

FPS = 24
LAND = 16
# the hammer lands out to his right, its head pointing back-right much as it lay across his shoulders, so it slides
# off along its own length and lies clear of him when he lands
BASE = dict(rs.IDLE, let=0.0, lx=0.12, ly=0.04, lz=0.12, fall=0.0, kick=0.0, drop=0.0, clat=0.0, nervous=0.0,
            sdx=-0.45, sdy=0.15, slay=130.0, pop=0.30)
UP = dict(let=1.0, lx=0.12, ly=0.06, lz=0.15)  # fists flung up to about his helm (short arms)
KEYS = [
    (0, dict(let=0.35, lean=-4.0, chin=4.0, fall=2.0), "io"),  # the blow: already snapping back
    (5, dict(UP, lean=-14.0, chin=14.0, fall=8.0), "out"),  # arched, chin up, fists up
    (8, dict(UP, lean=-9.0, chin=12.0, fall=13.0, ahead=-0.05, step=-0.06), "io"),  # a step back onto his heels
    (10, dict(UP, lz=0.13, lean=-6.0, chin=10.0, fall=18.0, ahead=-0.06, step=-0.06), "io"),  # teeters
    # knocked off his feet, speeding up like a falling thing; he lands with his head and shoulders raised (lean) so
    # the X eyes face the high camera, legs swung up
    (LAND, dict(let=1.0, lx=0.20, ly=0.0, lz=0.04, lean=22.0, chin=0.0, fall=88.0, kick=38.0, ahead=-0.06), "in"),
    (20, dict(let=1.0, lx=0.21, ly=0.0, lz=0.02, lean=18.0, chin=0.0, fall=84.0, kick=6.0, ahead=-0.06), "out"),
    (24, dict(let=1.0, lx=0.21, ly=0.0, lz=0.0, lean=26.0, chin=0.0, fall=88.0, kick=-15.0, ahead=-0.06), "io"),  # hips straightened past flat: his thick body holds straight legs up off the floor
    (28, dict(let=1.0, lx=0.21, ly=0.0, lz=0.0, lean=26.0, chin=0.0, fall=88.0, kick=-15.0, ahead=-0.06), "io"),
]
RELEASE, FALL_F, CLAT_F = 2, 8, 4  # the hammer rises with his opening hand for 2 frames (falling from his shoulders
# on the blow, the snapping helm hit it: drafts full1, full2), then falls, thuds down on frame 10, bounces once
HELD = {}  # the hammer's world pose on the blow's frame (rhx..rhqz), solved first: it falls from there. (From the
# idle carry instead, his helm snapped back into it on frame 0: draft k1.)


def face_at(f):
    """the face the bake shows (nervous_face moods by number): woe from the blow, dead once he lands"""
    return 2 if f < LAND else 3


def hammer_at(f):
    drop = min(1.0, max(0.0, (f - RELEASE) / FALL_F))  # still on his shoulders on the blow's frame, moving with him
    clat = min(1.0, max(0.0, (f - RELEASE - FALL_F) / CLAT_F))
    return dict(drop=drop, clat=clat, **{"r" + k: v for k, v in HELD.items()})


def knobs_at(f):
    full = [(t, {**BASE, **k}, e) for t, k, e in KEYS]
    k = full[-1][1]
    for (t0, k0, _), (t1, k1, e1) in zip(full, full[1:]):
        if t0 <= f <= t1:
            u = ease((f - t0) / (t1 - t0), e1)
            k = {n: k0[n] + (k1[n] - k0[n]) * u for n in k0}
            break
    return {**k, "nervous": face_at(f), **hammer_at(f)}


def idle_knobs(f):
    return dict(BASE)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--keys", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    # the idle carry first: the hammer falls from where it rests, and the left fist keeps its carry grip on the
    # forearm all through (the bake builds the fists once, round the handle, so it stays the same fist)
    rs.knobs_at = idle_knobs
    rs.solve(a.out, 99, 0)
    idle = json.load(open(os.path.join(a.out, "f99", "rook_pose.json")))
    rs.knobs_at = knobs_at
    rs.solve(a.out, RELEASE, 0)  # the release frame: the hammer still in his hand, where it falls from
    HELD.update(held_knobs(json.load(open(os.path.join(a.out, "f%02d" % RELEASE, "rook_pose.json")))["hammer_world"]))
    frames = ([int(x) for x in a.only.split(",")] if a.only else [t for t, _, _ in KEYS] if a.keys
              else list(range(KEYS[-1][0] + 1)))
    with ThreadPoolExecutor(a.jobs) as ex:
        res = sorted(ex.map(lambda f: rs.solve(a.out, f, 0), frames))
    for f, lines in res:
        print("frame %2d | %s" % (f, " | ".join(lines)))
    clip = []
    for f in frames:
        p = os.path.join(a.out, "f%02d" % f, "rook_pose.json")
        g = json.load(open(p))
        g["fists"][0]["m"] = idle["fists"][0]["m"]  # his left fist, rigid on the forearm as in the carry
        json.dump(g, open(p, "w"), indent=1)
        clip.append(g)
    if not (a.keys or a.only):
        json.dump(dict(fps=FPS, hit=0, land=LAND, keys=KEYS, frames=clip), open(os.path.join(a.out, "death.json"), "w"))
        print("WROTE", os.path.join(a.out, "death.json"), len(clip), "frames")
    else:  # a draft of just these frames, bakeable the same way
        json.dump(dict(fps=FPS, hit=0, land=LAND, keys=KEYS, frames=clip, drafted=frames),
                  open(os.path.join(a.out, "death.json"), "w"))
        print("WROTE draft", os.path.join(a.out, "death.json"), frames)
