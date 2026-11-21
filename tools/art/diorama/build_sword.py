# Royal blade (Wesley's pick B, 2026-11-19), modelled in Blender to match sword/b-royal.png:
# straight silver-grey blade with a gold line down its middle, gold crossguard whose ends curl into round scrolls,
# red-wrapped grip, gold pommel with one red diamond gem facing out.
# Long axis X: blade tip toward -X, pommel +X (king_motion.attach_prop's convention). Units: total length 1.0.
#   Blender -b --python build_sword.py -- OUT.glb [preview.png]
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import gpu_retry  # renders again in place after a Metal GPU reset

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
PREVIEW = argv[1] if len(argv) > 1 else None
bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, metal=0.0, rough=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m

STEEL = mat("blade_steel", (0.50, 0.52, 0.55), 0.0, 0.5)
GOLD = mat("gold", (0.62, 0.42, 0.10), 0.0, 0.45)
RED = mat("grip_red", (0.32, 0.03, 0.03), 0.0, 0.8)
GEM = mat("gem_red", (0.55, 0.01, 0.02), 0.0, 0.25)

def obj(name, me, m):
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(m)
    return o

def smooth(o, sub=2, angle=40):
    for p in o.data.polygons:
        p.use_smooth = True
    md = o.modifiers.new("sub", "SUBSURF"); md.levels = sub; md.render_levels = sub

# --- dimensions (fractions of total length)
TIP, GUARD = -1.0 + 0.0, -0.27     # blade from x=-1.0 (tip) to the guard at x=-0.27 ... rescaled below
BW, BT = 0.085, 0.022              # blade width, thickness at the guard
# blade: lens cross-section, straight sides, a short pointed tip
bm = bmesh.new()
xs = [-0.27, -0.55, -0.85, -0.93, -1.0]
ws = [BW, BW * 0.97, BW * 0.92, BW * 0.62, 0.0]
ring = []
for x, w in zip(xs, ws):
    hw, ht = max(w / 2, 0.001), max(BT / 2 * (w / BW), 0.0015)
    ring.append([bm.verts.new((x, 0, ht)), bm.verts.new((x, hw, 0)), bm.verts.new((x, 0, -ht)), bm.verts.new((x, -hw, 0))])
for a, b in zip(ring, ring[1:]):
    for i in range(4):
        bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
bm.faces.new(ring[0][::-1])
me = bpy.data.meshes.new("blade"); bm.to_mesh(me); bm.free()
blade = obj("blade", me, STEEL)
bev = blade.modifiers.new("bev", "BEVEL"); bev.width = 0.004; bev.segments = 3
for p in blade.data.polygons:
    p.use_smooth = True

# gold line down both faces of the blade (a thin raised strip, ends rounded by the subsurf)
for s in (1, -1):
    bpy.ops.mesh.primitive_cube_add(size=1)
    f = bpy.context.object; f.name = "fuller%+d" % s
    f.scale = (0.56, 0.02, 0.005); f.location = (-0.27 - 0.30, 0, s * BT / 2 * 0.9)
    bpy.ops.object.transform_apply(scale=True, location=True)
    f.data.materials.append(GOLD); smooth(f, 2)

# crossguard: a rounded bar across Y with the ends curled up toward the blade into round scrolls
def scroll(sign):
    cu = bpy.data.curves.new("scroll", "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = 0.016; cu.bevel_resolution = 4; cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    R0, turns, n = 0.034, 1.15, 28
    # straight bar from the centre out, then a spiral around a centre on the blade side (-X) of the bar end
    pts = [(-0.255, sign * 0.115 * i / 6, 0) for i in range(7)]
    cx, cyy = -0.255 - R0, sign * 0.115
    for i in range(1, n + 1):
        t = i / n
        ang = t * turns * 2 * math.pi
        r = R0 * (1 - 0.6 * t)
        # angle 0 points +X from the curl centre (back to the bar end), sweeping outward then toward -X
        pts.append((cx + r * math.cos(ang), cyy + sign * r * math.sin(ang), 0))
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (*c, 1)
    o = bpy.data.objects.new("scroll", cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target="MESH")
    o.select_set(False)
    o.data.materials.clear(); o.data.materials.append(GOLD)
    for p in o.data.polygons:
        p.use_smooth = True
    return o
scroll(1); scroll(-1)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.026, segments=24, ring_count=12, location=(-0.255, 0, 0))
c = bpy.context.object; c.name = "guard_centre"; c.scale = (0.9, 1.0, 0.8)
c.data.materials.append(GOLD); bpy.ops.object.shade_smooth()

