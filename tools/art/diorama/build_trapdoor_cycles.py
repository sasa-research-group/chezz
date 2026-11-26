# The trapdoor square, for Cycles (Wesley 2026-11-25, look "A, oak planks" from trap/trap-abc.jpg): a little door of
# weathered oak planks bound with rusty iron straps, a ring pull at the front, set flush in the square's own stone.
# It drops open for good once a piece standing on it moves off (docs/puzzles.md), and swings DOWN into the pit on
# hinges at its back edge (his call: opening upward, the door would cut through the figure falling in). Hanging
# against the pit's back wall it leaves the whole opening clear.
#
# Built from the set's own slab, as the sludge: the sculpted tile on that square gets a square hole cut through it, so
# the stone round the door is the same stone as every other square. Below it a stone-walled pit, dark at the bottom
# with a faint cool glow so the open square reads as a drop, not a black decal. Pre-rendered like the figures.
#
#   Blender -b --python build_trapdoor_cycles.py -- --out DIR [--res 1600 --samples 128 --states shut,fallen
#       --square 3,1 --zoom 0]
# writes DIR/trap-{state}.png (the whole board, or with --zoom N only a box N door-widths wide round it).
import bpy, bmesh, sys, os, math, argparse, random
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import stage
import trapdoor_geom as tg

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--states", default="shut,fallen")
ap.add_argument("--square", default="3,1")   # board square (0..4 from the left, 0..4 from the front)
ap.add_argument("--zoom", type=float, default=0.0)
ap.add_argument("--open", type=float, default=0.80)  # the opening's width, share of a square
ap.add_argument("--wood", default="1.85,2.9,5.6")  # WOOD_TINT for the door
ap.add_argument("--dim", type=float, default=0.3)  # share of the set's light the pit gets
ap.add_argument("--depth", type=float, default=1.6)  # the pit's depth, share of a square (past the hanging door)
ap.add_argument("--glow", type=float, default=6.0)   # the faint cool light at the pit's bottom (W)
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)
random.seed(11)

H = 1.7          # figure height (the set's unit)
S = 1.2 * H      # one square
EL, FOCAL, ZOOM5, LA, ASPECT = 35.0, 50.0, 0.255, 0.21, 4.0 / 3.0  # the game camera, as bake_king_sprites.py
N = 5

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
objs = stage.build_stage(sc, H, center=(0, 0), board=N)
cam = stage.build_camera(sc, H, aspect=ASPECT, zoom=ZOOM5, elevation=EL, look_ahead=LA, focal=FOCAL)
cam.data.dof.use_dof = False
stage.setup_render(sc, res=a.res, samples=a.samples, aspect=ASPECT)
bpy.context.view_layer.update()

i, j = (int(v) for v in a.square.split(","))
cx, cy = (i - (N - 1) / 2) * S, (j - (N - 1) / 2) * S
hw = a.open * S / 2
slab = next(s_ for s_ in objs["slabs"] if s_.name == "Slab_%d_%d" % (i, j))
slab.data = slab.data.copy()
wv = [slab.matrix_world @ v.co for v in slab.data.vertices]
near = sorted(p_.z for p_ in wv if abs(p_.x - cx) < 0.3 * S and abs(p_.y - cy) < 0.3 * S)
top = near[int(len(near) * 0.9)]
print("CHECK square %d,%d centre %.3f %.3f top %.4f" % (i, j, cx, cy, top), flush=True)



def nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    return m, nt, nt.nodes["Principled BSDF"]


