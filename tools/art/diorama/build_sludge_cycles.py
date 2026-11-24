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
import numpy as np
from mathutils import Vector, noise
from bpy_extras.object_utils import world_to_camera_view

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
import stage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sludge_pond as sp
import sludge_bubbles as sb

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--squares", default="1,1;3,2;1,3")  # board squares (0..4 from the left, 0..4 from the front)
ap.add_argument("--zoom", type=float, default=0.0)    # >0: render only a box round the pools, this much padded
ap.add_argument("--glow", type=float, default=3.0)    # the ooze's emission strength
ap.add_argument("--light", type=float, default=80.0)  # the point light over each pool (W)
ap.add_argument("--size", type=float, default=0.46)
ap.add_argument("--bubbles", type=int, default=9)
ap.add_argument("--burst", type=int, default=0)  # the burst ring and drops (the judge read the ring as a torus)
ap.add_argument("--solver", default="EXACT")
ap.add_argument("--chunks", type=int, default=8)
ap.add_argument("--rim", type=float, default=0.14)   # the cracked band round the pool, share of a square
ap.add_argument("--tilt", type=float, default=0.3)   # how far the rim pieces tip into the pool (radians, mean)
ap.add_argument("--drop", type=float, default=0.02)  # extra sinking of the rim pieces, share of a square
ap.add_argument("--heave", type=float, default=0.65)  # share of rim pieces heaved up rather than slumped
ap.add_argument("--gone", type=float, default=0.12)  # chance a rim piece has sunk out of sight
ap.add_argument("--t", type=float, default=0.3)      # the bubble loop's phase for a still (0..1)
ap.add_argument("--sink", type=float, default=0.45)  # how far each bubble sits below the surface, share of its radius
ap.add_argument("--flare", type=float, default=0.08)  # how far the broken edge slopes out, share of the hole
ap.add_argument("--depth", type=float, default=0.035)  # the ooze below the slab top, in figure heights   # the hole's half-width, share of a square
ap.add_argument("--rim_glb", default="")  # a Meshy model of the broken tile: it replaces the slab, the ooze fills its basin
ap.add_argument("--level", type=float, default=0.55)  # the ooze's height in that basin, 0 = its floor, 1 = the tile top
ap.add_argument("--fit", type=float, default=1.0)    # the model's footprint, share of the tile
ap.add_argument("--rim_val", type=float, default=0.5)  # the model's paint darkened toward the set's slate (as TILE_VAL)
ap.add_argument("--dome", type=float, default=1.2)  # timed bubbles need 1.2 to read on camera (0.34 read as lights under the surface)  # a bubble's height, share of its radius
ap.add_argument("--swell", type=float, default=0.005)  # the ooze's slow swell, share of a square
ap.add_argument("--bub_scale", type=float, default=1.0)  # bubble radius multiplier
ap.add_argument("--neck", type=float, default=0.035)  # the fillet where a bubble meets the surface, share of a square
ap.add_argument("--ping", type=float, default=0.0)  # W of a small light set to put a sharp highlight on the ooze only
ap.add_argument("--c0", default="0.09,0.5,0.01")  # the ooze's deep and light colours
ap.add_argument("--c1", default="0.2,0.68,0.02")
ap.add_argument("--rim_bump", type=float, default=0.0)  # fine chalky grain on the Meshy stone (bump strength)
ap.add_argument("--edge_dark", type=float, default=0.0)  # the ooze darkens this much toward the stone (0..1)
ap.add_argument("--margin", type=float, default=0.12)  # pond: the stone kept on free sides, share of a square
ap.add_argument("--round", type=float, default=0.12)   # pond: the outside corners' radius, share of a square
ap.add_argument("--fillet", type=float, default=0.1)   # pond: the inside corners' fillet, share of a square
ap.add_argument("--ragged", type=float, default=0.015)  # pond: the edge's wobble, share of a square
ap.add_argument("--stone", type=float, default=0.12)  # pond: the small rim stones, share of a square (big ones 1.6x)
ap.add_argument("--kit_tilt", type=float, default=25)  # pond stones tip up to this many degrees into the pool
ap.add_argument("--kit_sink", type=float, default=0.3)  # and sink up to this share of their thickness
ap.add_argument("--kit_turn", type=float, default=0.15)  # and turn up to this many radians off the edge line
ap.add_argument("--kit_thick", type=float, default=1.0)  # pond stones' thickness multiplier (chunkier slabs)
ap.add_argument("--kit_glb", default="")  # pond: a Meshy model of loose broken shards for the rim (else code shards)
ap.add_argument("--yaw", type=float, default=0.0)    # extra turn of the model (degrees)
ap.add_argument("--timed", type=int, default=1)  # 1: bubbles timed from the mudpot clips (sludge_bubbles.py); 0: the old even loop
ap.add_argument("--frames", type=int, default=0)  # >0: render the whole loop (--loop_s) as this many frames
ap.add_argument("--loop_s", type=float, default=8.0)  # the bubbling loop's length in seconds (the judge saw a 4 s loop repeat)
ap.add_argument("--splat", type=int, default=10)  # tiny still lumps of old splatter per square
ap.add_argument("--main_r", type=float, default=0.13)  # the main vent's biggest bubble radius, share of a square
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
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = tuple(float(v) for v in a.c0.split(",")) + (1,)
    ramp.color_ramp.elements[1].position = 0.7; ramp.color_ramp.elements[1].color = tuple(float(v) for v in a.c1.split(",")) + (1,)
    link(nt, nz.outputs["Fac"], ramp.inputs["Fac"])
    col = ramp.outputs["Color"]
    if a.edge_dark:  # deeper, darker green where the ooze runs under the stone (the concept's shaded edge)
        at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "edge"
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0.6; mr.inputs["From Max"].default_value = 1.0
        mr.inputs["To Max"].default_value = a.edge_dark
        link(nt, at.outputs["Fac"], mr.inputs["Value"])
        mx = nt.nodes.new("ShaderNodeMixRGB"); mx.blend_type = "MULTIPLY"
        mx.inputs["Color2"].default_value = (0.25, 0.4, 0.15, 1)
        link(nt, mr.outputs["Result"], mx.inputs["Fac"]); link(nt, col, mx.inputs["Color1"])
        col = mx.outputs["Color"]
    # the hole a burst tears in the skin: a dark opening into the ooze below (sludge_bubbles.tear)
    ta = nt.nodes.new("ShaderNodeAttribute"); ta.attribute_name = "tear"
    tm = nt.nodes.new("ShaderNodeMixRGB"); tm.blend_type = "MIX"
    tm.inputs["Color2"].default_value = (0.012, 0.035, 0.006, 1)
    link(nt, ta.outputs["Fac"], tm.inputs["Fac"]); link(nt, col, tm.inputs["Color1"])
    col = tm.outputs["Color"]
    link(nt, col, b.inputs["Base Color"])
    link(nt, col, b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = a.glow
    b.inputs["Roughness"].default_value = 0.16
    b.inputs["Subsurface Weight"].default_value = 0.0
    b.inputs["Subsurface Radius"].default_value = (0.4, 1.0, 0.3)
    b.inputs["Subsurface Scale"].default_value = 0.05 * S
    b.inputs["Coat Weight"].default_value = 0.6
    b.inputs["Coat Roughness"].default_value = 0.05
    # slow lumpy surface, not a mirror
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.03; bump.inputs["Distance"].default_value = 0.01 * S
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
    p = 2.4
    ph = [rng.uniform(0, 6.28) for _ in range(4)]
    bites = [(rng.uniform(0, 6.28), rng.uniform(0.04, 0.09), rng.uniform(0.15, 0.3)) for _ in range(rng.randint(2, 4))]
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        r = (abs(c) ** p + abs(s) ** p) ** (-1 / p)
        r *= 1 + 0.08 * math.sin(2 * t + ph[0]) + 0.05 * math.sin(5 * t + ph[1]) + 0.03 * math.sin(11 * t + ph[2])
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


def chunk(name, at, top, zs, t, mat, rng):
    """A broken piece of flagstone: a thick slab shard with a jagged outline and sharp-ish edges, its top the slab's
    worn face, tipped toward the pool so its outer edge stands proud and its inner edge sinks into the ooze."""
    th_ = max(top - (zs - 0.05 * S), 0.1 * S)  # thick blocks: thinner ones read as paper shards
    n = rng.randint(5, 7)
    R = rng.uniform(0.12, 0.21) * S
    outl = [(R * rng.uniform(0.6, 1.15) * math.cos(2 * math.pi * (q + rng.uniform(-0.25, 0.25)) / n),
             R * rng.uniform(0.6, 1.15) * math.sin(2 * math.pi * (q + rng.uniform(-0.25, 0.25)) / n)) for q in range(n)]
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, -th_)) for x, y in outl]
    hi = [bm.verts.new((x, y, 0)) for x, y in outl]
    for q in range(n):
        bm.faces.new((lo[q], lo[(q + 1) % n], hi[(q + 1) % n], hi[q]))
    bm.faces.new(hi); bm.faces.new(lo[::-1])
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.018 * S, segments=3, affect="EDGES")
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), 0))
    for v in bm.verts:
        v.co += Vector((0.5, 0.5, 1)) * 0.016 * S * noise.noise(v.co * (9 / S) + off)  # lumpy, hand-cut, not a clean fracture
    bm.normal_update()
    uvl = bm.loops.layers.uv.verify()  # the tile's texture, box-mapped from above
    for f in bm.faces:  # sides mapped from the side: mapped from above they streaked into stripes
        nx, ny, nz = (abs(c) for c in f.normal)
        for l in f.loops:
            x_, y_, z_ = l.vert.co
            l[uvl].uv = ((0.5 + x_ / S, 0.5 + y_ / S) if nz > 0.6 else
                         (0.5 + y_ / S, 0.5 + z_ / S) if nx > ny else (0.5 + x_ / S, 0.5 + z_ / S))
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    tilt = rng.uniform(0.3, 0.6)  # radians, toward the pool
    o.rotation_euler = (math.sin(t) * tilt, -math.cos(t) * tilt, rng.uniform(0, 6.28))
    o.rotation_euler = (-math.sin(t) * tilt * -1, math.cos(t) * tilt * -1, o.rotation_euler.z)
    o.location = (at[0], at[1], top + rng.uniform(-0.005, 0.03) * S)  # bedded in, not resting on the floor
    return o


