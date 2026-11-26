# The level bake's layout and key, as src/diorama/levelBake.ts writes them (both tests pin the same key).
# A layout is the board size and the squares a bake draws, never the pieces: same layout, same bake.
#   python3 level_layout.py [puzzles.json]   -> one line per puzzle: key w h name
import json, sys

BAKED_KINDS = ("hole", "wall", "eye", "sludge", "trapdoor", "snare", "gate", "lever", "plate")


def layout_of_puzzle(pz):
    c = []
    for field, kind in (("holes", "hole"), ("walls", "wall"), ("eyes", "eye"), ("sludge", "sludge"),
                        ("trapdoors", "trapdoor"), ("snares", "snare"), ("gates", "gate")):
        c += [(p["x"], p["y"], kind) for p in pz.get(field) or []]
    c += [(s["x"], s["y"], s["kind"]) for s in pz.get("switches") or []]
    cells = sorted((x, y, k) for x, y, k in c if k in BAKED_KINDS)
    cells.sort(key=lambda t: (t[1], t[0], t[2]))
    return {"w": pz["width"], "h": pz["height"], "cells": cells}


def layout_key(l):
    s = "%dx%d|" % (l["w"], l["h"]) + ";".join("%d,%d,%s" % c for c in l["cells"])
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return "%08x" % h


if __name__ == "__main__":
    data = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "src/puzzle/puzzles.json"))
    for pz in data["puzzles"]:
        l = layout_of_puzzle(pz)
        print(layout_key(l), l["w"], l["h"], pz.get("name", ""))
