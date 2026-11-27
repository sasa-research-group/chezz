# Check of refsheet.py with a generated 2 s test clip (ffmpeg's testsrc; no download):
#   uv run tools/art/diorama/test_refsheet.py
# /// script
# dependencies = ["pillow"]
# ///
import os, subprocess, sys, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import refsheet

tmp = tempfile.mkdtemp()
clip = os.path.join(tmp, "clip.mp4")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=640x480:rate=30",
                "-pix_fmt", "yuv420p", clip], check=True)
out = os.path.join(tmp, "out")
fr = refsheet.extract(clip, out, fps=24)
assert 47 <= len(fr) <= 49, len(fr)  # 2 s at 24 fps, whatever the clip's own rate
assert Image.open(fr[0]).size[1] == 360
fr = refsheet.extract(clip, out, start=0.5, end=1.5, fps=24)  # a trimmed range replaces the old frames
assert 23 <= len(fr) <= 25, len(fr)
step, n = refsheet.sheet(fr, os.path.join(out, "sheet.png"), cols=6, most=12)
assert step == -(-len(fr) // 12) and n <= 12, (step, n)
w, h = Image.open(fr[0]).size
assert Image.open(os.path.join(out, "sheet.png")).size == (w * 6, h * (-(-n // 6)))
r = subprocess.run([sys.executable, os.path.join(HERE, "refsheet.py"), clip, os.path.join(tmp, "cli")],
                   capture_output=True, text=True)
assert r.returncode == 0 and r.stdout.startswith("FRAMES"), r.stdout + r.stderr
print("TEST refsheet OK")