def iron_mat(u):
    """Hand-forged iron as the eye's lids: dark, hammer-dented, rust blooming in patches, worn bright on the edges.
    u: the size of a dent's patch."""
    m, nt, b = nodes("trap_iron")
    L_ = nt.links.new
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 9 / u
    L_(tc.outputs["Object"], vor.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = u * 0.02
    L_(vor.outputs["Distance"], bump.inputs["Height"])
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.2 / u; nz.inputs["Detail"].default_value = 6
    L_(tc.outputs["Object"], nz.inputs["Vector"])
    rust = nt.nodes.new("ShaderNodeValToRGB")
    rust.color_ramp.elements[0].position = 0.48; rust.color_ramp.elements[1].position = 0.66
    L_(nz.outputs["Fac"], rust.inputs["Fac"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    wear = nt.nodes.new("ShaderNodeValToRGB")
    wear.color_ramp.elements[0].position = 0.8; wear.color_ramp.elements[1].position = 0.9
    L_(geo.outputs["Pointiness"], wear.inputs["Fac"])
    mix1 = nt.nodes.new("ShaderNodeMix"); mix1.data_type = "RGBA"
    mix1.inputs[6].default_value = (0.075, 0.072, 0.07, 1); mix1.inputs[7].default_value = (0.07, 0.03, 0.015, 1)
    L_(rust.outputs["Color"], mix1.inputs["Factor"])
    mix2 = nt.nodes.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    L_(mix1.outputs[2], mix2.inputs[6]); mix2.inputs[7].default_value = (0.2, 0.17, 0.14, 1)
    L_(wear.outputs["Color"], mix2.inputs["Factor"])
    L_(mix2.outputs[2], b.inputs["Base Color"])
    met = nt.nodes.new("ShaderNodeMath"); met.operation = "MULTIPLY_ADD"
    met.inputs[1].default_value = -0.5; met.inputs[2].default_value = 0.6
    L_(rust.outputs["Color"], met.inputs[0]); L_(met.outputs[0], b.inputs["Metallic"])
    rough = nt.nodes.new("ShaderNodeMath"); rough.operation = "MULTIPLY_ADD"
    rough.inputs[1].default_value = 0.15; rough.inputs[2].default_value = 0.78
    L_(rust.outputs["Color"], rough.inputs[0]); L_(rough.outputs[0], b.inputs["Roughness"])
    L_(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def dark_mat(name="trap_pit_floor", col=(0.012, 0.012, 0.014), rough=0.6):
    """The pit's bottom (damp black earth, a little sheen) or its walls (sooty stone, the courses' steps catch the light)."""
    m, nt, b = nodes(name)
    b.inputs["Base Color"].default_value = col + (1,); b.inputs["Roughness"].default_value = rough
    return m


def box(x, y, z, sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(x, y, z), verts=bm.verts)
    return bm


def pit(x, y, hw, top, depth, rough, seed):
    """The pit's four walls, facing in, from just above the slab's underside down to the floor: rough stone courses
    (each course stepped in or out a little) so the walls catch the light unevenly."""
    rng = random.Random(seed)
    bm = bmesh.new()
    courses = 7
    for c in range(courses):
        z1 = top - 0.01 * S - depth * c / courses; z0 = top - depth * (c + 1) / courses
        for side in range(4):
            for k in range(3):  # three blocks a course a side
                o = rng.uniform(-1, 1) * rough
                a0 = -hw + 2 * hw * k / 3; a1 = -hw + 2 * hw * (k + 1) / 3
                t_ = 0.12 * S
                if side == 0:   bmb = box(x + (a0 + a1) / 2, y + hw + t_ / 2 + o, (z0 + z1) / 2, a1 - a0, t_, z1 - z0)
                elif side == 1: bmb = box(x + (a0 + a1) / 2, y - hw - t_ / 2 - o, (z0 + z1) / 2, a1 - a0, t_, z1 - z0)
                elif side == 2: bmb = box(x + hw + t_ / 2 + o, y + (a0 + a1) / 2, (z0 + z1) / 2, t_, a1 - a0, z1 - z0)
                else:           bmb = box(x - hw - t_ / 2 - o, y + (a0 + a1) / 2, (z0 + z1) / 2, t_, a1 - a0, z1 - z0)
                me_ = bpy.data.meshes.new("tmp"); bmb.to_mesh(me_); bmb.free(); bm.from_mesh(me_); bpy.data.meshes.remove(me_)
    return bm


def shape(p):
    """One ironwork piece from trapdoor_geom.ironwork as a bmesh, in the door's frame."""
    bm = bmesh.new()
    if p["kind"] == "box":
        return box(*p["at"], *p["size"])
    if p["kind"] == "dome":
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=6, radius=p["r"])
        bmesh.ops.scale(bm, vec=(1, 1, 0.42), verts=bm.verts)
    elif p["kind"] == "cyl":
        bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=p["r"], radius2=p["r"], depth=p["len"])
        if p["axis"] == "x":
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "Y"))
    elif p["kind"] == "torus":
        R, r = p["R"], p["r"]
        vs = []
        for u_ in range(24):
            row = []
            for v_ in range(8):
                tu, tv = 2 * math.pi * u_ / 24, 2 * math.pi * v_ / 8
                row.append(bm.verts.new(((R + r * math.cos(tv)) * math.cos(tu), (R + r * math.cos(tv)) * math.sin(tu), r * math.sin(tv))))
            vs.append(row)
        for u_ in range(24):
            for v_ in range(8):
                bm.faces.new((vs[u_][v_], vs[(u_ + 1) % 24][v_], vs[(u_ + 1) % 24][(v_ + 1) % 8], vs[u_][(v_ + 1) % 8]))
        bmesh.ops.scale(bm, vec=(1.08, 0.94, 1), verts=bm.verts)  # hand-bent, not a perfect circle
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(p["tilt"]), 3, "X"))
    bmesh.ops.translate(bm, vec=p["at"], verts=bm.verts)
    return bm


