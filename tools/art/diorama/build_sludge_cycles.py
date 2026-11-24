# The sludge square, for Cycles (Wesley 2026-11-24, look "A, glowing ooze" from sludge/sludge-abc.jpg): the floor slab
# has broken away into a pool of thick, glossy, glowing poison-green ooze with a few raised bubbles and one bursting,
# crumbled stone at its edge. No piece may stop in sludge, so the pool fills most of the square.
#
# It is built from the set's own slab, not drawn fresh: the real sculpted tile (stage.py's TILE_GLB) on that square gets
# an irregular hole cut through it (a boolean whose cut faces take a wet broken-stone material), and the ooze sits a
# little below the slab's top inside the hole. So the stone around the pool is the same stone as every other square.
#
#   Blender -b --python build_sludge_cycles.py -- --out DIR [--res 1600 --samples 128 --squares 1,1;3,2;1,3 --zoom 0]
# writes DIR/sludge.png (the whole board with pools on those squares) and, with --zoom N, DIR/sludge-zoom.png.
import bpy, bmesh, sys, os, math, argparse, random
from mathutils import Vector, noise
from bpy_extras.object_utils import world_to_camera_view

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
import stage

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--squares", default="1,1;3,2;1,3")  # board squares (0..4 from the left, 0..4 from the front)
ap.add_argument("--zoom", type=float, default=0.0)    # >0: render only a box round the pools, this much padded
ap.add_argument("--glow", type=float, default=3.0)    # the ooze's emission strength
ap.add_argument("--light", type=float, default=25.0)  # the point light over each pool (W)
ap.add_argument("--size", type=float, default=0.4)
ap.add_argument("--flare", type=float, default=0.14)  # how far the broken edge slopes out, share of the hole
ap.add_argument("--depth", type=float, default=0.07)  # the ooze below the slab top, in figure heights   # the hole's half-width, share of a square
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)

H = 1.7          # figure height (the set's unit)
S = 1.2 * H      # one square
EL, FOCAL, ZOOM5, LA, ASPECT = 35.0, 50.0, 0.255, 0.21, 4.0 / 3.0  # the game camera, as bake_king_sprites.py

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
objs = stage.build_stage(sc, H, center=(0, 0), board=5)
cam = stage.build_camera(sc, H, aspect=ASPECT, zoom=ZOOM5, elevation=EL, look_ahead=LA, focal=FOCAL)
cam.data.dof.use_dof = False
stage.setup_render(sc, res=a.res, samples=a.samples, aspect=ASPECT)
bpy.context.view_layer.update()


def nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    return m, nt, nt.nodes["Principled BSDF"]


def link(nt, a_, b_):
    nt.links.new(a_, b_)


