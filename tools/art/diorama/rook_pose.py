# The rebel rook's idle (Wesley 2026-11-23, pose 1 in ~/.dos/scratch/d84406ef/rook/pose-options.jpg): the
# sledgehammer rests across the back of his shoulders, his LEFT fist holding the handle near its grip end in front
# of his left shoulder, the head out past his right shoulder; his right arm hangs relaxed with a closed fist.
# Arms by two-bone IK (guard_pose.py's method); the open Meshy hands shrink into the wrists and clay fists are
# built by king_motion.attach_fists (palm toward him, knuckles out). Prints a clipping report: how deep any point of
# the hammer or a fist sits inside his body (hands and forearms holding it excluded), and how many faces of his
# body cross each other (feet, elbows, arms against the torso): "CLIP_MAX d SELF n". Both must be ~0.
#   Blender -b --python rook_pose.py -- OUTDIR [key=value ...]
#   env CHAR_GLB (rigged rook), PROP_GLB (hammer)
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import king_motion as km

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
os.makedirs(OUT, exist_ok=True)
K = dict(
    plen=0.70,     # hammer length, as a share of his height
    pgrip=0.10,    # where the left fist holds it, share of the length from the grip end
    gx=0.08, gy=-0.10, gz=0.04,  # the left fist's grip point, from his left shoulder (LeftArm head), share of height
    hx=-0.20, hy=0.60, hz=0.36,  # where the handle crosses: a point above-behind his right shoulder, share of height
    roll=0.0,      # turns the hammer head about the handle, degrees
    fist=0.09,    # clay fist size, share of height (his hands are big)
    flen=0.11,     # fist length along the handle, share of height
    mitt=0.12,     # how small the open Meshy hands shrink
    rax=0.16, ray=0.04, raz=-0.02,  # right wrist: out from the hip, forward, up (share of height) from his hip side
    stance=0.10,   # feet apart, share of height
    chin=0.0,      # head up a little, degrees
    wdrop=0.045, wout=0.01, rfist=0.03, rgr=0.015,
    px=0.3, py=-0.3,  # left elbow pole (out, back) per unit down; a natural carry is px~0.2, py~-0.4
    dqs=1,         # 1 = Preserve Volume skinning, so a tight elbow fold squashes instead of caving in
    render=1)
for kv in argv[1:]:
    k, v = kv.split("="); K[k] = float(v)
