# king_atlas.py DIR OUTDIR: pack bake_king_sprites.py's 8 headings into public/diorama/king8.webp (4 x 2 tiles,
# straight alpha, colours bled under the transparent pixels), king8-glow.png (same layout) and king8.json (king.json + the tile grid).
import json, sys
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
def bleed(im, n=12):
    """Spread edge colours under the fully transparent pixels, so texture filtering at his edge never mixes in
    black (the browser samples straight alpha)."""
    a = np.asarray(im, np.float32)
    rgb, al = a[..., :3].copy(), a[..., 3]
    have = al > 0
    for _ in range(n):
        acc = np.zeros_like(rgb); cnt = np.zeros(al.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            h = np.roll(have, (dy, dx), (0, 1)); acc += np.roll(rgb, (dy, dx), (0, 1)) * h[..., None]; cnt += h
        new = ~have & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]; have = have | new
    return Image.fromarray(np.dstack([rgb, al]).round().clip(0, 255).astype(np.uint8), "RGBA")
ims = [bleed(Image.open(f"{src}/king{k}.png").convert("RGBA")) for k in range(8)]
gls = [Image.open(f"{src}/king{k}-glow.png").convert("RGB") for k in range(8)]
w, h = ims[0].size
at = Image.new("RGBA", (4 * w, 2 * h)); gl = Image.new("RGB", (4 * w, 2 * h))
for k in range(8):
    at.paste(ims[k], ((k % 4) * w, (k // 4) * h)); gl.paste(gls[k], ((k % 4) * w, (k // 4) * h))
at.save(f"{out}/king8.webp", lossless=True, quality=100, method=6, exact=True)
gl.save(f"{out}/king8-glow.png", optimize=True)
info = json.load(open(f"{src}/king.json")); info["tiles"] = [4, 2]; info["tile"] = [w, h]
json.dump(info, open(f"{out}/king8.json", "w"), indent=1)
print(at.size)