def warp(o, amp, seed):
    """Hand-made unevenness: cut the box finer, then push it about with a soft noise, so no edge is ruler-straight."""
    sub = o.modifiers.new("sub", "SUBSURF"); sub.subdivision_type = "SIMPLE"; sub.levels = sub.render_levels = 3
    tex = bpy.data.textures.new("warp_%d" % seed, "CLOUDS"); tex.noise_scale = 0.35 * S; tex.noise_depth = 1
    d = o.modifiers.new("warp", "DISPLACE"); d.texture = tex; d.strength = amp; d.mid_level = 0.5
    d.texture_coords = "GLOBAL"
    # offset each piece's noise so two boards never warp alike
    e = bpy.data.objects.new("warp_at_%d" % seed, None); sc.collection.objects.link(e)
    e.location = (seed * 1.7, seed * 0.9, 0); d.texture_coords = "OBJECT"; d.texture_coords_object = e


STONE = stage._stone_mat()
_tint = os.environ.get("WOOD_TINT")
os.environ["WOOD_TINT"] = a.wood  # the set's oak, lifted to the door's weathered grey-brown (draft A)
WOOD = stage._wood_mat()
_bsdf = WOOD.node_tree.nodes["Principled BSDF"]
_lk = _bsdf.inputs["Base Color"].links[0]
_hs = WOOD.node_tree.nodes.new("ShaderNodeHueSaturation")
_hs.inputs["Saturation"].default_value = 0.65; _hs.inputs["Value"].default_value = 1.15
WOOD.node_tree.links.new(_lk.from_socket, _hs.inputs["Color"]); WOOD.node_tree.links.new(_hs.outputs["Color"], _bsdf.inputs["Base Color"])
for n_ in WOOD.node_tree.nodes:  # deeper, rougher grain than the set's polished frame
    if n_.type == "BUMP": n_.inputs["Strength"].default_value = 1.0
    if n_.type == "NORMAL_MAP": n_.inputs["Strength"].default_value = 3.0
if _tint is None: del os.environ["WOOD_TINT"]
else: os.environ["WOOD_TINT"] = _tint
IRON = iron_mat(0.1 * S)
PIT_FLOOR = dark_mat()
PIT_WALL = dark_mat("trap_pit_wall", (0.016, 0.014, 0.013), 0.85)


