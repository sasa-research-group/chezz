# Close-ups of a baked figure in its final felt look: opens the .blend a bake saved (SAVE_BLEND=...) and renders
# the named objects (default the two hands) with the bake's own lights and materials, from the game camera's
# direction and from turns around it, so the look can be judged up close before a full bake.
#   Blender -b --python felt_closeup.py -- scene.blend OUTDIR [objs=hand_Left,hand_Right] [res=700] [samples=96]
#        [turns=0,-60,60] [pad=1.6]
import bpy, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
BLEND, OUT = argv[0], argv[1]
K = dict(objs="hand_Left,hand_Right", res="700", samples="96", turns="0,-60,60", pad="1.6")
K.update(a.split("=", 1) for a in argv[2:])
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.abspath(BLEND))
sc = bpy.context.scene
try:  # the GPU, as the bake (a reopened file falls back to the CPU: ~10x slower)
    cp = bpy.context.preferences.addons["cycles"].preferences
    cp.compute_device_type = "METAL"; cp.get_devices()
    for d in cp.devices:
        d.use = True
    sc.cycles.device = "GPU"
except Exception as e:
    print("CHECK no GPU", e, flush=True)
base = sc.camera
fwd0 = base.matrix_world.to_3x3() @ Vector((0, 0, -1))
sc.render.resolution_x = sc.render.resolution_y = int(K["res"])
sc.render.resolution_percentage = 100
sc.render.film_transparent = False
sc.render.use_border = False
sc.cycles.samples = int(K["samples"])
if hasattr(sc.render.image_settings, "media_type"):  # the bake writes multilayer EXR
    sc.render.image_settings.media_type = "IMAGE"
sc.render.image_settings.file_format = "PNG"
sc.use_nodes = False  # no compositor passes, just the picture


def bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return (lo + hi) / 2, (hi - lo).length


for name in K["objs"].split(","):
    o = bpy.data.objects[name]
    c, size = bbox(o)
    for t in [float(x) for x in K["turns"].split(",")]:
        fwd = Matrix.Rotation(math.radians(t), 3, "Z") @ fwd0
        cd = bpy.data.cameras.new("close"); cd.lens = 85; cd.sensor_width = 36
        cd.dof.use_dof = False
        cam = bpy.data.objects.new("close", cd); sc.collection.objects.link(cam)
        dist = 85 * size * float(K["pad"]) / 36
        cam.location = c - fwd * dist
        cam.rotation_euler = fwd.to_track_quat("-Z", "Y").to_euler()
        cd.clip_start = dist * 0.05
        sc.camera = cam
        sc.render.filepath = os.path.join(OUT, "%s_%+d.png" % (name, int(t)))
        bpy.ops.render.render(write_still=True)
        print("CLOSE", sc.render.filepath, flush=True)
