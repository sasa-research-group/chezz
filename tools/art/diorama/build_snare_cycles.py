# The snare square, for Cycles (Wesley 2026-11-26, look "C, thorn roots" from snare/snare-abc.jpg): a ring of dark
# gnarled thorny roots pushing up through cracks round the square's edge, curled inward like waiting fingers, a faint
# green glow in the cracks they broke. Sprung (a piece stopped on it never moves again, docs/puzzles.md) they rise and
# wind round the piece's ankles. Shapes from snare_geom.py; set and camera as build_trapdoor_cycles.py.
#
#   Blender -b --python build_snare_cycles.py -- --out DIR [--res 1600 --samples 128 --states set,sprung
#       --square 3,1 --zoom 0]
# writes DIR/snare-{state}.png (states: set, sprung, a grip like 0.5, or g<k> = frame k of the spring).
import bpy, bmesh, sys, os, math, argparse, random
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stage
import snare_geom as sg

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--states", default="set,sprung")
ap.add_argument("--square", default="3,1")
ap.add_argument("--nx", type=int, default=5)
ap.add_argument("--ny", type=int, default=5)
ap.add_argument("--stop", default="")
ap.add_argument("--zoom", type=float, default=0.0)
ap.add_argument("--n", type=int, default=12)          # roots in the ring
ap.add_argument("--glow", type=float, default=0.5)   # the crack cores' green emission strength (low: light, not paint)
ap.add_argument("--glow_light", type=float, default=0.0)  # a green light in the middle (W): off, it read as a painted spot
ap.add_argument("--foot_light", type=float, default=0.5)  # a green light low at each root's foot (W): glow seeping out of the broken stone
ap.add_argument("--bark", default="0.0042,0.0026,0.0028")  # the roots' dark bark colour
ap.add_argument("--lump", type=float, default=0.3)  # gnarl: radius wobble along the root
ap.add_argument("--cores", type=int, default=0)  # glowing lines down the cracks (off: they read as painted neon)
ap.add_argument("--frames", type=int, default=20)    # the spring's frames, for g<k>
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)

H = 1.7
S = 1.2 * H
from level_camera import EL, FOCAL, ZOOM5, LA, ASPECT, stop_camera
NX, NY = a.nx, a.ny

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
objs = stage.build_stage(sc, H, center=(0, 0), board=NX if NX == NY else (NX, NY))
cam, _ = stop_camera(sc, H, NX, NY, tuple(float(v) for v in a.stop.split(",")) if a.stop else None)
cam.data.dof.use_dof = False
stage.setup_render(sc, res=a.res, samples=a.samples, aspect=ASPECT)
bpy.context.view_layer.update()

i, j = (int(v) for v in a.square.split(","))
cx, cy = (i - (NX - 1) / 2) * S, (j - (NY - 1) / 2) * S
slab = next(s_ for s_ in objs["slabs"] if s_.name == "Slab_%d_%d" % (i, j))
wv = [slab.matrix_world @ v.co for v in slab.data.vertices]
near = sorted(p_.z for p_ in wv if abs(p_.x - cx) < 0.3 * S and abs(p_.y - cy) < 0.3 * S)
top = near[int(len(near) * 0.9)]
print("CHECK square %d,%d centre %.3f %.3f top %.4f" % (i, j, cx, cy, top), flush=True)
coll = bpy.data.collections.new("Snare"); sc.collection.children.link(coll)


def nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    return m, nt, nt.nodes["Principled BSDF"]


