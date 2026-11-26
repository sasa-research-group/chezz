# Bake the static diorama set (box, walls, birches, moss, floor, lights; no pieces) for the 3D puzzle view.
#
#   cd <stage dir> && source tools/base_r78.env && \
#   Blender -b --python tools/art/diorama/bake_set.py -- --n 5 --res 2400 --samples 128 --out DIR
#
# One Cycles render of an NxN set from the locked play camera (35 deg, 50 mm, box ~90% of the frame), with
# a Position pass. The browser view (src/diorama/) turns it into a depth mesh: every pixel goes back to
# where Cycles saw it in the world, so the set keeps the exact Cycles look from this camera and still
# hides pieces correctly (a king on the back row stands in front of the hanging moss). Other board sizes
# are made from this one by cutting the set into four quarters at grout lines and sliding them together.
#
# Writes into --out:
#   set{N}.webp     colour, Standard view + exposure (what Blender shows before the compositor), alpha = set
#   set{N}-glow.png what is brighter than 1.0 (linear, before exposure): the bulbs, for the bloom
#   set{N}.depth    uint16 grid of camera-space depth, every STRIDE px, little endian, + header in the json
#   set{N}.json     camera, grid, scene units, bulb positions
import bpy, sys, os, math, json, time, argparse
import numpy as np
from mathutils import Matrix, Vector
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import gpu_retry  # renders again in place after a Metal GPU reset

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.append(STAGE)  # the repo's own stage.py (beside this file) comes first
import stage

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--n", type=int, default=5)
ap.add_argument("--nx", type=int, default=None)  # a rectangle: nx squares across, ny deep (both default to --n)
ap.add_argument("--ny", type=int, default=None)
ap.add_argument("--res", type=int, default=2400)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--stride", type=int, default=6)
ap.add_argument("--out", default=os.path.join(STAGE, "out", "builder3d"))
ap.add_argument("--zoom_k", type=float, default=1.0)  # <1 frames wider: set3 serves 2x2 and 3x3, whose play camera backs off
ap.add_argument("--stops", action="store_true")  # a board past one view: one bake per panning stop (level_layout.stops)
ap.add_argument("--glow_k", type=float, default=16.0)  # glow png stores (L - 1) / K
a = ap.parse_args(argv)
a.nx = a.nx or a.n
a.ny = a.ny or a.n
SQUARE = a.nx == a.ny
if SQUARE:
    a.n = a.nx
NAME = "set%d" % a.n if SQUARE else "set%dx%d" % (a.nx, a.ny)  # set5 / set12x5

from level_camera import EL, FOCAL, ZOOM5, LA, ASPECT, set_camera, stop_camera  # the locked play camera
from level_layout import stops as level_stops, window as level_window
STOPS = level_stops(a.nx, a.ny) if a.stops else []
KING = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/rig/rigged_character_glb__rigged_character.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KING)
# measure the king exactly as tools/render_v4.py does (the scene scale hangs off his height)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
stage.relax_arms(arm)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
zs = []
for o in bpy.data.objects:
    if o.type == "MESH":
        e = o.evaluated_get(dg)
        zs += [(e.matrix_world @ v.co).z for v in e.to_mesh().vertices]
H = max(zs) - min(zs)
print("FIG H", H, flush=True)
for o in list(bpy.data.objects):  # the set only: pieces are drawn live in the browser
    bpy.data.objects.remove(o)
os.environ["STAGE_NOCOMP"] = "1"  # bloom, grade, vignette and grain run in the browser
sc = bpy.context.scene
t0 = time.time()
objs = stage.build_stage(sc, H, board=a.n if SQUARE else (a.nx, a.ny))
print("BUILD_SECONDS %.1f" % (time.time() - t0), flush=True)
S = 1.2 * H


# with stops: one camera, the window's, slid to each stop in turn (place); every stop shares its zoom and turn
cam, zoom = stop_camera(sc, H, a.nx, a.ny, (0.0, 0.0) if STOPS else None, a.zoom_k)
cam.data.dof.use_dof = False
HOME = cam.location.copy()


