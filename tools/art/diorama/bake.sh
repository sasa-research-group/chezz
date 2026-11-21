#!/bin/bash
# bake.sh N RES SAMPLES OUTDIR -- one set bake with the r78 look (see bake_set.py)
# Shipped: 5 and 8 as is, 3 with ZOOM_K=0.69 (2x2 and 3x3 back the camera off to fit the walls).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
STAGE=${STAGE_DIR:-~/.dos/scratch/d84406ef/stage}
P=${PAID_DIR:-~/.dos/scratch/d84406ef/paid/out}
cd "$STAGE"
source tools/base_r78.env
export FAIRY_TUCK=${FAIRY_TUCK-1} BULB_EVEN=${BULB_EVEN-1}  # every bulb just inside the moss and equally bright (stage.py); bake_set.py also slides bulbs out from behind trunks and thick moss
export TILE_GLB=${TILE_GLB:-$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb}
export TILE_VAL=${TILE_VAL:-0.5} TILE_FILL=${TILE_FILL:-1.05} TILE_JIT=${TILE_JIT:-1.6} JOINT_MOSS=${JOINT_MOSS:-1.8}
for try in 1 2 3; do  # Metal crashes now and then: retry
  /Applications/Blender.app/Contents/MacOS/Blender -b --python "$HERE/bake_set.py" -- --n "$1" --res "$2" --samples "$3" --out "$4" --zoom_k "${ZOOM_K:-1}" 2>&1 \
    | grep -E "Error|Traceback|_SECONDS|CHANNELS|BULB|DONE" && [ -s "$4/set$1.json" ] && break
  echo "retry $try"
done
