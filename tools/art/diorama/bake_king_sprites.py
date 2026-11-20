# Pre-render the white king (Cycles king A, exactly as in the r17 hero) at 8 headings for the browser.
#
#   cd <stage dir> && source tools/base_r78.env && \
#   Blender -b --python tools/art/diorama/bake_king_sprites.py -- --out DIR [--res 3600 --samples 256 --only 0,1]
#
# The stage is built as for the set bake (same lights, felt fibres, KING_RIM backlight, crown glow), the king
# stands on the 5x5 centre square in the r17 pose (arms relaxed), and the locked play camera (35 deg, 50 mm)
# renders only him: every other object is hidden from the camera but still lights, bounces and shadows him.
# Film is transparent and cropped to one rectangle that holds him at every heading.
#
# Writes into --out, per heading k (k * 45 deg, 0 = toward the camera, 90 = his right turn toward +x):
#   king{k}.png        straight-alpha RGBA, Standard view + exposure, like set{N}.webp
#   king{k}-glow.png   what is brighter than 1.0 (the crown), sqrt((L - 1) / glowK), like set{N}-glow.png
#   king.json          crop, the camera-parallel quad the browser draws him on, anchors and timings
#
# --clip GLB --frames N bakes a loop instead (king_motion.py): the Meshy clip is resampled to N frames and reshaped
# for the chibi body (CHIBI_RUN), the cape and hem reweighted so they don't swing like boards, and the felt fibres
# (built in the r17 pose exactly as for the still king, then bound to their root triangles) re-seated on the
# posed body every frame. Writes run{k}_{i}.png / -glow.png and run.json; the crop holds every frame.
# PROP=path.glb puts a held prop (the sword, later) in his right hand for any bake (king_motion.attach_prop).
import bpy, sys, os, math, json, time, argparse
import numpy as np
from mathutils import Vector, Matrix

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
import stage
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=3600)
ap.add_argument("--samples", type=int, default=256)
ap.add_argument("--only", default="")  # headings to (re)render, e.g. "3,4"; default all missing
ap.add_argument("--glow_k", type=float, default=16.0)
ap.add_argument("--clip", default="")  # a Meshy animation glb (same mesh and rig): bake its loop
ap.add_argument("--frames", type=int, default=14)
a = ap.parse_args(argv)
EL, FOCAL, ZOOM5, LA, ASPECT = 35.0, 50.0, 0.255, 0.21, 4.0 / 3.0
KING = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/rig/rigged_character_glb__rigged_character.glb")
T0 = time.time()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import king_motion as km
NAME = "run" if a.clip else "king"

# --- the king, posed and measured exactly as tools/render_v4.py does for the hero
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.clip or KING)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm)
poses = []
if a.clip:
    km.fix_skirt(arm, body)
    km.fix_cape(arm, body)
    poses = km.loop_poses(arm, frames=a.frames)
    for pb in arm.pose.bones:  # back to rest, then the r17 pose: the stage, felt and lights are built in it
        pb.rotation_mode = "QUATERNION"
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
stage.relax_arms(arm)
if a.clip:
    for side in ("Left", "Right"):
        arm.pose.bones[side + "CapeArm"].rotation_quaternion = arm.pose.bones[side + "Arm"].rotation_quaternion.copy()
bpy.context.view_layer.update()
def under(o):
    while o is not None:
        if o is arm:
            return True
        o = o.parent
    return False
def king_points():
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in bpy.data.objects:
        if o.type == "MESH" and under(o):
            e = o.evaluated_get(dg)
            m = e.to_mesh()
            co = np.empty(len(m.vertices) * 3, np.float32); m.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)
            M = np.array(e.matrix_world)
            pts.append(co @ M[:3, :3].T + M[:3, 3])
            e.to_mesh_clear()
    return np.concatenate(pts)
P = king_points()
mn, mx = P.min(0), P.max(0)
H = float(mx[2] - mn[2])
print("FIG H", H, flush=True)
arm.location += Vector((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2]))
bpy.context.view_layer.update()
os.environ["STAGE_NOCOMP"] = "1"  # bloom, grade, vignette and grain run in the browser
sc = bpy.context.scene
t = time.time()
stage.build_stage(sc, H, center=(0, 0), board=5)
stage.clay_ify(arm)
binder = None
if a.clip:
    binder = km.FibreBinder(body, bpy.data.objects["felt_fibres"])  # bound in the pose they were grown in
    # stand the loop on the floor: the lowest point over the cycle touches it (the rest is airborne bounce)
    zlo = []
    for ps in poses:
        km.apply_pose(arm, ps)
        zlo.append(float(king_points()[:, 2].min()))
    arm.location.z -= min(zlo)
    print("CHECK loop floor lift %.4f (H %.3f), airborne max %.4f" % (-min(zlo), H, max(zlo) - min(zlo)), flush=True)
