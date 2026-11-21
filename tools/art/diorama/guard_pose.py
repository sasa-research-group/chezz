# The king's idle guard with the royal blade (Wesley 2026-11-19: "middle guard", both hands on the sword, a
# standard battle-ready pose leaning into the sword; draft sword/r1-mid.png).
# Poses the Meshy rig with IK (feet wide and staggered, knees bent, hips low, torso leaning forward, both hands on
# the grip, blade angled up and forward across his body), bakes the result to plain bone rotations, and writes:
#   guard.json      {bone: [loc xyz, quat wxyz]} in pose-bone space, plus the sword's matrix relative to RightHand
#   guard-*.png     quick EEVEE previews: game camera (35 deg), front and side
#   Blender -b --python guard_pose.py -- OUTDIR [key=value ...]   (knobs below, all optional)
# The shipped idle (king_guard.json, 2026-11-20) used: hips=0.1 lean=15 chin=15 stance=0.3 fist=0.09 shoulder=34
#   gx=-0.08 gy=-0.40 gz=0.42 tilt=28 wrist=0.08 fwd=10 gap=0.125 mitt=0.12
# then runguard.sh king_guard.json royal_blade.glb OUT and king_atlas.py OUT public/diorama.
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import gpu_retry  # renders again in place after a Metal GPU reset

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
K = dict(hips=0.07, lean=14.0, chin=12.0, stance=0.27, stagger=0.13, gx=-0.02, gy=-0.36, gz=0.50,
         tilt=40.0, fwd=35.0, length=0.72, gap=0.075, shoulder=28.0, wrist=0.05, mitt=0.3, fist=0.05, twist=0.0, roll=0.0,
         air=0.0, ahead=0.0, tuck=0.0, step=0.0, look=0.0, nervous=0.0, fall=0.0, let=0.0, lx=0.62, ly=0.10, lz=0.92, spin=0.0, drop=0.0, clat=0.0, sdx=-0.52, sdy=-0.02, hx=0.0, hy=0.0, hz=0.0, hqw=0.0, hqx=0.0, hqy=0.0, hqz=0.0, floor=-0.062, render=1)
for kv in argv[1:]:
    k, v = kv.split("="); K[k] = float(v)
