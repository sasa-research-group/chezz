# The eye square's prop, for Cycles (Wesley 2026-11-24, "Meshy base, code lids, render it"): the code-built eye looked
# like a GameCube model next to the handmade figures, so the pedestal and claws are now a Meshy model (image-to-3D from
# eye/ped-34.png, a stone plinth in the castle-wall style with four rusty claws round a plain grey stand-in ball), and
# only the parts that move are built here: a glassy eyeball and two hammered iron lids, in real Cycles materials. It is
# pre-rendered like the figures, never drawn live.
#
# What this script does to the Meshy model:
#   - finds the stand-in ball (a sphere fitted to its grey vertices) and cuts it out;
#   - squashes the plinth's middle block (Meshy made it as tall as it is wide; the eye must not hide the square behind);
#   - scales it to EYE_FOOT of a square and stands it on the floor;
# then builds the head (ball, iris, pupil, glass cornea, lids) inside the claws, a little smaller than the stand-in ball
# so the lids swing open without cutting through the claws.
#
#   Blender -b --python build_eye_cycles.py -- --ped MESHY.glb --out DIR [--res 1600 --samples 128 --states doze,stare]
# writes DIR/eye-{state}.png (the whole board, the eye on the centre square) and DIR/eye-{state}-zoom.png.
import bpy, bmesh, sys, os, math, argparse, random
import numpy as np
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
import stage

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--ped", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--states", default="doze,stare")
ap.add_argument("--squash", type=float, default=0.55)  # the plinth's middle block keeps this share of its height
ap.add_argument("--zoom", type=float, default=0.0)  # >0: render only a box this many eye-widths wide round it
ap.add_argument("--bake", action="store_true")  # the sprite frames (eye alone, transparent) instead of the stills
ap.add_argument("--glow_k", type=float, default=16.0)
ap.add_argument("--foot", type=float, default=0.6)     # footprint, share of a square
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)
random.seed(7)

H = 1.7          # figure height (the set's unit)
S = 1.2 * H      # one square
EL, FOCAL, ZOOM5, LA, ASPECT = 35.0, 50.0, 0.255, 0.21, 4.0 / 3.0  # the game camera, as bake_king_sprites.py

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ---------- the Meshy pedestal ----------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=a.ped)
new = [o for o in bpy.data.objects if o not in before]
ped = next(o for o in new if o.type == "MESH")
ped.data.transform(ped.matrix_world)
ped.parent = None
ped.matrix_world = Matrix()
for o in new:
    if o is not ped:
        bpy.data.objects.remove(o)
ped.name = "eye_pedestal"
me = ped.data
n = len(me.vertices)
P = np.empty(n * 3); me.vertices.foreach_get("co", P); P = P.reshape(n, 3)

# Per-vertex base colour from the Meshy texture (one loop's UV per vertex is enough to tell grey ball from rusty iron).
mat0 = me.materials[0]
bsdf = next(nd for nd in mat0.node_tree.nodes if nd.type == "BSDF_PRINCIPLED")
img = bsdf.inputs["Base Color"].links[0].from_node.image
w, h = img.size
px = np.array(img.pixels[:]).reshape(h, w, img.channels)[..., :3]
uvl = me.uv_layers.active.data
uv = np.empty(len(me.loops) * 2); uvl.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
lv = np.empty(len(me.loops), dtype=np.int64); me.loops.foreach_get("vertex_index", lv)
vuv = np.zeros((n, 2)); vuv[lv] = uv
col = px[np.clip((vuv[:, 1] % 1) * h, 0, h - 1).astype(int), np.clip((vuv[:, 0] % 1) * w, 0, w - 1).astype(int)]
val = col.max(1); sat = (col.max(1) - col.min(1)) / np.maximum(val, 1e-4)
grey = (sat < 0.12) & (val > 0.18) & (val < 0.85)

# Fit a sphere to the stand-in ball: grey vertices above the collar, refined a few times.
c = np.array([0.0, 0.0, P[:, 2].max() - 0.4]); rad = 0.4
for it in range(6):
    d = np.linalg.norm(P - c, axis=1)
    m = grey & (np.abs(d - rad) < (0.06 if it < 2 else 0.025)) & (P[:, 2] > P[:, 2].max() - 0.9)
    A = np.c_[2 * P[m], np.ones(m.sum())]
    sol = np.linalg.lstsq(A, (P[m] ** 2).sum(1), rcond=None)[0]
    c = sol[:3]; rad = float(np.sqrt(sol[3] + c @ c))
