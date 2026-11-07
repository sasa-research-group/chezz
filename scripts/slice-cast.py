#!/usr/bin/env python3
"""Slice a character-select sheet into one PNG per piece for public/art/cast.

The sheet (see the "Sprite cast pipeline" section of the studio's Tooling tab,
src/art/Tooling.tsx) is a title band over a regular grid of framed tiles: one row
per variant, six columns in the order pawn, knight, bishop, rook, queen, king.
Each tile is a flat beige backdrop with the character drawn on it and a white
label box overlapping the frame's bottom edge.

For every tile this writes <variant>-<kind>.png: the character cut out of its
backdrop (RGBA, 256 px wide, LANCZOS), which is what PieceSprite.tsx loads.
Nothing else goes into the output directory, because vite ships everything under
public/. The three inspection aids go to --aids-dir when given, else to a fresh
temporary directory whose path is printed at the end: <variant>-<kind>-token.png
(the framed tile, uncut), _sheet.png (a contact sheet of the cut-outs on a teal
ground, to check that the flood fill ate only the backdrop) and _meta.json (each
tile's box on the sheet and the fraction of pixels kept).

How the tiles are found: the backdrop colour is the median of BG_SAMPLE, an
empty patch at the top of the first tile, so keep the title band and the first
tile where they are on the reference sheet (2528 x 1696). Rows are runs of sheet
rows that are mostly that beige; the bottom 26 px of each run is dropped because
the label box starts there. A run ends where the beige fraction drops under 8%,
which the label boxes and the wide misfits push up, so on the reference sheet the
three rows keep 372 / 367 / 358 px. Columns come from the first two beige column
runs, whose spacing gives the pitch for all six. A sheet that does not detect
as --variants rows by six columns stops here, before anything is written.

Needs python3 with Pillow and numpy: python3 -c "import PIL, numpy".

Usage: python3 scripts/slice-cast.py <sheet.png> public/art/cast [--aids-dir DIR]
                                     [--variants rebel,royal,misfit]
"""
import argparse
import json
import os
import sys
import tempfile
from collections import deque

import numpy as np
from PIL import Image

KINDS = ["pawn", "knight", "bishop", "rook", "queen", "king"]
DEFAULT_VARIANTS = ["rebel", "royal", "misfit"]
# Sheet rows 250-280, columns 200-330: an empty patch of the first tile's backdrop.
BG_SAMPLE = (slice(250, 280), slice(200, 330))
BEIGE_TOLERANCE = 45    # sum of |rgb - bg| for a sheet pixel to count as backdrop when finding tiles
CUT_TOLERANCE = 75      # the looser match the flood fill uses inside a tile
LABEL_SLIVER = 26       # px of the label box that overlap the bottom of every tile row
ROW_MIN, COL_MIN = 150, 300  # shortest beige run that counts as a tile row / column
FRAME = 14              # px of dark frame to keep around a token
OUT_WIDTH = 256         # pieces render at ~100 px, so 256 is plenty even on retina
THUMB = 300             # contact-sheet cell


def runs(mask, minlen):
    """Start/end index pairs (inclusive) of every run of True in mask at least minlen long."""
    r, s = [], None
    for i, v in enumerate(mask):
        if v and s is None:
            s = i
        if not v and s is not None:
            if i - s >= minlen:
                r.append((s, i - 1))
            s = None
    if s is not None and len(mask) - s >= minlen:
        r.append((s, len(mask) - 1))
    return r


