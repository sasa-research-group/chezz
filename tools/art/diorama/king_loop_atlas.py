# king_loop_atlas.py DIR OUTDIR [name=walk] [scale=0.8] [q=88] [cps=2] [rows=2]: pack a bake_king_sprites.py --gait loop
# or --strike (DIR/{name}{k}_{i}.png) into public/diorama/king-{name}{k}.webp (one sheet per heading, frames on a grid
# of `rows` rows: 4 for the 29-frame strike, so a sheet stays under 8192 px wide for phone GPUs;
# lossy with exact alpha, colours bled under the transparent pixels), king-{name}{k}-glow.webp (same layout) and
# king-{name}.json ({name}.json + the grid, the headings that have a sheet, cps: loops per second at the game's
# pace). The game moves him at cycle * cps stage units a second, so the feet stay planted.
import glob, json, os, re, sys
from PIL import Image
import numpy as np

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

src, out = sys.argv[1], sys.argv[2]
kv = dict(a.split("=") for a in sys.argv[3:])
name = kv.get("name", "walk")
scale, q, cps = float(kv.get("scale", 0.8)), int(kv.get("q", 88)), float(kv.get("cps", 2))
info = json.load(open(f"{src}/{name}.json"))
nf = info["frames"]
have = sorted({int(re.match(name + r"(\d)_", os.path.basename(p)).group(1)) for p in glob.glob(f"{src}/{name}?_00.png")})
have = [k for k in have if all(os.path.exists(f"{src}/{name}{k}_{i:02d}.png") for i in range(nf))]
rows = int(kv.get("rows", 2))
cols = -(-nf // rows)
w0, h0 = Image.open(f"{src}/{name}{have[0]}_00.png").size
w, h = round(w0 * scale), round(h0 * scale)
sizes = {}
for k in have:
    at = Image.new("RGBA", (cols * w, rows * h)); gl = Image.new("RGB", (cols * w, rows * h))
    for i in range(nf):
        im = Image.open(f"{src}/{name}{k}_{i:02d}.png").convert("RGBA").resize((w, h), Image.LANCZOS)
        g = Image.open(f"{src}/{name}{k}_{i:02d}-glow.png").convert("RGB").resize((w, h), Image.LANCZOS)
        at.paste(bleed(im), ((i % cols) * w, (i // cols) * h)); gl.paste(g, ((i % cols) * w, (i // cols) * h))
    at.save(f"{out}/king-{name}{k}.webp", quality=q, alpha_quality=100, method=6, exact=True)
    gl.save(f"{out}/king-{name}{k}-glow.webp", quality=80, method=6)
    sizes[k] = (os.path.getsize(f"{out}/king-{name}{k}.webp"), os.path.getsize(f"{out}/king-{name}{k}-glow.webp"))
info.update(tiles=[cols, rows], tile=[w, h], scale=scale, have=have)
if info.get("cycle"):  # a gait loop plays at the game's pace; a strike keeps the fps it was baked at
    info.update(cps=cps, fps=cps * nf)
json.dump(info, open(f"{out}/king-{name}.json", "w"), indent=1)
print("SHEET", cols * w, rows * h, "tile", w, h, "sizes", sizes, "speed", info.get("cycle") and info["cycle"] * cps, "stage/s")