print("CHECK ball fit centre", c.round(3), "radius", round(rad, 3), "verts", int(m.sum()), flush=True)

# Cut the ball out: faces whose every vertex is on or inside it and grey (the claws hug it, so colour keeps them).
inside = (np.linalg.norm(P - c, axis=1) < rad * 1.025) & (grey | (np.linalg.norm(P - c, axis=1) < rad * 0.95))
bm = bmesh.new(); bm.from_mesh(me)
bm.verts.ensure_lookup_table()
kill = [f for f in bm.faces if all(inside[v.index] for v in f.verts)]
print("CHECK ball faces cut", len(kill), "of", len(bm.faces), flush=True)
bmesh.ops.delete(bm, geom=kill, context="FACES")
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
bm.to_mesh(me); bm.free()
n = len(me.vertices)
P = np.empty(n * 3); me.vertices.foreach_get("co", P); P = P.reshape(n, 3)

# Squash the middle block. The plinth is a base slab, a block of stone courses, then an overhanging capstone: find the
# block as the run of heights where the outline is narrower than both slab and capstone.
z0, z1 = P[:, 2].min(), P[:, 2].max()
zs = np.linspace(z0, z1, 80)
wid = np.array([np.abs(P[np.abs(P[:, 2] - z) < (z1 - z0) / 80, 0]).max(initial=0) for z in zs])
low = zs < c[2] - rad  # below the ball
slab_w = wid[:6].max()
narrow = low & (wid < slab_w * 0.9) & (wid > 0)
i0 = int(np.argmax(narrow)); i1 = i0
while i1 + 1 < len(zs) and narrow[i1 + 1]:
    i1 += 1  # the first run of narrow heights up from the slab (the collar above the capstone is narrow too)
bz0, bz1 = zs[i0], zs[i1]
narrow = (np.arange(len(zs)) >= i0) & (np.arange(len(zs)) <= i1)
cap_w = wid[i1 + 1:i1 + 6].max()
print("CHECK block z %.3f..%.3f (slab %.3f, block %.3f, cap %.3f wide)" % (bz0, bz1, slab_w, wid[narrow].mean(), cap_w), flush=True)
pad = (bz1 - bz0) * 0.04
bz0, bz1 = bz0 + pad, bz1 - pad
drop = (bz1 - bz0) * (1 - a.squash)
z = P[:, 2]
P[:, 2] = np.where(z <= bz0, z, np.where(z >= bz1, z - drop, bz0 + (z - bz0) * a.squash))
c[2] -= drop