def find_grid(a, bg, n_rows):
    """Tile boxes on the sheet: (rows, cols) as lists of inclusive (start, end) pairs."""
    H = a.shape[0]
    beige = np.abs(a - bg).sum(axis=2) < BEIGE_TOLERANCE
    rowfrac = beige.mean(axis=1)
    rows = [(y0, y1 - LABEL_SLIVER) for y0, y1 in runs(rowfrac > 0.08, ROW_MIN)]
    band = np.zeros(H, bool)
    for y0, y1 in rows:
        band[y0:y1 + 1] = True
    colfrac = beige[band].mean(axis=0)
    found = runs(colfrac > 0.02, COL_MIN)
    if len(rows) != n_rows or len(found) < 2:
        sys.exit(f"detection failed: {len(rows)} tile rows, want {n_rows} (--variants); {len(found)} beige column runs, want at least 2")
    # The sheet is a regular grid: take the pitch from the first two clean columns.
    (ax0, ax1), (bx0, _) = found[0], found[1]
    pitch, width = bx0 - ax0, ax1 - ax0
    cols = [(ax0 + k * pitch, ax0 + k * pitch + width) for k in range(len(KINDS))]
    print("cols", cols)
    print("rows", rows)
    if cols[-1][1] >= a.shape[1]:
        sys.exit(f"detection failed: column {len(KINDS)} would end at x={cols[-1][1]}, past the sheet's width {a.shape[1]}")
    return rows, cols


def cut_out(tile, bg):
    """RGBA cut-out of one tile: backdrop pixels reachable from the tile's edge become transparent."""
    h, w = tile.shape[:2]
    close = np.abs(tile - bg).sum(axis=2) < CUT_TOLERANCE
    seen = np.zeros((h, w), bool)
    q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and close[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([tile.astype(np.uint8), alpha]), "RGBA"), float(1 - seen.mean())


def slice_sheet(src, out, aids, variants):
    if os.path.abspath(aids) == os.path.abspath(out):
        sys.exit("--aids-dir must not be the output directory: vite ships everything under public/")
    im = Image.open(src).convert("RGB")
    W, H = im.size
    a = np.asarray(im).astype(int)
    bg = np.median(a[BG_SAMPLE].reshape(-1, 3), axis=0)
    print("beige", bg)
    rows, cols = find_grid(a, bg, len(variants))
    os.makedirs(out, exist_ok=True)
    os.makedirs(aids, exist_ok=True)
    meta = {}
    sheet = Image.new("RGBA", (len(KINDS) * THUMB, len(variants) * THUMB), (90, 140, 150, 255))
    for ri, (y0, y1) in enumerate(rows):
        for ci, (x0, x1) in enumerate(cols):
            name = f"{variants[ri]}-{KINDS[ci]}"
            # Token: the tile with its dark frame.
            im.crop((max(0, x0 - FRAME), max(0, y0 - FRAME), min(W, x1 + FRAME + 1), min(H, y1 + FRAME + 1))).save(f"{aids}/{name}-token.png")
            tile = np.asarray(im.crop((x0, y0, x1 + 1, y1 + 1))).astype(int)
            h, w = tile.shape[:2]
            cut, kept = cut_out(tile, bg)
            cut.resize((OUT_WIDTH, round(OUT_WIDTH * h / w)), Image.LANCZOS).save(f"{out}/{name}.png")
            meta[name] = {"box": [int(x0), int(y0), int(x1), int(y1)], "kept": round(kept, 2)}
            th = cut.resize((THUMB, THUMB))
            sheet.paste(th, (ci * THUMB, ri * THUMB), th)
    sheet.save(f"{aids}/_sheet.png")
    with open(f"{aids}/_meta.json", "w") as f:
        json.dump(meta, f, indent=1)
    print({k: v["kept"] for k, v in meta.items()})
    print(f"{len(meta)} portraits -> {out}; inspection aids (tokens, _sheet.png, _meta.json) -> {aids}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("sheet", help="the character-select sheet (PNG)")
    p.add_argument("out", help="where <variant>-<kind>.png go, normally public/art/cast")
    p.add_argument("--aids-dir", help="where the -token.png, _sheet.png and _meta.json inspection aids go (default: a new temporary directory, printed at the end; never OUT)")
    p.add_argument("--variants", default=",".join(DEFAULT_VARIANTS), help="row names, top to bottom (default: %(default)s)")
    args = p.parse_args()
    variants = [v.strip() for v in args.variants.split(",") if v.strip()]
    slice_sheet(args.sheet, args.out, args.aids_dir or tempfile.mkdtemp(prefix="cast-aids-"), variants)


if __name__ == "__main__":
    main()