# ---------- the pools ----------
def box_r(t, hw):
    """How far the ray at angle t runs before leaving a square of half-width hw."""
    c, s_ = abs(math.cos(t)), abs(math.sin(t))
    return hw / max(c, s_, 1e-6)


def radius_fn(rng):
    """The pool's edge as a radius for any angle: a rounded blob with a wobbly edge and a few bites."""
    p = 2.4
    ph = [rng.uniform(0, 6.28) for _ in range(4)]
    bites = [(rng.uniform(0, 6.28), rng.uniform(0.05, 0.12), rng.uniform(0.15, 0.3)) for _ in range(rng.randint(2, 4))]

    def r(t):
        c, s_ = math.cos(t), math.sin(t)
        v = (abs(c) ** p + abs(s_) ** p) ** (-1 / p)
        v *= 1 + 0.08 * math.sin(2 * t + ph[0]) + 0.05 * math.sin(5 * t + ph[1]) + 0.03 * math.sin(11 * t + ph[2])
        v *= 1 + 0.025 * noise.noise(Vector((c * 3, s_ * 3, ph[3])))
        for bt, depth, width in bites:
            d = math.atan2(math.sin(t - bt), math.cos(t - bt))
            v *= 1 + depth * math.exp(-(d / width) ** 2)
        return v
    return r


def prism(name, poly, zb, zt):
    """A straight prism over a 2D polygon (counter-clockwise), from zb to zt."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, zb)) for x, y in poly]; hi = [bm.verts.new((x, y, zt)) for x, y in poly]
    n = len(poly)
    for q in range(n):
        bm.faces.new((lo[q], lo[(q + 1) % n], hi[(q + 1) % n], hi[q]))
    bm.faces.new(hi); bm.faces.new(lo[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(BROKEN)
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    o.hide_render = True; o.hide_viewport = True
    return o


def bake(o):
    """The object with its modifiers applied, as a new object in world space."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    me.transform(o.matrix_world)
    n = bpy.data.objects.new(o.name + "_b", me); sc.collection.objects.link(n)
    return n


def smax(a_, b_, k):
    """Smooth maximum: two heights merged with a soft fillet k wide (a bubble's neck into the surface)."""
    h = max(0.0, min(1.0, 0.5 + 0.5 * (a_ - b_) / k))
    return b_ * (1 - h) + a_ * h + k * h * (1 - h)


def bubble_h(bub, x, y, t):
    """One bubble's height at (x, y) at loop phase t (0..1): it swells out of the surface, slumps, and is gone; the
    next one grows in the same place. Lopsided: stretched along its own axis and leaning off-centre."""
    bx, by, r, ph, ang, st, lean = bub
    u = (t + ph) % 1.0
    grow = math.sin(math.pi * min(u / 0.85, 1.0)) ** 0.7 if u < 0.85 else 0.0  # up, round over, down
    if grow <= 0:
        return 0.0
    dx, dy = x - bx, y - by
    ca, sa = math.cos(ang), math.sin(ang)
    lx, ly = (dx * ca + dy * sa) / st, (-dx * sa + dy * ca)
    lx -= lean * r * 0.3 * (1 - (ly / r) ** 2 if abs(ly) < r else 0)
    d = math.hypot(lx, ly) / (r * (0.6 + 0.4 * grow))
    return 0.0 if d >= 1 else grow * a.dome * r * math.sqrt(1 - d * d)


class Timed:
    """The timed bubbling for one pool or pond: its events and its splatter (sludge_bubbles.py)."""
    def __init__(self, events, splat):
        self.events, self.splat = events, splat


