# pack_lever.py BAKE [OUT=public/diorama]: pack runleverbake.sh's BAKE/sq{i}{j}/ folders into the game's sheets with
# king_loop_atlas.py (the throw's frames, right then left, on 4 rows, at the bake's own size): OUT/lever{i}{j}-throw0.webp
# (+ -glow) and -throw.json, the lever and its floor, drawn under figures. The square comes from the folder name, as
# pack_gate.py.
import os, re, subprocess, sys

bake = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else "public/diorama"
here = os.path.dirname(os.path.abspath(__file__))
done = 0
for d in sorted(os.listdir(bake)):
    m = re.fullmatch(r"sq(\d)(\d)", d)
    if not m or not os.path.exists(f"{bake}/{d}/throw.json"):
        continue
    subprocess.run([sys.executable, "-I", f"{here}/king_loop_atlas.py", f"{bake}/{d}", out, "name=throw",
                    f"figure=lever{m[1]}{m[2]}", "rows=4", "scale=1", "q=88"], check=True)
    done += 1
print("PACKED %d squares" % done)
