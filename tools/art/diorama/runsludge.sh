#!/bin/bash
# runsludge.sh OUT [RES=1600] [SAMPLES=128] [extra build_sludge_cycles.py args...]: the sludge's look-check stills in the
# real set, with the set's own render settings and tiles as runeye.sh. Metal crashes now and then: it retries.
OUT=${1:?out dir}; shift
SL_RES=${1:-1600}; SL_SAMPLES=${2:-128}; shift 2 2>/dev/null
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh"
mkdir -p "$OUT"; OUT=$(abspath "$OUT")
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
for try in 1 2 3 4 5 6; do
  "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --python "$HERE/build_sludge_cycles.py" -- \
    --out "$OUT" --res "$SL_RES" --samples "$SL_SAMPLES" "$@" > "$OUT/sludge.log" 2>&1
  grep -E "Error|Traceback|File .*py|CHECK|SLUDGE" "$OUT/sludge.log" | tail -20
  grep -q "SLUDGE STILLS OK" "$OUT/sludge.log" && exit 0
  grep -q Traceback "$OUT/sludge.log" && exit 1  # a script error, not a GPU crash
  echo "crashed (try $try)"
done
exit 1