CHAR = os.path.expanduser(os.environ.get("CHAR_GLB") or "~/.dos/scratch/d84406ef/paid/out/rook2rig/rigged_character_glb__rigged_character.glb")
PROP = os.path.expanduser(os.environ.get("PROP_GLB") or "~/.dos/scratch/d84406ef/paid/out/hammer/model_glb__model.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CHAR)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm)
arm.animation_data_clear()
MW = arm.matrix_world
bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
H = max(p.z for p in bb) - min(p.z for p in bb)
print("HEIGHT %.3f" % H, flush=True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
def W(b):
    return MW @ arm.pose.bones[b].head
def rot_world(bone, axis, deg):
    pb = arm.pose.bones[bone]
    R = (MW.to_3x3().inverted() @ Matrix.Rotation(math.radians(deg), 3, axis) @ MW.to_3x3()).to_4x4()
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()
def aim(bone, end, target):
    A = W(bone)
    R = (W(end) - A).rotation_difference(target - A).to_matrix()
    pb = arm.pose.bones[bone]
    Rl = (MW.to_3x3().inverted() @ R @ MW.to_3x3()).to_4x4()
    h = pb.head.copy()
    pb.matrix = Matrix.Translation(h) @ Rl @ Matrix.Translation(-h) @ pb.matrix
    bpy.context.view_layer.update()
def ik2(upper, lower, endb, T, pole):
    A, B, C = W(upper), W(lower), W(endb)
    l1, l2 = (B - A).length, (C - B).length
    v = T - A; d = min(v.length, (l1 + l2) * 0.999); u = v.normalized()
    p = pole - A; p = (p - u * p.dot(u)).normalized()
    ang = math.acos(max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    aim(upper, lower, A + l1 * (u * math.cos(ang) + p * math.sin(ang)))
    aim(lower, endb, A + u * d)
    return (W(endb) - T).length

# head up a little (the face is +y back... the head top should move back, +y)
before = (MW @ arm.pose.bones["head_end"].head).y
rot_world("Head", "X", K["chin"])
if (MW @ arm.pose.bones["head_end"].head).y < before:
    rot_world("Head", "X", -2 * K["chin"])
# legs a little apart, feet flat
for s, sx in (("Left", 1), ("Right", -1)):
    f = W(s + "Foot")
    ik2(s + "UpLeg", s + "Leg", s + "Foot", Vector((sx * K["stance"] * H, f.y, f.z)), Vector((sx * 0.3, -2.0, 0.5)))
    t0 = W(s + "ToeBase") - W(s + "Foot")
    aim(s + "Foot", s + "ToeBase", W(s + "Foot") + Vector((sx * 0.2, -1.0, -0.35)).normalized() * t0.length)

# --- the hammer's line: from the left grip G through the crossing point P behind his right shoulder
G = W("LeftArm") + Vector((K["gx"], K["gy"], K["gz"])) * H
P = W("RightArm") + Vector((K["hx"], K["hy"], K["hz"])) * H
d = (P - G).normalized()  # grip end -> head
# fist frame: x along the handle, z = the back of his hand, facing out from his body (away from the neck), level
c = (W("neck") + W("Spine")) * 0.5
out = (G - c); out = (out - d * out.dot(d)).normalized()
# --- left arm: wrist below the fist, elbow down and out
wrist = G - Vector((0, 0, 1)) * K["wdrop"] * H + out * K["wout"] * H
# elbow pole: down and a little forward/out, as a real shoulder carry (upper arm near vertical, arm folded tight)
miss_l = ik2("LeftArm", "LeftForeArm", "LeftHand", wrist, W("LeftArm") + Vector((K["px"], K["py"], -1.0)))
# --- right arm: hangs at his side, a little out from the hip, elbow back
hip = W("RightUpLeg")
rw = hip + Vector((-K["rax"], -K["ray"], K["raz"])) * H
miss_r = ik2("RightArm", "RightForeArm", "RightHand", rw, W("RightArm") + Vector((-0.4, 1.0, -0.3)))
def bend(s_):
    a, b, c_ = W(s_ + "Arm"), W(s_ + "ForeArm"), W(s_ + "Hand")
    return math.degrees((a - b).angle(c_ - b))
print("REACH left miss %.3f right miss %.3f; elbow angle left %.0f right %.0f (180 = straight)" % (miss_l, miss_r, bend("Left"), bend("Right")), flush=True)
for s in ("Left", "Right"):
    arm.pose.bones[s + "Hand"].scale = (K["mitt"],) * 3
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode="OBJECT")
for md in body.modifiers:
    if md.type == "ARMATURE":
        md.use_deform_preserve_volume = bool(K["dqs"])

# --- the hammer, grip end -> head along d, faces turned by roll
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=PROP)
hs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
ham = hs[0]
ham.parent = None
me = ham.data
me.transform(ham.matrix_world); ham.matrix_world = Matrix.Identity(4)
co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
lo, hi = co.min(0), co.max(0); ax = int(np.argmax(hi - lo)); L = hi[ax] - lo[ax]
def spread(mask):
    p = co[mask]; o_ = [i for i in range(3) if i != ax]
    return sum(p[:, i].max() - p[:, i].min() for i in o_)
head_hi = spread(co[:, ax] > hi[ax] - 0.1 * L) > spread(co[:, ax] < lo[ax] + 0.1 * L)
gend = lo[ax] if head_hi else hi[ax]
sgn = 1.0 if head_hi else -1.0
near = np.abs(co[:, ax] - gend) < 0.3 * L
ctr = co[near].mean(0)
oth = [i for i in range(3) if i != ax]
hm = np.abs(co[:, ax] - (gend + sgn * L)) < 0.15 * L
wide = max(oth, key=lambda i: co[hm][:, i].max() - co[hm][:, i].min())  # the head's long cross axis
u = Vector((0, 0, 0)); u[ax] = sgn
w = Vector((0, 0, 0)); w[wide] = 1.0
gp = Vector(ctr); gp[ax] = gend + sgn * K["pgrip"] * L
S = K["plen"] * H / L
# the head's long axis (its striking faces) points along `wd`: across the handle, mostly up/down, turned by roll
up_ = Vector((0, 0, 1)) - d * d.z; up_.normalize()
side_ = d.cross(up_)
rr = math.radians(K["roll"])
wd = (up_ * math.cos(rr) + side_ * math.sin(rr)).normalized()
src = Matrix((u, w, u.cross(w))).transposed()
dst = Matrix((d, wd, d.cross(wd))).transposed()
ham.matrix_world = Matrix.Translation(G) @ (dst @ src.inverted()).to_4x4() @ Matrix.Scale(S, 4) @ Matrix.Translation(-gp)
bpy.context.view_layer.update()
ham.name = "hammer"
mw = ham.matrix_world.copy()
ham.parent = arm; ham.parent_type = "BONE"; ham.parent_bone = "LeftForeArm"; ham.matrix_world = mw
gr = float(np.median(np.linalg.norm((co[near] - ctr)[:, oth], axis=1))) * S  # handle radius
print("HANDLE radius %.4f length %.3f" % (gr, K["plen"] * H), flush=True)

# --- clay fists: left round the handle, right closed on nothing (a tiny grip) along the forearm
def fist_for(side, F, grip_r, bone):
    pbm = MW @ arm.pose.bones[bone].matrix
    wl = F.inverted() @ (MW @ arm.pose.bones[side + "Hand"].head)
    f = dict(side=side, m=[list(r) for r in pbm.inverted() @ F], r=K["fist"] * H, len=K["flen"] * H, gr=grip_r, wrist=list(wl))
    return km.attach_fists(arm, dict(fists=[f]), bone), f
FL = Matrix((d, out.cross(d), out)).transposed().to_4x4(); FL.translation = G
fl_objs, fl = fist_for("Left", FL, gr, "LeftForeArm")
fa = (W("RightHand") - W("RightForeArm")).normalized()
fy2 = fa.cross(Vector((0, 0, 1))).normalized() if abs(fa.z) < 0.99 else Vector((0, 1, 0))
FR = Matrix((fa, fy2, fa.cross(fy2))).transposed().to_4x4()  # closed on nothing: grip along the forearm (the king's let-go fist)
FR.translation = W("RightHand") + fa * K["rfist"] * H
fr_objs, fr = fist_for("Right", FR, K["rgr"] * H, "RightForeArm")
json.dump(dict(knobs=K, height=H, pose={pb.name: [list(pb.location), list(pb.rotation_quaternion), list(pb.scale)] for pb in arm.pose.bones},
               hammer_in_forearm=[list(r) for r in (MW @ arm.pose.bones["LeftForeArm"].matrix).inverted() @ ham.matrix_world],
               hammer_bone="LeftForeArm", fists=[fl, fr]), open(os.path.join(OUT, "rook_pose.json"), "w"), indent=1)

# --- clipping: points of the hammer and the fists inside his body (his own holding hand/forearm skipped)
dg = bpy.context.evaluated_depsgraph_get()
eb = body.evaluated_get(dg); bm_ = eb.to_mesh()
verts = [eb.matrix_world @ v.co for v in bm_.vertices]
vg_names = {g.index: g.name for g in body.vertex_groups}
def top_group(poly):
    acc = {}
    for vi in poly.vertices:
        for ge in body.data.vertices[vi].groups:
            n = vg_names[ge.group]; acc[n] = acc.get(n, 0) + ge.weight
    return max(acc, key=acc.get) if acc else ""
polys = [(list(p.vertices), top_group(p)) for p in body.data.polygons]
def bvh_without(skip):
    keep = [p for p, g in polys if g not in skip]
    return BVHTree.FromPolygons(verts, keep)
def km_inside(bvh, q):
    up, n, o = Vector((0.0001, 0.0002, 1.0)).normalized(), 0, q.copy()
    for _ in range(64):
        hit = bvh.ray_cast(o, up)[0]
        if hit is None:
            break
        n += 1; o = hit + up * 1e-4
    return n % 2 == 1
def depth_report(name, pts, skip):
    keep = [p for p, g in polys if g not in skip]; kg = [g for p, g in polys if g not in skip]
    t = BVHTree.FromPolygons(verts, keep)
    worst = 0.0; wg = ""
    for q in pts:
        loc, nrm, _i, dist = t.find_nearest(q)
        if loc is None:
            continue
        if (q - loc).dot(nrm) < 0 and km_inside(t, q):  # both votes, as strike_check.py
            if dist > worst:
                worst = dist; wg = kg[_i]
    print("CLIP %-10s %.3f %s" % (name, worst, wg), flush=True)
    return worst
def obj_pts(o, step=3):
    e = o.evaluated_get(dg); m = e.to_mesh(); p = [e.matrix_world @ v.co for v in m.vertices][::step]; e.to_mesh_clear()
    return p
hp = obj_pts(ham)
# the stretch inside the left fist is held: skip hammer points within the fist's length of G along the handle
hp = [q for q in hp if abs((q - G).dot(d)) > K["flen"] * H * 0.6 or (q - G - d * (q - G).dot(d)).length > gr * 3]
cmax = max(depth_report("hammer", hp, {"LeftHand", "LeftForeArm"}),
           depth_report("fist_L", sum((obj_pts(o) for o in fl_objs), []), {"LeftHand", "LeftForeArm"}),
           depth_report("fist_R", sum((obj_pts(o) for o in fr_objs), []), {"RightHand", "RightForeArm"}))
# --- his body against itself (a pose can fold a limb into his body with nothing held at all): surface
# crossings between two parts, by BVH overlap. Faces sharing a vertex (the seam where two parts join) don't count.
LEGL = {"LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "LeftToe_End"}
LEGR = {n.replace("Left", "Right") for n in LEGL}
ARMR = {"RightArm", "RightForeArm", "RightHand"}
TORSO = {"Hips", "Spine", "Spine01", "Spine02", "Spine1", "Spine2", "neck", "Neck", "LeftUpLeg", "RightUpLeg"}
def part(names):
    idx = [i for i, (p_, g) in enumerate(polys) if g in names]
    return BVHTree.FromPolygons(verts, [polys[i][0] for i in idx]), idx
def crossings(name, A, B):
    ta, ia = part(A); tb, ib = part(B)
    n = 0; zmax = 0.0
    for i, j in ta.overlap(tb):
        pa, pb = polys[ia[i]][0], polys[ib[j]][0]
        if set(pa) & set(pb):
            continue
        n += 1
    print("SELF %-14s %d crossing faces" % (name, n), flush=True)
    return n
gnames = set(g for _p, g in polys)
selfn = (crossings("feet/legs", LEGL & gnames, LEGR & gnames)
         + crossings("right arm/body", ARMR & gnames, TORSO & gnames)
         + crossings("left elbow", {"LeftForeArm"}, {"LeftArm"})
         + crossings("right elbow", {"RightForeArm"}, {"RightArm"})
         + crossings("left arm/body", {"LeftArm", "LeftForeArm"}, TORSO & gnames))
print("GROUPS", sorted(gnames), flush=True)
print("CLIP_MAX %.3f SELF %d" % (cmax, selfn), flush=True)
zs = [v.z for v in verts]; eb.to_mesh_clear()
arm.location.z -= min(zs)
if not K["render"]:
    sys.exit()

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [x.identifier for x in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 600, 700
wd_ = bpy.data.worlds.new("w"); wd_.use_nodes = True
wd_.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.52, 1)
sc.world = wd_
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
sun.data.energy = 3; sun.rotation_euler = (math.radians(50), 0, math.radians(-30))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50
tgt = Vector((0, 0, H * 0.5))
for name, el, az, dist, t in (("front", 8, 0, 1.7, tgt), ("34", 15, -35, 1.7, tgt), ("back", 10, 160, 1.7, tgt),
                              ("game", 35, 0, 1.7, tgt), ("fist", 10, -20, 0.5, G + Vector((0, 0, -0.02))),
                              ("feet", 25, 15, 0.7, (W("LeftFoot") + W("RightFoot")) * 0.5 - Vector((0, 0, 0.03))),
                              ("elbowL", 5, 120, 0.7, W("LeftForeArm")), ("armR", 5, -100, 0.9, W("RightForeArm"))):
    v = Vector((math.sin(math.radians(az)) * math.cos(math.radians(el)), -math.cos(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))))
    cam.location = t + v * dist * H
    cam.rotation_euler = (-v).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
print("DONE", flush=True)
