# pack_gate.py BAKE [OUT=public/diorama] [SUFFIX=]: pack rungatebake.sh's BAKE/sq{i}{j}/ folders into the game's sheets
# with king_loop_atlas.py (the swing's frames on 4 rows, at the bake's own size): OUT/gate{i}{j}{SUFFIX}-swing0.webp
# (+ -glow) and -swing.json, the gate and its floor, drawn under figures; OUT/gate{i}{j}{SUFFIX}-front0.webp (+ -glow)
# and -front.json, the gate's parts nearer the camera than a figure in the doorway, drawn over it. SUFFIX "q" for a
# TURN=q bake (the quarter-turned gate). The square comes from the folder name, as pack_snare.py.
import os, re, subprocess, sys

bake = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "public/diorama"
suffix = sys.argv[3] if len(sys.argv) > 3 else ""
here = os.path.dirname(os.path.abspath(__file__))
done = 0
for d in sorted(os.listdir(bake)):
    m = re.fullmatch(r"sq(\d)(\d)", d)
    if not m or not os.path.exists(f"{bake}/{d}/swing.json"):
        continue
    for name in ("swing", "front"):
        subprocess.run([sys.executable, "-I", f"{here}/king_loop_atlas.py", f"{bake}/{d}", out, f"name={name}",
                        f"figure=gate{m[1]}{m[2]}{suffix}", "rows=4", "scale=1", "q=88"], check=True)
    done += 1
print("PACKED %d squares" % done)