def ooze_mat():
    """Thick glowing poison ooze: bright where it is thin and moving, deeper green in the slow patches, a wet clear
    coat on top so the lanterns put hard highlights on it, and a little light passing into it."""
    m, nt, b = nodes("sludge_ooze")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.4 / S; nz.inputs["Detail"].default_value = 5
    nz.inputs["Distortion"].default_value = 0.6
    link(nt, tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = (0.015, 0.2, 0.008, 1)
    ramp.color_ramp.elements[1].position = 0.7; ramp.color_ramp.elements[1].color = (0.16, 0.85, 0.03, 1)
    link(nt, nz.outputs["Fac"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], b.inputs["Base Color"])
    link(nt, ramp.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = a.glow
    b.inputs["Roughness"].default_value = 0.18
    b.inputs["Subsurface Weight"].default_value = 0.25
    b.inputs["Subsurface Radius"].default_value = (0.4, 1.0, 0.3)
    b.inputs["Subsurface Scale"].default_value = 0.05 * S
    b.inputs["Coat Weight"].default_value = 1.0
    b.inputs["Coat Roughness"].default_value = 0.03
    # slow lumpy surface, not a mirror
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08; bump.inputs["Distance"].default_value = 0.01 * S
    nz2 = nt.nodes.new("ShaderNodeTexNoise"); nz2.inputs["Scale"].default_value = 4 / S; nz2.inputs["Detail"].default_value = 3
    link(nt, tc.outputs["Object"], nz2.inputs["Vector"]); link(nt, nz2.outputs["Fac"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], b.inputs["Normal"])
    link(nt, bump.outputs["Normal"], b.inputs["Coat Normal"])
    return m


def broken_mat():
    """The broken inner faces of the slab: darker, wet, stained green near the ooze."""
    m, nt, b = nodes("sludge_broken")
    geo = nt.nodes.new("ShaderNodeNewGeometry")  # world space: the cut faces sit on slabs scaled flat
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 14 / S; nz.inputs["Detail"].default_value = 8
    link(nt, geo.outputs["Position"], nz.inputs["Vector"])
    vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 30 / S  # chipped facets
    link(nt, geo.outputs["Position"], vor.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.09, 0.095, 0.1, 1); mix.inputs[7].default_value = (0.2, 0.205, 0.2, 1)
    link(nt, nz.outputs["Fac"], mix.inputs["Factor"])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); link(nt, geo.outputs["Position"], sep.inputs["Vector"])
    stain = nt.nodes.new("ShaderNodeMapRange")  # green tide mark on the low part of the broken face
    stain.inputs["From Min"].default_value = SLAB_TOP - 0.04 * H; stain.inputs["From Max"].default_value = SLAB_TOP - 0.08 * H
    link(nt, sep.outputs["Z"], stain.inputs["Value"])
    mix2 = nt.nodes.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    link(nt, mix.outputs[2], mix2.inputs[6]); mix2.inputs[7].default_value = (0.03, 0.09, 0.02, 1)
    link(nt, stain.outputs["Result"], mix2.inputs["Factor"])
    link(nt, mix2.outputs[2], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.45
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6
    hsum = nt.nodes.new("ShaderNodeMath"); hsum.operation = "ADD"
    link(nt, nz.outputs["Fac"], hsum.inputs[0]); link(nt, vor.outputs["Distance"], hsum.inputs[1])
    link(nt, hsum.outputs[0], bump.inputs["Height"]); link(nt, bump.outputs["Normal"], b.inputs["Normal"])
    return m


def outline(rng, n=96):
    """The hole: a squarish blob (superellipse) with a wobbly edge and a few bites where chunks broke off."""
    p = 3.2
    ph = [rng.uniform(0, 6.28) for _ in range(4)]
    bites = [(rng.uniform(0, 6.28), rng.uniform(0.04, 0.09), rng.uniform(0.15, 0.3)) for _ in range(rng.randint(2, 4))]
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        r = (abs(c) ** p + abs(s) ** p) ** (-1 / p)
        r *= 1 + 0.05 * math.sin(3 * t + ph[0]) + 0.035 * math.sin(5 * t + ph[1]) + 0.02 * math.sin(11 * t + ph[2])
        r *= 1 + 0.025 * noise.noise(Vector((c * 3, s * 3, ph[3])))
        for bt, depth, width in bites:  # a chunk gone: the edge pushed out
            d = math.atan2(math.sin(t - bt), math.cos(t - bt))
            r *= 1 + depth * math.exp(-(d / width) ** 2)
        pts.append((c * r * a.size * S, s * r * a.size * S))
    return pts


def cutter_mesh(name, pts, zb, zs, top, mat, rng):
    """The hole, as a loft: straight down below the ooze, then flaring out as it climbs to the slab's top so the
    broken edge shows from the high camera as a crumbled band of stone sloping into the pool."""
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), 0))
    levels = [(zb, 0.97)] + [(zs + (top - zs) * t, 1.0 + a.flare * t ** 0.8) for t in (0, 0.25, 0.5, 0.75, 1.0)] \
        + [(top + 0.3 * H, 1.0 + a.flare)]
    bm = bmesh.new(); rings = []
    for li, (z, f) in enumerate(levels):
        ring_ = []
        for x, y in pts:
            v = Vector((x, y, z))
            jag = 0.0 if li in (0, len(levels) - 1) else 0.05 * noise.noise(v * (7 / S) + off) + 0.025 * noise.noise(v * (19 / S) + off)
            ring_.append(bm.verts.new((x * (f + jag), y * (f + jag), z)))
        rings.append(ring_)
    n = len(pts)
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((r0[i], r0[(i + 1) % n], r1[(i + 1) % n], r1[i]))
    bm.faces.new(rings[-1]); bm.faces.new(rings[0][::-1])
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    return o


