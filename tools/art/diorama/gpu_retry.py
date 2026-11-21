"""Cycles renders that survive a Metal GPU reset.

On this Mac, Blender's Cycles work can't pause quickly, so when something else needs the graphics chip (a game, Chrome's
3D view, the screen, another Blender) macOS sometimes resets the chip ("CDM Kill timeout"). Blender is the innocent
victim: the render fails with "Command buffer not completed. status = 5 ... kIOGPUCommandBufferCallbackErrorInnocentVictim".
Rendering the same frame again in the same Blender works (tested 2026-11-21: 3 resets in 32 walk frames, all recovered
in place), so a reset costs one frame instead of a Blender restart and a scene rebuild.

    import gpu_retry
    gpu_retry.render()          # instead of bpy.ops.render.render(write_still=True)
"""
import time

TRIES = 8


def is_gpu_reset(err):
    s = str(err)
    return "Command buffer not completed" in s or "InnocentVictim" in s or "GPU error/recovery" in s


def render(write_still=True, tries=TRIES, op=None, log=print, pause=1.0):
    """Run one Cycles render; on a Metal GPU reset, render it again (up to `tries` times). Other errors raise at once."""
    if op is None:
        import bpy
        op = bpy.ops.render.render
    for attempt in range(1, tries + 1):
        try:
            return op(write_still=write_still)
        except RuntimeError as e:
            if not is_gpu_reset(e) or attempt == tries:
                raise
            log("GPU_RETRY attempt %d of %d after a Metal GPU reset: %s" % (attempt, tries, str(e).splitlines()[0][:120]), flush=True)
            time.sleep(pause)
