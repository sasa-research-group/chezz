# Reference video -> numbered frames and a contact sheet, for the reference pass before keying a new animation
# (.claude/skills/animation-reference). The agent looks at the sheet to find key poses and their timing.
#   uv run refsheet.py CLIP.mp4 OUT [--start 1.2] [--end 2.6] [--fps 24] [--cols 6] [--max 36]
# writes OUT/f_001.png ... (360 px high, at --fps, so frame numbers are the game's 24 fps frames) and
# OUT/sheet.png: every Nth frame in a grid (at most --max tiles), each stamped with its frame number.
# /// script
# dependencies = ["pillow"]
# ///
import argparse, glob, os, subprocess
from PIL import Image, ImageDraw


def extract(clip, out, start=None, end=None, fps=24):
    os.makedirs(out, exist_ok=True)
    for f in glob.glob(os.path.join(out, "f_*.png")):
        os.remove(f)
    cmd = ["ffmpeg", "-loglevel", "error", "-y"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-i", clip, "-vf", "fps=%g,scale=-2:360" % fps, os.path.join(out, "f_%03d.png")]
    subprocess.run(cmd, check=True)
    return sorted(glob.glob(os.path.join(out, "f_*.png")))


def sheet(frames, path, cols=6, most=36):
    step = max(1, -(-len(frames) // most))  # ceil: every Nth frame so the sheet stays readable
    pick = frames[::step]
    w, h = Image.open(pick[0]).size
    rows = -(-len(pick) // cols)
    im = Image.new("RGB", (w * cols, h * rows), "black")
    d = ImageDraw.Draw(im)
    for i, f in enumerate(pick):
        x, y = (i % cols) * w, (i // cols) * h
        im.paste(Image.open(f).convert("RGB"), (x, y))
        n = int(os.path.basename(f)[2:-4])
        d.rectangle([x, y, x + 46, y + 20], fill="black")
        d.text((x + 4, y + 4), "%d" % n, fill="yellow")
    im.save(path)
    return step, len(pick)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("out")
    ap.add_argument("--start", type=float)
    ap.add_argument("--end", type=float)
    ap.add_argument("--fps", type=float, default=24)
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--max", type=int, default=36)
    a = ap.parse_args()
    fr = extract(a.clip, a.out, a.start, a.end, a.fps)
    if not fr:
        raise SystemExit("no frames extracted")
    step, n = sheet(fr, os.path.join(a.out, "sheet.png"), a.cols, a.max)
    print("FRAMES %d (every %d on the sheet, %d tiles) -> %s" % (len(fr), step, n, os.path.join(a.out, "sheet.png")))