def timed_bubbles(rng, centers, clear, nsq):
    """Vents (a main one near each square's middle, two small ones per square), the loop's events, and the splatter.
    clear(x, y) is how far (x, y) is inside the ooze's edge."""
    vents = []
    gx, gy = sum(c[0] for c in centers) / len(centers), sum(c[1] for c in centers) / len(centers)
    for cx, cy in centers:
        # main vents lean halfway toward the pond's middle: real mud churns in the middle, never at the edge
        mx, my = (cx + gx) / 2, (cy + gy) / 2
        for _ in range(60):
            x, y = mx + rng.uniform(-0.12, 0.12) * S, my + rng.uniform(-0.12, 0.12) * S
            c = clear(x, y)
            if c > 0.1 * S:
                vents.append((x, y, min(a.main_r * S * a.bub_scale, c / 1.5), True))
                break
    for _ in range(200):
        if len(vents) >= 3 * len(centers):
            break
        cx, cy = rng.choice(centers)
        x, y = cx + rng.uniform(-0.4, 0.4) * S, cy + rng.uniform(-0.4, 0.4) * S
        c = clear(x, y)
        if c > 0.06 * S and all(math.hypot(x - v[0], y - v[1]) > 0.12 * S for v in vents):
            vents.append((x, y, min(0.065 * S * a.bub_scale, c / 1.5), False))
    if not vents:
        return Timed([], [])
    events = sb.schedule(vents, nsq, rng, dome=a.dome, loop=a.loop_s)
    for e in events:
        e.drops = [d for d in e.drops if clear(d.x1, d.y1) > 1.5 * d.r and clear(d.x0, d.y0) > 0]
    spots = []
    for _ in range(400):
        cx, cy = rng.choice(centers)
        x, y = cx + rng.uniform(-0.45, 0.45) * S, cy + rng.uniform(-0.45, 0.45) * S
        r = rng.uniform(0.012, 0.025) * S
        if clear(x, y) > r + 0.03 * S:
            spots.append((x, y, r))
    print("CHECK timed: %d vents, %d events, %d splatter" % (len(vents), len(events), min(len(spots), a.splat * nsq)), flush=True)
    return Timed(events, sb.splatter(spots, rng, a.splat, nsq))


def bub_z(bubbles, x, y, t, z):
    """The surface height z at (x, y) with the bubbles at loop phase t merged in."""
    if isinstance(bubbles, Timed):
        return sb.surface_height(z, bubbles.events, bubbles.splat, x, y, t * a.loop_s, a.loop_s)
    for b_ in bubbles:
        hb = bubble_h(b_, x, y, t)
        if hb > 0:
            z = smax(z, hb, a.neck * S)
    return z


ANIM = []  # (object, rebuild(t) -> a fresh object of the same sheet at phase t): swapped in per frame
DROPS = []  # (sheet object, its Timed bubbles): the blobs in the air are drawn over it each frame
_drop_objs = []


def tear_values(me, bubbles, t):
    if not isinstance(bubbles, Timed):
        return [0.0] * len(me.vertices)
    return [sb.tear_at(bubbles.events, v.co.x, v.co.y, t * a.loop_s, a.loop_s) for v in me.vertices]


def place_drops(t):
    """Draw every blob in the air at loop phase t as a small ball of ooze, lit like its sheet."""
    while _drop_objs:
        o = _drop_objs.pop()
        bpy.data.objects.remove(o)
    if not hasattr(place_drops, "mesh"):
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
        me = bpy.data.meshes.new("sludge_drop"); bm.to_mesh(me); bm.free(); me.materials.append(OOZE)
        for p_ in me.polygons:
            p_.use_smooth = True
        place_drops.mesh = me
    n = 0
    for surf, bubs in DROPS:
        time = t * a.loop_s
        for x, y, z, r in sb.drops_in_air(bubs.events, time, a.loop_s):
            base = sb.surface_height(0.0, bubs.events, bubs.splat, x, y, time, a.loop_s)
            o = bpy.data.objects.new("sludge_drop_%d" % n, place_drops.mesh); n += 1
            sc.collection.objects.link(o)
            o.location = surf.location + Vector((x, y, base + z + 0.6 * r))
            o.scale = (r, r, 1.15 * r)
            for tag in ("sludge_unlit_", "sludge_pinged_"):
                col_ = bpy.data.collections.get(tag + surf.name)
                if col_:
                    col_.objects.link(o)
                    if tag == "sludge_unlit_":
                        for item in col_.collection_objects:  # everything in it is kept off this glow
                            item.light_linking.link_state = "EXCLUDE"
            _drop_objs.append(o)
    return n


def ooze_sheet(name, rfn, zs, bubbles, t, rng, rings=64, segs=200):
    """The ooze: one sheet filling the whole hole (a little past it, tucked under the stone), with a slow swell, a
    meniscus climbing the broken edge, and the bubbles merged in with soft fillets."""
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), 0))
    tw = 2 * math.pi * t
    bm = bmesh.new()
    c = bm.verts.new((0, 0, 0))
    grid = []
    for k in range(1, rings + 1):
        f = (k / rings) ** 0.85
        grid.append([bm.verts.new((math.cos(2 * math.pi * q / segs) * rfn(2 * math.pi * q / segs) * 1.01 * f,
                                   math.sin(2 * math.pi * q / segs) * rfn(2 * math.pi * q / segs) * 1.01 * f, 0)) for q in range(segs)])
    for q in range(segs):
        bm.faces.new((c, grid[0][q], grid[0][(q + 1) % segs]))
    for k in range(rings - 1):
        for q in range(segs):
            bm.faces.new((grid[k][q], grid[k + 1][q], grid[k + 1][(q + 1) % segs], grid[k][(q + 1) % segs]))
    for v in bm.verts:
        x, y = v.co.x, v.co.y
        rr = math.hypot(x, y) / max(rfn(math.atan2(y, x)), 1e-6)  # 0 at the middle, ~1 at the broken edge
        # slow swell drifting round a loop (seamless: the noise walks a circle in its third axis)
        z = a.swell * S * noise.noise(Vector((x * 2.2 / S, y * 2.2 / S, 0)) + off + Vector((0.4 * math.cos(tw), 0.4 * math.sin(tw), 0)))
        z += 0.008 * S * max(0.0, (rr - 0.9) / 0.1) ** 2  # meniscus up the stone, still below its top
        v.co.z = bub_z(bubbles, x, y, t, z)
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(OOZE)
    me.attributes.new("tear", "FLOAT", "POINT").data.foreach_set("value", tear_values(me, bubbles, t))
    ed = me.attributes.new("edge", "FLOAT", "POINT")  # 0 in the middle, 1 at the stone: the ooze darkens there
    ed.data.foreach_set("value", [min(1.0, math.hypot(v.co.x, v.co.y) / max(rfn(math.atan2(v.co.y, v.co.x)), 1e-6))
                                  for v in me.vertices])
    for p_ in me.polygons:
        p_.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.location = (0, 0, zs)
    return o


