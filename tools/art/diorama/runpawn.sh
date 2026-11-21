#!/bin/bash
# runpawn.sh OUT [RES=3600] [SAMPLES=256] [ONLY=0,1,2,3,4,5,6,7] [extra bake_king_sprites args...]
# Bakes the patrol guard (enemy pawn) in the locked king look: same stage, felt and rim as runguard.sh,
# no crown spot (he has none). CHAR_GLB points the king bake at the guard's rig; GUARD/PROP as for the king.
OUT=${1:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
export KING_RIM=1100 KING_RIM_FIBONLY=1 RIM_PLAY=1 RIM_EL=8.5
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
export CHAR_GLB=${CHAR_GLB:-$P/guardrig/rigged_character_glb__rigged_character.glb}
/Applications/Blender.app/Contents/MacOS/Blender -b --python "$HERE/bake_king_sprites.py" -- --out "$OUT" \
  --res "${2:-3600}" --samples "${3:-256}" --only "${4:-0,1,2,3,4,5,6,7}" "${@:5}" 2>&1 \
  | grep -E "Error|Traceback|File .*py|line [0-9]|CHECK|FIG|FELT|_SECONDS|CROP|RENDER_TOTAL|DONE"
