# Check of gpu_retry.py with a fake render (no Blender needed):  python3 tools/art/diorama/test_gpu_retry.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gpu_retry

RESET = RuntimeError("Error: Command buffer not completed. status = 5. (PSO_GENERIC.integrator_queued_paths_array):\n"
                     "Error Domain=MTLCommandBufferErrorDomain Code=1 \"Discarded (victim of GPU error/recovery) "
                     "(00000005:kIOGPUCommandBufferCallbackErrorInnocentVictim)\"")


def fake(fails, err=RESET):
    calls = []
    def op(write_still=True):
        calls.append(write_still)
        if len(calls) <= fails:
            raise err
        return {"FINISHED"}
    return op, calls


quiet = lambda *a, **k: None

# a reset or two: the same frame renders again and succeeds
op, calls = fake(2)
assert gpu_retry.render(op=op, log=quiet, pause=0) == {"FINISHED"}
assert calls == [True, True, True], calls

# no reset: one call
op, calls = fake(0)
gpu_retry.render(op=op, log=quiet, pause=0)
assert len(calls) == 1

# resets every time: gives up after `tries` and raises the reset
op, calls = fake(99)
try:
    gpu_retry.render(op=op, tries=3, log=quiet, pause=0)
    raise AssertionError("should have raised")
except RuntimeError as e:
    assert gpu_retry.is_gpu_reset(e)
assert len(calls) == 3

# any other error is not retried
op, calls = fake(1, RuntimeError("Error: Cannot write a single file with an animation format selected"))
try:
    gpu_retry.render(op=op, log=quiet, pause=0)
    raise AssertionError("should have raised")
except RuntimeError as e:
    assert not gpu_retry.is_gpu_reset(e)
assert len(calls) == 1

print("test_gpu_retry OK")