def meshy_rim(k, slab, cx, cy, hw, top):
    """The Meshy broken tile in place of the slab on (cx, cy): squared to the grid, scaled to the tile, its outer band at
    the tile's height. Returns the pool's edge (where the basin rises out of the ooze, per angle) pulled in a little for
    the bubbles, the ooze sheet's radius (a little past the edge, tucked under the stone) and the ooze's height."""
    from mathutils import Matrix
    from mathutils.bvhtree import BVHTree
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=a.rim_glb)
    new = [o for o in bpy.data.objects if o not in before]
    m = next(o for o in new if o.type == "MESH")
    m.data.transform(m.matrix_world); m.parent = None; m.matrix_world = Matrix()
    for o in new:
        if o is not m:
            bpy.data.objects.remove(o)
    m.name = "sludge_rim_%d" % k
    me = m.data
    n = len(me.vertices)
    P = np.empty(n * 3); me.vertices.foreach_get("co", P); P = P.reshape(n, 3)
    P[:, :2] -= (P[:, :2].min(0) + P[:, :2].max(0)) / 2

    def rot(d):
        r_ = math.radians(d)
        return np.array([[math.cos(r_), -math.sin(r_)], [math.sin(r_), math.cos(r_)]])
    # square it to the grid: the turn with the smallest bounding box
    best = min(range(0, 90), key=lambda d: float(np.prod(np.ptp(P[:, :2] @ rot(d), 0))))
    P[:, :2] = P[:, :2] @ rot(best + a.yaw)
    P[:, :2] -= (P[:, :2].min(0) + P[:, :2].max(0)) / 2
    kk = 2 * hw * a.fit / max(np.ptp(P[:, 0]), np.ptp(P[:, 1]))
    P *= kk
    edge = np.maximum(np.abs(P[:, 0]), np.abs(P[:, 1])) > 0.8 * hw
    rimtop = np.percentile(P[edge, 2], 90)
    P[:, 2] += top - rimtop
    P[:, 0] += cx; P[:, 1] += cy
    me.vertices.foreach_set("co", P.ravel()); me.update()
    slab.hide_render = True; slab.hide_viewport = True
    tint_meshy(me.materials)
    bvh = BVHTree.FromPolygons([tuple(v) for v in P], [tuple(p_.vertices) for p_ in me.polygons])
    return finish_rim(k, bvh, cx, cy, hw, top, best, kk)


