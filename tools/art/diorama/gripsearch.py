# Search grip placements for one lunge key pose so the spear clears the guard's body and both hands reach it.
#   python3 gripsearch.py KEYNAME OUTDIR gx=a,b,c gy=... gz=... tilt=... [fwd=...]
# KEYNAME is a dict in lunge_pose.py (LEVEL, DRAW, THRUST, HOLD, OUT_HIP, PULL, RAISE). Each candidate is solved by
# guard_pose.py, all are checked in one strike_check.py run; prints the best by cost = clip depth + reach penalty
# + a small pull toward the original numbers.
import itertools, json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
import lunge_pose as lp

name, out = sys.argv[1], sys.argv[2]
grid = {k: [float(x) for x in v.split(",")] for k, v in (a.split("=") for a in sys.argv[3:])}
base = lp.knobs_at(int(name[1:])) if name[0] == "F" and name[1:].isdigit() else {**lp.READY, **getattr(lp, name)}  # F6 = frame 6 as blended
os.makedirs(out, exist_ok=True)
cands = [dict(base, **dict(zip(grid, vals))) for vals in itertools.product(*grid.values())]


def solve(i):
    d = os.path.join(out, "c%03d" % i)
    if not os.path.exists(os.path.join(d, "guard.json")):
        args = ["%s=%.5f" % kv for kv in cands[i].items()] + ["render=0"]
        r = subprocess.run([lp.BLENDER, "-b", "--python", os.path.join(D, "guard_pose.py"), "--", d] + args,
                           capture_output=True, text=True, env=lp.ENV)
    else:
        r = None
    miss = [0.0, 0.0]
    if r is not None:
        miss = [float(l.rsplit("miss", 1)[1]) for l in r.stdout.splitlines() if l.startswith("REACH")] or [9, 9]
        json.dump(miss, open(os.path.join(d, "miss.json"), "w"))
    else:
        miss = json.load(open(os.path.join(d, "miss.json")))
    return miss


with ThreadPoolExecutor(8) as ex:
    misses = list(ex.map(solve, range(len(cands))))
frames = [json.load(open(os.path.join(out, "c%03d" % i, "guard.json"))) for i in range(len(cands))]
json.dump(dict(fps=24, frames=frames), open(os.path.join(out, "all.json"), "w"))
r = subprocess.run([lp.BLENDER, "-b", "--python", os.path.join(D, "strike_check.py"), "--", os.path.join(out, "all.json")],
                   capture_output=True, text=True, env=dict(lp.ENV, CLIP_WHERE="1"))
depth = {}
for l in r.stdout.splitlines():
    m = re.match(r"CLIP frame +(\d+) depth ([\d.]+)", l)
    if m:
        depth[int(m.group(1))] = (float(m.group(2)), l.split(" at ", 1)[1] if " at " in l else "")
rows = []
for i, c in enumerate(cands):
    dp, where = depth.get(i, (9, "?"))
    reach = max(0.0, max(misses[i]) - 0.06)
    dev = sum(abs(c[k] - base[k]) for k in grid if k != "tilt" and k != "fwd") * 0.05 + sum(abs(c[k] - base[k]) for k in grid if k in ("tilt", "fwd")) * 0.0005
    rows.append((dp + 2 * reach + dev, dp, max(misses[i]), {k: c[k] for k in grid}, where))
rows.sort(key=lambda r: r[0])
for row in rows[:int(os.environ.get("TOP", 8))]:
    print("cost %.3f depth %.3f miss %.3f %s %s" % row)