def surface(name, pts, z, mat, rng, grow=1.04):
    """The ooze: a fan of the outline (a little wider, tucked under the broken stone), gently lumped."""
    bm = bmesh.new()
    c = bm.verts.new((0, 0, z))
    rings = 10
    grid = [[c]]
    for k in range(1, rings + 1):
        f = k / rings
        grid.append([bm.verts.new((x * grow * f, y * grow * f, z)) for x, y in pts])
    n = len(pts)
    for i in range(n):
        bm.faces.new((c, grid[1][i], grid[1][(i + 1) % n]))
    for k in range(1, rings):
        for i in range(n):
            bm.faces.new((grid[k][i], grid[k + 1][i], grid[k + 1][(i + 1) % n], grid[k][(i + 1) % n]))
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), 0))
    for v in bm.verts:  # slow swells, and a slight meniscus rising to the stone
        r = math.hypot(v.co.x, v.co.y) / (a.size * S)
        v.co.z += 0.012 * S * noise.noise(v.co * (3 / S) + off) + 0.01 * S * max(0, r - 0.8) / 0.2
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    return o


def ball(name, r, at, mat, cut=None, squash=1.0):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=r)
    if cut is not None:  # a dome: drop what sits below the surface
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut * r], context="VERTS")
    for v in bm.verts:
        v.co.z *= squash
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.location = at
    return o


def ring(name, R, r, at, mat):
    bm = bmesh.new()
    segs, sides = 32, 8
    vs = [[bm.verts.new(((R + r * math.cos(q * 2 * math.pi / sides)) * math.cos(t * 2 * math.pi / segs),
                         (R + r * math.cos(q * 2 * math.pi / sides)) * math.sin(t * 2 * math.pi / segs),
                         r * math.sin(q * 2 * math.pi / sides))) for q in range(sides)] for t in range(segs)]
    for t in range(segs):
        for q in range(sides):
            bm.faces.new((vs[t][q], vs[(t + 1) % segs][q], vs[(t + 1) % segs][(q + 1) % sides], vs[t][(q + 1) % sides]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.location = at
    return o


def rubble(name, r, at, mat, rng):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=3, radius=r)
    sq = (rng.uniform(0.9, 1.4), rng.uniform(0.7, 1.1), rng.uniform(0.35, 0.55))
    for v in bm.verts:
        v.co = Vector((v.co.x * sq[0], v.co.y * sq[1], v.co.z * sq[2])) * (1 + 0.25 * noise.noise(v.co * 6 / r))
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    for p in me.polygons:
        p.use_smooth = True
    o.location = at; o.rotation_euler = (rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), rng.uniform(0, 6.28))
    return o


