# The gate's meshes for Cycles (Wesley 2026-11-26, look "Middle 1"): the stone arch and the two oak door leaves, from
# gate_geom.py, on the set's own materials so the gate is rendered and baked like the trapdoor and snare (a live,
# browser-lit gate looked "GameCube", as the first eye did). build_gate_cycles.py places it in the set.
#
# build(coll, mats, S, stage) -> {"arch": obj, "leafL": obj, "leafR": obj, "moss": [objs]}
#   mats: {"oak", "iron", "stone", "moss", "vine"}; S: one square in set units. Every mesh is built in square units and
#   scaled by S, about the gate's own origin (the doorway's middle, on the floor, on the wall's middle line): parent
#   the objects to an empty to place and turn it. The leaves' origins sit on their hinges.
import bmesh, bpy, math, random
from mathutils import Matrix, Vector
import gate_geom as gg

ORDER = ("oak", "iron", "stone", "moss", "vine")
GRAIN = 1.6  # oak photo (tex/gate_oak.png, grain up the image) per square unit of board: a plank shows a quarter of its width
VINE_R = 0.5  # vine stem radius, of gate_geom.vines' radii


def box(x0, x1, y0, y1, z0, z1):
    g = bmesh.new()
    bmesh.ops.create_cube(g, size=1)
    bmesh.ops.scale(g, vec=(x1 - x0, y1 - y0, z1 - z0), verts=g.verts)
    bmesh.ops.translate(g, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=g.verts)
    return g


def prism(outline, y0, y1):
    """A flat piece: an xz outline pushed through y0..y1."""
    g = bmesh.new()
    fr = [g.verts.new((x, y0, z)) for x, z in outline]
    bk = [g.verts.new((x, y1, z)) for x, z in outline]
    n = len(outline)
    g.faces.new(fr[::-1]); g.faces.new(bk)
    for k in range(n):
        g.faces.new([fr[k], fr[(k + 1) % n], bk[(k + 1) % n], bk[k]])
    bmesh.ops.recalc_face_normals(g, faces=g.faces)
    return g


def tube(pts, radii, segs=10):
    g = bmesh.new()
    pts = [Vector(p) for p in pts]
    rings = []
    for k, p in enumerate(pts):
        t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        u = t.cross(Vector((0, 1, 0)))
        if u.length < 1e-6:
            u = t.cross(Vector((1, 0, 0)))
        u.normalize(); w = t.cross(u)
        rings.append([g.verts.new(p + radii[k] * (math.cos(2 * math.pi * s / segs) * u + math.sin(2 * math.pi * s / segs) * w))
                      for s in range(segs)])
    for r0, r1 in zip(rings, rings[1:]):
        for s in range(segs):
            g.faces.new([r0[s], r0[(s + 1) % segs], r1[(s + 1) % segs], r1[s]])
    g.faces.new(rings[0][::-1]); g.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(g, faces=g.faces)
    return g


def dome(c, r, rng, flat=1.0, sub=2):
    g = bmesh.new()
    bmesh.ops.create_icosphere(g, subdivisions=sub, radius=r)
    for v in g.verts:
        v.co *= rng.uniform(0.9, 1.1)
    bmesh.ops.scale(g, vec=(1, flat, 1), verts=g.verts)
    bmesh.ops.translate(g, vec=c, verts=g.verts)
    return g


def torus(c, R, r, seg=24, ring=10):
    g = bmesh.new()
    vs = []
    for i in range(seg):
        th = 2 * math.pi * i / seg
        row = []
        for j in range(ring):
            ph = 2 * math.pi * j / ring
            x = (R + r * math.cos(ph)) * math.sin(th); z = -(R + r * math.cos(ph)) * math.cos(th); y = r * math.sin(ph)
            row.append(g.verts.new((c[0] + x, c[1] + y, c[2] + z)))
        vs.append(row)
    for i in range(seg):
        for j in range(ring):
            g.faces.new([vs[i][j], vs[(i + 1) % seg][j], vs[(i + 1) % seg][(j + 1) % ring], vs[i][(j + 1) % ring]])
    return g


_TEX = {}


