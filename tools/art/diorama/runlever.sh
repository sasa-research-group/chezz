#!/bin/bash
# runlever.sh OUT [RES=1600] [SAMPLES=128] [STATES=left,right]: the lever's look-check stills in the real set
# (build_lever_cycles.py), with the set's tiles as runeye.sh. Extra args in LEVER_ARGS (e.g. "--square 2,2 --zoom 1"). Metal crashes now and then: it retries.
OUT=${1:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh"
mkdir -p "$OUT"; OUT=$(abspath "$OUT")
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
for try in 1 2 3 4 5 6 7 8; do
  "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --python "$HERE/build_lever_cycles.py" -- \
    --out "$OUT" --res "${2:-1600}" --samples "${3:-128}" --states "${4:-left,right}" $LEVER_ARGS > "$OUT/lever.log" 2>&1
  grep -E "Error|Traceback|File .*py|CHECK|LEVER" "$OUT/lever.log" | tail -20
  grep -qE "LEVER STILLS OK" "$OUT/lever.log" && exit 0
  grep -qE "Traceback|SyntaxError" "$OUT/lever.log" && exit 1  # a script error, not a GPU crash
  echo "crashed (try $try)"
done
exit 1
