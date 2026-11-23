#!/bin/bash
# sweep.sh "name k=v ..." ...: runs rook_pose.py (no render) in parallel, prints each run's checks on one line.
cd ~/.dos/scratch/d84406ef/rook
B="flen=0.11 fist=0.09 hz=0.32 hy=0.34 hx=-0.14 render=0"
for spec in "$@"; do
  ( set -- $spec; n=$1; shift
    /Applications/Blender.app/Contents/MacOS/Blender -b --python ~/chezz-puzzle/tools/art/diorama/rook_pose.py -- rp/$n $B "$@" 2>&1 \
      | grep -E "REACH|CLIP |SELF " > rp/$n.txt ) &
done
wait
for spec in "$@"; do
  set -- $spec
  echo "$1: $(sed -E 's/REACH.*elbow angle //; s/crossing faces//; s/ +/ /g' rp/$1.txt | tr '\n' '|')"
done
