#!/bin/bash
# rungatebake.sh OUT [SQUARES=all] [RES=2400] [SAMPLES=128]: the gate's swing sprites, two layers (build_gate_cycles.py
# --bake), one folder per square, OUT/sq{i}{j}/swing0_NN.png (under figures) + front0_NN.png (over the figure in the doorway) + swing.json; TURN=q bakes the quarter-turned gate (a wall running front to back). Per square: the fixed camera
# sees each square from its own angle. SQUARES is "all" or "3,1 0,4 ...". Resumes: a finished frame is skipped.
OUT=${1:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
source "$HERE/abspaths.sh"
mkdir -p "$OUT"; OUT=$(abspath "$OUT")
SQ=${2:-all}
[ "$SQ" = all ] && SQ=$(for i in 0 1 2 3 4; do for j in 0 1 2 3 4; do echo -n "$i,$j "; done; done)
# NX/NY set (bake_level.py): a level's own board, folders sq{i}_{j} (squares past 9 need the gap)
BOARD=${NX:+--nx $NX --ny $NY}
# the set's own look (look.env), so the gate's stone matches the set it is pasted into
source "$HERE/look.env"
for s in $SQ; do
  if [ -n "$NX" ]; then D="$OUT/sq${s/,/_}"; else D="$OUT/sq${s/,/}"; fi; mkdir -p "$D"
  [ -f "$D/swing.json" ] && { echo "$s done"; continue; }
  ok=0
  for try in 1 2 3 4 5 6 7 8; do
    "${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}" -b --python "$HERE/build_gate_cycles.py" -- \
      --out "$D" --res "${3:-2400}" --samples "${4:-128}" --square "$s" --bake --posts ${TURN:+--turn 1.5707963} $BOARD $GATE_ARGS > "$D/bake.log" 2>&1
    grep -qE "GATE BAKE OK" "$D/bake.log" && { ok=1; break; }
    grep -qE "Traceback|SyntaxError" "$D/bake.log" && { grep -E "Error|Traceback|File .*py" "$D/bake.log" | tail -8; exit 1; }
    echo "$s crashed (try $try)"
  done
  [ $ok = 1 ] || exit 1
  echo "$s baked $(grep -c RENDER_SECONDS "$D/bake.log") frames, $(grep CROP "$D/bake.log")"
done
echo "GATE BAKE ALL OK"
