#!/bin/bash
# runrook.sh ROOK_POSE_JSON OUT [RES=3600] [SAMPLES=256] [ONLY=0,1,2,3,4,5,6,7] [extra bake_king_sprites args...]
# Bakes the rebel rook in his shoulder carry (rook_pose.py's rook_pose.json) in the locked king look: same stage,
# felt and rim as runpawn.sh. The hammer and the fingered fists come back from the json (hands.attach_carried).
GJ=${1:?rook_pose.json}; OUT=${2:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh"
GJ=$(abspath "$GJ"); OUT=$(abspath "$OUT")
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
export KING_RIM=1100 KING_RIM_FIBONLY=1 RIM_PLAY=1 RIM_EL=8.5
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
export NOCAPE=1 CHAR_GLB=${CHAR_GLB:-$P/rook2rig/rigged_character_glb__rigged_character.glb}
export GUARD="$GJ" PROP=${PROP:-$P/hammer/model_glb__model.glb}
"${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --python "$HERE/bake_king_sprites.py" -- --out "$OUT" \
  --res "${3:-3600}" --samples "${4:-256}" --only "${5:-0,1,2,3,4,5,6,7}" "${@:6}" 2>&1 \
  | grep -E "Error|Traceback|File .*py|line [0-9]|CHECK|FIG|FELT|_SECONDS|CROP|RENDER_TOTAL|DONE|^GPU"