def oak_height(path):
    """The oak photo's lightness as a height sampler h(u, v) in 0..1 (dark grain and checks low), tiled."""
    if path not in _TEX:
        im = bpy.data.images.load(path, check_existing=True)
        w, h = im.size
        px = [0.0] * (w * h * 4); im.pixels.foreach_get(px)
        lum = [0.3 * px[4 * k] + 0.59 * px[4 * k + 1] + 0.11 * px[4 * k + 2] for k in range(w * h)]
        lo, hi = sorted(lum)[len(lum) // 50], sorted(lum)[-len(lum) // 50]
        _TEX[path] = (w, h, [min(1.0, max(0.0, (l_ - lo) / (hi - lo))) for l_ in lum])
    w, h, lum = _TEX[path]
    return lambda u, v: lum[int((v % 1.0) * (h - 1)) * w + int((u % 1.0) * (w - 1))]


CARVE = 0.006   # grain relief on the plank fronts, square units (dark grain and checks this much lower)
OAK_TEX = None  # set by the builder: the oak photo's path; None: no carving


def _carve(g, u0, v0, t):
    """Cut the plank's front into a fine grid and press the photo's dark grain into it: real relief that throws
    shadows (bump shading alone read as painted lines). Front = the face at y = -t/2 (toward the camera)."""
    if OAK_TEX is None:
        return
    hgt = oak_height(OAK_TEX)
    xs = [v.co.x for v in g.verts]; zs = [v.co.z for v in g.verts]
    geom = g.verts[:] + g.edges[:] + g.faces[:]
    x = min(xs) + 0.003
    while x < max(xs) - 0.003:
        r = bmesh.ops.bisect_plane(g, geom=geom, plane_co=(x, 0, 0), plane_no=(1, 0, 0)); geom = g.verts[:] + g.edges[:] + g.faces[:]
        x += 0.003
    z = min(zs) + 0.006
    while z < max(zs) - 0.004:
        bmesh.ops.bisect_plane(g, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1)); geom = g.verts[:] + g.edges[:] + g.faces[:]
        z += 0.006
    g.normal_update()
    front = min(v.co.y for v in g.verts)
    for v in g.verts:
        if abs(v.co.y - front) < 1e-4 and all(f.normal.y < -0.9 for f in v.link_faces):
            v.co.y += CARVE * (1.0 - hgt(u0 + v.co.x * GRAIN, v0 + v.co.z * GRAIN))


class Part:
    def __init__(self, name, mats):
        self.name, self.mats, self.bm = name, mats, bmesh.new()

    def add(self, g, kind, smooth=True, plank=None):
        """plank=(u0, v0, tone): wood grain UVs for this piece, the grain running up the board (z), from its own
        strip u0 of the oak photo (v0 0: a door-high board spans the photo's height without a wrap), and a per-board tone in the "tone" UV layer (u: brightness, v: hue)."""
        k = ORDER.index(kind)
        for f in g.faces:
            f.material_index = k
            f.smooth = smooth
        uv = g.loops.layers.uv.get("UVMap") or g.loops.layers.uv.new("UVMap")
        tn = g.loops.layers.uv.get("tone") or g.loops.layers.uv.new("tone")
        u0, v0, tone = plank if plank else (0.0, 0.0, (0.5, 0.5))
        for f in g.faces:
            n = f.normal
            for lp in f.loops:
                c = lp.vert.co
                across = c.y if abs(n.x) > max(abs(n.y), abs(n.z)) else c.x  # side faces: across the board's depth
                along = c.x if abs(n.z) > max(abs(n.x), abs(n.y)) else c.z    # top/bottom end grain: anything
                lp[uv].uv = (u0 + across * GRAIN, v0 + along * GRAIN)  # image x across the board, y up it
                lp[tn].uv = tone
        me = bpy.data.meshes.new("tmp"); g.to_mesh(me); g.free()
        self.bm.from_mesh(me); bpy.data.meshes.remove(me)

    def obj(self, coll, S, origin=(0, 0, 0)):
        for v in self.bm.verts:
            v.co = (v.co - Vector(origin)) * S
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me); self.bm.free()
        for kind in ORDER:
            me.materials.append(self.mats[kind])
        o = bpy.data.objects.new(self.name, me); coll.objects.link(o)
        o.location = Vector(origin) * S
        return o


def _arch(mats, coll, S, rng):
    arch = Part("gate_arch", mats)
    zc, R = gg.arch_circle()
    for v in gg.voussoirs():
        d0, d1 = -v["d"] / 2 + v["dy"], v["d"] / 2 + v["dy"]
        ring_ = [gg.arch_point(ang, rr) for ang in (v["a0"], v["a1"]) for rr in (R, R + v["t"])]
        g = prism([ring_[0], ring_[2], ring_[3], ring_[1]], d0, d1)
        bmesh.ops.subdivide_edges(g, edges=g.edges[:], cuts=3, use_grid_fill=True)
        for vv in g.verts:  # hand-cut: each stone a little lumpy, not a clean wedge
            vv.co += Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))) * 0.0015
        bmesh.ops.bevel(g, geom=[e for e in g.edges if e.is_boundary or len(e.link_faces) == 2 and
                                 e.link_faces[0].normal.angle(e.link_faces[1].normal, 0) > 0.6],
                        offset=0.005, segments=3, affect="EDGES", clamp_overlap=True)
        arch.add(g, "stone", smooth=True)
    return arch.obj(coll, S)


