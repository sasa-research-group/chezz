# pack_snare.py BAKE [OUT=public/diorama]: pack runsnarebake.sh's BAKE/sq{i}{j}/ folders into the game's sheets with
# king_loop_atlas.py (20 frames on 5 x 4, at the bake's own size): OUT/snare{i}{j}-spring0.webp (+ -glow) and
# snare{i}{j}-spring.json, the whole square, drawn under figures; OUT/snare{i}{j}-front0.webp (+ -glow) and
# snare{i}{j}-front.json, the roots nearer the camera than the legs of the figure on it, drawn over that figure.
# The square comes from the folder name, as pack_trapdoor.py.
import os, re, subprocess, sys

bake = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "public/diorama"
here = os.path.dirname(os.path.abspath(__file__))
done = 0
for d in sorted(os.listdir(bake)):
    m = re.fullmatch(r"sq(\d)(\d)", d)
    if not m or not os.path.exists(f"{bake}/{d}/spring.json"):
        continue
    for name in ("spring", "front"):
        subprocess.run([sys.executable, "-I", f"{here}/king_loop_atlas.py", f"{bake}/{d}", out, f"name={name}",
                        f"figure=snare{m[1]}{m[2]}", "rows=4", "scale=1", "q=88"], check=True)
    done += 1
print("PACKED %d squares" % done)
