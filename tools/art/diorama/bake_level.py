# uv run --no-project --with numpy --with pillow tools/art/diorama/bake_level.py PUZZLE [--res 2400] [--samples 128] [--out public/diorama] [--work DIR] [--only set,trap,snare]
# Bakes one level for the game, any board size: its own Cycles set from the kit (bake.sh, any nx x ny) and a drop
# sheet for each of its trapdoors (runtrapbake.sh) and two for each snare (runsnarebake.sh), packed into OUT/levels/{key}/ and listed in OUT/levels/index.json,
# where src/diorama/levelBake.ts finds it. PUZZLE is a puzzle's name or its number in src/puzzle/puzzles.json.
# The key is the layout's (level_layout.py), so two puzzles on the same squares share one bake.
# A board past one view (level_layout.stops) is baked once per panning stop instead: set-s{k}.* for each stop, and each
# trapdoor from every stop that frames it, trap-{x}-{y}-s{k}; the index lists the stops and which see which door.
# Resumes: a finished set or trapdoor in WORK is not baked again.
# /// script
# dependencies = ["numpy", "pillow"]
# ///
import argparse, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from level_layout import layout_key, layout_of_puzzle, sees, stops, window


def stage_square(x, y, h):
    """Board square (x, y) as the builders count it: i from the left and j = h-1-y, as src/diorama/trapdoor.ts."""
    return x, h - 1 - y


def plan(pz):
    """What one puzzle's bake needs: its key, size and the builder squares of its trapdoors and snares."""
    l = layout_of_puzzle(pz)
    traps = [(c[0], c[1]) for c in l["cells"] if c[2] == "trapdoor"]
    snares = [(c[0], c[1]) for c in l["cells"] if c[2] == "snare"]
    w, h = l["w"], l["h"]
    sq = [stage_square(x, y, h) for x, y in traps]
    ssq = [stage_square(x, y, h) for x, y in snares]
    st = stops(w, h)
    seen = lambda qs: [[k for k, s_ in enumerate(st) if sees(s_, q, w, h)] for q in qs] if st else []
    return {"key": layout_key(l), "w": w, "h": h, "trapdoors": traps, "squares": sq, "stops": st,
            "sideLights": bool(st),  # a board that pans: bulbs down the side walls too (look.env SIDE_LIGHTS)
            "trapStops": seen(sq), "snares": snares, "snareSquares": ssq, "snareStops": seen(ssq)}


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
    ap.add_argument("--only", default="set,trap,snare")
    a = ap.parse_args()
    p = plan(find_puzzle(json.load(open(a.puzzles))["puzzles"], a.puzzle))
    key, w, h = p["key"], p["w"], p["h"]
    work = os.path.join(a.work, key)
    dest = os.path.join(a.out, "levels", key)
    os.makedirs(work, exist_ok=True); os.makedirs(dest, exist_ok=True)
    env = dict(os.environ, NX=str(w), NY=str(h))
    if p["sideLights"]:  # so a stop that can't see the back wall still has warm light
        env["SIDE_LIGHTS"] = "1"
    print("LEVEL %s %dx%d trapdoors %s" % (key, w, h, p["trapdoors"]), flush=True)

    st = p["stops"]
    views = [(k, "-s%d" % k) for k in range(len(st))] if st else [(None, "")]  # (stop, file suffix)
    if "set" in a.only:
        sd = os.path.join(work, "set")
        name = "set%d" % w if w == h else "set%dx%d" % (w, h)
        done = name + ("-stops.json" if st else ".json")
        if not os.path.exists(os.path.join(sd, done)):
            subprocess.run(["bash", os.path.join(HERE, "bake.sh"), str(max(w, h)), str(a.res), str(a.samples), sd],
                           env=dict(env, STOPS="1") if st else env, check=True)
        for _, suf in views:
            to_webp(os.path.join(sd, name + suf + ".png"), os.path.join(dest, "set%s.webp" % suf))
            for ext in (".json", ".depth", "-glow.png"):
                shutil.copy(os.path.join(sd, name + suf + ext), os.path.join(dest, "set" + suf + ext))

    if "trap" in a.only and p["squares"]:
        for k, suf in views:
            mine = [n for n in range(len(p["squares"])) if k is None or k in p["trapStops"][n]]
            if not mine:
                continue
            td = os.path.join(work, "trap" + suf)
            sq = " ".join("%d,%d" % p["squares"][n] for n in mine)
            ev = dict(env, TRAP_ARGS=("--stop %g,%g" % tuple(st[k])) if k is not None else "")
            subprocess.run(["bash", os.path.join(HERE, "runtrapbake.sh"), td, sq, str(a.res), str(a.samples)], env=ev, check=True)
            for n in mine:
                (x, y), (i, j) = p["trapdoors"][n], p["squares"][n]
                subprocess.run([sys.executable, "-I", os.path.join(HERE, "king_loop_atlas.py"), os.path.join(td, "sq%d_%d" % (i, j)),
                                dest, "name=drop", "figure=trap-%d-%d%s" % (x, y, suf), "rows=5", "scale=1", "q=88"], check=True)

    if "snare" in a.only and p["snareSquares"]:  # as the trapdoors: per stop, two layers per snare (runsnarebake.sh)
        for k, suf in views:
            mine = [n for n in range(len(p["snareSquares"])) if k is None or k in p["snareStops"][n]]
            if not mine:
                continue
            sd = os.path.join(work, "snare" + suf)
            sq = " ".join("%d,%d" % p["snareSquares"][n] for n in mine)
            ev = dict(env, SNARE_ARGS=("--stop %g,%g" % tuple(st[k])) if k is not None else "")
            subprocess.run(["bash", os.path.join(HERE, "runsnarebake.sh"), sd, sq, str(a.res), str(a.samples)], env=ev, check=True)
            for n in mine:
                (x, y), (i, j) = p["snares"][n], p["snareSquares"][n]
                for layer in ("spring", "front"):
                    subprocess.run([sys.executable, "-I", os.path.join(HERE, "king_loop_atlas.py"), os.path.join(sd, "sq%d_%d" % (i, j)),
                                    dest, "name=" + layer, "figure=snare-%d-%d%s" % (x, y, suf), "rows=4", "scale=1", "q=88"], check=True)

    ip = os.path.join(a.out, "levels", "index.json")
    index = json.load(open(ip)) if os.path.exists(ip) else {}
    index[key] = {"w": w, "h": h, "trapdoors": [list(t) for t in p["trapdoors"]], "snares": [list(t) for t in p["snares"]]}
    if st:  # panning stops (squares from the board's middle, stage axes) and, per trapdoor and snare, the stops with its sheet
        index[key].update({"window": list(window(w, h)), "stops": [list(t) for t in st], "trapStops": p["trapStops"], "snareStops": p["snareStops"]})
    json.dump(dict(sorted(index.items())), open(ip, "w"), indent=1)
    print("LEVEL BAKE OK", dest, flush=True)


if __name__ == "__main__":
    main()