def _arch_moss(mats, coll, S, rng, stage):
    """A soft cushion of the set's moss on top of the arch (lighter than the first drafts, nothing hanging): clumps
    packed along the top, thinning toward the springs, a few tumbling just over the front edge, with the set's fuzz."""
    zc, R = gg.arch_circle()
    amax = math.asin(gg.HALF / R)
    pts = []
    for k in range(150):
        u = rng.uniform(-1, 1)
        if rng.random() < abs(u) ** 2 * 0.8:
            continue
        ang = amax * 0.96 * u
        x, z = gg.arch_point(ang, R + gg.ARCH_T + 0.004)
        y = rng.uniform(-0.42, 0.42) * gg.ARCH_D
        pts.append((x * S, y * S, z * S, rng.uniform(0.016, 0.03) * S))
    for k in range(26):  # a lip over the front edge
        ang = amax * rng.uniform(-0.9, 0.9)
        x, z = gg.arch_point(ang, R + gg.ARCH_T * rng.uniform(0.7, 0.95))
        pts.append((x * S, (-gg.ARCH_D / 2 - 0.004) * S, z * S, rng.uniform(0.012, 0.022) * S))
    mo = stage._build_moss("gate_moss", pts, mats["moss"], coll, rng, squash=(0.45, 0.7))
    stage._add_fuzz(mo, 40000, 0.012 * S, 0, 5, radius=0.0018 * S, rand=0.6, tip=0.3)
    return mo