def place(stop):
    cam.location = HOME + Vector((stop[0] * S, stop[1] * S, 0.0))
    bpy.context.view_layer.update()  # f/8 on a 5 cm king is near-sharp; the browser view stays sharp
stage.setup_render(sc, res=a.res, samples=a.samples, aspect=ASPECT)


LIVE_LIGHTS = ("lantern", "framekey", "pool", "warmfill", "moon")


def stage_lights():
    """The stage lamps the game re-creates live to light its pieces (src/diorama/Diorama.tsx Lights): each copy of
    the lantern, frame key, pool, warm fill and moon (a long board has one per stretch, stage._light_segments) with
    its name, where it is, the way it points, its watts and, for a spot, its cone's half angle. Colours and the
    softness of each stay in the game, per name, as they were tuned."""
    out = []
    for o in sorted(bpy.data.objects, key=lambda o: o.name):
        if o.type != "LIGHT" or o.hide_render:
            continue
        base = o.name.split("_seg")[0].split(".")[0]
        if base not in LIVE_LIGHTS:
            continue
        d = o.data
        aim = o.matrix_world.to_3x3() @ Vector((0, 0, -1))
        li = {"name": base, "at": [round(v, 4) for v in o.matrix_world.translation],
              "dir": [round(v, 4) for v in aim.normalized()], "watts": round(d.energy, 3)}
        if d.type == "SPOT":
            li["half"] = round(d.spot_size / 2, 4)
        out.append(li)
    return out


def clear_bulbs(sc, cam, S):
    """Slides any fairy bulb a birch trunk (or a solid hank of moss) hides from the play camera sideways until the camera sees all of it.
    Moves the bulb, its light and the bottom of its drop wire together, along the wall it hangs on (across for the
    back wall, front-to-back for a side wall, SIDE_LIGHTS), so it never leaves the wall. Returns (name, shift) per move."""
    dg = bpy.context.evaluated_depsgraph_get()
    eye = cam.matrix_world.translation.copy()
    wire = bpy.data.objects.get("FairyWire2")
    def centre(o):
        bb = [o.matrix_world @ Vector(b) for b in o.bound_box]
        return sum(bb, Vector()) / 8, (max(v.x for v in bb) - min(v.x for v in bb)) / 2
    def blocked(p, r, any_hit):
        """Does something stand between the camera and p? A trunk always counts; with any_hit, so does moss."""
        d = p - eye
        o_, left = eye.copy(), d.length - 0.5 * r
        for _ in range(64):  # walk on through haze (and moss, unless it counts)
            hit, loc, _, _, ob, _ = sc.ray_cast(dg, o_, d.normalized(), distance=left)
            if not hit:
                return False
            if ob.name.startswith("Birch") or (any_hit and not ob.name.startswith(("Haze", "FairyWire", "FairyBulb", "FairyPin"))):
                return True
            step = (loc - o_).length + 1e-4
            o_, left = o_ + d.normalized() * step, left - step
            if left <= 0:
                return False
        return False

    def hidden(c, r):
        # a trunk over any part of the bulb, or moss over most of it (a strand or two across it is fine)
        offs = [Vector(), Vector((r, 0, 0)), Vector((-r, 0, 0)), Vector((0, 0, r)), Vector((0, 0, -r))]
        if any(blocked(c + o_, r, False) for o_ in offs):
            return True
        return sum(blocked(c + o_, r, True) for o_ in offs) >= 3
    moved = []
    bulbs_ = [o for o in bpy.data.objects if o.name.startswith("FairyBulb2_")]
    y_back = max((centre(o)[0].y for o in bulbs_), default=0.0)
    for o in sorted((o for o in bpy.data.objects if o.name.startswith("FairyBulb2_")), key=lambda o: o.name):
        c, r = centre(o)
        if not hidden(c, r):
            continue
        ax = Vector((0, 1, 0)) if c.y < y_back - 0.8 * S else Vector((1, 0, 0))  # side-wall bulb: slide along y
        dx = None
        for k in range(1, 40):  # nearest clear spot, either side, plus a bulb's width of margin
            for sg in (1, -1):
                t = sg * k * 0.02 * S
                if not hidden(c + ax * t, r) and not hidden(c + ax * (t + sg * 2 * r), r):
                    dx = t + sg * 2 * r
                    break
            if dx is not None:
                break
        if dx is None:
            print("BULB_STILL_HIDDEN", o.name, flush=True)
            continue
        o.data.transform(Matrix.Translation(ax * dx))
        lo = bpy.data.objects.get("fairy2_" + o.name.split("_")[-1])
        if lo:
            lo.location += ax * dx
        if wire:
            for sp in wire.data.splines:
                if len(sp.points) == 2:
                    q = Vector(sp.points[1].co[:3])
                    if abs(q.x - c.x) < 1e-3 and abs(q.y - c.y) < 1e-3 and 0 < q.z - c.z < 4 * r:
                        q += ax * dx
                        sp.points[1].co = (q.x, q.y, q.z, 1.0)
        moved.append((o.name, "xy"[int(ax.y)], round(dx, 4)))
        dg = bpy.context.evaluated_depsgraph_get()
    return moved


