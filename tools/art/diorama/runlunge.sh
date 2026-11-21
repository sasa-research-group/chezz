#!/bin/bash
# runlunge.sh STRIKE_JSON OUT [RES=3600] [SAMPLES=256] [ONLY=0,1,2,3,4,5,6,7]
# Bakes the patrol guard's spear lunge (lunge_pose.py's strike.json) in the locked king look, as runpawn.sh does his
# idle. Metal crashes now and then: this reruns the bake (it resumes at the missing frames) until it finishes.
SJ=${1:?strike.json}; OUT=${2:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh" # relative GUARD/PROP/CHAR_GLB from the caller's folder, before the cd below
SJ=$(cd "$(dirname "$SJ")" && pwd)/$(basename "$SJ")
mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
export KING_RIM=1100 KING_RIM_FIBONLY=1 RIM_PLAY=1 RIM_EL=8.5
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
export NOCAPE=1 CHAR_GLB=${CHAR_GLB:-$P/guardrig/rigged_character_glb__rigged_character.glb}  # no GUARD: frame 0 places the spear
for try in 1 2 3 4 5 6 7 8; do
  PROP=$P/spear/model_glb__model.glb "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b \
    --python "$HERE/bake_king_sprites.py" -- --out "$OUT" --strike "$SJ" \
    --res "${3:-3600}" --samples "${4:-256}" --only "${5:-0,1,2,3,4,5,6,7}" > "$OUT/bake.log" 2>&1
  grep -E "Error|Traceback|File .*py|CHECK|FIG|CROP|RENDER_TOTAL" "$OUT/bake.log" | tail -20
  grep -q RENDER_TOTAL "$OUT/bake.log" && { echo "STRIKE DONE"; exit 0; }
  echo "crashed (try $try): $(ls "$OUT"/strike?_??.png 2>/dev/null | wc -l) frames so far"
done
echo "STRIKE FAILED"; exit 1