# grip: a red cylinder with wrapped ridges
bpy.ops.mesh.primitive_cylinder_add(radius=0.021, depth=0.19, vertices=20, location=(-0.24 + 0.095 + 0.0, 0, 0),
                                    rotation=(0, math.radians(90), 0))
g = bpy.context.object; g.name = "grip"; g.data.materials.append(RED); bpy.ops.object.shade_smooth()
for i in range(9):
    x = -0.235 + 0.02 * (i + 0.5) * 0.19 / 0.18
    bpy.ops.mesh.primitive_torus_add(major_radius=0.021, minor_radius=0.0045, major_segments=20, minor_segments=8,
                                     location=(x, 0, 0), rotation=(0, math.radians(90 + 12), 0))
    w = bpy.context.object; w.name = "wrap%d" % i; w.data.materials.append(RED); bpy.ops.object.shade_smooth()

# pommel: a gold disc (faces +-Z, the sword's flat sides) with a red diamond gem on each face
PX = -0.24 + 0.19 + 0.032
bpy.ops.mesh.primitive_cylinder_add(radius=0.036, depth=0.03, vertices=32, location=(PX, 0, 0))
p = bpy.context.object; p.name = "pommel"; p.data.materials.append(GOLD)
bev = p.modifiers.new("bev", "BEVEL"); bev.width = 0.009; bev.segments = 4
bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_cylinder_add(radius=0.014, depth=0.016, vertices=16, location=(PX - 0.03, 0, 0),
                                    rotation=(0, math.radians(90), 0))
n = bpy.context.object; n.name = "pommel_neck"; n.data.materials.append(GOLD); bpy.ops.object.shade_smooth()
for s in (1, -1):
    bm = bmesh.new()
    a, b, h = 0.016, 0.022, 0.008  # half-widths along Y and X, height
    v = [bm.verts.new(c) for c in ((PX, 0, s * (0.015 + h)), (PX + b, 0, s * 0.015), (PX, a, s * 0.015),
                                    (PX - b, 0, s * 0.015), (PX, -a, s * 0.015))]
    for i in range(4):
        f = (v[0], v[1 + i], v[1 + (i + 1) % 4]) if s > 0 else (v[0], v[1 + (i + 1) % 4], v[1 + i])
        bm.faces.new(f)
    me = bpy.data.meshes.new("gem"); bm.to_mesh(me); bm.free()
    obj("gem%+d" % s, me, GEM)

# join, apply modifiers, scale so the total length is 1
for o in bpy.data.objects:
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
    o.select_set(False)
for o in bpy.data.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = bpy.data.objects["blade"]
bpy.ops.object.join()
sw = bpy.context.object; sw.name = "royal_blade"
bb = [sw.matrix_world @ Vector(c) for c in sw.bound_box]
lo, hi = min(v.x for v in bb), max(v.x for v in bb)
print("SWORD length %.3f  grip at %.3f of length" % (hi - lo, (-0.15 - lo) / (hi - lo)), flush=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True)
print("SAVED", OUT, flush=True)

if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 1400, 700
    w = bpy.data.worlds.new("w"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.45, 0.45, 0.47, 1); sc.world = w
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 0.95
    cam.location = ((hi + lo) / 2, 0, 1.0); cam.data.ortho_scale = 1.15; cam.rotation_euler = (0, 0, 0)
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
    sun.data.energy = 3.5; sun.rotation_euler = (math.radians(30), math.radians(-20), 0)
    sc.render.filepath = PREVIEW
    gpu_retry.render()