KING = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/rig/rigged_character_glb__rigged_character.glb")
SWORD = os.path.expanduser("~/.dos/scratch/d84406ef/sword/royal_blade.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KING)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm)
arm.animation_data_clear()
# nervous: a face from nervous_face.py, applied at rest before posing: 1 the worried face of the "in check" loop,
# 2 woe (the death's stumble: open frown), 3 dead (X eyes, tongue out)
if K["nervous"]:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import nervous_face
    nervous_face.apply(arm, body, nervous_face.MOODS[min(2, max(0, int(round(K["nervous"])) - 1))])
H = 1.7
MW = arm.matrix_world
def W(b, tail=False):  # world position of a pose bone's head/tail
    pb = arm.pose.bones[b]
    return MW @ (pb.tail if tail else pb.head)
def empty(name, loc):
    e = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(e)
    e.location = loc
    return e
def rot_world(bone, axis, deg):
    """rotate a pose bone about a world axis through its head"""
    pb = arm.pose.bones[bone]
    R = (MW.to_3x3().inverted() @ Matrix.Rotation(math.radians(deg), 3, axis) @ MW.to_3x3()).to_4x4()
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"

# --- body: hips down, torso leaning forward (forward is -y; tipping forward is +x rotation... check sign below)
foot0 = {s: W(s + "Foot") for s in ("Left", "Right")}
hips = arm.pose.bones["Hips"]
m = hips.matrix.copy(); m.translation += MW.to_3x3().inverted() @ Vector((0, 0, -K["hips"])) ; hips.matrix = m
bpy.context.view_layer.update()
# lean: the head should move toward -y
for b, share in (("Spine02", 0.45), ("Spine01", 0.35), ("Spine", 0.2)):
    before = W("Head").y
    rot_world(b, "X", -K["lean"] * share)
    if W("Head").y > before:  # wrong way: undo twice
        rot_world(b, "X", 2 * K["lean"] * share)
rot_world("Head", "X", 0)  # placeholder so the head is updated
before = W("head_end").y
rot_world("Head", "X", K["chin"] * 0.5); rot_world("neck", "X", K["chin"] * 0.5)
if W("head_end").y < before:  # chin should come up: the head top moves back (+y)
    rot_world("Head", "X", -K["chin"]); rot_world("neck", "X", -K["chin"])
# twist the chest toward the sword (left shoulder comes forward); the head keeps facing ahead
if K["twist"]:
    hr = arm.pose.bones["Head"].matrix.to_3x3().copy()
    for bn, share in (("Spine02", 0.5), ("Spine01", 0.3), ("Spine", 0.2)):
        before = W("LeftArm").y
        rot_world(bn, "Z", K["twist"] * share)
        if W("LeftArm").y > before:
            rot_world(bn, "Z", -2 * K["twist"] * share)
    pb = arm.pose.bones["Head"]; m = hr.to_4x4(); m.translation = pb.matrix.translation; pb.matrix = m
    bpy.context.view_layer.update()
# look: turn the head (neck 40%, head 60%) about the vertical, degrees; + turns his face toward the camera's right
if K["look"]:
    rot_world("neck", "Z", K["look"] * 0.4); rot_world("Head", "Z", K["look"] * 0.6)
    bpy.context.view_layer.update()
# shoulders roll forward so the short arms reach the grip in front of the belly
for s, sg in (("Left", 1), ("Right", -1)):
    rot_world(s + "Shoulder", "Z", -sg * K["shoulder"])
    if W(s + "Arm").y > W(s + "Shoulder").y + 0.0:  # arm head should have come forward (-y)
        rot_world(s + "Shoulder", "Z", 2 * sg * K["shoulder"])

def aim(bone, end, target, end_tail=False):
    """rotate `bone` about its head (world) so the point `end` (a bone head, or this bone's tail) points at target"""
    A = W(bone)
    cur = (W(end, tail=end_tail) - A)
    R = cur.rotation_difference(target - A).to_matrix()
    pb = arm.pose.bones[bone]
    Rl = (MW.to_3x3().inverted() @ R @ MW.to_3x3()).to_4x4()
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Rl @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()

def ik2(upper, lower, endb, T, pole):
    """exact two-bone IK: the joint bends toward `pole`"""
    A, B, C = W(upper), W(lower), W(endb)
    l1, l2 = (B - A).length, (C - B).length
    v = T - A
    d = min(v.length, (l1 + l2) * 0.999)
    u = v.normalized()
    p = (pole - A); p = (p - u * p.dot(u)).normalized()
    ca = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    ang = math.acos(ca)
    knee = A + l1 * (u * math.cos(ang) + p * math.sin(ang))
    aim(upper, lower, knee)
    aim(lower, endb, A + u * d)
    return (W(endb) - T).length

# --- legs: wide, staggered feet (left foot forward), knees forward and out
for s, sx, dy in (("Left", 1, -K["stagger"]), ("Right", -1, K["stagger"] * 0.4)):
    # tuck: feet drawn up under him (a jump; `air` lifts the whole body afterwards). step: the front (left) foot
    # reaches further forward, a lunge
    T = Vector((sx * K["stance"], foot0[s].y + dy - (K["step"] if s == "Left" else 0) + K["tuck"] * 0.5,
                foot0[s].z + K["tuck"]))
    print("LEG %s miss %.3f" % (s, ik2(s + "UpLeg", s + "Leg", s + "Foot", T, Vector((sx * (K["stance"] + 0.3), -1.5, 0.25)))), flush=True)
    # keep the foot flat and pointing forward-out: undo the shin's rotation on the foot
    aim(s + "Foot", s + "ToeBase", W(s + "Foot") + Vector((sx * 0.25, -1.0, -0.6)).normalized() * (W(s + "ToeBase") - W(s + "Foot")).length)

# --- the sword: grip centre at (gx, gy, gz), blade up and forward, leaning toward his right (viewer's left, -x)
t, f = math.radians(K["tilt"]), math.radians(K["fwd"])
up = Vector((-math.sin(t), -math.sin(f), math.cos(t) * math.cos(f))).normalized()  # pommel -> tip
G = Vector((K["gx"], K["gy"], K["gz"]))
# which way the blade's flat faces: toward the viewer (-y) in the guard; `roll` turns that reference about the
# vertical toward +x, so in a chop (blade pointing forward) the flat faces sideways and the edge leads
rr = math.radians(K["roll"])
REF = Vector((math.sin(rr), -math.cos(rr), 0))
def flat(u):
    v = REF - u * u.dot(REF)
    if v.length < 1e-4:
        v = Vector((0, 0, 1)) - u * u.dot(Vector((0, 0, 1)))
    return v.normalized()
hands = {"Right": G + up * K["gap"] * 0.5, "Left": G - up * K["gap"] * 0.5}  # right hand by the guard
side = up.cross(Vector((0, -1, 0))).normalized() if abs(up.y) < 0.999 else Vector((1, 0, 0))  # across the grip
if side.x < 0:
    side = -side
# that breaks down as the blade points forward (a chop), so blend toward plain +x across the grip as `roll` rises
w = min(1.0, abs(K["roll"]) / 90.0)
if w:
    px = (Vector((1, 0, 0)) - up * up.x).normalized()
    side = (side * (1 - w) + px * w).normalized()
# let (0..1): his hands leave the grip and the arms fall open to the sides (the death); the targets are in his
# standing frame, so once `fall` tips him onto his back they lie spread on the floor
# (lx, ly, lz: where the open hands go; the stumble raises and flails them)
LET = {"Left": Vector((K["lx"], K["ly"], K["lz"])), "Right": Vector((-K["lx"], K["ly"], K["lz"]))}
for s, sx in (("Left", 1), ("Right", -1)):
    wrist = hands[s] + side * sx * K["wrist"] + Vector((0, 0.02, 0))
    wrist = wrist.lerp(LET[s], K["let"])
    print("ARM %s miss %.3f" % (s, ik2(s + "Arm", s + "ForeArm", s + "Hand", wrist, Vector((sx * 1.2, 0.4, 0.2)))), flush=True)
    if K["let"] < 0.5:
        aim(s + "Hand", s + "Hand", hands[s] + Vector((0, -0.03, 0)), end_tail=True)  # fist closes around the grip
bpy.ops.object.mode_set(mode="OBJECT")
for o in list(bpy.data.objects):
    if o.type == "EMPTY":
        bpy.data.objects.remove(o)

for b in ("Hips","Spine","Head","head_end","LeftShoulder","LeftArm","LeftForeArm","LeftHand","RightArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot","RightLeg","RightFoot"):
    print("POS %-12s %s" % (b, tuple(round(v, 3) for v in W(b))), flush=True)
for s in ("Left", "Right"):
    print("REACH %s hand %s want %s miss %.3f" % (s, tuple(round(v, 3) for v in W(s + "Hand")),
          tuple(round(v, 3) for v in hands[s]), (W(s + "Hand") - hands[s]).length), flush=True)

# --- the sword, placed in the world, then parented to the right hand keeping its transform
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SWORD)
sw = next(o for o in bpy.data.objects if o not in before and o.type == "MESH")
me = sw.data
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
lo, hi = co.min(0), co.max(0); L = hi[0] - lo[0]
grip = Vector((lo[0] + 0.835 * L, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
me.transform(Matrix.Scale(K["length"] * H / L, 4) @ Matrix.Translation(-grip))  # grip centre at the origin
# local -x is the blade: map -x -> up; local z (the flat) faces the viewer as much as possible
x_ax = -up
z_ax = flat(up)
y_ax = z_ax.cross(x_ax)
R = Matrix((x_ax, y_ax, z_ax)).transposed().to_4x4()
sw.matrix_world = Matrix.Translation(G) @ R
bpy.context.view_layer.update()
mw = sw.matrix_world.copy()
sw.parent = arm; sw.parent_type = "BONE"; sw.parent_bone = "RightForeArm"  # not the hand: it is shrunk below
sw.matrix_world = mw
bpy.context.view_layer.update()
# the Meshy hands are open mitts: they can't close on the grip, so they shrink into the wrist and a clay fist
# (stored here, built by king_motion.attach_held) wraps the grip where each hand holds it
for s_ in ("Left", "Right"):
    arm.pose.bones[s_ + "Hand"].scale = (K["mitt"],) * 3
bpy.context.view_layer.update()
rh = arm.pose.bones["RightForeArm"]
rel = (MW @ rh.matrix).inverted() @ sw.matrix_world  # sword in the hand bone's frame (tail-relative fix below)
pose = {pb.name: [list(pb.location), list(pb.rotation_quaternion), list(pb.scale)] for pb in arm.pose.bones}
HB = (MW @ rh.matrix).inverted()
fists = []
for s_ in ("Left", "Right"):
    # fist frame: x along the grip (up), z toward the viewer-ish, centre on the grip
    fz = flat(up)
    fy = fz.cross(up)
    F = Matrix((up, fy, fz)).transposed().to_4x4(); F.translation = hands[s_]
    if K["let"]:  # an open-handed fist off the grip: along the forearm, just past the wrist
        fa = (W(s_ + "Hand") - W(s_ + "ForeArm")).normalized()
        fy2 = fa.cross(Vector((0, 0, 1))).normalized() if abs(fa.z) < 0.99 else Vector((0, 1, 0))
        F2 = Matrix((fa, fy2, fa.cross(fy2))).transposed().to_4x4(); F2.translation = W(s_ + "Hand") + fa * 0.05
        F = F if K["let"] < 0.5 else F2
    wl = F.inverted() @ W(s_ + "Hand")  # the forearm's end, in the fist frame
    fists.append(dict(side=s_, m=[list(r) for r in HB @ F], r=K["fist"], len=K["gap"] * 0.98,
                      gr=0.0215 / 1.018 * K["length"] * H, wrist=list(wl)))
# a jump or lunge: the whole body (and the sword and fists with it, as they hang off the forearm) rises by `air`
# and travels forward by `ahead`, moved at the root bone after everything above is solved
if K["air"] or K["ahead"]:
    m = hips.matrix.copy(); m.translation += MW.to_3x3().inverted() @ Vector((0, -K["ahead"], K["air"])); hips.matrix = m
    bpy.context.view_layer.update()
    pose = {pb.name: [list(pb.location), list(pb.rotation_quaternion), list(pb.scale)] for pb in arm.pose.bones}
# fall (degrees): the whole body tips back about his back heel (the death), then is lifted so nothing sinks
# through the floor (`floor`: the standing guard's lowest point, where the bake puts the floor); drop (0..1): the sword leaves his hand and lands flat on the floor at his right side
def body_min_z():
    dg = bpy.context.evaluated_depsgraph_get()
    e = body.evaluated_get(dg); m_ = e.to_mesh()
    z = min((e.matrix_world @ v.co).z for v in m_.vertices); e.to_mesh_clear()
    return z
if K["fall"]:
    piv = Vector((0, max(W("LeftFoot").y, W("RightFoot").y) + 0.06, min(W("LeftFoot").z, W("RightFoot").z)))
    R4 = Matrix.Translation(piv) @ Matrix.Rotation(math.radians(-K["fall"]), 4, "X") @ Matrix.Translation(-piv)
    hips.matrix = MW.inverted() @ R4 @ MW @ hips.matrix
    bpy.context.view_layer.update()
    z = body_min_z()
    if z < K["floor"]:
        m = hips.matrix.copy(); m.translation += MW.to_3x3().inverted() @ Vector((0, 0, K["floor"] - z)); hips.matrix = m
        bpy.context.view_layer.update()
    print("FALL %.0f head %s lift %.3f" % (K["fall"], tuple(round(v, 2) for v in W("Head")), max(0, K["floor"] - z)), flush=True)
    pose = {pb.name: [list(pb.location), list(pb.rotation_quaternion), list(pb.scale)] for pb in arm.pose.bones}
# spin (degrees): the whole body turns about the vertical through his hips (the death's dizzy half-turn), after
# the fall, so a fall is always back in his own frame. Plus is counterclockwise seen from above.
if K["spin"]:
    c = W("Hips"); c.z = 0
    R4 = Matrix.Translation(c) @ Matrix.Rotation(math.radians(K["spin"]), 4, "Z") @ Matrix.Translation(-c)
    hips.matrix = MW.inverted() @ R4 @ MW @ hips.matrix
    bpy.context.view_layer.update()
    print("SPIN %.0f about %s" % (K["spin"], tuple(round(v, 2) for v in c)), flush=True)
    pose = {pb.name: [list(pb.location), list(pb.rotation_quaternion), list(pb.scale)] for pb in arm.pose.bones}
if K["drop"]:
    # drop (0..1, time through the fall): it slips out of his opening hands and falls like a dropped thing, from
    # rest at the release pose (hx..hqz, the sword's world pose on the frame his hands open; unset: where it is in
    # his hand now), speeding up (gravity: the height goes as drop^2), tipping over flat as it falls, onto the floor
    # by his right foot (sdx, sdy). clat (0..1, after it lands): it clatters, the heavy hilt end bouncing twice off
    # the floor about the blade's tip. (Draft 4 slid it along an arc that slowed into the floor: "unnatural", Wesley)
    held = MW @ rh.matrix @ rel  # where it is in his hand now (world)
    if K["hqw"] or K["hqx"] or K["hqy"] or K["hqz"]:
        held = Matrix.Translation(Vector((K["hx"], K["hy"], K["hz"]))) @ Quaternion((K["hqw"], K["hqx"], K["hqy"], K["hqz"])).to_matrix().to_4x4()
    xa = Vector((-0.30, -0.95, 0)).normalized()  # pommel -> tip: forward and out to his right, flat on the floor
    lie = Matrix((-xa, Vector((0, 0, 1)).cross(-xa), Vector((0, 0, 1)))).transposed().to_4x4()
    lie.translation = Vector((K["sdx"], K["sdy"], 0))
    sw.matrix_world = lie; bpy.context.view_layer.update()
    zs_ = [(sw.matrix_world @ v.co).z for v in sw.data.vertices]
    lie.translation.z -= min(zs_) - K["floor"]  # lowest point of the sword on the floor
    u = min(1.0, K["drop"])
    a, b = held.to_translation(), lie.to_translation()
    T = a.lerp(b, u)
    T.z = a.z + (b.z - a.z) * u * u
    Q = held.to_quaternion().slerp(lie.to_quaternion(), u)
    want = Matrix.Translation(T) @ Q.to_matrix().to_4x4()
    if K["clat"] and u >= 1:
        p_ = min(1.0, K["clat"])
        tip = lie.translation + xa * (0.835 * K["length"] * H)
        ax = xa.cross(Vector((0, 0, 1))).normalized()
        if (Matrix.Rotation(0.1, 3, ax) @ (-xa)).z < 0:  # turn the way that lifts the hilt end
            ax = -ax
        ang = math.radians(9) * abs(math.sin(2 * math.pi * p_)) * (1 - p_) ** 1.5
        want = Matrix.Translation(tip) @ Matrix.Rotation(ang, 4, ax) @ Matrix.Translation(-tip) @ want
    rel = (MW @ rh.matrix).inverted() @ want
    sw.matrix_world = want; bpy.context.view_layer.update()
    print("DROP %.2f clat %.2f sword at %s" % (u, K["clat"], tuple(round(v, 2) for v in T)), flush=True)
os.makedirs(OUT, exist_ok=True)
json.dump(dict(knobs=K, pose=pose, sword_in_hand=[list(r) for r in rel], sword_world=[list(r) for r in MW @ rh.matrix @ rel], sword_world_length=K["length"] * H, grip=0.835, fists=fists, bone="RightForeArm"),
          open(os.path.join(OUT, "guard.json"), "w"), indent=1)

sys.path.insert(0, os.path.expanduser("~/chezz-puzzle/tools/art/diorama"))
import king_motion as km
km.attach_fists(arm, dict(fists=fists), "RightForeArm")

# --- lowest point and a quick look
dg = bpy.context.evaluated_depsgraph_get()
e = body.evaluated_get(dg); m2 = e.to_mesh()
zs = [(e.matrix_world @ v.co).z for v in m2.vertices]; e.to_mesh_clear()
print("FLOOR body min z %.3f (was 0)" % min(zs), flush=True)
arm.location.z -= min(zs) if not (K["air"] or K["tuck"]) else -0.062  # off the ground: keep the standing floor
if not K["render"]:
    sys.exit()
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [x.identifier for x in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 700, 800
wd = bpy.data.worlds.new("w"); wd.use_nodes = True
wd.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.52, 1); wd.node_tree.nodes["Background"].inputs[1].default_value = 1.2
sc.world = wd
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50
tgt = Vector((0, 0, 0.8))
for name, el, az in (("game", 35, 0), ("front", 5, 0), ("side", 5, 90)):
    d = 4.2
    dirv = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), -math.cos(math.radians(az)) * math.cos(math.radians(el)),
                   math.sin(math.radians(el))))
    cam.location = tgt + dirv * d
    cam.rotation_euler = (-dirv).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, "guard-%s.png" % name)
    gpu_retry.render()
# close-up of the hands on the grip, from the game camera and from the front
fc = sum((o.matrix_world.translation for o in bpy.data.objects if o.name.startswith("fist_")), Vector()) / 2
for name, el in (("hands", 35), ("hands-front", 8)):
    dirv = Vector((0, -math.cos(math.radians(el)), math.sin(math.radians(el))))
    cam.location = fc + dirv * 1.3
    cam.rotation_euler = (-dirv).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, "guard-%s.png" % name)
    gpu_retry.render()
print("DONE", flush=True)
