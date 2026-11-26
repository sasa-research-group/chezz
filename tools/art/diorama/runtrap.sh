#!/bin/bash
# runtrap.sh OUT [RES=1600] [SAMPLES=128] [STATES=shut,fallen]: the trapdoor's look-check stills in the real set
# (build_trapdoor_cycles.py), with the set's tiles as runeye.sh. Extra args in TRAP_ARGS. Metal crashes now and then: it retries.
OUT=${1:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh"
mkdir -p "$OUT"; OUT=$(abspath "$OUT")
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
for try in 1 2 3 4 5 6 7 8; do
  "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --python "$HERE/build_trapdoor_cycles.py" -- \
    --out "$OUT" --res "${2:-1600}" --samples "${3:-128}" --states "${4:-shut,fallen}" $TRAP_ARGS > "$OUT/trap.log" 2>&1
  grep -E "Error|Traceback|File .*py|CHECK|TRAP" "$OUT/trap.log" | tail -20
  grep -qE "TRAP STILLS OK" "$OUT/trap.log" && exit 0
  grep -q Traceback "$OUT/trap.log" && exit 1  # a script error, not a GPU crash
  echo "crashed (try $try)"
done
exit 1
