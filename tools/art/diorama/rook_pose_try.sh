#!/bin/bash
# rp.sh NAME [k=v ...]: rook idle pose -> rook/rp/NAME.jpg (draft | front | 3/4 | back | fist)
cd ~/.dos/scratch/d84406ef/rook
n=$1; shift
/Applications/Blender.app/Contents/MacOS/Blender -b --python ~/chezz-puzzle/tools/art/diorama/rook_pose.py -- rp/$n "$@" 2>&1 | grep -E "REACH|HANDLE|CLIP|SELF|GROUPS|Error|Traceback|line [0-9]"
python3 -c "
from PIL import Image
n='rp/$n'; ims=[Image.open('pose1.png').convert('RGB')]+[Image.open(f'{n}/{v}.png').convert('RGB') for v in ('front','34','back','fist')]
ims=[i.resize((int(i.width*500/i.height),500)) for i in ims]
o=Image.new('RGB',(sum(i.width for i in ims),500)); x=0
for i in ims: o.paste(i,(x,0)); x+=i.width
o.save(n+'.jpg',quality=85)"
