# The patrol guard's idle (enemy pawn, 2026-11-20): a sentry at attention, the spear upright in his right fist,
# its butt on the floor by his right foot, the left arm hanging at his side (as the painted card, patrol-pawn.webp).
# Poses the guard's Meshy rig (same 24 bones as the king) with the same two-bone IK as guard_pose.py and writes
# guard.json in guard_pose.py's format, so bake_king_sprites.py (GUARD=..., PROP=spear glb) bakes him unchanged:
#   pose {bone: [loc, quat wxyz, scale]}, sword_in_hand (the spear relative to RightForeArm), sword_world_length,
#   grip (fraction along the spear from its butt), fists (one clay fist on the shaft), bone "RightForeArm".
#   Blender -b --python spear_pose.py -- OUTDIR [key=value ...]
# The spear glb's long axis is X with the head toward +X (the sword's blade is toward -X), so here x maps to "up".
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
# hx, hy, hz: the right fist on the shaft (x is his left, -y toward the camera, z up; rig units, figure 1.7 tall)
# length: the spear, world units; spx: how far out from his side the shaft stands (fist and butt share x, y)
# lx, ly, lz: where the hanging left hand goes; out: how far the right elbow points out (pole)
K = dict(hx=-0.36, hy=-0.10, hz=0.80, length=2.0, lx=0.33, ly=0.0, lz=0.60, fist=0.085, flen=0.10, out=1.2,
         chin=4.0, mitt=0.12, knuckle=35.0, render=1)
for kv in argv[1:]:
    k, v = kv.split("="); K[k] = float(v)
CHAR = os.path.expanduser(os.environ.get("CHAR_GLB") or "~/.dos/scratch/d84406ef/paid/out/guardrig/rigged_character_glb__rigged_character.glb")
SPEAR = os.path.expanduser(os.environ.get("SPEAR_GLB") or "~/.dos/scratch/d84406ef/paid/out/spear/model_glb__model.glb")
SHAFT_R = 0.0115  # shaft radius as a fraction of the spear's length (measured on the Meshy spear)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CHAR)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm)
arm.animation_data_clear()
MW = arm.matrix_world


def W(b, tail=False):
    pb = arm.pose.bones[b]
    return MW @ (pb.tail if tail else pb.head)


def rot_world(bone, axis, deg):
    pb = arm.pose.bones[bone]
    R = (MW.to_3x3().inverted() @ Matrix.Rotation(math.radians(deg), 3, axis) @ MW.to_3x3()).to_4x4()
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()


def aim(bone, end, target, end_tail=False):
    A = W(bone)
    R = (W(end, tail=end_tail) - A).rotation_difference(target - A).to_matrix()
    pb = arm.pose.bones[bone]
    Rl = (MW.to_3x3().inverted() @ R @ MW.to_3x3()).to_4x4()
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Rl @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()


def ik2(upper, lower, endb, T, pole):
    A, B, C = W(upper), W(lower), W(endb)
    l1, l2 = (B - A).length, (C - B).length
    v = T - A
    d = min(v.length, (l1 + l2) * 0.999)
    u = v.normalized()
    p = (pole - A); p = (p - u * p.dot(u)).normalized()
    ca = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    ang = math.acos(ca)
    aim(upper, lower, A + l1 * (u * math.cos(ang) + p * math.sin(ang)))
    aim(lower, endb, A + u * d)
    return (W(endb) - T).length


def body_min_z():
    dg = bpy.context.evaluated_depsgraph_get()
    e = body.evaluated_get(dg); m_ = e.to_mesh()
    z = min((e.matrix_world @ v.co).z for v in m_.vertices); e.to_mesh_clear()
    return z


bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
# chin up a little: a proud sentry (the head top moves back, +y)
before = W("head_end").y
rot_world("Head", "X", K["chin"])
if W("head_end").y < before:
    rot_world("Head", "X", -2 * K["chin"])

