# /// script
# dependencies = ["numpy", "pillow"]
# ///
"""match_floor.py BAKE SET [LAYER ...=throw]: colour-match a square's baked frames to the set picture under them.

Why (2026-11-27): the set picture the game draws (public/diorama/set5.webp) was baked on 2026-11-20; the builder has
since moved into the repo (stage.py + look.env) and renders the same floor a little warmer (blue about 8/255 lower on
plain tiles nowhere near any prop). The game's grade (saturation 1.4) makes that read as a beige tile under every
square sprite baked since (lever, gate). Rebaking the set would change the approved look, so each sprite is matched
to the set instead: one gain per colour channel, in linear light, from the frame's opaque pixels compared with the
set's own pixels at the same spot (its exposure undone; sprites are baked at exposure 0). The median ratio ignores
the prop itself (handle, plate), which the set never had.

BAKE: a runner's square folders (sq{i}{j}/ with LAYER.json: its crop and res), or one such folder. LAYERs: the
sprite layers, frames LAYER0_NN.png; the first gives the gain (it has the floor), every layer gets it (the gate's
front layer has no floor of its own: `match_floor.py OUT SET swing front`). --like OTHER: take each square's gain
from another bake's match.json (OTHER/sq{i}{j}) instead of measuring it, for a prop that hides its floor (the snare's
roots and glow leave a few hundred noisy floor pixels; the lever's bare slot floor is the clean measurement, and
both were baked with the same builder). SET: the set's
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
    return floor_gain(sprite_rgba, under_rgb, set_exposure)[0]


def floor_gain(sprite_rgba, under_rgb, set_exposure):
    """Per-channel gain that brings the sprite's floor to the set's colour. sprite_rgba: HxWx4 uint8 (exposure 0);
    under_rgb: the set's HxWx3 uint8 pixels at the same spot (baked at set_exposure).
    The floor is the one thing the sprite and the set share, so its pixels all want about the same gain while the
    prop's (doors, handle) scatter: take the densest cluster of per-pixel log gains, not a median over everything
    (the gate's closed doors cover most of its frame and pulled a plain median to blue 2.2). Also returns how many
    pixels agree with it, so the caller can pick the frame that shows the most floor."""
    a = sprite_rgba[..., 3] >= 250
    s = to_lin(sprite_rgba[..., :3])[a]
    u = to_lin(under_rgb)[a] * 2.0 ** -set_exposure
    ls, lu = s.mean(1), u.mean(1)
    ok = ((s.min(1) > 0.004) & (u.min(1) > 0.004) & (ls / np.maximum(lu, 1e-6) > 0.6)
          & (ls / np.maximum(lu, 1e-6) < 1.6))
    if ok.sum() < 200:
        return np.ones(3), 0
    r = np.log(u[ok] / s[ok])
    q = np.floor(r / 0.04).astype(int)                       # 3D histogram of log gains, bins 4% wide
    keys, counts = np.unique(q, axis=0, return_counts=True)
    c = (keys[counts.argmax()] + 0.5) * 0.04
    for _ in range(8):                                       # refine: median of the pixels near the peak
        near = np.abs(r - c).max(1) < 0.08
        c = np.median(r[near], axis=0)
    return np.exp(c), int((np.abs(r - c).max(1) < 0.08).sum())


def apply(sprite_rgba, g):
    out = sprite_rgba.copy()
    out[..., :3] = np.round(to_srgb(to_lin(sprite_rgba[..., :3]) * g)).astype(np.uint8)
    return out


def layer_frames(d, layer):
    return [f for f in sorted(glob.glob(os.path.join(d, layer + "0_*.png"))) if not f.endswith("-glow.png")]


def match_square(d, set_img, set_info, layers=("throw",), like=None):
    if os.path.exists(os.path.join(d, "match.json")):
        print(d, "already matched"); return
    info = json.load(open(os.path.join(d, layers[0] + ".json")))
    rx, ry = info["res"]; u0, v0, u1, v1 = info["crop"]
    if set_img.size != (rx, ry):
        sys.exit("set picture is %s, the bake %s" % (set_img.size, (rx, ry)))
    x0, y0 = round(u0 * rx), round((1 - v1) * ry)
    frames = layer_frames(d, layers[0])
    best = (np.ones(3), 0, None)
    if like:
        best = (np.array(json.load(open(os.path.join(like, os.path.basename(d.rstrip("/")), "match.json")))["gain"]),
                0, like)
    for f in ([] if like else frames):   # one gain for the whole clip (the floor never changes), from the frame showing the most floor
        im = np.asarray(Image.open(f).convert("RGBA"))
        h, w = im.shape[:2]
        g, n = floor_gain(im, np.asarray(set_img)[y0:y0 + h, x0:x0 + w], set_info["exposure"])
        if n > best[1]:
            best = (g, n, os.path.basename(f))
    g, n, src = best
    frames = [f for layer in layers for f in layer_frames(d, layer)]
    for f in frames:
        Image.fromarray(apply(np.asarray(Image.open(f).convert("RGBA")), g)).save(f)
    json.dump({"gain": list(map(float, g)), "from": src, "floor_px": n, "set": set_info.get("at", ""), "frames": len(frames)},
              open(os.path.join(d, "match.json"), "w"))
    print(d, "gain %.3f %.3f %.3f" % tuple(g), "from", src, len(frames), "frames")


if __name__ == "__main__":
    args = sys.argv[1:]
    like = None
    if "--like" in args:
        i = args.index("--like"); like = args[i + 1]; del args[i:i + 2]
    bake, setp = args[0], args[1]
    layers = tuple(args[2:]) or ("throw",)
    set_img = Image.open(setp + ".webp").convert("RGB")
    set_info = json.load(open(setp + ".json"))
    dirs = [bake] if os.path.exists(os.path.join(bake, layers[0] + ".json")) else sorted(
        p for p in glob.glob(os.path.join(bake, "sq*")) if os.path.exists(os.path.join(p, layers[0] + ".json")))
    for d in dirs:
        match_square(d, set_img, set_info, layers, like)
