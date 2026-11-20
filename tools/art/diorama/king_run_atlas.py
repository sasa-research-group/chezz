# king_run_atlas.py DIR OUTDIR [scale=0.7] [q=88] [fps=30]: pack bake_king_sprites.py --clip's run frames into
# public/diorama/king-run{k}.webp (one sheet per heading, frames on a 7 x 2 grid, lossy with exact alpha, colours bled
# under the transparent pixels), king-run{k}-glow.webp (same layout) and king-run.json (run.json + the grid, the
# frame rate and the headings that have a sheet). Frames are scaled by `scale`: the run is seen moving, at game size.
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
scale, q, fps = float(kv.get("scale", 0.7)), int(kv.get("q", 88)), float(kv.get("fps", 30))
info = json.load(open(f"{src}/run.json"))
nf = info["frames"]
have = sorted({int(re.match(r"run(\d)_", os.path.basename(p)).group(1)) for p in glob.glob(f"{src}/run?_00.png")})
have = [k for k in have if all(os.path.exists(f"{src}/run{k}_{i:02d}.png") for i in range(nf))]
cols = (nf + 1) // 2
w0, h0 = Image.open(f"{src}/run{have[0]}_00.png").size
w, h = round(w0 * scale), round(h0 * scale)
sizes = {}
for k in have:
    at = Image.new("RGBA", (cols * w, 2 * h)); gl = Image.new("RGB", (cols * w, 2 * h))
    for i in range(nf):
        im = Image.open(f"{src}/run{k}_{i:02d}.png").convert("RGBA").resize((w, h), Image.LANCZOS)
        g = Image.open(f"{src}/run{k}_{i:02d}-glow.png").convert("RGB").resize((w, h), Image.LANCZOS)
        at.paste(bleed(im), ((i % cols) * w, (i // cols) * h)); gl.paste(g, ((i % cols) * w, (i // cols) * h))
    at.save(f"{out}/king-run{k}.webp", quality=q, alpha_quality=100, method=6, exact=True)
    gl.save(f"{out}/king-run{k}-glow.webp", quality=80, method=6)
    sizes[k] = (os.path.getsize(f"{out}/king-run{k}.webp"), os.path.getsize(f"{out}/king-run{k}-glow.webp"))
info.update(tiles=[cols, 2], tile=[w, h], scale=scale, fps=fps, have=have)
json.dump(info, open(f"{out}/king-run.json", "w"), indent=1)
print("SHEET", cols * w, 2 * h, "tile", w, h, "sizes", sizes)