def pose(i):
    if binder is not None:
        km.apply_pose(arm, poses[i])
        binder.update()
if a.clip:
    pose(0)
if os.environ.get("PROP"):
    pr = km.attach_prop(arm, os.environ["PROP"], H)
    print("CHECK prop", pr.name, flush=True)
print("BUILD_SECONDS %.1f" % (time.time() - t), flush=True)
cam = stage.build_camera(sc, H, aspect=ASPECT, zoom=ZOOM5, elevation=EL, look_ahead=LA, focal=FOCAL)
cam.data.dof.use_dof = False  # as the set bake

# --- king objects: the armature and its meshes/shells, plus the fibre curves (world-space, unparented)
king = [o for o in bpy.data.objects if under(o) or o.name.startswith("felt_fibres")]
roots = [o for o in king if o is arm or (o.parent is None)]
base = {o.name: o.matrix_world.copy() for o in roots}
print("CHECK king objects", sorted(o.name for o in king), flush=True)
for o in bpy.data.objects:
    if o in king or o.type in ("LIGHT", "CAMERA"):
        continue
    o.visible_camera = False  # still lights, bounces and shadows him
def heading(k):
    R = Matrix.Rotation(math.radians(45 * k), 4, "Z")
    for o in roots:
        o.matrix_world = R @ base[o.name]
    bpy.context.view_layer.update()

