"""match_floor: the gain brings a warm-tinted floor back to the set's colour and leaves the prop out of the sum.
Run: uv run --no-project --with pytest --with numpy --with pillow python -m pytest test_match_floor.py"""
import numpy as np

import match_floor as mf


def _floor(rgb, h=40, w=60):
    return np.tile(np.array(rgb, np.uint8), (h, w, 1))


def test_gain_undoes_a_warm_tint():
    under = _floor((108, 106, 103))                     # the set's grey floor, baked at exposure -0.35
    g_true = np.array([1.25, 1.12, 0.93])              # the sprite: brighter (exposure 0) and warmer
    lin = mf.to_lin(under) * 2 ** 0.35 / g_true
    sprite = np.concatenate([np.round(mf.to_srgb(lin)).astype(np.uint8), np.full((40, 60, 1), 255, np.uint8)], -1)
    g = mf.gains(sprite, under, -0.35)
    assert np.allclose(g, g_true, atol=0.03)
    fixed = mf.apply(sprite, g)[..., :3].astype(float)
    back = mf.to_srgb(mf.to_lin(under) * 2 ** 0.35)    # the set's floor at exposure 0, as the game sees both
    assert np.abs(fixed - back).max() <= 2


def test_the_prop_does_not_pull_the_gain():
    under = _floor((108, 106, 103))
    sprite = np.concatenate([under, np.full((40, 60, 1), 255, np.uint8)], -1).copy()
    sprite[:, :20, :3] = (200, 120, 40)                # a third of it is the oak handle, far from the floor
    g = mf.gains(sprite, under, 0.0)
    assert np.allclose(g, 1.0, atol=0.02)


def test_see_through_pixels_are_ignored_and_kept():
    under = _floor((108, 106, 103))
    sprite = np.concatenate([under, np.zeros((40, 60, 1), np.uint8)], -1)
    assert np.allclose(mf.gains(sprite, under, 0.0), 1.0)   # nothing opaque: no change
    assert (mf.apply(sprite, np.array([1.2, 1, 0.9]))[..., 3] == 0).all()


def test_every_layer_gets_the_first_layers_gain(tmp_path):
    import json
    from PIL import Image
    set_img = Image.fromarray(_floor((108, 106, 103), 40, 40))
    d = tmp_path / "sq22"; d.mkdir()
    json.dump({"res": [40, 40], "crop": [0.25, 0.25, 0.75, 0.75]}, open(d / "swing.json", "w"))
    warm = np.concatenate([_floor((120, 110, 90), 20, 20), np.full((20, 20, 1), 255, np.uint8)], -1)
    Image.fromarray(warm).save(d / "swing0_00.png")
    front = warm.copy(); front[..., 3] = 0; front[:2, :2, 3] = 255      # a few opaque arch pixels, no floor
    Image.fromarray(front).save(d / "front0_00.png")
    Image.fromarray(warm).save(d / "front0_00-glow.png")                 # glow maps are left alone
    mf.match_square(str(d), set_img, {"exposure": 0.0}, ("swing", "front"))
    g = np.array(json.load(open(d / "match.json"))["gain"])
    assert np.allclose(np.asarray(Image.open(d / "swing0_00.png"))[0, 0, :3], (108, 106, 103), atol=2)
    assert np.allclose(np.asarray(Image.open(d / "front0_00.png"))[0, 0, :3], (108, 106, 103), atol=2)
    assert (np.asarray(Image.open(d / "front0_00-glow.png")) == warm).all()
    assert json.load(open(d / "match.json"))["frames"] == 2 and g[2] > 1.1


def test_a_prop_covering_most_of_the_frame_does_not_pull_the_gain():
    rng = np.random.default_rng(1)
    under = _floor((108, 106, 103), 60, 60)
    g_true = np.array([1.05, 1.15, 1.35])
    lin = mf.to_lin(under) / g_true
    sprite = np.concatenate([np.round(mf.to_srgb(lin)).astype(np.uint8), np.full((60, 60, 1), 255, np.uint8)], -1)
    door = rng.integers((70, 60, 40), (140, 110, 80), (60, 40, 3))   # oak doors over two thirds, grain all over
    sprite[:, :40, :3] = door
    assert np.allclose(mf.gains(sprite, under, 0.0), g_true, atol=0.03)