def tint_meshy(mats):
    """Meshy paint darkened as the set darkens its own tiles (stage.py, TILE_VAL / TILE_SAT), with a chalky grain."""
    for mt in mats:
        nt = mt.node_tree
        bsdf = next((nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED"), None)
        if bsdf and bsdf.inputs["Base Color"].links:
            src = bsdf.inputs["Base Color"].links[0].from_socket
            hsv = nt.nodes.new("ShaderNodeHueSaturation")
            hsv.inputs["Saturation"].default_value = 0.8; hsv.inputs["Value"].default_value = a.rim_val
            nt.links.new(src, hsv.inputs["Color"]); nt.links.new(hsv.outputs["Color"], bsdf.inputs["Base Color"])
        if bsdf and a.rim_bump:  # chalky plaster grain over Meshy's smooth paint
            tc_ = nt.nodes.new("ShaderNodeTexCoord"); nz_ = nt.nodes.new("ShaderNodeTexNoise")
            nz_.inputs["Scale"].default_value = 60 / S; nz_.inputs["Detail"].default_value = 6
            nt.links.new(tc_.outputs["Object"], nz_.inputs["Vector"])
            bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = a.rim_bump
            bp.inputs["Distance"].default_value = 0.004 * S
            nt.links.new(nz_.outputs["Fac"], bp.inputs["Height"])
            if bsdf.inputs["Normal"].links:
                nt.links.new(bsdf.inputs["Normal"].links[0].from_socket, bp.inputs["Normal"])
            nt.links.new(bp.outputs["Normal"], bsdf.inputs["Normal"])
            for l_ in list(bsdf.inputs["Roughness"].links):
                nt.links.remove(l_)
            bsdf.inputs["Roughness"].default_value = 0.85


def finish_rim(k, bvh, cx, cy, hw, top, best, kk):
    """The Meshy rim's pool: its floor, the ooze height and the edge per angle (see meshy_rim)."""

    def hz(x, y):
        hit = bvh.ray_cast(Vector((x, y, top + H)), Vector((0, 0, -1)))
        return hit[0].z if hit[0] is not None else None
    mid = [hz(cx + r * math.cos(t), cy + r * math.sin(t)) for r in (0, 0.05 * S, 0.1 * S) for t in np.linspace(0, 6.28, 12)]
    mid = [z for z in mid if z is not None]
    floor = float(np.median(mid))
    zs = floor + a.level * (top - floor)
    NA = 360
    er = np.zeros(NA)
    for q in range(NA):
        t = 2 * math.pi * q / NA
        r = 0.05 * S
        while r < box_r(t, hw):
            z = hz(cx + r * math.cos(t), cy + r * math.sin(t))
            if z is not None and z > zs + 0.002 * S:
                break
            r += 0.004 * S
        er[q] = min(r, box_r(t, hw) - 0.08 * S)  # never out onto the whole stone round it
    er = np.convolve(np.r_[er[-3:], er, er[:3]], np.ones(7) / 7, mode="valid")
    print("CHECK rim %d turn %d k %.3f floor %.4f top %.4f ooze %.4f edge %.2f-%.2fS" % (
        k, best, kk, floor, top, zs, er.min() / S, er.max() / S), flush=True)

    def redge(t):
        f = (t % (2 * math.pi)) / (2 * math.pi) * NA
        q = int(f) % NA
        return er[q] * (1 - (f - int(f))) + er[(q + 1) % NA] * (f - int(f))
    return (lambda t: redge(t) * 0.92), (lambda t: redge(t) + 0.03 * S), zs


slabs = objs["slabs"]
n_ = 5
SLAB_TOP = max((s.matrix_world @ Vector(c)).z for s in slabs for c in s.bound_box) - 0.01 * H
OOZE, BROKEN = ooze_mat(), broken_mat()


# ---------- ponds: touching sludge squares as one pool (Wesley 2026-11-24) ----------
def sq_center(i, j):
    return ((i - (n_ - 1) / 2) * S, (j - (n_ - 1) / 2) * S)


def stone_mat():
    """Code shards' stone (only until the Meshy kit exists): the set's slate grey, chalky, lighter on the edges."""
    m, nt, b = nodes("sludge_stone")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 18 / S; nz.inputs["Detail"].default_value = 6
    link(nt, geo.outputs["Position"], nz.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.06, 0.06, 0.06, 1); mix.inputs[7].default_value = (0.12, 0.12, 0.115, 1)
    link(nt, nz.outputs["Fac"], mix.inputs["Factor"])
    edge = nt.nodes.new("ShaderNodeMapRange"); edge.inputs["From Min"].default_value = 0.45; edge.inputs["From Max"].default_value = 0.6
    link(nt, geo.outputs["Pointiness"], edge.inputs["Value"])
    mix2 = nt.nodes.new("ShaderNodeMix"); mix2.data_type = "RGBA"
    link(nt, mix.outputs[2], mix2.inputs[6]); mix2.inputs[7].default_value = (0.17, 0.17, 0.16, 1)
    link(nt, edge.outputs["Result"], mix2.inputs["Factor"])
    link(nt, mix2.outputs[2], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.3
    nz2 = nt.nodes.new("ShaderNodeTexNoise"); nz2.inputs["Scale"].default_value = 60 / S
    link(nt, geo.outputs["Position"], nz2.inputs["Vector"]); link(nt, nz2.outputs["Fac"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], b.inputs["Normal"])
    return m


def code_shard(name, rng):
    """A chunky angular broken slab, about 1 long (x), 0.6 wide (y), 0.3 thick, bottom at z=0, beveled a little."""
    n = rng.randint(5, 7)
    pts = []
    for q in range(n):
        t = 2 * math.pi * (q + rng.uniform(-0.25, 0.25)) / n
        r = rng.uniform(0.8, 1.05)
        pts.append((0.5 * r * math.cos(t), 0.3 * r * math.sin(t)))
    th = rng.uniform(0.3, 0.42)
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, 0)) for x, y in pts]
    hi = [bm.verts.new((x * 0.96, y * 0.96, th * rng.uniform(0.9, 1.1))) for x, y in pts]
    for q in range(n):
        bm.faces.new((lo[q], lo[(q + 1) % n], hi[(q + 1) % n], hi[q]))
    bm.faces.new(hi); bm.faces.new(lo[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(STONE)
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    bv = o.modifiers.new("chip", "BEVEL"); bv.width = 0.01; bv.segments = 1; bv.limit_method = "ANGLE"
    return o


KIT = []


def load_kit():
    """The Meshy shards: welded, split into loose parts, the 7 biggest kept, each laid long side on x, centred, its
    bottom at z=0, scaled to length 1. Hidden: copies go round the ponds."""
    if KIT or not a.kit_glb:
        return KIT
    from mathutils import Matrix
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=a.kit_glb)
    new = [o for o in bpy.data.objects if o not in before]
    m = next(o for o in new if o.type == "MESH")
    m.data.transform(m.matrix_world); m.parent = None; m.matrix_world = Matrix()
    for o in new:
        if o is not m:
            bpy.data.objects.remove(o)
    bm = bmesh.new(); bm.from_mesh(m.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    bm.to_mesh(m.data); bm.free()
    tint_meshy(m.data.materials)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = m; m.select_set(True)
    bpy.ops.mesh.separate(type="LOOSE")
    parts = sorted([o for o in bpy.context.selected_objects], key=lambda o: -len(o.data.vertices))
    for o in parts[7:]:
        bpy.data.objects.remove(o)
    for q, o in enumerate(parts[:7]):
        me = o.data
        P = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", P); P = P.reshape(-1, 3)
        P[:, :2] -= P[:, :2].mean(0)
        w, V = np.linalg.eigh(np.cov(P[:, :2].T))
        ax = V[:, np.argmax(w)]
        ang = math.atan2(ax[1], ax[0])
        R = np.array([[math.cos(-ang), -math.sin(-ang)], [math.sin(-ang), math.cos(-ang)]])
        P[:, :2] = P[:, :2] @ R.T
        P[:, :2] -= (P[:, :2].min(0) + P[:, :2].max(0)) / 2
        P[:, 2] -= P[:, 2].min()
        P /= np.ptp(P[:, 0])
        me.vertices.foreach_set("co", P.ravel()); me.update()
        o.name = "sludge_kit_%d" % q
        o.hide_render = True; o.hide_viewport = True
        KIT.append(o)
    print("CHECK kit pieces", [round(float(np.ptp(np.array([v.co.y for v in o.data.vertices]))), 2) for o in KIT], flush=True)
    return KIT


def place_stone(name, slot, top, rng):
    """One rim stone on its slot: long side along the edge, a third of it over the ooze, bedded into the slab and
    tipped 10-25 degrees into the pool about its outer bottom edge."""
    from mathutils import Matrix
    x, y, along, size, (ox, oy) = slot
    kit = load_kit()
    if kit:
        o = kit[rng.randrange(len(kit))].copy(); o.data = o.data.copy(); sc.collection.objects.link(o)
        o.hide_render = False; o.hide_viewport = False; o.name = name
    else:
        o = code_shard(name, rng)
    me = o.data
    me.transform(Matrix.Diagonal((size, size * rng.uniform(0.85, 1.1), size * rng.uniform(0.9, 1.15) * a.kit_thick, 1)))
    ys = [v.co.y for v in me.vertices]; zs_ = [v.co.z for v in me.vertices]
    width, thick = max(ys) - min(ys), max(zs_) - min(zs_)
    if rng.random() < 0.5:
        me.transform(Matrix.Rotation(math.pi, 4, "Z"))  # either face toward the pool
    tilt = math.radians(rng.uniform(a.kit_tilt * 0.4, a.kit_tilt))
    sink = thick * rng.uniform(a.kit_sink * 0.6, a.kit_sink)
    out = Vector((ox, oy, 0))
    tang = Vector((-oy, ox, 0))
    pivot = Vector((x, y, top - sink)) + out * (width / 2)
    # local: x along the edge, y across (+y outward), z up; then tip the inward side down about the outer edge
    rot = Matrix.Rotation(math.atan2(oy, ox) - math.pi / 2, 4, "Z")
    base = Matrix.Translation(Vector((x, y, top - sink))) @ rot
    T = Matrix.Translation(pivot) @ Matrix.Rotation(tilt, 4, tang) @ Matrix.Translation(-pivot)
    probe = base @ Vector((0, -width / 2, 0))
    if (T @ probe).z > probe.z:
        T = Matrix.Translation(pivot) @ Matrix.Rotation(-tilt, 4, tang) @ Matrix.Translation(-pivot)
    o.matrix_world = T @ base @ Matrix.Rotation(rng.uniform(-a.kit_turn, a.kit_turn), 4, "Z")
    return o


def pond_noise(x, y):
    # broad bites plus a finer wobble, so the edge reads as broken floor, not a rounded box
    return noise.noise(Vector((x * 1.2 / S, y * 1.2 / S, 9.1))) + 0.4 * noise.noise(Vector((x * 3.0 / S, y * 3.0 / S, 4.2)))


def build_pond(k, comp):
    """Touching sludge squares as one pool: one edge round the lot (straight across shared edges, inset on free
    sides), every member slab cut by it, the moss in its joints taken out, one ooze sheet over it all, broken stones
    round the edge, a green glow over each square."""
    rng = random.Random(2000 + 31 * comp[0][0] + 7 * comp[0][1])
    sdf = sp.pond_sdf(comp, S, margin=a.margin, round_=a.round, fillet=a.fillet, ragged=a.ragged, noise=pond_noise,
                      center=sq_center)
    cs = [sq_center(i, j) for i, j in comp]
    box = (min(c[0] for c in cs) - S / 2, min(c[1] for c in cs) - S / 2, max(c[0] for c in cs) + S / 2, max(c[1] for c in cs) + S / 2)
    loops = sp.outline(sdf, box, 0.01 * S)
    tops, zbot = [], 1e9
    members = []
    for i, j in comp:
        cx, cy = sq_center(i, j)
        slab = next(s_ for s_ in slabs if s_.name == "Slab_%d_%d" % (i, j))
        slab.data = slab.data.copy()
        wv = [slab.matrix_world @ v.co for v in slab.data.vertices]
        near = sorted(p_.z for p_ in wv if abs(p_.x - cx) < 0.3 * S and abs(p_.y - cy) < 0.3 * S)
        tops.append(near[int(len(near) * 0.9)])
        zbot = min(zbot, min(p_.z for p_ in wv))
        members.append(slab)
    top = sorted(tops)[len(tops) // 2]
    zs = top - a.depth * H
    outer = [L for L in loops if sp._area(L) > 0]
    print("CHECK pond %d squares %d loops %d (outer %d, %d pts) top %.4f ooze %.4f" % (
        k, len(comp), len(loops), len(outer), sum(len(L) for L in loops), top, zs), flush=True)
    # the hole through every member slab
    for q, L in enumerate(outer):
        cut = prism("sludge_pcut_%d_%d" % (k, q), L, zbot - 0.1 * H, top + 0.3 * H)
        for slab in members:
            mod = slab.modifiers.new("pond%d" % q, "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cut
            mod.solver = a.solver; mod.use_hole_tolerant = True; mod.material_mode = "TRANSFER"
    # the moss in the joints inside the pond would poke through the ooze
    for mo in [o for o in sc.objects if o.type == "MESH" and o.name in ("Moss", "GroutMoss")]:
        bm = bmesh.new(); bm.from_mesh(mo.data)
        mw = mo.matrix_world
        kill = [v for v in bm.verts if sdf(*(mw @ v.co).xy) < 0.02 * S]
        if kill:
            bmesh.ops.delete(bm, geom=kill, context="VERTS")
            bm.to_mesh(mo.data)
        print("CHECK pond %d moss %s cut %d verts" % (k, mo.name, len(kill)), flush=True)
        bm.free()
    # a dark basin floor below the ooze (kept out of the glow, or it lights up through the ooze)
    floors = []
    for q, L in enumerate(outer):
        fl = prism("sludge_pfloor_%d_%d" % (k, q), L, zs - 0.06 * S, zs - 0.05 * S)
        fl.hide_render = False; fl.hide_viewport = False
        fl.data.materials[0] = FLOOR
        floors.append(fl)
    # bubbles where they fit, about --bubbles per square
    bubs = []
    want = max(1, a.bubbles * len(comp))
    for q in range(want * 30):
        if len(bubs) >= want:
            break
        r = (rng.uniform(0.1, 0.14) if len(bubs) < 2 * len(comp) else rng.uniform(0.04, 0.09)) * S * a.bub_scale
        x, y = rng.uniform(box[0], box[2]), rng.uniform(box[1], box[3])
        if sdf(x, y) > -r * 1.1:
            continue
        if any(math.hypot(x - b_[0], y - b_[1]) < (r + b_[2]) * 0.8 for b_ in bubs):
            continue
        bubs.append((x, y, r, rng.uniform(0, 1), rng.uniform(0, 6.28), rng.uniform(1.0, 1.12), rng.uniform(-0.3, 0.3)))
    if a.timed:
        bubs = timed_bubbles(rng, cs, lambda x, y: -sdf(x, y), len(comp))
    seed = rng.randrange(1 << 30)
    surf = pond_sheet("sludge_pond_%d" % k, sdf, box, bubs, a.t, random.Random(seed))
    if a.timed:
        DROPS.append((surf, bubs))
    ANIM.append((surf, lambda t, k=k, sdf=sdf, box=box, bubs=bubs, seed=seed:
                 pond_sheet("sludge_pond_%d_f" % k, sdf, box, bubs, t, random.Random(seed))))
    surf.location = (0, 0, zs)
    sub = surf.modifiers.new("smooth", "SUBSURF"); sub.levels = 0; sub.render_levels = 1
    # the rim stones
    slots = sp.rim_slots(loops, sdf, S, rng, sizes=(a.stone * 1.6, a.stone))
    for q, slot in enumerate(slots):
        place_stone("sludge_pstone_%d_%d" % (k, q), slot, top, rng)
    print("CHECK pond %d bubbles %d stones %d" % (k, len(bubs.events) if a.timed else len(bubs), len(slots)), flush=True)
    for q, (cx, cy) in enumerate(cs):
        pool_lights("%d_%d" % (k, q), surf, cx, cy, zs, ping=(q == 0), unlit=floors)
        pools.append((cx, cy))
    groups.append(box)


def pond_sheet(name, sdf, box, bubbles, t, rng, step=0.012):
    """The pond's ooze: a grid sheet over the pond in world xy (z from the object's location), reaching a little past
    the edge under the stone, with the same swell, meniscus, bubbles and edge darkening as the single pool."""
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), 0))
    tw = 2 * math.pi * t
    h = step * S
    tuck = 0.03 * S
    x0, y0 = box[0] - tuck, box[1] - tuck
    nx, ny = int((box[2] - box[0] + 2 * tuck) / h) + 2, int((box[3] - box[1] + 2 * tuck) / h) + 2
    bm = bmesh.new()
    vid = {}
    dist = {}
    for a_ in range(nx):
        for b_ in range(ny):
            x, y = x0 + a_ * h, y0 + b_ * h
            d = sdf(x, y)
            if d < tuck:
                vid[(a_, b_)] = bm.verts.new((x, y, 0))
                dist[(a_, b_)] = d
    for a_ in range(nx - 1):
        for b_ in range(ny - 1):
            c = [(a_, b_), (a_ + 1, b_), (a_ + 1, b_ + 1), (a_, b_ + 1)]
            if all(q in vid for q in c):
                bm.faces.new([vid[q] for q in c])
    edge = []
    for key, v in vid.items():
        x, y = v.co.x, v.co.y
        d = dist[key]
        z = a.swell * S * noise.noise(Vector((x * 2.2 / S, y * 2.2 / S, 0)) + off + Vector((0.4 * math.cos(tw), 0.4 * math.sin(tw), 0)))
        z += 0.008 * S * min(1.0, max(0.0, (d + 0.06 * S) / (0.06 * S))) ** 2  # meniscus up the stone
        v.co.z = bub_z(bubbles, x, y, t, z)
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(OOZE)
    me.attributes.new("tear", "FLOAT", "POINT").data.foreach_set("value", tear_values(me, bubbles, t))
    ed = me.attributes.new("edge", "FLOAT", "POINT")
    ed.data.foreach_set("value", [min(1.0, max(0.0, 1 + sdf(v.co.x, v.co.y) / (0.4 * S))) for v in me.vertices])
    for p_ in me.polygons:
        p_.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    return o


def pool_lights(tag, surf, cx, cy, zs, ping=True, unlit=()):
    """The green glow over one square (kept off the ooze itself) and, with --ping, the small hard highlight on it."""
    L = bpy.data.lights.new("sludge_glow_%s" % tag, "POINT"); L.energy = a.light; L.color = (0.45, 1.0, 0.15)
    L.shadow_soft_size = 0.3 * S; L.use_shadow = False
    lo = bpy.data.objects.new("sludge_glow_%s" % tag, L); sc.collection.objects.link(lo); lo.location = (cx, cy, zs + 0.06 * H)
    ex = bpy.data.collections.get("sludge_unlit_%s" % surf.name) or bpy.data.collections.new("sludge_unlit_%s" % surf.name)
    for o_ in (surf, *unlit):
        if o_.name not in ex.objects:
            ex.objects.link(o_)
    lo.light_linking.receiver_collection = ex
    for item in ex.collection_objects:
        item.light_linking.link_state = "EXCLUDE"
    if a.ping and ping:
        v_ = (cam.matrix_world.translation - Vector((cx, cy, zs))).normalized()
        A_ = bpy.data.lights.new("sludge_ping_%s" % tag, "AREA"); A_.energy = a.ping; A_.size = 0.03 * S
        ao = bpy.data.objects.new("sludge_ping_%s" % tag, A_); sc.collection.objects.link(ao)
        ao.location = Vector((cx, cy, zs)) + Vector((-v_.x, -v_.y, v_.z)) * 3 * S + Vector((0.15 * S, 0.1 * S, 0))
        ao.rotation_euler = (Vector((cx, cy, zs)) - ao.location).to_track_quat("-Z", "Y").to_euler()
        inc = bpy.data.collections.get("sludge_pinged_%s" % surf.name) or bpy.data.collections.new("sludge_pinged_%s" % surf.name)
        if surf.name not in inc.objects:
            inc.objects.link(surf)
        ao.light_linking.receiver_collection = inc

STONE = stone_mat()
FLOOR, _nt, _b = nodes("sludge_floor"); _b.inputs["Base Color"].default_value = (0.01, 0.02, 0.008, 1); _b.inputs["Roughness"].default_value = 1
pools = []
groups = []  # (x0, y0, x1, y1) world box of each pool or pond, for the crops
SQS = [tuple(int(v) for v in sq_.split(",")) for sq_ in a.squares.split(";") if sq_.strip()]
COMPS = sp.components(SQS)
LONE = [c[0] for c in COMPS if len(c) == 1]
print("CHECK sludge groups", COMPS, flush=True)
for k, (i, j) in enumerate(LONE):
    rng = random.Random(1000 + 31 * i + 7 * j)
    cx, cy = (i - (n_ - 1) / 2) * S, (j - (n_ - 1) / 2) * S
    slab = next(s for s in slabs if s.name == "Slab_%d_%d" % (i, j))
    slab.data = slab.data.copy()  # the tile mesh is shared by every slab
    wv = [slab.matrix_world @ v.co for v in slab.data.vertices]
    hw = min(max(abs(p_.x - cx) for p_ in wv), max(abs(p_.y - cy) for p_ in wv))  # the tile's half-width
    near = sorted(p_.z for p_ in wv if abs(p_.x - cx) < 0.3 * S and abs(p_.y - cy) < 0.3 * S)
    top = near[int(len(near) * 0.9)]  # its face near the middle (some tiles have one tall bump)
    zbot = min(p_.z for p_ in wv)
    zs = top - a.depth * H
    if a.rim_glb:
        rin, rooze_m, zs = meshy_rim(k, slab, cx, cy, hw, top)
        kept, rout = [], rin
    else:
        # The broken zone: the pool's edge (rin) and, round it, the line where the slab cracked away (rout), kept inside
        # the tile so a band of whole stone always frames the pool.
        rb = radius_fn(rng)
        rim = a.rim * S

        def rout(t, rb=rb, hw=hw):
            return min(rb(t) * a.size * S + rim, box_r(t, hw) - 0.06 * S)

        def rin(t, rout=rout):
            return rout(t) - rim * (0.75 + 0.5 * (0.5 + 0.5 * noise.noise(Vector((math.cos(t) * 2, math.sin(t) * 2, k + 7.3)))))
        print("CHECK pool %d top %.4f hw %.3fS rin %.2f-%.2fS rout %.2f-%.2fS" % (
            k, top, hw / S, min(rin(q / 30 * 6.28) for q in range(30)) / S, max(rin(q / 30 * 6.28) for q in range(30)) / S,
            min(rout(q / 30 * 6.28) for q in range(30)) / S, max(rout(q / 30 * 6.28) for q in range(30)) / S))
        # Rim pieces: the cracked band split into wedges along jagged cracks, each the real tile cut out by a prism, then
        # tipped into the pool about its own outer bottom edge, so it pulls away from the wall and never into a neighbour.
        nw = rng.randint(5, 7)
        cuts = sorted((q + rng.uniform(-0.3, 0.3)) / nw * 2 * math.pi for q in range(nw))
        cuts.append(cuts[0] + 2 * math.pi)
        parts = []; kept = []
        for w in range(nw):
            if rng.random() < a.gone:  # this piece fell in and sank
                continue
            gap = 0.012 * S
            t0, t1 = cuts[w], cuts[w + 1]
            steps = max(4, int((t1 - t0) / (2 * math.pi) * 96))
            def crack(tc, side):  # a jagged crack line from the outer to the inner edge at angle tc
                pts_ = []
                for m in range(4):
                    f = m / 3
                    jt = 0 if m in (0, 3) else rng.uniform(-0.06, 0.06)
                    tt = tc + jt + side * gap / max(rout(tc), 0.1)
                    rr_ = rout(tt) * (1 - f) + rin(tt) * f
                    pts_.append((math.cos(tt) * rr_, math.sin(tt) * rr_))
                return pts_
            a0 = t0 + gap / rout(t0); a1 = t1 - gap / rout(t1)
            outer = [(math.cos(t0 + (t1 - t0) * q / steps) * rout(t0 + (t1 - t0) * q / steps),
                      math.sin(t0 + (t1 - t0) * q / steps) * rout(t0 + (t1 - t0) * q / steps)) for q in range(1, steps)]
            inner = [(math.cos(t0 + (t1 - t0) * q / steps) * rin(t0 + (t1 - t0) * q / steps),
                      math.sin(t0 + (t1 - t0) * q / steps) * rin(t0 + (t1 - t0) * q / steps)) for q in range(steps - 1, 0, -1)]
            c0 = crack(t0, +1); c1 = crack(t1, -1)
            poly = [c0[0]] + outer + c1[::1][:1] + c1[1:] + inner + c0[::-1][:-1]
            poly = [(cx + x, cy + y) for x, y in poly]
            pr = prism("sludge_wcut_%d_%d" % (k, w), poly, zbot - 0.1 * H, top + 0.3 * H)
            wo = slab.copy(); wo.data = slab.data.copy(); wo.modifiers.clear(); sc.collection.objects.link(wo)
            m_ = wo.modifiers.new("piece", "BOOLEAN"); m_.operation = "INTERSECT"; m_.object = pr
            m_.solver = "EXACT"; m_.material_mode = "TRANSFER"
            piece = bake(wo); bpy.data.objects.remove(wo)
            piece.name = "sludge_piece_%d_%d" % (k, w)
            print("CHECK piece %d.%d verts %d" % (k, w, len(piece.data.vertices)))
            bv = piece.modifiers.new("soft", "BEVEL"); bv.width = 0.012 * S; bv.segments = 3; bv.limit_method = "ANGLE"
            bv.angle_limit = math.radians(40); bv.harden_normals = False
            # tip it. Most pieces heave: the inner (pool) edge pushed up so its broken face shows above the ooze, the
            # piece turning on its outer top edge and nudged inward to clear the wall. The rest slump into the pool,
            # turning on the outer bottom edge.
            from mathutils import Matrix
            heave = rng.random() < a.heave
            zax = top if heave else zbot
            pa = Vector((cx + c0[0][0], cy + c0[0][1], zax)); pb = Vector((cx + c1[0][0], cy + c1[0][1], zax))
            ax = (pb - pa).normalized()
            tilt = rng.uniform(a.tilt * 0.6, a.tilt * 1.4)
            mid_in = Vector((cx + inner[len(inner) // 2][0], cy + inner[len(inner) // 2][1], top)) if inner else Vector((cx, cy, top))
            M = Matrix.Translation(pa) @ Matrix.Rotation(tilt, 4, ax) @ Matrix.Translation(-pa)
            if ((M @ mid_in).z > mid_in.z) != heave:
                M = Matrix.Translation(pa) @ Matrix.Rotation(-tilt, 4, ax) @ Matrix.Translation(-pa)
            inward = (Vector((cx, cy, 0)) - Vector(((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, 0))).normalized()
            th_ = top - zbot
            shift = inward * (th_ * math.sin(tilt) + 0.01 * S) if heave else Vector((0, 0, 0))
            M = Matrix.Translation(shift + Vector((0, 0, (-rng.uniform(0, a.drop) * S) if not heave else rng.uniform(-0.01, 0.01) * S))) @ M
            piece.matrix_world = M
            kept.append((t0, t1))
            parts.append(piece)
        # the hole: the whole broken zone out of the slab, straight walls
        cut = prism("sludge_cut_%d" % k, [(cx + math.cos(q / 160 * 6.2832) * rout(q / 160 * 6.2832),
                                           cy + math.sin(q / 160 * 6.2832) * rout(q / 160 * 6.2832)) for q in range(160)],
                    zbot - 0.1 * H, top + 0.3 * H)
        mod = slab.modifiers.new("pool", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.object = cut
        mod.solver = a.solver; mod.use_hole_tolerant = True; mod.material_mode = "TRANSFER"
        dg_ = bpy.context.evaluated_depsgraph_get()
        print("CHECK slab %d verts %d -> %d" % (k, len(slab.data.vertices), len(slab.evaluated_get(dg_).data.vertices)))
    # bubbles: a few big ones near the middle, smaller ones toward the edge, each on its own phase of the loop
    bubs = []
    nb = rng.randint(a.bubbles - 1, a.bubbles + 1)
    for q in range(nb * 8):
        if len(bubs) >= nb:
            break
        r = (rng.uniform(0.1, 0.14) if len(bubs) < 2 else rng.uniform(0.04, 0.09)) * S * a.bub_scale
        tt = rng.uniform(0, 6.28); f_ = math.sqrt(rng.uniform(0, 1))
        lim = rin(tt) - r * 0.9
        if lim <= 0:
            continue
        x, y = math.cos(tt) * lim * f_, math.sin(tt) * lim * f_
        if any(math.hypot(x - b_[0], y - b_[1]) < (r + b_[2]) * 0.8 for b_ in bubs):
            continue
        bubs.append((x, y, r, rng.uniform(0, 1), rng.uniform(0, 6.28), rng.uniform(1.0, 1.12), rng.uniform(-0.3, 0.3)))
    def rooze(t, kept=kept, rin=rin, rout=rout):
        tt = t % (2 * math.pi)
        for t0, t1 in kept:
            for sh in (0, 2 * math.pi):
                if t0 <= tt + sh <= t1:
                    return rin(t) + 0.45 * (rout(t) - rin(t))
        return rout(t)
    if a.rim_glb:
        rooze = rooze_m
    if a.timed:
        bubs = timed_bubbles(rng, [(0.0, 0.0)], lambda x, y: rin(math.atan2(y, x)) - math.hypot(x, y), 1)
    seed = rng.randrange(1 << 30)
    surf = ooze_sheet("sludge_ooze_%d" % k, rooze, zs, bubs, a.t, random.Random(seed))
    if a.timed:
        DROPS.append((surf, bubs))
    ANIM.append((surf, lambda t, k=k, rooze=rooze, zs=zs, bubs=bubs, seed=seed:
                 ooze_sheet("sludge_ooze_%d_f" % k, rooze, zs, bubs, t, random.Random(seed))))
    sub = surf.modifiers.new("smooth", "SUBSURF"); sub.levels = 0; sub.render_levels = 1
    surf.location = (cx, cy, zs)
    # the glow spilling onto the stone round it (in game this is a live additive light on the floor)
    L = bpy.data.lights.new("sludge_glow_%d" % k, "POINT"); L.energy = a.light; L.color = (0.45, 1.0, 0.15)
    L.shadow_soft_size = 0.3 * S; L.use_shadow = False
    lo = bpy.data.objects.new("sludge_glow_%d" % k, L); sc.collection.objects.link(lo); lo.location = (cx, cy, zs + 0.06 * H)
    ex = bpy.data.collections.new("sludge_unlit_%d" % k); ex.objects.link(surf)
    lo.light_linking.receiver_collection = ex
    for item in ex.collection_objects:
        item.light_linking.link_state = "EXCLUDE"
    if a.ping:  # a small hard light where its mirror image in the pool faces the camera: a sharp wet highlight
        v_ = (cam.matrix_world.translation - Vector((cx, cy, zs))).normalized()
        A_ = bpy.data.lights.new("sludge_ping_%d" % k, "AREA"); A_.energy = a.ping; A_.size = 0.03 * S
        ao = bpy.data.objects.new("sludge_ping_%d" % k, A_); sc.collection.objects.link(ao)
        ao.location = Vector((cx, cy, zs)) + Vector((-v_.x, -v_.y, v_.z)) * 3 * S + Vector((0.15 * S, 0.1 * S, 0))
        ao.rotation_euler = (Vector((cx, cy, zs)) - ao.location).to_track_quat("-Z", "Y").to_euler()
        inc = bpy.data.collections.new("sludge_pinged_%d" % k); inc.objects.link(surf)
        ao.light_linking.receiver_collection = inc
    pools.append((cx, cy))
    groups.append((cx - S / 2, cy - S / 2, cx + S / 2, cy + S / 2))
for k, comp in enumerate([c for c in COMPS if len(c) > 1]):
    build_pond(100 + k, comp)
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
import json
boxes = []
for gx0, gy0, gx1, gy1 in groups:
    uv_ = [world_to_camera_view(sc, cam, Vector((x, y, SLAB_TOP))) for x in (gx0 - 0.45 * S, gx1 + 0.45 * S)
           for y in (gy0 - 0.45 * S, gy1 + 0.45 * S)]
    boxes.append([min(q.x for q in uv_), 1 - max(q.y for q in uv_), max(q.x for q in uv_), 1 - min(q.y for q in uv_)])
json.dump({"boxes": boxes}, open(os.path.join(a.out, "pools.json"), "w"))
if a.frames:  # the whole loop, frame by frame: only the ooze sheets change
    json.dump({"frames": a.frames, "fps": a.frames / a.loop_s, "loop_s": a.loop_s}, open(os.path.join(a.out, "anim.json"), "w"))
    for i in range(a.frames):
        for surf, rebuild in ANIM:
            fresh = rebuild(i / a.frames)
            old = surf.data
            surf.data = fresh.data
            bpy.data.objects.remove(fresh)
            bpy.data.meshes.remove(old)
        nd = place_drops(i / a.frames)
        sc.render.filepath = os.path.join(a.out, "frame_%03d.png" % i)
        bpy.ops.render.render(write_still=True)
        print("CHECK frame %d/%d drops %d" % (i + 1, a.frames, nd), flush=True)
    print("SLUDGE STILLS OK frames", a.frames, flush=True)
else:
    print("CHECK drops %d" % place_drops(a.t), flush=True)
    sc.render.filepath = os.path.join(a.out, "sludge-zoom.png" if a.zoom else "sludge.png")
    bpy.ops.render.render(write_still=True)
    print("SLUDGE STILLS OK", sc.render.filepath, flush=True)
