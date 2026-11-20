# Quick look at a reshaped clip (no stage, workbench, seconds): side and front views of every loop frame, plus
# the numbers that matter for a small figure. Blender -b --python preview_motion.py -- CLIP.glb OUTDIR [k=v ...]
#   k=v are king_motion shape knobs (leg=0.6 ...); raw=1 leaves the clip untouched. frames=N.
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import king_motion as km
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]
clip, out = a[0], a[1]
kv = dict(x.split("=") for x in a[2:])
frames = int(kv.pop("frames", 14))
raw = kv.pop("raw", None)
shape = {k: float(v) for k, v in kv.items()}
if raw:
    shape = dict(leg=1, knee=1, arms=1, spread=0, upright=0, bounce=1, armout=0)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=clip)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = next(o for o in bpy.data.objects if o.type == "MESH")
if not kv.get("noskirt") and not raw:
    km.fix_skirt(arm, body)
    if not kv.get("nocape"):
        km.fix_cape(arm, body)
shape.pop("nocape", None)
shape.pop("noskirt", None)
poses = km.loop_poses(arm, frames=frames, **shape)
W = lambda n: arm.matrix_world @ arm.pose.bones[n].head
st = []
for p in poses:
    km.apply_pose(arm, p)
    h, hd, lf, rf = W("Hips"), W("Head"), W("LeftFoot"), W("RightFoot")
    v = hd - h
    st.append((h.z, math.degrees(math.atan2(-v.y, v.z)), max(lf.z, rf.z), abs(lf.x - rf.x), abs(lf.y - rf.y)))
H = 1.7
z = [s[0] for s in st]
print("STATS bounce %.1f%%H  lean %.1f..%.1f deg  heel max %.0f%%H  feet gap(x) min %.0f%%H  stride(y) max %.0f%%H" % (
    100 * (max(z) - min(z)) / H, min(s[1] for s in st), max(s[1] for s in st), 100 * max(s[2] for s in st) / H,
    100 * min(s[3] for s in st) / H, 100 * max(s[4] for s in st) / H), flush=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "TEXTURE"
sc.render.resolution_x, sc.render.resolution_y = 240, 300
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.1
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
os.makedirs(out, exist_ok=True)
for view, loc in (("side", (6, 0, 0.85)), ("front", (0, -6, 0.85))):
    cam.location = loc
    cam.rotation_euler = (Vector((0, 0, 0.85)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    for i, p in enumerate(poses):
        km.apply_pose(arm, p)
        sc.render.filepath = os.path.join(out, "%s%02d.png" % (view, i))
        bpy.ops.render.render(write_still=True)
print("DONE", flush=True)
