#!/bin/bash
# runbake.sh GAIT OUT [RES=3600] [SAMPLES=256] [ONLY=0,2] [FRAMES=16]
# Bakes a king gait loop (king_motion.GAITS: walk, jog, run) in the locked king look: rim 1100 on the fibres
# only, plus the crown spot. Metal crashes now and then: rerun the same line, it resumes at the missing frames.
# GUARD=king_guard.json PROP=royal_blade.glb: he carries the sword in the idle guard (king_motion.hold_guard).
# Needs the stage scripts and paid assets under ~/.dos/scratch/d84406ef.
G=${1:?gait}; OUT=${2:?out dir}
HERE=$(cd "$(dirname "$0")" && pwd)
cd ~/.dos/scratch/d84406ef/stage || exit 1
source tools/base_r78.env
export KING_RIM=1100 KING_RIM_FIBONLY=1 RIM_PLAY=1 RIM_EL=8.5 CROWN_RIM=2500 CROWN_EL=8.5
P=~/.dos/scratch/d84406ef/paid/out
export TILE_GLB=$P/tile/model_glb__model.glb,$P/tile2/model_glb__model.glb TILE_VAL=0.5 TILE_FILL=1.05 TILE_JIT=1.6 JOINT_MOSS=1.8
/Applications/Blender.app/Contents/MacOS/Blender -b --python "$HERE/bake_king_sprites.py" -- --out "$OUT" --gait "$G" \
  --res "${3:-3600}" --samples "${4:-256}" --only "${5:-0,2}" --frames "${6:-16}" 2>&1 \
  | grep -E "Error|Traceback|File .*py|line [0-9]|CHECK|GAIT|FIG|_SECONDS|CROP|RENDER_TOTAL|DONE|CAPE|SKIRT"