def link_obj(name, bm, mat, parent=None, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    if parent is not None:
        o.parent = parent
    return o


# ---------- the hole through the slab, the pit below ----------
cut_bm = box(cx, cy, top - a.depth * S / 2, 2 * hw, 2 * hw, a.depth * S + 0.6 * H)
cut = link_obj("trap_cut", cut_bm, STONE)
cut.hide_render = True; cut.hide_viewport = True
mod = slab.modifiers.new("trap", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cut
mod.solver = "EXACT"; mod.use_hole_tolerant = True; mod.material_mode = "TRANSFER"
# the set's ground plate, the shadow box's base and the haze box sit just under the slabs: without the same hole
# the pit would be 0.08 of a square deep (found by the ray probe below)
for nm in ("Ground", "FrameBase", "HazeVolume"):
    ob = sc.objects.get(nm)
    if ob is None or ob.type != "MESH":
        print("CHECK no %s to cut" % nm, flush=True); continue
    ob.data = ob.data.copy()
    m_ = ob.modifiers.new("trap", "BOOLEAN"); m_.operation = "DIFFERENCE"; m_.object = cut
    m_.solver = "EXACT"; m_.use_hole_tolerant = True
chip = slab.modifiers.new("trap_chip", "BEVEL"); chip.width = 0.018 * S; chip.segments = 2; chip.limit_method = "ANGLE"
# the moss in the joints would poke up through the door
for mo in [o for o in sc.objects if o.type == "MESH" and o.name in ("Moss", "GroutMoss")]:
    bm = bmesh.new(); bm.from_mesh(mo.data); mw = mo.matrix_world
    kill = [v for v in bm.verts if tg.inside((mw @ v.co).x - cx, (mw @ v.co).y - cy, hw + 0.01 * S)]
    if kill:
        bmesh.ops.delete(bm, geom=kill, context="VERTS"); bm.to_mesh(mo.data)
    bm.free()
    print("CHECK moss %s cut %d verts" % (mo.name, len(kill)), flush=True)
link_obj("trap_pit", pit(cx, cy, hw, top, a.depth * S, rough=0.03 * S, seed=3), PIT_WALL)
link_obj("trap_pit_floor", box(cx, cy, top - a.depth * S - 0.01 * S, 2 * hw, 2 * hw, 0.02 * S), PIT_FLOOR)
bpy.context.view_layer.update()
_dg = bpy.context.evaluated_depsgraph_get()
for _dx, _dy in ((0, 0), (0.6, 0.6), (-0.6, -0.6)):
    _o = Vector((cx + _dx * hw, cy + _dy * hw, top + 0.5 * S))
    _hits = []
    while len(_hits) < 4:
        ok_, loc_, _n, _i, ob_, _m = sc.ray_cast(_dg, _o, Vector((0, 0, -1)))
        if not ok_: break
        _hits.append("%s@%.2fS" % (ob_.name, (loc_.z - top) / S)); _o = loc_ + Vector((0, 0, -0.002 * S))
    print("CHECK below the hole at (%.1f,%.1f): %s" % (_dx, _dy, ", ".join(_hits) or "nothing"))
glow = bpy.data.lights.new("trap_glow", "AREA"); glow.size = 1.6 * hw; glow.energy = a.glow
glow.color = (0.55, 0.75, 1.0)
gl = bpy.data.objects.new("trap_glow", glow); sc.collection.objects.link(gl)
gl.location = (cx, cy, top - a.depth * S + 0.03 * S)
gl.rotation_euler = (math.pi, 0, 0)  # an area light faces -z: turned to shine up

# ---------- the door: planks on a hinge at the back edge ----------
door = bpy.data.objects.new("trap_door", None); sc.collection.objects.link(door)
gap = 0.012 * S                   # the play round the door in its frame
TH = 0.055 * S                    # plank thickness
dw = 2 * hw - 2 * gap             # the door's width
dl = 2 * hw - gap - 1.2 * TH      # its length: the hinge sits 1.2 TH in from the back wall, so the hung door's back
                                  # face clears the wall (test_trapdoor_geom.py)
door.location = (cx, cy + hw - 1.2 * TH, top - 0.004 * S)  # the hinge line, a hair under the stone
for k, pl in enumerate(tg.planks(dw, dl, TH, n=4, seed=5)):
    ln, wd, tk = pl["size"]
    o = link_obj("trap_plank_%d" % k, box(0, 0, 0, ln, wd, tk), WOOD, door)
    # built long along x (the wood's grain runs along local x), turned to run front to back
    o.location = pl["at"]
    o.rotation_euler = (math.radians(pl["twist"][1]), math.radians(pl["twist"][0]), math.pi / 2)
    bev = o.modifiers.new("bevel", "BEVEL"); bev.width = 0.006 * S; bev.segments = 2
    warp(o, 0.012 * S, 7 + k)
for k, part in enumerate(tg.ironwork(dw, dl, TH)):
    o = link_obj("trap_iron_%d" % k, shape(part), IRON, door, smooth=part["kind"] in ("dome", "cyl", "torus"))
    bev = o.modifiers.new("bevel", "BEVEL"); bev.width = 0.002 * S; bev.segments = 1
    if part.get("warp"):
        warp(o, 0.006 * S, 30 + k)

# A pit lit as brightly as the floor reads as a shallow recess. A lid just under the hinge, unseen by the camera
# and by reflections, lets only part of the set's light down, so the hung door and walls fall into shade the way a
# real hole does. (The door passes through it; it only casts shade.)
lid_m, lnt, _b = nodes("trap_dim")
lnt.nodes.remove(_b)
tr = lnt.nodes.new("ShaderNodeBsdfTransparent"); df = lnt.nodes.new("ShaderNodeBsdfDiffuse")
df.inputs["Color"].default_value = (0, 0, 0, 1)
mx = lnt.nodes.new("ShaderNodeMixShader"); mx.inputs["Fac"].default_value = 1 - a.dim
lnt.links.new(tr.outputs[0], mx.inputs[2]); lnt.links.new(df.outputs[0], mx.inputs[1])
lnt.links.new(mx.outputs[0], lnt.nodes["Material Output"].inputs["Surface"])
lid = link_obj("trap_dim", box(cx, cy, top - 0.09 * S, 2 * hw, 2 * hw, 0.002 * S), lid_m)
lid.visible_camera = False; lid.visible_glossy = False; lid.visible_transmission = False

# moss tufts in the board gaps (draft A), lumpy flattened blobs in the set's own moss material
_moss = sc.objects.get("Moss")
MOSS = _moss.active_material if _moss is not None else None
print("CHECK tuft material %s" % (MOSS.name if MOSS else "none"), flush=True)
_rng = random.Random(21)
for k, (mx_, my_, mr) in enumerate(tg.moss_tufts(dw, dl)):
    bm = bmesh.new()  # a flocked clump: many tiny bumps, taller in the middle, not one smooth blob
    for j in range(40):
        r_ = mr * math.sqrt(_rng.random()); t_ = _rng.random() * 2 * math.pi
        dx_, dy_ = r_ * math.cos(t_), r_ * math.sin(t_) * 1.6  # longer along the gap
        g = bmesh.new()
        bmesh.ops.create_icosphere(g, subdivisions=1, radius=mr * _rng.uniform(0.12, 0.22))
        bmesh.ops.scale(g, vec=(1, 1, _rng.uniform(1.2, 2.2) * (1.2 - r_ / mr)), verts=g.verts)
        bmesh.ops.translate(g, vec=(mx_ + dx_, my_ + dy_, 0.002 * S), verts=g.verts)
        me_ = bpy.data.meshes.new("tmp"); g.to_mesh(me_); g.free(); bm.from_mesh(me_); bpy.data.meshes.remove(me_)
    link_obj("trap_tuft_%d" % k, bm, MOSS, door, smooth=True)

STATES = {"shut": 0.0, "half": 45.0, "fallen": tg.FALLEN_DEG}


def pose(name):
    door.rotation_euler = (math.radians(STATES[name]), 0, 0)  # + swings the front edge down into the pit


# the door's box on screen, for the zoomed crop
corners = [Vector((cx + x, cy + y, top + z)) for x in (-hw, hw) for y in (-hw, hw) for z in (-0.3 * S, 0.1 * S)]
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
    pose(name)
    sc.render.filepath = os.path.join(a.out, "trap-%s.png" % name)
    bpy.ops.render.render(write_still=True)
    print("CHECK rendered", sc.render.filepath, flush=True)
with open(os.path.join(a.out, "box.txt"), "w") as f:
    f.write("%f %f %f %f\n" % box)
print("TRAP STILLS OK", box, flush=True)