def _leaf(side, mats, coll, S, rng):
    p = Part("gate_leafL" if side < 0 else "gate_leafR", mats)
    t = gg.LEAF_T
    top = lambda x: gg.intrados(x) - gg.GAP
    for x0, x1 in gg.planks(side):
        plank = (rng.random(), 0.02, (rng.uniform(0.0, 1.0), rng.uniform(0.0, 1.0)))
        steps = 8
        out = [(x0, 0.0), (x1, 0.0)] + [(x1 + (x0 - x1) * k / steps, top(x1 + (x0 - x1) * k / steps) - rng.uniform(0, 0.006))
                                         for k in range(steps + 1)]
        g = prism(out, -t / 2 + rng.uniform(-0.005, 0.003), t / 2)
        bmesh.ops.bevel(g, geom=g.edges[:], offset=0.0045, segments=3, affect="EDGES", clamp_overlap=True)
        _carve(g, plank[0], plank[1], t)
        p.add(g, "oak", smooth=False, plank=plank)  # flat-shaded: smooth shading rounded the planks into pillows
    # a dark backing board behind the planks, so the seams read as tight joints, not see-through slits
    lo, hi = sorted((side * gg.GAP, side * (gg.HALF - gg.GAP)))
    out = [(lo + 0.004, 0.0), (hi - 0.004, 0.0)] + [(hi - 0.004 + (lo - hi + 0.008) * k / 8, top(hi - 0.004 + (lo - hi + 0.008) * k / 8) - 0.012)
                                                   for k in range(9)]
    p.add(prism(out, t / 2 - 0.012, t / 2 - 0.004), "oak", smooth=False, plank=(0.3, 0.6, (0.0, 0.5)))
    for z in (0.13, 0.43):  # back braces (seen when open)
        lo, hi = sorted((side * gg.GAP, side * (gg.HALF - gg.GAP)))
        g = box(lo + 0.02, hi - 0.02, t / 2, t / 2 + 0.018, z - 0.03, z + 0.03)
        bmesh.ops.bevel(g, geom=g.edges[:], offset=0.003, segments=2, affect="EDGES", clamp_overlap=True)
        p.add(g, "oak", smooth=False, plank=(rng.random(), rng.random(), (rng.random(), rng.random())))
    for z, x0, x1 in gg.straps(side):  # iron straps with rivets, a hinge knuckle at the post side
        g = box(x0, x1, -t / 2 - 0.012, -t / 2 + 0.001, z - 0.024, z + 0.024)
        bmesh.ops.bevel(g, geom=g.edges[:], offset=0.002, segments=1, affect="EDGES", clamp_overlap=True)
        p.add(g, "iron", smooth=False)  # a flat hammered band, not a pipe
        for k in range(4):
            xx = x0 + (x1 - x0) * (k + 0.5) / 4
            p.add(dome((xx, -t / 2 - 0.012, z), 0.008, rng, flat=0.7), "iron")
        g = bmesh.new()
        bmesh.ops.create_cone(g, cap_ends=True, segments=16, radius1=0.015, radius2=0.015, depth=0.07)
        bmesh.ops.translate(g, vec=(side * (gg.HALF - gg.GAP), 0, z), verts=g.verts)
        p.add(g, "iron")
    (rx, rz), rr = gg.ring(side)  # ring pull hanging from a round plate
    g = bmesh.new()
    bmesh.ops.create_cone(g, cap_ends=True, segments=24, radius1=0.03, radius2=0.026, depth=0.008)
    bmesh.ops.rotate(g, verts=g.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    bmesh.ops.translate(g, vec=(rx, -t / 2 - 0.004, rz + rr * 0.75), verts=g.verts)
    p.add(g, "iron")
    p.add(torus((rx, -t / 2 - 0.016, rz), rr * 0.85, 0.009), "iron")
    for v in gg.vines(side):  # woody vines on the front face, with twigs
        y = -t / 2 - 0.012
        pts = [(x, y - 0.008 * math.sin(k * 1.7), z) for k, (x, z) in enumerate(v["pts"])]
        # thin woody stems: thick ones read as dark worms at the game's camera (Cycles still, 2026-11-26)
        p.add(tube(pts, [r_ * VINE_R for r_ in v["radii"]], segs=8), "vine")
        for tw in v["twigs"]:
            p.add(tube([(x, y, z) for x, z in tw["pts"]], [r_ * VINE_R for r_ in tw["radii"]], segs=6), "vine")
    hx, hy = gg.hinge(side)
    # built about the wall's middle plane: hang it behind the arch; the origin on the hinge
    for v in p.bm.verts:
        v.co.y += hy
    return p.obj(coll, S, origin=(hx, hy, 0))


def _leaf_moss(side, mats, coll, S, rng, stage, leaf):
    """Moss creeping up the foot of the door and into the plank seams; parented to the leaf so it swings with it."""
    t = gg.LEAF_T
    hx, hy = gg.hinge(side)
    pts = []
    for k in range(18):
        x = side * rng.uniform(0.03, gg.HALF - 0.03)
        pts.append(((x - hx) * S, (-t / 2 - 0.004) * S, rng.uniform(0.0, 0.02) * S, rng.uniform(0.012, 0.02) * S))
    for v in gg.vines(side):  # leafy tufts along the vines, so they read as ivy, not bare sticks
        for k, (x, z) in enumerate(v["pts"]):
            if k % 3 == 1:
                pts.append(((x - hx) * S, (-t / 2 - 0.014) * S, z * S, rng.uniform(0.007, 0.012) * S))
    mo = stage._build_moss(leaf.name + "_moss", pts, mats["moss"], coll, rng, axis="y", sign=-1.0, squash=(0.5, 0.8))
    stage._add_fuzz(mo, 6000, 0.01 * S, 0, 9 + side, radius=0.0016 * S, rand=0.6, tip=0.3)
    mo.parent = leaf
    return mo


def build(coll, mats, S, stage, seed=4):
    rng = random.Random(seed)
    arch = _arch(mats, coll, S, rng)
    moss = [_arch_moss(mats, coll, S, rng, stage)]
    leafL, leafR = _leaf(-1, mats, coll, S, rng), _leaf(1, mats, coll, S, rng)
    moss += [_leaf_moss(-1, mats, coll, S, rng, stage, leafL), _leaf_moss(1, mats, coll, S, rng, stage, leafR)]
    return {"arch": arch, "leafL": leafL, "leafR": leafR, "moss": moss}


def set_leaves(parts, e):
    """Turn the leaves to e of the full swing (0 shut, 1 open; the swing's curve may pass 1 a little)."""
    parts["leafL"].rotation_euler = (0, 0, gg.leaf_angle(e, -1, clamp=False))
    parts["leafR"].rotation_euler = (0, 0, gg.leaf_angle(e, 1, clamp=False))


def set_open(parts, f):
    """Turn the leaves to f (0 shut, 1 open), eased as the stills always were (smoothstep)."""
    set_leaves(parts, f * f * (3 - 2 * f))
