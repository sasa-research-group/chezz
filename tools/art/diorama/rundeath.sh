#!/bin/bash
# rundeath.sh DEATH_JSON OUT [RES=3600] [SAMPLES=256] [ONLY=0,1,2,3,4,5,6,7]
# Bakes the king's checkmate death (death_pose.py's death.json; woe face, then X eyes once he lands) in the locked
# king look, as runcheck.sh does the check loop. Metal crashes now and then: this reruns the bake (it resumes at the missing frames) until it finishes,
# or until two tries in a row add no frames.
SJ=${1:?death.json}; OUT=${2:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh" # relative GUARD/PROP/CHAR_GLB from the caller's folder, before the cd below
SJ=$(cd "$(dirname "$SJ")" && pwd)/$(basename "$SJ")
mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
export KING_RIM=1100 KING_RIM_FIBONLY=1 RIM_PLAY=1 RIM_EL=8.5 CROWN_RIM=2500 CROWN_EL=8.5
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
stuck=0; last=-1
for try in $(seq 1 80); do
  GUARD="$HERE/king_guard.json" PROP="$HERE/royal_blade.glb" /Applications/Blender.app/Contents/MacOS/Blender -b \
    --python "$HERE/bake_king_sprites.py" -- --out "$OUT" --death "$SJ" \
    --res "${3:-3600}" --samples "${4:-256}" --only "${5:-0,1,2,3,4,5,6,7}" > "$OUT/bake.log" 2>&1
  grep -E "Error|Traceback|File .*py|CHECK|NERVOUS|FIG|CROP|RENDER_TOTAL" "$OUT/bake.log" | tail -20
  grep -q RENDER_TOTAL "$OUT/bake.log" && { echo "DEATH DONE"; exit 0; }
  n=$(ls "$OUT"/death?_??.png 2>/dev/null | wc -l | tr -d ' ')
  echo "crashed (try $try): $n frames so far"
  # Metal resets (another app's GPU fault) cost a few frames each; give up only when tries stop adding frames.
  if [ "$n" -le "$last" ]; then stuck=$((stuck+1)); [ $stuck -ge 2 ] && break; else stuck=0; fi
  last=$n
done
echo "DEATH FAILED"; exit 1