def bark_mat():
    """Old root bark: near-black brown, deep lengthwise furrows (stretched voronoi), knots, lighter dry ridges where the
    bark is worn, a damp sheen; a mossy green-grey near the stone it broke out of."""
    m, nt, b = nodes("snare_bark")
    L_ = nt.links.new
    base = tuple(float(v) for v in a.bark.split(","))
    tc = nt.nodes.new("ShaderNodeTexCoord")
    # furrows run along the root: the root's own UV would be best, but object space stretched along z reads close
    # enough on these short curls
    # furrows run along the root: the "bark" attribute (bark_coords) is (cos, sin) round the root and arc length along
    # it, so stretched cells there become long thin plates and cracks, with no seam round the back
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_type = "GEOMETRY"; at.attribute_name = "bark"
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (3.2, 3.2, 3.0 / S)  # many narrow grooves round, long along (judge r2: big cells read as scales)
    L_(at.outputs["Vector"], mp.inputs["Vector"])
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.feature = "DISTANCE_TO_EDGE"; vor.inputs["Scale"].default_value = 1.0
    vor.inputs["Randomness"].default_value = 0.9
    L_(mp.outputs["Vector"], vor.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 30 / S; nz.inputs["Detail"].default_value = 8
    L_(tc.outputs["Object"], nz.inputs["Vector"])
    fur = nt.nodes.new("ShaderNodeValToRGB")
    fur.color_ramp.elements[0].position = 0.0; fur.color_ramp.elements[1].position = 0.08
    L_(vor.outputs["Distance"], fur.inputs["Fac"])
    h = nt.nodes.new("ShaderNodeMath"); h.operation = "MULTIPLY_ADD"; h.inputs[2].default_value = 0.0
    L_(fur.outputs["Color"], h.inputs[0]); h.inputs[1].default_value = 0.5
    h2 = nt.nodes.new("ShaderNodeMath"); h2.operation = "MULTIPLY_ADD"; h2.inputs[1].default_value = 0.35
    L_(nz.outputs["Fac"], h2.inputs[0]); L_(h.outputs[0], h2.inputs[2])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.9; bump.inputs["Distance"].default_value = 0.01 * S
    L_(h2.outputs[0], bump.inputs["Height"])
    # colour: furrow bottoms darkest, ridges a dry grey-brown
    col = nt.nodes.new("ShaderNodeMix"); col.data_type = "RGBA"
    col.inputs[6].default_value = (base[0] * 0.45, base[1] * 0.45, base[2] * 0.45, 1)
    col.inputs[7].default_value = (base[0] * 2.2, base[1] * 2.1, base[2] * 2.0, 1)  # dry-brushed ridges, subtle
    L_(h2.outputs[0], col.inputs["Factor"])
    # moss near the stone: world height above the floor
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); L_(geo.outputs["Position"], sep.inputs[0])
    hz = nt.nodes.new("ShaderNodeMapRange")
    hz.inputs["From Min"].default_value = top - 0.01 * S; hz.inputs["From Max"].default_value = top + 0.015 * S  # only a hint of moss at the stone
    L_(sep.outputs["Z"], hz.inputs["Value"])
    mz = nt.nodes.new("ShaderNodeMath"); mz.operation = "SUBTRACT"; mz.inputs[0].default_value = 1.0
    L_(hz.outputs["Result"], mz.inputs[1])
    mzn = nt.nodes.new("ShaderNodeMath"); mzn.operation = "MULTIPLY"
    L_(mz.outputs[0], mzn.inputs[0]); L_(nz.outputs["Fac"], mzn.inputs[1])
    moss = nt.nodes.new("ShaderNodeMix"); moss.data_type = "RGBA"
    L_(col.outputs[2], moss.inputs[6]); moss.inputs[7].default_value = (0.05, 0.07, 0.02, 1)
    L_(mzn.outputs[0], moss.inputs["Factor"])
    # dry-brush: the raised edges (pointiness) catch a lighter grey-brown, as a painter's dry brush would
    pt = nt.nodes.new("ShaderNodeNewGeometry")
    pr = nt.nodes.new("ShaderNodeValToRGB")
    pr.color_ramp.elements[0].position = 0.53; pr.color_ramp.elements[1].position = 0.6
    L_(pt.outputs["Pointiness"], pr.inputs["Fac"])
    dry = nt.nodes.new("ShaderNodeMix"); dry.data_type = "RGBA"
    L_(moss.outputs[2], dry.inputs[6]); dry.inputs[7].default_value = (base[0] * 3, base[1] * 3, base[2] * 2.9, 1)
    L_(pr.outputs["Color"], dry.inputs["Factor"])
    L_(dry.outputs[2], b.inputs["Base Color"])
    rough = nt.nodes.new("ShaderNodeMath"); rough.operation = "MULTIPLY_ADD"
    rough.inputs[1].default_value = 0.25; rough.inputs[2].default_value = 0.6  # painted clay, a soft satin (judges flip between gloss and matte)
    L_(fur.outputs["Color"], rough.inputs[0]); L_(rough.outputs[0], b.inputs["Roughness"])
    L_(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def glow_mat():
    m, nt, b = nodes("snare_glow")
    b.inputs["Base Color"].default_value = (0.01, 0.02, 0.01, 1)
    b.inputs["Emission Color"].default_value = (0.3, 0.9, 0.25, 1)
    b.inputs["Emission Strength"].default_value = a.glow
    return m


BARK = bark_mat()
GLOW = glow_mat()
_moss = sc.objects.get("Moss")
MOSS = _moss.active_material if _moss is not None else None
built = []


def clear():
    for o in built:
        bpy.data.objects.remove(o, do_unlink=True)
    built.clear()


def bark_coords(o, pts, segs, seed):
    """stage._limb lays a tube out ring by ring (segs verts each, then two caps): give each vertex its place round the
    root and along it, for the bark's lengthwise furrows. Each root starts its arc length at its own offset."""
    arc, s_ = [], seed * 1.37
    for n_, p in enumerate(pts):
        if n_:
            s_ += (p - pts[n_ - 1]).length
        arc.append(s_)
    att = o.data.attributes.new("bark", "FLOAT_VECTOR", "POINT")
    for v in o.data.vertices:
        ring, k_ = divmod(v.index, segs)
        th = 2 * math.pi * k_ / segs
        att.data[v.index].vector = (math.cos(th), math.sin(th), arc[min(ring, len(arc) - 1)])


def build(t):
    """The ring at grip t."""
    clear()
    off = Vector((cx, cy, top))
    for k, r in enumerate(sg.roots(S, t, n=a.n)):
        pts = [Vector(p) + off for p in r["pts"]]
        o = stage._limb("snare_root_%d" % k, pts, r["radii"], 12, BARK, coll, lump=a.lump, seed=k * 3.1)
        bark_coords(o, pts, 12, k)
        sub = o.modifiers.new("sub", "SUBSURF"); sub.levels = sub.render_levels = 1
        built.append(o)
        for q, sh in enumerate(r["shoots"]):
            so = stage._limb("snare_shoot_%d_%d" % (k, q), [Vector(p) + off for p in sh["pts"]], sh["radii"], 10, BARK,
                             coll, lump=a.lump, seed=k * 3.1 + q + 0.5)
            bark_coords(so, [Vector(p) + off for p in sh["pts"]], 10, k + 0.5 * q + 0.3)
            ss = so.modifiers.new("sub", "SUBSURF"); ss.levels = ss.render_levels = 1
            built.append(so)
        bm = bmesh.new()
        for th in r["thorns"]:
            g = bmesh.new()
            bmesh.ops.create_cone(g, cap_ends=True, segments=6, radius1=th["r"], radius2=th["r"] * 0.22, depth=th["len"])  # blunt, sculpted tip
            d = Vector(th["dir"])
            rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix()
            bmesh.ops.rotate(g, verts=g.verts, cent=(0, 0, 0), matrix=rot)
            bmesh.ops.translate(g, vec=Vector(th["at"]) + off + d * th["len"] * 0.45, verts=g.verts)
            me_ = bpy.data.meshes.new("tmp"); g.to_mesh(me_); g.free(); bm.from_mesh(me_); bpy.data.meshes.remove(me_)
        built.append(stage._mesh_obj("snare_thorns_%d" % k, bm, BARK, coll, smooth=False))


# ---------- the fissures the roots broke (dark, a thin green glow down each), moss round each root's foot (these stay) ----------
FISSURE = bpy.data.materials.new("snare_fissure"); FISSURE.use_nodes = True
_fb = FISSURE.node_tree.nodes["Principled BSDF"]
_fb.inputs["Base Color"].default_value = tuple(float(v) for v in os.environ.get("FISSURE_RGB", "0.004,0.004,0.004").split(",")) + (1,); _fb.inputs["Roughness"].default_value = 0.9


_dg = None


def ground(x, y):
    """The stone's real top at (x, y) (square-local): the sculpted tile is bumpy, so a flat decal at one height sinks
    under it in places."""
    global _dg
    if _dg is None:
        bpy.context.view_layer.update(); _dg = bpy.context.evaluated_depsgraph_get()
    o_ = Vector((cx + x, cy + y, top + 0.3 * S))
    for _ in range(6):  # step through anything unseen (the haze box) to the first surface the camera sees
        ok_, loc_, _n, _i, ob_, _m = sc.ray_cast(_dg, o_, Vector((0, 0, -1)))
        if not ok_:
            return top
        if ob_.visible_camera and not ob_.name.startswith("Haze"):
            if len(_seen) < 4:
                _seen.append("%s@%.4f" % (ob_.name, (loc_.z - top) / S)); print("CHECK crack ground", _seen[-1], flush=True)
            return loc_.z
        o_ = loc_ + Vector((0, 0, -0.0005 * S))
    return top


_seen = []


def strip(bm, pts, ws, k, z):
    """A flat jagged band along pts, ws[i] * k wide, laid z above the stone's own surface."""
    for (p, q), (w0, w1) in zip(zip(pts, pts[1:]), zip(ws, ws[1:])):
        dx, dy = q[0] - p[0], q[1] - p[1]
        m = math.hypot(dx, dy) or 1.0
        nx_, ny_ = -dy / m, dx / m
        a0, a1 = w0 * k / 2, max(w1 * k / 2, 0.0004 * S)
        cs = [(p[0] + nx_ * a0, p[1] + ny_ * a0), (p[0] - nx_ * a0, p[1] - ny_ * a0),
              (q[0] - nx_ * a1, q[1] - ny_ * a1), (q[0] + nx_ * a1, q[1] + ny_ * a1)]
        bm.faces.new([bm.verts.new((cx + x, cy + y, ground(x, y) + z)) for x, y in cs])


fis, core = bmesh.new(), bmesh.new()
for c in sg.cracks(S):
    strip(fis, c["pts"], c["w"], 0.35, 0.003 * S)  # thin dark lines: wide bands read as stickers
    if a.cores:
        strip(core, c["pts"], c["w"], 0.1, 0.0034 * S)
stage._mesh_obj("snare_fissures", fis, FISSURE, coll, smooth=False)
if a.cores:
    stage._mesh_obj("snare_cracks", core, GLOW, coll, smooth=False)
for k, r in enumerate(sg.rim(S)):  # the tangle round the edge, also unchanged by the spring
    pts = [Vector(p) + Vector((cx, cy, top)) for p in r["pts"]]
    o = stage._limb("snare_rim_%d" % k, pts, r["radii"], 12, BARK, coll, lump=a.lump * 1.4, seed=40 + k)
    bark_coords(o, pts, 12, 40 + k)
    sub = o.modifiers.new("sub", "SUBSURF"); sub.levels = sub.render_levels = 1
rng = random.Random(7)
if MOSS is not None:
    for k, r in enumerate(sg.roots(S, 0.0, n=a.n)):
        x0, y0, _ = r["pts"][0]
        bm = bmesh.new()
        mr = 0.05 * S
        for q in range(30):
            rr = mr * math.sqrt(rng.random()); tt = rng.random() * 2 * math.pi
            g = bmesh.new()
            bmesh.ops.create_icosphere(g, subdivisions=1, radius=mr * rng.uniform(0.12, 0.25))
            bmesh.ops.scale(g, vec=(1, 1, rng.uniform(0.8, 1.6) * (1.2 - rr / mr)), verts=g.verts)
            bmesh.ops.translate(g, vec=(cx + x0 + rr * math.cos(tt), cy + y0 + rr * math.sin(tt), top + 0.002 * S), verts=g.verts)
            me_ = bpy.data.meshes.new("tmp"); g.to_mesh(me_); g.free(); bm.from_mesh(me_); bpy.data.meshes.remove(me_)
        stage._mesh_obj("snare_tuft_%d" % k, bm, MOSS, coll)
gl = bpy.data.lights.new("snare_glow", "POINT"); gl.energy = a.glow_light; gl.color = (0.4, 1.0, 0.35)
gl.shadow_soft_size = 0.1 * S
glo = bpy.data.objects.new("snare_glow", gl); coll.objects.link(glo)
glo.location = (cx, cy, top + 0.05 * S)
glo.visible_camera = False
if a.glow_light <= 0:
    glo.hide_render = True
# green seeping out of the broken stone at each root's foot, and the stone shards the root heaved up round it
STONE = slab.active_material
srng = random.Random(11)
for k, r in enumerate(sg.roots(S, 0.0, n=a.n)):
    x0, y0, _ = r["pts"][0]
    fl = bpy.data.lights.new("snare_foot_%d" % k, "POINT"); fl.energy = a.foot_light; fl.color = (0.35, 1.0, 0.3)
    fl.shadow_soft_size = 0.06 * S  # a soft pool, not a spot
    fo = bpy.data.objects.new("snare_foot_%d" % k, fl); coll.objects.link(fo)
    ang = math.atan2(y0, x0)
    fo.location = (cx + x0 - 0.13 * S * math.cos(ang), cy + y0 - 0.13 * S * math.sin(ang), top + 0.025 * S)  # on the stone inside the ring, clear of the root (r0 up to 0.08 S)
    fo.visible_camera = False
    if STONE is None:
        continue
    bm = bmesh.new()
    for q in range(srng.randint(2, 3)):
        tt = ang + srng.uniform(-1.6, 1.6)
        d_ = r["radii"][0] * srng.uniform(1.1, 1.6)
        sx, sy = x0 + d_ * math.cos(tt), y0 + d_ * math.sin(tt)
        if max(abs(sx), abs(sy)) > (sg.RING_LEFT - 0.03) * S:
            continue
        g = bmesh.new()
        bmesh.ops.create_icosphere(g, subdivisions=1, radius=0.5)  # a chunk of rubble, no two alike
        w_ = 0.05 * S * srng.uniform(0.7, 1.2)
        for v in g.verts:
            v.co *= srng.uniform(0.75, 1.25)
        bmesh.ops.scale(g, vec=(w_, w_ * srng.uniform(0.6, 1.0), 0.018 * S), verts=g.verts)
        tilt = Matrix.Rotation(srng.uniform(0.25, 0.55), 3, Vector((-math.sin(tt), math.cos(tt), 0)))
        bmesh.ops.rotate(g, verts=g.verts, cent=(0, 0, 0), matrix=tilt @ Matrix.Rotation(tt + srng.uniform(-0.4, 0.4), 3, "Z"))
        bmesh.ops.translate(g, vec=(cx + sx, cy + sy, ground(sx, sy) + 0.002 * S), verts=g.verts)
        me_ = bpy.data.meshes.new("tmp"); g.to_mesh(me_); g.free(); bm.from_mesh(me_); bpy.data.meshes.remove(me_)
    stage._mesh_obj("snare_shards_%d" % k, bm, STONE, coll, smooth=False)


def grip(name):
    if name == "set": return 0.0
    if name == "sprung": return 1.0
    if name.startswith("g"): return sg.grip(int(name[1:]), a.frames)
    return float(name)


corners = [Vector((cx + x, cy + y, top + z)) for x in (-S / 2, S / 2) for y in (-S / 2, S / 2) for z in (0, 0.3 * S)]
uvs = [world_to_camera_view(sc, cam, p) for p in corners]
rx, ry = sc.render.resolution_x, sc.render.resolution_y
box = (min(p.x for p in uvs), max(p.x for p in uvs), min(p.y for p in uvs), max(p.y for p in uvs))
if a.zoom:
    cx_, cy_ = (box[0] + box[1]) / 2, (box[2] + box[3]) / 2
    hwz = (box[1] - box[0]) * a.zoom / 2
    hh = hwz * rx / ry * 0.75
    r_ = sc.render
    r_.use_border = True; r_.use_crop_to_border = True
    r_.border_min_x, r_.border_max_x = max(0, cx_ - hwz), min(1, cx_ + hwz)
    r_.border_min_y, r_.border_max_y = max(0, cy_ - hh), min(1, cy_ + hh)
for name in a.states.split(","):
    build(grip(name))
    sc.render.filepath = os.path.join(a.out, "snare-%s.png" % name)
    bpy.ops.render.render(write_still=True)
    print("CHECK rendered", sc.render.filepath, flush=True)
with open(os.path.join(a.out, "box.txt"), "w") as f:
    f.write("%f %f %f %f\n" % box)
print("SNARE STILLS OK", box, flush=True)
