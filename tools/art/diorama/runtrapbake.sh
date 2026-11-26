#!/bin/bash
# runtrapbake.sh OUT [SQUARES=all] [RES=2400] [SAMPLES=128]: the trapdoor's drop sprites (build_trapdoor_cycles.py
# --bake), one folder per square, OUT/sq{i}{j}/drop0_NN.png + drop.json. Baked per square because the fixed camera
# sees each pit's walls differently. SQUARES is "all" or "3,1 0,4 ...". Resumes: a finished frame is skipped.
OUT=${1:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh"
mkdir -p "$OUT"; OUT=$(abspath "$OUT")
SQ=${2:-all}
[ "$SQ" = all ] && SQ=$(for i in 0 1 2 3 4; do for j in 0 1 2 3 4; do echo -n "$i,$j "; done; done)
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
for s in $SQ; do
  D="$OUT/sq${s/,/}"; mkdir -p "$D"
  [ -f "$D/drop.json" ] && { echo "$s done"; continue; }
  ok=0
  for try in 1 2 3 4 5 6 7 8; do
    "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --python "$HERE/build_trapdoor_cycles.py" -- \
      --out "$D" --res "${3:-2400}" --samples "${4:-128}" --square "$s" --bake $TRAP_ARGS > "$D/bake.log" 2>&1
    grep -qE "TRAP BAKE OK" "$D/bake.log" && { ok=1; break; }
    grep -q Traceback "$D/bake.log" && { grep -E "Error|Traceback|File .*py" "$D/bake.log" | tail -8; exit 1; }
    echo "$s crashed (try $try)"
  done
  [ $ok = 1 ] || exit 1
  echo "$s baked $(grep -c RENDER_SECONDS "$D/bake.log") frames, $(grep CROP "$D/bake.log")"
done
echo "TRAP BAKE ALL OK"
