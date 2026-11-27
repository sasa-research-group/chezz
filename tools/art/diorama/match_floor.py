# /// script
# dependencies = ["numpy", "pillow"]
# ///
"""match_floor.py BAKE SET [glob=throw0_*.png]: colour-match a square's baked frames to the set picture under them.

Why (2026-11-27): the set picture the game draws (public/diorama/set5.webp) was baked on 2026-11-20; the builder has
since moved into the repo (stage.py + look.env) and renders the same floor a little warmer (blue about 8/255 lower on
plain tiles nowhere near any prop). The game's grade (saturation 1.4) makes that read as a beige tile under every
square sprite baked since (lever, gate). Rebaking the set would change the approved look, so each sprite is matched
to the set instead: one gain per colour channel, in linear light, from the frame's opaque pixels compared with the
set's own pixels at the same spot (its exposure undone; sprites are baked at exposure 0). The median ratio ignores
the prop itself (handle, plate), which the set never had.

BAKE: a runner's square folders (sq{i}{j}/ with throw.json: its crop and res), or one such folder. SET: the set's
picture and json without the extension (public/diorama/set5). Rewrites the frames in place; writes match.json
(the gains) so a second run is a no-op."""
import glob, json, os, sys

import numpy as np
from PIL import Image


def to_lin(c):
    c = np.asarray(c, float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055) * 255.0


def gains(sprite_rgba, under_rgb, set_exposure):
    """Per-channel gain that brings the sprite's floor to the set's colour. sprite_rgba: HxWx4 uint8 (exposure 0);
    under_rgb: the set's HxWx3 uint8 pixels at the same spot (baked at set_exposure)."""
    a = sprite_rgba[..., 3] >= 250
    s = to_lin(sprite_rgba[..., :3])[a]
    u = to_lin(under_rgb)[a] * 2.0 ** -set_exposure
    ls, lu = s.mean(1), u.mean(1)
    ok = (lu > 0.01) & (ls > 0.01) & (ls / np.maximum(lu, 1e-6) > 0.6) & (ls / np.maximum(lu, 1e-6) < 1.6)
    if ok.sum() < 200:
        return np.ones(3)
    return np.median(u[ok] / s[ok], axis=0)


def apply(sprite_rgba, g):
    out = sprite_rgba.copy()
    out[..., :3] = np.round(to_srgb(to_lin(sprite_rgba[..., :3]) * g)).astype(np.uint8)
    return out


def match_square(d, set_img, set_info, pattern):
    if os.path.exists(os.path.join(d, "match.json")):
        print(d, "already matched"); return
    info = json.load(open(os.path.join(d, "throw.json")))
    rx, ry = info["res"]; u0, v0, u1, v1 = info["crop"]
    if set_img.size != (rx, ry):
        sys.exit("set picture is %s, the bake %s" % (set_img.size, (rx, ry)))
    x0, y0 = round(u0 * rx), round((1 - v1) * ry)
    frames = sorted(glob.glob(os.path.join(d, pattern)))
    frames = [f for f in frames if not f.endswith("-glow.png")]
    first = np.asarray(Image.open(frames[0]).convert("RGBA"))
    h, w = first.shape[:2]
    under = np.asarray(set_img)[y0:y0 + h, x0:x0 + w]
    g = gains(first, under, set_info["exposure"])   # one gain for the whole clip: the floor never changes
    for f in frames:
        Image.fromarray(apply(np.asarray(Image.open(f).convert("RGBA")), g)).save(f)
    json.dump({"gain": list(map(float, g)), "set": set_info.get("at", ""), "frames": len(frames)},
              open(os.path.join(d, "match.json"), "w"))
    print(d, "gain %.3f %.3f %.3f" % tuple(g), len(frames), "frames")


if __name__ == "__main__":
    bake, setp = sys.argv[1], sys.argv[2]
    pattern = sys.argv[3] if len(sys.argv) > 3 else "throw0_*.png"
    set_img = Image.open(setp + ".webp").convert("RGB")
    set_info = json.load(open(setp + ".json"))
    dirs = [bake] if os.path.exists(os.path.join(bake, "throw.json")) else sorted(
        p for p in glob.glob(os.path.join(bake, "sq*")) if os.path.exists(os.path.join(p, "throw.json")))
    for d in dirs:
        match_square(d, set_img, set_info, pattern)