# --- the backlight, placed for this camera. stage.py puts KING_RIM (light-linked to the king alone) behind and a
# little above him for an eye-level close-up; from the 35 deg play camera that disc sits above the view ray and
# washes his front instead of rimming him. RIM_PLAY puts it where the close-up has it relative to its camera:
# straight behind him along the view ray, raised RIM_EL degrees above it, RIM_D x H from his middle.
rim = bpy.data.objects.get("king_rim")
if rim is not None and os.environ.get("RIM_PLAY"):
    Pk = king_points()
    ctr = Vector(((Pk.min(0) + Pk.max(0)) / 2).tolist())
    M3 = cam.matrix_world.to_3x3()
    f_ = -(M3 @ Vector((0, 0, 1)))
    r_ = M3 @ Vector((1, 0, 0))
    d_ = Matrix.Rotation(math.radians(float(os.environ.get("RIM_EL", 8.5))), 3, r_) @ f_
    rim.location = ctr + d_ * float(os.environ.get("RIM_D", 1.0)) * H
    rim.rotation_euler = (ctr - rim.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
# CROWN_RIM: with KING_RIM_FIBONLY the rim lights only the felt (fibres and shells), so hands and face stay out
# of it but so does the crown. This puts a narrow spot, linked to the body mesh alone, behind and above the crown
# (CROWN_EL degrees above the view ray, CROWN_D x H away), its cone just wide enough for the crown.
if os.environ.get("CROWN_RIM"):
    Pk = king_points()
    lo, hi = Pk.min(0), Pk.max(0)
    crown = Vector((float(lo[0] + hi[0]) / 2, float(lo[1] + hi[1]) / 2, float(hi[2]) - 0.1 * H))
    M3 = cam.matrix_world.to_3x3()
    f_, r_ = -(M3 @ Vector((0, 0, 1))), M3 @ Vector((1, 0, 0))
    d_ = Matrix.Rotation(math.radians(float(os.environ.get("CROWN_EL", 30))), 3, r_) @ f_
    dist = float(os.environ.get("CROWN_D", 1.0)) * H
    cl = bpy.data.lights.new("crown_rim", "SPOT")
    cl.energy = float(os.environ["CROWN_RIM"]) * H * H
    cl.color = (1.0, 0.72, 0.42)
    cl.spot_size = 2 * math.atan(float(os.environ.get("CROWN_R", 0.22)) * H / dist)
    cl.spot_blend = 0.5
    cl.shadow_soft_size = 0.1 * H
    try:
        cl.cycles.cast_shadow = False
    except Exception:
        pass
    co_ = bpy.data.objects.new("crown_rim", cl)
    bpy.context.scene.collection.objects.link(co_)
    co_.location = crown + d_ * dist
    co_.rotation_euler = (crown - co_.location).to_track_quat("-Z", "Y").to_euler()
    rc_ = bpy.data.collections.new("CrownRimRecv")
    for o_ in king:
        if o_.type == "MESH" and not o_.name.startswith("felt_fibres") and "_shell" not in o_.name:
            rc_.objects.link(o_)
    co_.light_linking.receiver_collection = rc_
    bpy.context.view_layer.update()
    print("CHECK crown_rim", tuple(round(x, 3) for x in co_.location), "energy", round(cl.energy, 1),
          "cone", round(math.degrees(cl.spot_size), 1), [o.name for o in rc_.objects], flush=True)
if rim is not None:
    print("CHECK rim", tuple(round(x, 3) for x in rim.location), "energy", round(rim.data.energy, 1), "size", round(rim.data.size, 3), flush=True)

# --- one crop for all headings (and loop frames): a cylinder round his axis (fibres and halo stick out a little)
P = []
for i in range(max(1, len(poses))):
    pose(i)
    P.append(king_points())
P = np.concatenate(P)
pose(0)
r = float(np.sqrt(P[:, 0] ** 2 + P[:, 1] ** 2).max()) * 1.12
top = float(P[:, 2].max()) + 0.04 * H
stage.setup_render(sc, res=a.res, samples=a.samples, aspect=ASPECT)
rx, ry = sc.render.resolution_x, sc.render.resolution_y
us, vs, ds = [], [], []
M = cam.matrix_world
cpos = M.translation.copy()
fwd = -(M.to_3x3() @ Vector((0, 0, 1)))
right = M.to_3x3() @ Vector((1, 0, 0))
up = M.to_3x3() @ Vector((0, 1, 0))
for i in range(32):
    th = 2 * math.pi * i / 32
    for z in (-0.02 * H, top):
        p = Vector((r * math.cos(th), r * math.sin(th), z))
        c = world_to_camera_view(sc, cam, p)
        us.append(c.x); vs.append(c.y)
        ds.append((p - cpos).dot(fwd))
u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
# snap to whole pixels
u0, u1 = math.floor(u0 * rx) / rx, math.ceil(u1 * rx) / rx
v0, v1 = math.floor(v0 * ry) / ry, math.ceil(v1 * ry) / ry
sc.render.use_border = True
sc.render.use_crop_to_border = True
sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = u0, u1, v0, v1
sc.render.film_transparent = True
# The haze stays (hidden from the camera like the rest): it dims and warms the light that reaches him, as in
# the hero. Hiding it outright lit him brighter and paler than r17. Its veil in front of him is in the set bake.
print("CROP", u0, u1, v0, v1, "px", round((u1 - u0) * rx), round((v1 - v0) * ry), flush=True)

# The quad the browser draws him on: parallel to the image plane, a little in front of his nearest point,
# so the set's depth (moss, walls) still sorts against him the way it would against the real figure.
d0 = (Vector((0, 0, 0)) - cpos).dot(fwd)  # depth of his feet (the anchor)
near = []  # his nearest point over all headings (meshes; fibres add a hair)
for k in range(8):
    heading(k)
    for i in range(0, max(1, len(poses)), 2):
        pose(i)
        near.append(float(((king_points() - np.array(cpos)) @ np.array(fwd)).min()))
heading(0)
pose(0)
dq = min(near) - 0.03 * H
tanX = 18.0 / FOCAL
tanY = tanX / ASPECT
def at_plane(u, v):
    d = fwd + (2 * u - 1) * tanX * right + (2 * v - 1) * tanY * up
    return cpos + d * dq
P0 = cpos + (Vector((0, 0, 0)) - cpos) * (dq / d0)  # where the ray to his feet meets the quad
corners = [at_plane(u, v) - P0 for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
quad = {"x0": corners[0].dot(right), "x1": corners[1].dot(right), "y0": corners[0].dot(up), "y1": corners[2].dot(up)}

vl = sc.view_layers[0]
sc.render.image_settings.media_type = "MULTI_LAYER_IMAGE"
sc.render.image_settings.file_format = "OPEN_EXR_MULTILAYER"
sc.render.image_settings.color_depth = "32"
sc.render.image_settings.color_mode = "RGBA"
os.makedirs(a.out, exist_ok=True)
import OpenImageIO as oiio
def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
expo = 2.0 ** float(os.environ.get("EXPO", 0))
only = [int(k) for k in a.only.split(",") if k != ""] or list(range(8))
times = {}
jobs = [(k, i) for k in only for i in range(len(poses))] if a.clip else [(k, None) for k in only]
for k, i in jobs:
    tag = "%d" % k if i is None else "%d_%02d" % (k, i)
    png = os.path.join(a.out, "%s%s.png" % (NAME, tag))
    if os.path.exists(png) and (not a.only or a.clip):  # a loop resumes after a Metal crash
        continue
    heading(k)
    pose(i) if i is not None else None
    exr = os.path.join(a.out, "%s%s.exr" % (NAME, tag))
    sc.render.filepath = exr
    t = time.time()
    bpy.ops.render.render(write_still=True)
    times[tag] = time.time() - t
    print("RENDER_SECONDS %s %.1f" % (tag, times[tag]), flush=True)
    img = oiio.ImageInput.open(exr)
    chans, j = {}, 0
    while img.seek_subimage(j, 0):
        spec = img.spec()
        px = np.asarray(img.read_image(j, 0, 0, spec.nchannels, "float")).reshape(spec.height, spec.width, spec.nchannels)
        for c, nm in enumerate(spec.channelnames):
            chans[nm] = px[:, :, c]
        j += 1
    img.close()
    ch = lambda s: next(v for nm, v in chans.items() if nm.endswith(s) and "Noisy" not in nm)
    lin = np.stack([ch("Combined.R"), ch("Combined.G"), ch("Combined.B")], -1)
    al = np.clip(ch("Combined.A"), 0, 1)[..., None]
    straight = np.where(al > 1e-4, lin / np.maximum(al, 1e-4), 0.0)
    ldr = np.concatenate([srgb(straight * expo), al], -1)
    h_, w_ = al.shape[:2]
    sp = oiio.ImageSpec(w_, h_, 4, "uint8")
    # already straight: without this OIIO takes the pixels as premultiplied and divides by alpha again on
    # writing the PNG, which blew his see-through fibre edge up into a white outline
    sp.attribute("oiio:UnassociatedAlpha", 1)
    ob = oiio.ImageBuf(sp)
    ob.set_pixels(oiio.ROI(), (ldr * 255 + 0.5).astype(np.uint8))
    ob.write(png)
    glow = np.clip((straight - 1.0) / a.glow_k, 0, 1) * (al > 0.02)
    gb = oiio.ImageBuf(oiio.ImageSpec(w_, h_, 3, "uint8"))
    gb.set_pixels(oiio.ROI(), (np.sqrt(glow) * 255 + 0.5).astype(np.uint8))
    gb.write(os.path.join(a.out, "%s%s-glow.png" % (NAME, tag)))
    if not os.environ.get("KEEP_EXR"):
        os.remove(exr)

info = {
    "H": H, "S": 1.2 * H, "res": [rx, ry], "crop": [u0, v0, u1, v1], "px": [round((u1 - u0) * rx), round((v1 - v0) * ry)],
    "right": list(right), "up": list(up), "fwd": list(fwd), "camera": list(cpos), "d0": d0, "dq": dq,
    "anchor": list(P0), "quad": quad, "exposure": float(os.environ.get("EXPO", 0)), "glowK": a.glow_k,
    "headings": 8, "samples": a.samples,
    "frames": len(poses) or None, "clip": os.path.basename(a.clip) or None, "shape": km.CHIBI_RUN if a.clip else None,
    "prop": os.environ.get("PROP"),
    "rim": {k: os.environ.get(k) for k in ("KING_RIM", "KING_RIM_S", "KING_RIM_FIBONLY", "RIM_PLAY", "RIM_EL", "RIM_D", "CROWN_RIM", "CROWN_EL", "CROWN_D", "CROWN_R")},
}
json.dump(info, open(os.path.join(a.out, NAME + ".json"), "w"), indent=1)
print("RENDER_TOTAL %.1f" % sum(times.values()), "WALL %.1f" % (time.time() - T0), json.dumps(times), flush=True)
print("DONE", flush=True)
