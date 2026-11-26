# The level bake's layout and key, as src/diorama/levelBake.ts writes them (both tests pin the same key).
# A layout is the board size and the squares a bake draws, never the pieces: same layout, same bake.
#   python3 level_layout.py [puzzles.json]   -> one line per puzzle: key w h name
import json, math, sys

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


# Panning stops (Wesley 2026-11-26: long levels). A board bigger than one view is baked from several "stops": the
# same camera slid along the board, never turned, each one framing a WINDOW of squares the way a set that size is
# framed. Stops sit evenly from one end to the other, at most STEP squares apart, so neighbours overlap.
WINDOW = (8, 6)  # squares a stop shows: across, deep (depth reads foreshortened at 35 degrees, so fewer rows)
STEP = 3


def window(nx, ny, win=WINDOW):
    return min(nx, win[0]), min(ny, win[1])


def stop_axis(n, m, step=STEP):
    """Window centres along one axis, in squares from the board's middle."""
    if n <= m:
        return [0.0]
    span, k = (n - m) / 2, math.ceil((n - m) / step) + 1
    return [round(-span + 2 * span * i / (k - 1), 4) for i in range(k)]


def stops(nx, ny, win=WINDOW, step=STEP):
    """The stops of an nx x ny board as (x, y) window centres in squares (stage axes: x right, y toward the back),
    front row first. Empty when the whole board fits one view (the set's own fitted camera, no pan)."""
    mx, my = window(nx, ny, win)
    if (mx, my) == (nx, ny):
        return []
    return [(x, y) for y in stop_axis(ny, my, step) for x in stop_axis(nx, mx, step)]


def sees(stop, sq, nx, ny, win=WINDOW):
    """Does a stop frame stage square sq = (i, j) (i from the left, j from the front) whole, so it gets its own
    sprite from there: is it inside the stop's window? (Squares just past it show at the frame's edge, cut off.)"""
    mx, my = window(nx, ny, win)
    dx, dy = sq[0] - (nx - 1) / 2 - stop[0], sq[1] - (ny - 1) / 2 - stop[1]
    return abs(dx) <= mx / 2 and abs(dy) <= my / 2


if __name__ == "__main__":
    data = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "src/puzzle/puzzles.json"))
    for pz in data["puzzles"]:
        l = layout_of_puzzle(pz)
        print(layout_key(l), l["w"], l["h"], pz.get("name", ""))