# right arm: the fist on the shaft beside him, elbow down and out; left arm hanging, elbow back
F = Vector((K["hx"], K["hy"], K["hz"]))
wrist = F + Vector((0.05, 0.0, 0.0))  # the fist sits just outside the wrist, round the shaft
miss_r = ik2("RightArm", "RightForeArm", "RightHand", wrist, W("RightArm") + Vector((-K["out"], 0.6, -1.0)))
aim("RightHand", "RightHand", F, end_tail=True)
L = Vector((K["lx"], K["ly"], K["lz"]))
miss_l = ik2("LeftArm", "LeftForeArm", "LeftHand", L, W("LeftArm") + Vector((0.4, 1.0, -0.3)))
aim("LeftHand", "LeftHand", L + Vector((0.0, 0.0, -0.2)), end_tail=True)  # open hand hangs down
print("ARM Right miss %.3f Left miss %.3f" % (miss_r, miss_l), flush=True)
arm.pose.bones["RightHand"].scale = (K["mitt"],) * 3  # the open mitt shrinks into the clay fist
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode="OBJECT")
pose = {pb.name: [list(pb.location), list(pb.rotation_quaternion), list(pb.scale)] for pb in arm.pose.bones}

# the spear: upright through the fist, its butt on the floor (the lowest point of his body, where the bake puts it)
floor = body_min_z()
Lw = K["length"]
grip = (F.z - floor) / Lw
up = Vector((0, 0, 1))
R = Matrix((up, Vector((0, 1, 0)), Vector((-1, 0, 0)))).transposed().to_4x4()
G = Matrix.Translation(F) @ R  # grip point in the world, local x up the shaft
rh = arm.pose.bones["RightForeArm"]
HB = (MW @ rh.matrix).inverted()
rel = HB @ G
# the fist: x up the shaft, the back of the hand (z) out to his right and a little toward the camera
kn = math.radians(K["knuckle"])
fz = Vector((-math.cos(kn), -math.sin(kn), 0))
Fm = Matrix((up, fz.cross(up), fz)).transposed().to_4x4(); Fm.translation = F
wl = Fm.inverted() @ W("RightHand")
fists = [dict(side="Right", m=[list(r) for r in HB @ Fm], r=K["fist"], len=K["flen"], gr=SHAFT_R * Lw, wrist=list(wl))]
os.makedirs(OUT, exist_ok=True)
json.dump(dict(knobs=K, pose=pose, sword_in_hand=[list(r) for r in rel], sword_world=[list(r) for r in MW @ rh.matrix @ rel],
               sword_world_length=Lw, grip=grip, fists=fists, bone="RightForeArm", floor=floor),
          open(os.path.join(OUT, "guard.json"), "w"), indent=1)
print("SPEAR grip %.3f floor %.3f fist %s hand %s" % (grip, floor, tuple(round(v, 3) for v in F),
      tuple(round(v, 3) for v in W("RightHand"))), flush=True)
if not K["render"]:
    sys.exit()

# --- quick EEVEE look: the spear and fist placed exactly as the bake will (king_motion.attach_held)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import king_motion as km
g = json.load(open(os.path.join(OUT, "guard.json")))
sp = km.attach_held(arm, SPEAR, g)
co = [(sp.matrix_world @ v.co) for v in sp.data.vertices]
print("SPEAR world z %.3f..%.3f x %.3f y %.3f" % (min(c.z for c in co), max(c.z for c in co),
      sum(c.x for c in co) / len(co), sum(c.y for c in co) / len(co)), flush=True)
arm.location.z -= floor
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [x.identifier for x in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 600, 800
wd = bpy.data.worlds.new("w"); wd.use_nodes = True
wd.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.52, 1); wd.node_tree.nodes["Background"].inputs[1].default_value = 1.2
sc.world = wd
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50
for name, el, az, tgt, d in (("game", 35, 0, Vector((0, 0, 0.95)), 5.0), ("front", 5, 0, Vector((0, 0, 0.95)), 5.0),
                             ("side", 5, 90, Vector((0, 0, 0.95)), 5.0), ("hand", 20, -30, F - Vector((0, 0, floor)), 1.4)):
    dirv = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), -math.cos(math.radians(az)) * math.cos(math.radians(el)),
                   math.sin(math.radians(el))))
    cam.location = tgt + dirv * d
    cam.rotation_euler = (-dirv).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, "spear-%s.png" % name)
    bpy.ops.render.render(write_still=True)
print("DONE", flush=True)
