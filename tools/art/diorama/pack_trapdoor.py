# pack_trapdoor.py BAKE [OUT=public/diorama]: pack runtrapbake.sh's BAKE/sq{i}{j}/ folders into the game's sheets,
# OUT/trap{i}{j}-drop0.webp (+ -glow) and trap{i}{j}-drop.json, with king_loop_atlas.py (35 frames on 7 x 5, at
# the bake's own size: the set is 2400 px wide too). The square comes from the folder name (bakes before ded182a's
# follow-up wrote a wrong j into drop.json).
# /// script
# dependencies = ["numpy", "pillow"]
# ///
import json, os, re, subprocess, sys

bake = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "public/diorama"
here = os.path.dirname(os.path.abspath(__file__))
done = 0
for d in sorted(os.listdir(bake)):
    m = re.fullmatch(r"sq(\d)(\d)", d)
    if not m or not os.path.exists(f"{bake}/{d}/drop.json"):
        continue
    i, j = int(m[1]), int(m[2])
    p = f"{bake}/{d}/drop.json"
    info = json.load(open(p))
    if info.get("square") != [i, j]:
        info["square"] = [i, j]
        json.dump(info, open(p, "w"), indent=1)
    subprocess.run([sys.executable, "-I", f"{here}/king_loop_atlas.py", f"{bake}/{d}", out, "name=drop", f"figure=trap{i}{j}",
                    "rows=5", "scale=1", "q=88"], check=True)
    done += 1
print("PACKED %d squares" % done)
