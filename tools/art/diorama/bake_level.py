# uv run --no-project --with numpy --with pillow tools/art/diorama/bake_level.py PUZZLE [--res 2400] [--samples 128] [--out public/diorama] [--work DIR] [--only set,trap]
# Bakes one level for the game, any board size: its own Cycles set from the kit (bake.sh, any nx x ny) and a drop
# sheet for each of its trapdoors (runtrapbake.sh), packed into OUT/levels/{key}/ and listed in OUT/levels/index.json,
# where src/diorama/levelBake.ts finds it. PUZZLE is a puzzle's name or its number in src/puzzle/puzzles.json.
# The key is the layout's (level_layout.py), so two puzzles on the same squares share one bake.
# Resumes: a finished set or trapdoor in WORK is not baked again.
import argparse, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from level_layout import layout_key, layout_of_puzzle


def stage_square(x, y, h):
    """Board square (x, y) as the builders count it: i from the left and j = h-1-y, as src/diorama/trapdoor.ts."""
    return x, h - 1 - y


def plan(pz):
    """What one puzzle's bake needs: its key, size and the builder squares of its trapdoors."""
    l = layout_of_puzzle(pz)
    traps = [(c[0], c[1]) for c in l["cells"] if c[2] == "trapdoor"]
    return {"key": layout_key(l), "w": l["w"], "h": l["h"], "trapdoors": traps,
            "squares": [stage_square(x, y, l["h"]) for x, y in traps]}


def find_puzzle(puzzles, which):
    if which.isdigit():
        return puzzles[int(which)]
    for pz in puzzles:
        if pz.get("name", "").lower() == which.lower():
            return pz
    sys.exit("no puzzle named %r" % which)


def to_webp(src, dst):
    from PIL import Image
    Image.open(src).save(dst, "WEBP", quality=92, method=6, exact=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("puzzle")
    ap.add_argument("--puzzles", default="src/puzzle/puzzles.json")
    ap.add_argument("--res", type=int, default=2400)
    ap.add_argument("--samples", type=int, default=128)
    ap.add_argument("--out", default="public/diorama")
    ap.add_argument("--work", default=os.path.expanduser("~/.dos/scratch/d84406ef/levelbake/work"))
    ap.add_argument("--only", default="set,trap")
    a = ap.parse_args()
    p = plan(find_puzzle(json.load(open(a.puzzles))["puzzles"], a.puzzle))
    key, w, h = p["key"], p["w"], p["h"]
    work = os.path.join(a.work, key)
    dest = os.path.join(a.out, "levels", key)
    os.makedirs(work, exist_ok=True); os.makedirs(dest, exist_ok=True)
    env = dict(os.environ, NX=str(w), NY=str(h))
    print("LEVEL %s %dx%d trapdoors %s" % (key, w, h, p["trapdoors"]), flush=True)

    if "set" in a.only:
        sd = os.path.join(work, "set")
        name = "set%dx%d" % (w, h)
        if not os.path.exists(os.path.join(sd, name + ".json")):
            subprocess.run(["bash", os.path.join(HERE, "bake.sh"), str(max(w, h)), str(a.res), str(a.samples), sd],
                           env=env, check=True)
        to_webp(os.path.join(sd, name + ".png"), os.path.join(dest, "set.webp"))
        for ext in (".json", ".depth", "-glow.png"):
            shutil.copy(os.path.join(sd, name + ext), os.path.join(dest, "set" + ext))

    if "trap" in a.only and p["squares"]:
        td = os.path.join(work, "trap")
        sq = " ".join("%d,%d" % s for s in p["squares"])
        subprocess.run(["bash", os.path.join(HERE, "runtrapbake.sh"), td, sq, str(a.res), str(a.samples)], env=env, check=True)
        for (x, y), (i, j) in zip(p["trapdoors"], p["squares"]):
            subprocess.run([sys.executable, "-I", os.path.join(HERE, "king_loop_atlas.py"), os.path.join(td, "sq%d_%d" % (i, j)),
                            dest, "name=drop", "figure=trap-%d-%d" % (x, y), "rows=5", "scale=1", "q=88"], check=True)

    ip = os.path.join(a.out, "levels", "index.json")
    index = json.load(open(ip)) if os.path.exists(ip) else {}
    index[key] = {"w": w, "h": h, "trapdoors": [list(t) for t in p["trapdoors"]]}
    json.dump(dict(sorted(index.items())), open(ip, "w"), indent=1)
    print("LEVEL BAKE OK", dest, flush=True)


if __name__ == "__main__":
    main()
