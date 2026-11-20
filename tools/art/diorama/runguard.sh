#!/bin/bash
# runguard.sh GUARD_JSON SWORD_GLB OUT [RES=3600] [SAMPLES=256] [ONLY=0,1,2,3,4,5,6,7]
# Bakes the still king in his sword guard, in the locked king look (as runbake.sh).
GJ=${1:?guard.json}; SW=${2:?sword glb}; OUT=${3:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
export KING_RIM=1100 KING_RIM_FIBONLY=1 RIM_PLAY=1 RIM_EL=8.5 CROWN_RIM=2500 CROWN_EL=8.5
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
GUARD="$GJ" PROP="$SW" /Applications/Blender.app/Contents/MacOS/Blender -b --python "$HERE/bake_king_sprites.py" -- --out "$OUT" \
  --res "${4:-3600}" --samples "${5:-256}" --only "${6:-0,1,2,3,4,5,6,7}" 2>&1 \
  | grep -E "Error|Traceback|File .*py|line [0-9]|CHECK|FIG|_SECONDS|CROP|RENDER_TOTAL|DONE"
