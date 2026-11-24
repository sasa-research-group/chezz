# Headless check of king_motion.hold_guard's free arm (the rook's walk): locked bones take the guard pose, a free
# bone keeps the guard's hang turned by the gait's swing about its loop mean (so it swings round the hang rather
# than snapping to the gait's own arm), swing=0 freezes it at the hang, and the hand stays locked (shrunk in the fist).
#   Blender -b --python test_hold_guard.py
import math, os, sys
from mathutils import Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import king_motion as km

N = 16
hang = Quaternion((1, 0, 0), math.radians(-70))  # the carry's relaxed arm
guard = {n: (Vector(), Quaternion()) for n in km.UPPER}
guard["RightArm"] = (Vector((0, 0.01, 0)), hang)
guard["RightHand"] = (Vector(), Quaternion(), Vector((0.2, 0.2, 0.2)))
gait_rest = Quaternion((0, 0, 1), math.radians(40))  # the gait's arm sticks out sideways
poses = []
for i in range(N):
    sw = Quaternion((1, 0, 0), math.radians(25 * math.sin(2 * math.pi * i / N)))
    p = {n: (Vector(), Quaternion()) for n in km.UPPER}
    p["Hips"] = (Vector(), Quaternion())
    p["RightArm"] = (Vector(), gait_rest @ sw)
    p["RightHand"] = (Vector(), Quaternion((0, 1, 0), 0.5))
    poses.append(p)

fails = []
def check(ok, msg):
    print(("ok " if ok else "FAIL ") + msg)
    if not ok:
        fails.append(msg)

ang = lambda a, b: math.degrees(a.rotation_difference(b).angle)
out = km.hold_guard(None, poses, guard, free=("RightArm", "RightForeArm"))
check(all(ang(q["RightHand"][1], Quaternion()) < 1e-3 and len(q["RightHand"]) == 3 for q in out), "hand stays locked, scale kept")
check(all(ang(q["Spine"][1], Quaternion()) < 1e-3 for q in out), "spine locked to the guard")
check(ang(km._qmean([q["RightArm"][1] for q in out]), hang) < 1.0, "free arm swings round the guard's hang")
spread = max(ang(q["RightArm"][1], hang) for q in out)
check(20 < spread < 30, "free arm keeps the gait's swing (%.1f deg)" % spread)
check(all(abs(q["RightArm"][0].y - 0.01) < 1e-6 for q in out), "free arm keeps the guard's location")
still = km.hold_guard(None, poses, guard, free=("RightArm",), swing=0.0)
check(all(ang(q["RightArm"][1], hang) < 1e-3 for q in still), "swing=0 holds the hang")
half = km.hold_guard(None, poses, guard, free=("RightArm",), swing=0.5)
check(abs(max(ang(q["RightArm"][1], hang) for q in half) - spread / 2) < 1.0, "swing=0.5 halves it")
print("ALL OK" if not fails else "FAILED %d" % len(fails))
sys.exit(1 if fails else 0)