# ---------- the pools ----------
slabs = objs["slabs"]
n_ = 5
SLAB_TOP = max((s.matrix_world @ Vector(c)).z for s in slabs for c in s.bound_box) - 0.01 * H
OOZE, BROKEN = ooze_mat(), broken_mat()
STONE = BROKEN
rubble_mat, nt, b = nodes("sludge_rubble")
b.inputs["Base Color"].default_value = (0.2, 0.21, 0.21, 1); b.inputs["Roughness"].default_value = 0.7
pools = []
for k, sq_ in enumerate(a.squares.split(";")):
    i, j = (int(v) for v in sq_.split(","))
    rng = random.Random(1000 + 31 * i + 7 * j)
    cx, cy = (i - (n_ - 1) / 2) * S, (j - (n_ - 1) / 2) * S
    slab = next(s for s in slabs if s.name == "Slab_%d_%d" % (i, j))
    slab.data = slab.data.copy()  # the tile mesh is shared by every slab
    top = max((slab.matrix_world @ Vector(c)).z for c in slab.bound_box)
    pts = outline(rng)
    zs = top - a.depth * H
    cutter = cutter_mesh("sludge_cut_%d" % k, pts, -0.5 * H, zs, top, BROKEN, rng)
    cutter.location = (cx, cy, 0); cutter.hide_render = True; cutter.hide_viewport = True
    mod = slab.modifiers.new("pool", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cutter
    mod.solver = "EXACT"; mod.use_hole_tolerant = True; mod.material_mode = "TRANSFER"
    surf = surface("sludge_ooze_%d" % k, pts, zs, OOZE, rng); surf.location = (cx, cy, 0)
    parts = [surf]
    # bubbles: one big swelling, a few small, one bursting ring with drops flung up
    for q in range(rng.randint(4, 6)):
        r = (0.1 if q == 0 else rng.uniform(0.035, 0.065)) * S
        ang, rad = rng.uniform(0, 6.28), rng.uniform(0.05, 0.62) * a.size * S
        parts.append(ball("sludge_bubble_%d_%d" % (k, q), r, (cx + rad * math.cos(ang), cy + rad * math.sin(ang), zs - 0.35 * r), OOZE, cut=0.35, squash=0.9))
    ang, rad = rng.uniform(0, 6.28), rng.uniform(0.3, 0.55) * a.size * S
    bx, by = cx + rad * math.cos(ang), cy + rad * math.sin(ang)
    parts.append(ring("sludge_burst_%d" % k, 0.04 * S, 0.008 * S, (bx, by, zs + 0.004 * S), OOZE))
    for q in range(3):
        t = q * 2.1 + rng.uniform(0, 0.6)
        parts.append(ball("sludge_drop_%d_%d" % (k, q), rng.uniform(0.007, 0.012) * S,
                          (bx + 0.03 * S * math.cos(t), by + 0.03 * S * math.sin(t), zs + rng.uniform(0.03, 0.07) * S), OOZE))
    # broken chunks lying at the edge, half sunk
    for q in range(rng.randint(2, 4)):
        t = rng.uniform(0, 6.28)
        x, y = pts[int(t / 6.28 * len(pts)) % len(pts)]
        f = rng.uniform(0.82, 0.92)
        parts.append(rubble("sludge_rubble_%d_%d" % (k, q), rng.uniform(0.035, 0.06) * S, (cx + x * f, cy + y * f, zs - 0.01 * S), BROKEN, rng))
    # the glow spilling onto the stone round it
    L = bpy.data.lights.new("sludge_glow_%d" % k, "POINT"); L.energy = a.light; L.color = (0.45, 1.0, 0.15)
    L.shadow_soft_size = 0.3 * S
    lo = bpy.data.objects.new("sludge_glow_%d" % k, L); sc.collection.objects.link(lo); lo.location = (cx, cy, zs + 0.12 * H)
    pools.append((cx, cy))
print("CHECK slab top %.3f, pools %s, res %s -> %d x %d" % (SLAB_TOP, pools, a.res, sc.render.resolution_x, sc.render.resolution_y), flush=True)

rx, ry = sc.render.resolution_x, sc.render.resolution_y
if a.zoom:
    uvs = [world_to_camera_view(sc, cam, Vector((x + dx * S / 2, y + dy * S / 2, SLAB_TOP)))
           for x, y in pools for dx in (-1, 1) for dy in (-1, 1)]
    u0, u1 = min(p.x for p in uvs), max(p.x for p in uvs)
    v0, v1 = min(p.y for p in uvs), max(p.y for p in uvs)
    cu, cv, hw = (u0 + u1) / 2, (v0 + v1) / 2, (u1 - u0) / 2 * a.zoom
    hh = max((v1 - v0) / 2 * a.zoom, hw * rx / ry * 0.6)
    r_ = sc.render
    r_.use_border = True; r_.use_crop_to_border = True
    r_.border_min_x, r_.border_max_x = max(0, cu - hw), min(1, cu + hw)
    r_.border_min_y, r_.border_max_y = max(0, cv - hh), min(1, cv + hh)
sc.render.filepath = os.path.join(a.out, "sludge-zoom.png" if a.zoom else "sludge.png")
bpy.ops.render.render(write_still=True)
print("SLUDGE STILLS OK", sc.render.filepath, flush=True)