if os.environ.get("FAIRY_CLEAR", "1") == "1":
    # every stop sees the same bulbs (the game fades from one stop to the next): clear them for all of them
    for st in STOPS or [None]:
        if st is not None:
            place(st)
        print("BULBS_MOVED", st, clear_bulbs(sc, cam, S), flush=True)
sc.render.film_transparent = True
vl = sc.view_layers[0]
vl.use_pass_position = True
haze = bpy.data.objects.get("HazeVolume")
os.makedirs(a.out, exist_ok=True)
sc.render.image_settings.media_type = "MULTI_LAYER_IMAGE"
sc.render.image_settings.file_format = "OPEN_EXR_MULTILAYER"
sc.render.image_settings.color_depth = "32"
sc.render.image_settings.color_mode = "RGBA"
import OpenImageIO as oiio


def bake_view(NAME, stop):
  """Renders the set from the camera as it stands and writes NAME .png, -glow.png, .depth and .json."""
  exr = os.path.join(a.out, NAME + ".exr")
  sc.render.filepath = exr
  t = time.time()
  gpu_retry.render()
  print("RENDER_SECONDS %.1f" % (time.time() - t), flush=True)

  img = oiio.ImageInput.open(exr)
  chans = {}  # Blender 5 writes one EXR part per pass
  k = 0
  while img.seek_subimage(k, 0):
      spec = img.spec()
      px = np.asarray(img.read_image(k, 0, 0, spec.nchannels, "float")).reshape(spec.height, spec.width, spec.nchannels)
      for j, nm in enumerate(spec.channelnames):
          chans[nm] = px[:, :, j]
      k += 1
  img.close()
  names = list(chans)
  def ch(suffix):
      return next(v for nm, v in chans.items() if nm.endswith(suffix) and "Noisy" not in nm)
  print("CHANNELS", names, flush=True)
  R, G, B, A = ch("Combined.R"), ch("Combined.G"), ch("Combined.B"), ch("Combined.A")
  PX, PY, PZ = ch("Position.X"), ch("Position.Y"), ch("Position.Z")
  h_, w_ = R.shape
  # un-premultiply, Standard view: exposure then the sRGB curve
  lin = np.stack([R, G, B], -1)
  al = np.clip(A, 0, 1)[..., None]
  straight = np.where(al > 1e-4, lin / np.maximum(al, 1e-4), 0.0)
  expo = 2.0 ** float(os.environ.get("EXPO", 0))
  def srgb(x):
      x = np.clip(x, 0, 1)
      return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
  ldr = np.concatenate([srgb(straight * expo), al], -1)
  glow = np.clip((straight - 1.0) / a.glow_k, 0, 1)
  # image rows: EXR row 0 is the top
  out_png = oiio.ImageBuf(oiio.ImageSpec(w_, h_, 4, "uint8"))
  out_png.set_pixels(oiio.ROI(), (ldr * 255 + 0.5).astype(np.uint8))
  out_png.write(os.path.join(a.out, NAME + ".png"))
  gb = oiio.ImageBuf(oiio.ImageSpec(w_ // 4, h_ // 4, 3, "uint8"))
  # glow at quarter res: keep the max so small bulbs survive
  gq = glow[: h_ // 4 * 4, : w_ // 4 * 4].reshape(h_ // 4, 4, w_ // 4, 4, 3).max(axis=(1, 3))
  gb.set_pixels(oiio.ROI(), (np.sqrt(gq) * 255 + 0.5).astype(np.uint8))
  gb.write(os.path.join(a.out, NAME + "-glow.png"))

  # depth grid: camera-space depth along the view axis at every STRIDE-th pixel centre
  M = cam.matrix_world
  cpos = M.translation
  fwd = -(M.to_3x3() @ Vector((0, 0, 1)))
  st = a.stride
  gx = np.arange(0, w_ + st - 1, st).clip(0, w_ - 1)
  gy = np.arange(0, h_ + st - 1, st).clip(0, h_ - 1)
  P = np.stack([PX, PY, PZ], -1)[np.ix_(gy, gx)]
  Ag = A[np.ix_(gy, gx)]
  d = (P - np.array(cpos)) @ np.array(fwd)
  valid = Ag > 0.02
  # fill invalid (background) cells from the nearest valid neighbour so silhouettes stay put; alpha cuts them
  from collections import deque
  dd = np.where(valid, d, 0.0)
  filled = valid.copy()
  q = deque(zip(*np.nonzero(valid)))
  gh, gw = d.shape
  while q:
      y, x = q.popleft()
      for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
          if 0 <= yy < gh and 0 <= xx < gw and not filled[yy, xx]:
              filled[yy, xx] = True
              dd[yy, xx] = dd[y, x]
              q.append((yy, xx))
  near, far = float(dd[valid].min()) * 0.98, float(dd[valid].max()) * 1.02
  qd = np.round((dd - near) / (far - near) * 65534).astype(np.uint16) + 1
  qd[~valid] = np.where(qd[~valid] > 0, qd[~valid], 1)
  # mark "background" cells with the top bit clear? keep it simple: a separate validity is the alpha texture
  qd.astype("<u2").tofile(os.path.join(a.out, NAME + ".depth"))

  bulbs = []
  for o in bpy.data.objects:
      if o.name.startswith("FairyBulb"):
          bb = [o.matrix_world @ Vector(b) for b in o.bound_box]
          c = sum(bb, Vector()) / 8
          bulbs.append([round(v, 4) for v in c])
  cd = cam.data
  info = {
      "n": a.n if SQUARE else min(a.nx, a.ny), "H": H, "S": S, "W": min(a.nx, a.ny) * S / 2 + 0.28 * S,
      "res": [w_, h_], "stride": st, "grid": [gw, gh], "near": near, "far": far,
      "camera": {"matrixWorld": [list(r) for r in M], "lens": cd.lens, "sensor": cd.sensor_width,
                 "fit": cd.sensor_fit, "zoom": zoom, "elevation": EL, "lookAhead": LA},
      "exposure": float(os.environ.get("EXPO", 0)), "glowK": a.glow_k,
      "bulbs": bulbs,
      "lights": stage_lights(),
  }
  if not SQUARE:  # a rectangle: the box's half extents per axis (W stays the short side's)
      info.update({"nx": a.nx, "ny": a.ny, "Wx": a.nx * S / 2 + 0.28 * S, "Wy": a.ny * S / 2 + 0.28 * S})
  if stop is not None:  # one panning stop: where its window centres (squares) and the window's size
    info.update({"stop": list(stop), "window": list(level_window(a.nx, a.ny))})
  json.dump(info, open(os.path.join(a.out, NAME + ".json"), "w"), indent=1)
  print("DONE", NAME, w_, h_, gw, gh, near, far, len(bulbs), flush=True)


if STOPS:
    for k, st in enumerate(STOPS):
        if os.path.exists(os.path.join(a.out, "%s-s%d.json" % (NAME, k))):
            print("STOP", k, "done", flush=True)
            continue
        place(st)
        bake_view("%s-s%d" % (NAME, k), st)
    json.dump({"window": list(level_window(a.nx, a.ny)), "stops": [list(t) for t in STOPS]},
              open(os.path.join(a.out, NAME + "-stops.json"), "w"), indent=1)
    print("DONE STOPS", NAME, len(STOPS), flush=True)
else:
    bake_view(NAME, None)
