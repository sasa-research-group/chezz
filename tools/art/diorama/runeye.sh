#!/bin/bash
# runeye.sh PED_GLB OUT [RES=1600] [SAMPLES=128] [STATES=doze,stare]: the eye's look-check stills in the real set
# (build_eye_cycles.py), with the set's own render settings as runrook.sh. Metal crashes now and then: it retries.
PED=${1:?meshy pedestal glb}; OUT=${2:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh"
PED=$(abspath "$PED"); mkdir -p "$OUT"; OUT=$(abspath "$OUT")
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
for try in 1 2 3 4 5 6 7 8; do
  "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --python "$HERE/build_eye_cycles.py" -- \
    --ped "$PED" --out "$OUT" --res "${3:-1600}" --samples "${4:-128}" --states "${5:-doze,stare}" $EYE_ARGS > "$OUT/eye.log" 2>&1
  grep -E "Error|Traceback|File .*py|CHECK|EYE" "$OUT/eye.log" | tail -20
  grep -qE "EYE (STILLS|BAKE) OK" "$OUT/eye.log" && exit 0
  grep -q Traceback "$OUT/eye.log" && exit 1  # a script error, not a GPU crash
  echo "crashed (try $try)"
done
exit 1
