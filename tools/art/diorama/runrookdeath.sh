#!/bin/bash
# runrookdeath.sh DEATH_JSON OUT [RES=3600] [SAMPLES=256] [ONLY=0,1,2,3,4,5,6,7]
# Bakes the rebel rook's death (rook_death.py's death.json; woe eyes in his visor, X eyes once he lands) in his locked look, as runrook.sh
# does his carry: the hammer (falling to the floor) and the fists are re-placed every frame from that frame's solve.
# Metal crashes now and then: this reruns the bake (it resumes at the missing frames) until it finishes.
SJ=${1:?death.json}; OUT=${2:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh"
SJ=$(abspath "$SJ"); mkdir -p "$OUT"; OUT=$(abspath "$OUT")
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
export KING_RIM=1100 KING_RIM_FIBONLY=1 RIM_PLAY=1 RIM_EL=8.5
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
export SKIN_FELT=1 FELT_SKIN=0 KSKIN_SAT=${ROOK_SAT:-1.0} KSKIN_VAL=${ROOK_VAL:-0.95} KSKIN_HUE=${ROOK_HUE:--0.03}
export NOCAPE=1 CHAR_GLB=${CHAR_GLB:-$P/rook2rig/rigged_character_glb__rigged_character.glb}
export PROP=${PROP:-$P/hammer/model_glb__model.glb}
unset GUARD; export FACE=rook  # the pose comes from the death's frames; nervous_face's rook visor eyes
for try in 1 2 3 4 5 6 7 8; do
  "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --python "$HERE/bake_king_sprites.py" -- \
    --out "$OUT" --death "$SJ" --res "${3:-3600}" --samples "${4:-256}" --only "${5:-0,1,2,3,4,5,6,7}" > "$OUT/bake.log" 2>&1
  grep -E "Error|Traceback|File .*py|CHECK|NERVOUS|FIG|CROP|RENDER_TOTAL" "$OUT/bake.log" | tail -20
  grep -q RENDER_TOTAL "$OUT/bake.log" && { echo "ROOK DEATH DONE"; exit 0; }
  echo "crashed (try $try): $(ls "$OUT"/death?_??.png 2>/dev/null | wc -l) frames so far"
done
echo "ROOK DEATH FAILED"; exit 1