# Centre it, stand it on the floor, scale it to the footprint.
lo, hi = P.min(0), P.max(0)
off = np.array([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
k = a.foot * S / max(hi[0] - lo[0], hi[1] - lo[1])
P = (P + off) * k
c = (c + off) * k; rad *= k
me.vertices.foreach_set("co", P.ravel()); me.update()
print("CHECK pedestal %.3f x %.3f x %.3f (H %.2f); ball centre z %.3f radius %.3f" % (*(P.max(0) - P.min(0)), H, c[2], rad), flush=True)

# ---------- materials for the code parts ----------
def nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    return m, nt, nt.nodes["Principled BSDF"]


def link(nt, a_, b_):
    nt.links.new(a_, b_)


def iron_mat(name="eye_iron"):
    """Hand-forged iron like Meshy's claws: dark, hammer-dented, rust blooming in patches, worn bright on the edges."""
    m, nt, b = nodes(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 9 / rad
    link(nt, tc.outputs["Object"], vor.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = rad * 0.02
    link(nt, vor.outputs["Distance"], bump.inputs["Height"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.2 / rad; nz.inputs["Detail"].default_value = 6
    link(nt, tc.outputs["Object"], nz.inputs["Vector"])
    rust = nt.nodes.new("ShaderNodeValToRGB")  # rust mask
    rust.color_ramp.elements[0].position = 0.6; rust.color_ramp.elements[1].position = 0.74
    link(nt, nz.outputs["Fac"], rust.inputs["Fac"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    wear = nt.nodes.new("ShaderNodeValToRGB")
    wear.color_ramp.elements[0].position = 0.53; wear.color_ramp.elements[1].position = 0.6
    link(nt, geo.outputs["Pointiness"], wear.inputs["Fac"])
    mix1 = nt.nodes.new("ShaderNodeMix"); mix1.data_type = "RGBA"
    mix1.inputs[6].default_value = (0.075, 0.072, 0.07, 1); mix1.inputs[7].default_value = (0.22, 0.09, 0.035, 1)
    link(nt, rust.outputs["Color"], mix1.inputs["Factor"])
    mix2 = nt.nodes.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    link(nt, mix1.outputs[2], mix2.inputs[6]); mix2.inputs[7].default_value = (0.42, 0.4, 0.37, 1)
    link(nt, wear.outputs["Color"], mix2.inputs["Factor"])
    link(nt, mix2.outputs[2], b.inputs["Base Color"])
    met = nt.nodes.new("ShaderNodeMath"); met.operation = "MULTIPLY_ADD"
    met.inputs[1].default_value = -0.7; met.inputs[2].default_value = 0.85
    link(nt, rust.outputs["Color"], met.inputs[0]); link(nt, met.outputs[0], b.inputs["Metallic"])
    rough = nt.nodes.new("ShaderNodeMath"); rough.operation = "MULTIPLY_ADD"
    rough.inputs[1].default_value = 0.45; rough.inputs[2].default_value = 0.42
    link(nt, rust.outputs["Color"], rough.inputs[0]); link(nt, rough.outputs[0], b.inputs["Roughness"])
    link(nt, bump.outputs["Normal"], b.inputs["Normal"])
    return m


def iris_texture(nn=512):
    y, x = (np.mgrid[0:nn, 0:nn] + 0.5) / nn * 2 - 1
    r = np.hypot(x, y); ang = np.arctan2(y, x)
    streak = 0.5 + 0.5 * np.sin(ang * 41 + np.sin(ang * 5) * 2) * np.sin(ang * 23 + 1.3)
    t = np.clip(r, 0, 1)
    inner, outer = np.array([1.0, 0.86, 0.35]), np.array([0.95, 0.52, 0.06])  # gold to amber; redder read as a target
    rgb = inner * (1 - t[..., None]) + outer * t[..., None]
    rgb = rgb * (0.7 + 0.3 * streak[..., None])
    ring = np.exp(-((r - 0.42) / 0.05) ** 2)  # a darker collarette ring, like a real iris
    rgb = rgb * (1 - 0.15 * ring[..., None])
    rim = np.clip((r - 0.84) / 0.12, 0, 1)
    rgb = rgb * (1 - 0.9 * rim[..., None])
    im = bpy.data.images.new("eye_iris", nn, nn)
    im.pixels.foreach_set(np.concatenate([rgb, np.ones((nn, nn, 1))], -1).astype(np.float32).ravel())
    im.pack()
    return im


IRON = iron_mat()
SCLERA, nt, b = nodes("eye_sclera")  # a painted resin ball: warm off-white, a little light passing through, glossy coat
b.inputs["Base Color"].default_value = (0.74, 0.69, 0.6, 1)
b.inputs["Roughness"].default_value = 0.3
b.inputs["Subsurface Weight"].default_value = 0.35
b.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.3)
b.inputs["Subsurface Scale"].default_value = rad * 0.15
b.inputs["Coat Weight"].default_value = 1.0
b.inputs["Coat Roughness"].default_value = 0.04
IRIS, nt, b = nodes("eye_iris")
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = iris_texture()
link(nt, tex.outputs["Color"], b.inputs["Base Color"]); link(nt, tex.outputs["Color"], b.inputs["Emission Color"])
b.inputs["Roughness"].default_value = 0.35
b.inputs["Emission Strength"].default_value = 3.0
PUPIL, nt, b = nodes("eye_pupil")
b.inputs["Base Color"].default_value = (0.006, 0.004, 0.003, 1); b.inputs["Roughness"].default_value = 0.2
CORNEA, nt, b = nodes("eye_cornea")  # a clear glass dome over the iris: the highlight and the depth of a real eye
b.inputs["Base Color"].default_value = (1, 1, 1, 1); b.inputs["Roughness"].default_value = 0.0
b.inputs["Transmission Weight"].default_value = 1.0; b.inputs["IOR"].default_value = 1.38

# ---------- the head ----------
R = rad * 0.84             # the eyeball: smaller than the stand-in, so the lids fit inside the claws
LID_IN, LID_OUT = rad * 0.9, rad * 0.955
IRIS_DEG, PUPIL_DEG = 40, 15
u = R / 0.17               # build_eye.py's detail sizes were drawn for a 0.17 ball


def obj(name, bm_, mat, parent=None, origin=Vector()):
    m_ = bpy.data.meshes.new(name); bm_.to_mesh(m_); bm_.free()
    m_.materials.append(mat)
    o = bpy.data.objects.new(name, m_); sc.collection.objects.link(o)
    o.parent = parent; o.location = origin
    for p in m_.polygons:
        p.use_smooth = True
    return o


def cap(radius, deg, segs=64, rings=32):
    bm_ = bmesh.new()
    bmesh.ops.create_uvsphere(bm_, u_segments=segs, v_segments=rings, radius=radius)
    bmesh.ops.rotate(bm_, matrix=Matrix.Rotation(math.radians(90), 4, "X"), verts=bm_.verts)  # pole to -y
    cut = math.cos(math.radians(deg))
    bmesh.ops.delete(bm_, geom=[v for v in bm_.verts if -v.co.y / radius < cut - 1e-6], context="VERTS")
    return bm_


def planar_uv(bm_, radius, deg):
    uvl_ = bm_.loops.layers.uv.verify(); s_ = radius * math.sin(math.radians(deg))
    for f in bm_.faces:
        for l in f.loops:
            l[uvl_].uv = (0.5 + l.vert.co.x / s_ / 2, 0.5 + l.vert.co.z / s_ / 2)


def tube(points, radii, sides=10):
    bm_ = bmesh.new(); rings = []
    for i, (p, r) in enumerate(zip(points, radii)):
        p = Vector(p)
        t = (Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        e1 = t.orthogonal().normalized(); e2 = t.cross(e1)
        rings.append([bm_.verts.new(p + (e1 * math.cos(2 * math.pi * q / sides) + e2 * math.sin(2 * math.pi * q / sides)) * r) for q in range(sides)])
    for r0, r1 in zip(rings, rings[1:]):
        for q in range(sides):
            bm_.faces.new((r0[q], r0[(q + 1) % sides], r1[(q + 1) % sides], r1[q]))
    bm_.faces.new(rings[-1][::-1]); bm_.faces.new(rings[0])
    bm_.normal_update()
    return bm_


def shell(radius, lower, thick):
    bm_ = bmesh.new()
    bmesh.ops.create_uvsphere(bm_, u_segments=64, v_segments=32, radius=radius)
    bmesh.ops.delete(bm_, geom=[v for v in bm_.verts if (v.co.z > 1e-6 if lower else v.co.z < -1e-6)], context="VERTS")
    for v in bm_.verts:  # hammered by hand, not spun: a little unevenness
        v.co *= 1 + random.uniform(-0.006, 0.006)
    bm_.normal_update()
    bmesh.ops.solidify(bm_, geom=bm_.faces[:], thickness=thick)
    return bm_


def join(name, parts, parent):
    m_ = bpy.data.meshes.new(name); big = bmesh.new()
    for bm_ in parts:
        tmp = bpy.data.meshes.new("tmp"); bm_.to_mesh(tmp); bm_.free(); big.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    big.to_mesh(m_); big.free(); m_.materials.append(IRON)
    o = bpy.data.objects.new(name, m_); sc.collection.objects.link(o); o.parent = parent
    for p in m_.polygons:
        p.use_smooth = True
    return o


head = bpy.data.objects.new("eye_head", None); sc.collection.objects.link(head)
head.location = Vector(c)
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=R)
obj("eye_ball", bm, SCLERA, head)
bm = cap(R * 1.003, IRIS_DEG); planar_uv(bm, R * 1.003, IRIS_DEG)
obj("iris", bm, IRIS, head)
bm = cap(R * 1.006, PUPIL_DEG); bmesh.ops.translate(bm, vec=(0, R * 1.006, 0), verts=bm.verts)
pupil = obj("pupil", bm, PUPIL, head, Vector((0, -R * 1.006, 0)))
bm = cap(R * 1.035, IRIS_DEG + 4)  # the cornea bulges a touch past the ball
obj("cornea", bm, CORNEA, head)


def lid(name, radius, lower):
    sgn = -1 if lower else 1
    parts = [shell(radius, lower, 0.012 * u)]
    lip = [(radius * math.cos(t), radius * math.sin(t), 0) for t in np.linspace(0, 2 * math.pi, 97)]
    parts.append(tube(lip, [0.009 * u] * len(lip), 10))
    crown = [(0, radius * 1.03 * math.cos(t), sgn * radius * 1.03 * math.sin(t)) for t in np.linspace(0, math.pi, 41)]
    parts.append(tube(crown, [0.007 * u] * len(crown), 8))
    for t in np.linspace(0, 2 * math.pi, 15)[:-1]:
        bm_ = bmesh.new(); bmesh.ops.create_uvsphere(bm_, u_segments=10, v_segments=6, radius=0.0075 * u)
        bmesh.ops.translate(bm_, vec=(radius * 1.02 * math.cos(t), radius * 1.02 * math.sin(t), sgn * 0.014 * u), verts=bm_.verts)
        parts.append(bm_)
    return join(name, parts, head)


top = lid("lid_top", LID_OUT, False)
bot = lid("lid_bot", LID_IN, True)

# eye.ts's numbers: lids from shut, the gaze tipped up toward the high camera, and how far it turns toward a piece.
LID_OPEN, LID_SLIT, GAZE_UP_DOZE, GAZE_UP_STARE, TURN_SHARE = 100, 11, 40, 22, 0.65
STATES = {
    "doze": dict(lid=LID_SLIT, pitch=GAZE_UP_DOZE, yaw=0.0, glow=1.8, pupil=1.0),
    # staring at a piece two squares to its right
    "stare": dict(lid=LID_OPEN, pitch=GAZE_UP_STARE, yaw=TURN_SHARE * math.pi / 2, glow=3.5, pupil=0.55),
}


def pose(st):
    head.rotation_euler = (-math.radians(st["pitch"]), 0, st["yaw"])
    top.rotation_euler.x = -math.radians(st["lid"])
    bot.rotation_euler.x = math.radians(st["lid"] * 0.8)
    pupil.scale = (st["pupil"],) * 3
    IRIS.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = st["glow"]


# ---------- the animation (Wesley 2026-11-24: "Looks right, bake it") ----------
# Reference pass (no clips: published eyelid timing, see docs/art/FIGURES.md): a real lid opens with a ~30 ms jump
# then settles over 200-400 ms, and closes faster than it opens; drowsy lids close slowly. Cartoon cheats: a small
# overshoot past open, the glow flaring as it snaps awake, the pupil pinching, the gaze trailing the lids.
# Per frame at 24 fps: (lid, share of the way from the slit to open; turn, share of the way to the piece; glow; pupil)
WAKE = [(0.0, 0.0, 1.8, 1.0), (0.45, 0.1, 2.6, 0.85), (0.9, 0.35, 6.0, 0.6), (1.06, 0.65, 5.0, 0.55),
        (1.02, 0.88, 4.3, 0.55), (0.99, 1.03, 3.9, 0.55), (1.0, 1.0, 3.6, 0.55), (1.0, 1.0, 3.5, 0.55)]
DOZE_N, DOZE_PERIOD = 8, 2 * math.pi / 1.1  # eye.ts: the dozing lids drift +-2.2 degrees, sin(t * 1.1)


def yaw_of(k):
    """Heading k (45 degrees each; 0 toward the camera, 2 right, as the figures) as the eye's cheated turn."""
    ang = ((45 * k + 180) % 360) - 180 or (180 if k == 4 else 0)
    return TURN_SHARE * math.radians(ang)


def wake_state(k, i):
    lid, turn, glow, pup = WAKE[i]
    return dict(lid=LID_SLIT + (LID_OPEN - LID_SLIT) * lid, yaw=turn * yaw_of(k),
                pitch=GAZE_UP_DOZE + (GAZE_UP_STARE - GAZE_UP_DOZE) * min(1.0, lid), glow=glow, pupil=pup)


# ---------- the set, the camera, the stills ----------
stage.build_stage(sc, H, center=(0, 0), board=5)
cam = stage.build_camera(sc, H, aspect=ASPECT, zoom=ZOOM5, elevation=EL, look_ahead=LA, focal=FOCAL)
cam.data.dof.use_dof = False
stage.setup_render(sc, res=a.res, samples=a.samples, aspect=ASPECT)
bpy.context.view_layer.update()

# the eye's box on screen, for the zoomed crop
pts = [ped.matrix_world @ Vector(v) for v in (P.min(0), P.max(0))]
corners = [Vector((x, y, z)) for x in (pts[0].x, pts[1].x) for y in (pts[0].y, pts[1].y) for z in (pts[0].z, pts[1].z)]
uvs = [world_to_camera_view(sc, cam, p) for p in corners]
rx, ry = sc.render.resolution_x, sc.render.resolution_y
box = (min(p.x for p in uvs), max(p.x for p in uvs), min(p.y for p in uvs), max(p.y for p in uvs))

if a.bake:
    import json, time
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import gpu_retry
    import OpenImageIO as oiio
    mine = {ped, head, *head.children_recursive}
    for o in bpy.data.objects:
        if o not in mine and o.type not in ("LIGHT", "CAMERA"):
            o.visible_camera = False  # the set still lights and shadows it
    # every point the eye can reach: the plinth, and a ball round the head wide enough for the open lids
    pts = [Vector(v) for v in P[::7]]
    for i in range(400):
        z_ = 1 - 2 * (i + 0.5) / 400; r_ = math.sqrt(1 - z_ * z_); t_ = i * 2.39996
        pts.append(Vector(c) + Vector((r_ * math.cos(t_), r_ * math.sin(t_), z_)) * LID_OUT * 1.25)
    M = cam.matrix_world; cpos = M.translation.copy()
    fwd = -(M.to_3x3() @ Vector((0, 0, 1))); right = M.to_3x3() @ Vector((1, 0, 0)); up = M.to_3x3() @ Vector((0, 1, 0))
    uv_ = [world_to_camera_view(sc, cam, p) for p in pts]
    u0, u1 = math.floor(min(q.x for q in uv_) * rx) / rx, math.ceil(max(q.x for q in uv_) * rx) / rx
    v0, v1 = math.floor(min(q.y for q in uv_) * ry) / ry, math.ceil(max(q.y for q in uv_) * ry) / ry
    r_ = sc.render
    r_.use_border = True; r_.use_crop_to_border = True
    r_.border_min_x, r_.border_max_x, r_.border_min_y, r_.border_max_y = u0, u1, v0, v1
    r_.film_transparent = True
    print("CROP", u0, u1, v0, v1, "px", round((u1 - u0) * rx), round((v1 - v0) * ry), flush=True)
    # the quad the game draws it on (as bake_king_sprites.py): parallel to the image, just in front of its nearest point
    d0 = (Vector((0, 0, 0)) - cpos).dot(fwd)
    dq = min((p - cpos).dot(fwd) for p in pts) - 0.03 * H
    tanX = 18.0 / FOCAL; tanY = tanX / ASPECT
    at_plane = lambda u_, v_: cpos + (fwd + (2 * u_ - 1) * tanX * right + (2 * v_ - 1) * tanY * up) * dq
    P0 = cpos + (Vector((0, 0, 0)) - cpos) * (dq / d0)
    cn = [at_plane(u_, v_) - P0 for u_, v_ in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
    quad = {"x0": cn[0].dot(right), "x1": cn[1].dot(right), "y0": cn[0].dot(up), "y1": cn[2].dot(up)}
    im_ = sc.render.image_settings
    im_.media_type = "MULTI_LAYER_IMAGE"; im_.file_format = "OPEN_EXR_MULTILAYER"; im_.color_depth = "32"; im_.color_mode = "RGBA"

    def srgb(x):
        x = np.clip(x, 0, 1)
        return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)

    def shoot(st, tag):
        png = os.path.join(a.out, tag + ".png")
        if os.path.exists(png):  # resumes after a Metal crash
            return
        pose(st)
        exr = os.path.join(a.out, tag + ".exr"); sc.render.filepath = exr
        t0 = time.time(); gpu_retry.render()
        img = oiio.ImageInput.open(exr); chans, j = {}, 0
        while img.seek_subimage(j, 0):
            sp_ = img.spec()
            px_ = np.asarray(img.read_image(j, 0, 0, sp_.nchannels, "float")).reshape(sp_.height, sp_.width, sp_.nchannels)
            for q, nm in enumerate(sp_.channelnames):
                chans[nm] = px_[:, :, q]
            j += 1
        img.close()
        ch = lambda s_: next(v for nm, v in chans.items() if nm.endswith(s_) and "Noisy" not in nm)
        lin = np.stack([ch("Combined.R"), ch("Combined.G"), ch("Combined.B")], -1)
        al = np.clip(ch("Combined.A"), 0, 1)[..., None]
        straight = np.where(al > 1e-4, lin / np.maximum(al, 1e-4), 0.0)
        h_, w_ = al.shape[:2]
        sp = oiio.ImageSpec(w_, h_, 4, "uint8"); sp.attribute("oiio:UnassociatedAlpha", 1)
        ob = oiio.ImageBuf(sp); ob.set_pixels(oiio.ROI(), (np.concatenate([srgb(straight), al], -1) * 255 + 0.5).astype(np.uint8)); ob.write(png)
        glow = np.clip((straight - 1.0) / a.glow_k, 0, 1) * (al > 0.02)
        gb = oiio.ImageBuf(oiio.ImageSpec(w_, h_, 3, "uint8")); gb.set_pixels(oiio.ROI(), (np.sqrt(glow) * 255 + 0.5).astype(np.uint8))
        gb.write(os.path.join(a.out, tag + "-glow.png"))
        os.remove(exr)
        print("RENDER_SECONDS %s %.1f" % (tag, time.time() - t0), flush=True)

    base = {"H": H, "S": S, "res": [rx, ry], "crop": [u0, v0, u1, v1], "right": list(right), "up": list(up),
            "fwd": list(fwd), "camera": list(cpos), "d0": d0, "dq": dq, "anchor": list(P0), "quad": quad,
            "exposure": 0.0, "glowK": a.glow_k, "headings": 8, "samples": a.samples}
    for k in range(8):  # awake, staring along heading k (the odd headings are the in-betweens of a turn)
        shoot(wake_state(k, len(WAKE) - 1), "eye%d" % k)
    json.dump(base, open(os.path.join(a.out, "eye.json"), "w"), indent=1)
    for k in (0, 2, 4, 6):  # it only sees along its row and column
        for i in range(len(WAKE)):
            shoot(wake_state(k, i), "wake%d_%02d" % (k, i))
    json.dump({**base, "frames": len(WAKE), "fps": 24}, open(os.path.join(a.out, "wake.json"), "w"), indent=1)
    for i in range(DOZE_N):
        st = dict(STATES["doze"]); st["lid"] = LID_SLIT + 2.2 * math.sin(2 * math.pi * i / DOZE_N)
        shoot(st, "doze0_%02d" % i)
    json.dump({**base, "frames": DOZE_N, "fps": DOZE_N / DOZE_PERIOD}, open(os.path.join(a.out, "doze.json"), "w"), indent=1)
    print("EYE BAKE OK", flush=True)
    sys.exit(0)

if a.zoom:  # render only round the eye (the bake's full size, without paying for the whole board)
    cx_, cy_ = (box[0] + box[1]) / 2, (box[2] + box[3]) / 2
    hw = (box[1] - box[0]) * a.zoom / 2
    hh = hw * rx / ry * 0.75
    r_ = sc.render
    r_.use_border = True; r_.use_crop_to_border = True
    r_.border_min_x, r_.border_max_x = max(0, cx_ - hw), min(1, cx_ + hw)
    r_.border_min_y, r_.border_max_y = max(0, cy_ - hh), min(1, cy_ + hh)
for name in a.states.split(","):
    pose(STATES[name])
    sc.render.filepath = os.path.join(a.out, f"eye-{name}.png")
    bpy.ops.render.render(write_still=True)
    print("CHECK rendered", sc.render.filepath, flush=True)
with open(os.path.join(a.out, "box.txt"), "w") as f:
    f.write("%f %f %f %f\n" % box)
print("EYE STILLS OK", box, flush=True)
