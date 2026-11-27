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
