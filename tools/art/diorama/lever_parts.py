# The lever's meshes for Cycles (Wesley 2026-11-26, look A; no base 2026-11-27): the oak handle with its iron ball
# knob, coming up out of a slot in the middle of the square, the slot lined by a riveted iron plate set into the
# slab, the pivot pin across the slot under the floor, moss in the seam round the plate; from lever_geom.py, on the
# set's own materials (prop_mats.py) as the gate. build_lever_cycles.py places it in the set and cuts the slab.
#
# build(coll, mats, S, stage, floor) -> {"plate", "handle", "slot", "moss": [objs]}
#   mats: {"oak", "iron", "knob", "rust", "stone", "moss", "crack"}; S: one square in set units; floor(x, y): the
#   slab's height above the lever's origin at (x, y), square units (0 on a flat floor). Every mesh is built in square
#   units and scaled by S about the lever's origin (the square's centre on the floor): parent them to an empty to
#   place it. The handle's origin sits on the pivot: set_throw turns it.
import bmesh, bpy, math, random
from mathutils import Matrix, Vector
import lever_geom as lg
import gate_parts as gp

ORDER = ("oak", "iron", "knob", "rust", "stone", "crack")
GRAIN = gp.GRAIN  # oak photo per square unit, as the gate's planks


class Part:
    """Pieces of one object, each on one of ORDER's materials, joined in a bmesh; UVs as each piece sets them."""

    def __init__(self, name, mats):
        self.name, self.mats, self.bm = name, mats, bmesh.new()

    def add(self, g, kind, smooth=True, uv=None, tone=(0.5, 0.5)):
        """uv(face, loop) -> (u, v), or None for a box projection over the piece's own bounds (0..1 a side: the
        stone's rim grime reads each face's edges from it)."""
        k = ORDER.index(kind)
        g.normal_update()
        uvl = g.loops.layers.uv.get("UVMap") or g.loops.layers.uv.new("UVMap")
        tn = g.loops.layers.uv.get("tone") or g.loops.layers.uv.new("tone")
        lo = [min(v.co[q] for v in g.verts) for q in range(3)]
        sz = [max(1e-6, max(v.co[q] for v in g.verts) - lo[q]) for q in range(3)]
        for f in g.faces:
            f.material_index = k
            f.smooth = smooth
            n = f.normal
            ax = max(range(3), key=lambda q: abs(n[q]))
            a_, b_ = [q for q in range(3) if q != ax]
            for lp in f.loops:
                c = lp.vert.co
                lp[uvl].uv = uv(f, lp) if uv else ((c[a_] - lo[a_]) / sz[a_], (c[b_] - lo[b_]) / sz[b_])
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


def _ring(g, outer, inner, z0, z1):
    """A flat frame: the quad ring between two rectangles (x0, x1, y0, y1), z0 to z1, walls in and out; one
    manifold mesh, so displacement has no seams (four boxes would show theirs)."""
    def rect(r, z):
        x0, x1, y0, y1 = r
        return [g.verts.new((x, y, z)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))]
    ot, it, ob, ib = rect(outer, z1), rect(inner, z1), rect(outer, z0), rect(inner, z0)
    for k in range(4):
        k1 = (k + 1) % 4
        g.faces.new([ot[k], ot[k1], it[k1], it[k]])          # top
        g.faces.new([ob[k], ib[k], ib[k1], ob[k1]])          # bottom
        g.faces.new([ob[k], ob[k1], ot[k1], ot[k]])          # outside wall
        g.faces.new([ib[k], it[k], it[k1], ib[k1]])          # the slot's wall
    bmesh.ops.recalc_face_normals(g, faces=g.faces)
    return g


PLATE_DENT = 0.0025  # hammered: the plate's top a little uneven, square units


def plate_heights(floor):
    """The plate's bottom and top (square units): sunk PLATE_SINK below the lowest slab under it, PLATE_T over the
    highest, so an uneven slab never shows a gap or swallows an edge."""
    x0, x1, y0, y1, _, _ = lg.plate_box()
    hs = [floor(x, y) for x in (x0, 0.0, x1) for y in (y0, 0.0, y1)]
    return min(hs) - lg.PLATE_SINK, max(hs) + lg.PLATE_T


def _plate(mats, rng, floor):
    """The plate round the slot: a flat hand-forged iron frame, its top hammered uneven, its outer edges worn round,
    eight domed rivets; and the pin across the slot under the floor."""
    x0, x1, y0, y1, _, _ = lg.plate_box()
    s0, s1, w0, w1, _, _ = lg.slot_box()
    zb, zt = plate_heights(floor)
    p = Part("lever_plate", mats)
    g = _ring(bmesh.new(), (x0, x1, y0, y1), (s0, s1, w0, w1), zb, zt)
    bmesh.ops.bevel(g, geom=g.edges[:], offset=0.004, segments=2, affect="EDGES", clamp_overlap=True)
    bmesh.ops.subdivide_edges(g, edges=g.edges[:], cuts=4, use_grid_fill=True)
    ph = [rng.uniform(0, 6.3) for _ in range(3)]
    for v in g.verts:
        if v.co.z > zt - 0.003:  # hammered, not rolled flat
            v.co.z += PLATE_DENT * (math.sin(v.co.x * 41 + ph[0]) * math.sin(v.co.y * 37 + ph[1]) + 0.5 * math.sin((v.co.x + v.co.y) * 73 + ph[2]))
        v.co.x += rng.uniform(-1, 1) * 0.0012; v.co.y += rng.uniform(-1, 1) * 0.0012
    p.add(g, "iron", smooth=False)
    for rx, ry in lg.RIVETS:
        p.add(gp.dome((rx, ry, zt), lg.RIVET_R, rng), "iron")
    # the pin across the slot, its ends into the slot's walls
    px, py, pz = lg.PIVOT
    g = bmesh.new()
    bmesh.ops.create_cone(g, cap_ends=True, segments=16, radius1=lg.PIN_R, radius2=lg.PIN_R, depth=lg.SLOT_W + 0.01)
    bmesh.ops.rotate(g, verts=g.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    bmesh.ops.translate(g, vec=(px, py, pz), verts=g.verts)
    p.add(g, "iron")
    return p


def _slot(mats, coll, floor):
    """The slot under the plate: its walls down to a black floor SLOT_DEPTH under the floor (the builder cuts the
    slab open; the set's slab is non-manifold, so the cut leaves no walls of its own). Rusty iron where the light
    reaches just under the plate, near-black below (stone-coloured walls read as a pale dish)."""
    s0, s1, w0, w1, d0, _ = lg.slot_box()
    zb, _ = plate_heights(floor)
    p = Part("lever_slot", mats)
    band = zb - 0.035
    for kind, (za, zz) in (("rust", (band, zb + 0.002)), ("crack", (d0, band))):
        g = bmesh.new()
        lo = [g.verts.new((x, y, za)) for x, y in ((s0, w0), (s1, w0), (s1, w1), (s0, w1))]
        hi = [g.verts.new((x, y, zz)) for x, y in ((s0, w0), (s1, w0), (s1, w1), (s0, w1))]
        for k in range(4):
            k1 = (k + 1) % 4
            g.faces.new([lo[k], hi[k], hi[k1], lo[k1]])  # facing into the slot
        if kind == "crack":
            g.faces.new(lo[::-1])
        bmesh.ops.subdivide_edges(g, edges=g.edges[:], cuts=3, use_grid_fill=True)
        p.add(g, kind, smooth=False)
    return p.obj(coll, 1.0)


def slot_cutter(floor):
    """The cut the builder takes out of the slab (boolean difference, square units, a bmesh): the slot, a hair wider
    than its walls so the slab never shows inside, from below the slot's floor to above the slab."""
    s0, s1, w0, w1, d0, _ = lg.slot_box()
    e = 0.004
    return gp.box(s0 - e, s1 + e, w0 - e, w1 + e, d0 - 0.02, max(floor(x, y) for x in (s0, s1) for y in (w0, w1)) + 0.05)


HANDLE_CARVE = 0.010  # grain relief round the handle, square units (0.004 and 0.007 read smooth to the judges)
FACETS = 9           # whittled flats round the handle
FACET = 0.5          # how far toward a true 9-sided prism (0 round, 1 flat facets)
DENTS = 30           # hammer dents on the ball
DENT = 0.004         # their depth, square units


def _handle(mats, coll, rng):
    """The handle, about the pivot (origin) pointing up +z: a stout round oak dowel, a little hand-whittled, the
    photo's dark grain pressed into it as real relief (bump alone read as a flat print), and the iron ball knob,
    hammer-dented. No collar: the draft's ball sits straight on the wood (judges called a collar extra)."""
    import prop_mats as pm
    p = Part("lever_handle", mats)
    n, segs = 64, 48
    z0, z1 = -lg.BUTT, lg.HANDLE_LEN
    pts, radii = [], []
    for k in range(n + 1):
        z = z0 + (z1 - z0) * k / n
        pts.append((0.0, 0.0, z))
        r = lg.HANDLE_R * (1 + 0.03 * math.sin(z * 34) + 0.015 * math.sin(z * 71 + 1.0))  # whittled, not lathe-true
        r *= 0.9 if k == n else 1.0                      # a softened end under the ball
        radii.append(r)
    g = gp.tube(pts, radii, segs=segs)
    u0 = rng.random()
    URND = lg.HANDLE_R * GRAIN * 2.5  # finer grain round it: wider showed one blur

    def uv_of(co, ang):
        return (u0 + ang * URND, 0.05 + (co.z - z0) * GRAIN)
    hgt = gp.oak_height(pm.OAK_PNG)
    for v in g.verts:  # carve: dark grain sits low
        r_ = math.hypot(v.co.x, v.co.y)
        if r_ < lg.HANDLE_R * 0.5 or v.co.z <= z0 + 1e-6 or v.co.z >= z1 - 1e-6:
            continue
        a_ = math.atan2(v.co.y, v.co.x)
        u_, v_ = uv_of(v.co, a_)
        w_ = 2 * math.pi / FACETS  # knife flats: a whittled dowel, not a lathe-turned one
        flat = math.cos(w_ / 2) / math.cos(((a_ + 0.3 * math.sin(v.co.z * 9)) % w_) - w_ / 2)
        k_ = (1 - FACET + FACET * flat) * (1 - HANDLE_CARVE * (1 - hgt(u_, v_)) / r_)
        v.co.x *= k_; v.co.y *= k_

    def uv(f, lp):  # the photo wrapped round the dowel, its grain running up it
        c = lp.vert.co
        ang = math.atan2(c.y, c.x)
        fa = [math.atan2(l_.vert.co.y, l_.vert.co.x) for l_ in f.loops]
        if max(fa) - min(fa) > math.pi and ang < 0:  # the seam: keep a face's loops on one side
            ang += 2 * math.pi
        return uv_of(c, ang)
    p.add(g, "oak", smooth=True, uv=uv, tone=(1.0, 0.25))  # the light, golden end of the gate planks' range: a hand-polished handle
    g = bmesh.new()
    bmesh.ops.create_uvsphere(g, u_segments=72, v_segments=44, radius=lg.KNOB_R)
    dents = [Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1))).normalized() for _ in range(DENTS)]
    for v in g.verts:  # hand-forged: never quite round, hammer dents all over
        d = v.co.normalized()
        push = sum(math.exp(-(d.angle(q, 0) / rng_w) ** 2) for q, rng_w in zip(dents, [0.22] * DENTS))
        v.co *= 1 - DENT * min(1.0, push) / lg.KNOB_R
    bmesh.ops.translate(g, vec=(0, 0, lg.HANDLE_LEN + lg.KNOB_R * (1 - lg.KNOB_SINK)), verts=g.verts)
    p.add(g, "knob", smooth=True)
    o = p.obj(coll, 1.0)
    return o


def _moss(mats, coll, rng, stage, S, floor):
    """The set's moss in the seam round the plate: tufts along its outer edge on the slab, thicker in two corners
    and along the back, gaps here and there (an even ring read as "mathematical" on the block); the set's fuzz.
    Set units, about the lever's origin."""
    x0, x1, y0, y1, _, _ = lg.plate_box()
    pts = []
    per = 2 * (lg.PLATE_L + lg.PLATE_W)
    thick = [(x1, y1, 0.12), (x0, y0, 0.08), (0.05, y1, 0.08)]
    for k in range(20):
        s = rng.uniform(0, per)
        if s < lg.PLATE_L:
            x, y = x0 + s, y0 - 0.007
        elif s < lg.PLATE_L + lg.PLATE_W:
            x, y = x1 + 0.007, y0 + s - lg.PLATE_L
        elif s < 2 * lg.PLATE_L + lg.PLATE_W:
            x, y = x1 - (s - lg.PLATE_L - lg.PLATE_W), y1 + 0.007
        else:
            x, y = x0 - 0.007, y1 - (s - 2 * lg.PLATE_L - lg.PLATE_W)
        near = max(max(0.0, 1 - math.hypot(x - cx_, y - cy_) / r_) for cx_, cy_, r_ in thick)
        if rng.random() > 0.3 + 0.7 * near:
            continue
        out = rng.uniform(0, 0.02 + 0.04 * near)  # spreads out onto the slab where it is thick
        x += math.copysign(out, x) if abs(abs(x) - lg.PLATE_L / 2) < 0.01 else 0
        y += math.copysign(out, y) if abs(abs(y) - lg.PLATE_W / 2) < 0.01 else 0
        pts.append((x * S, y * S, floor(x, y) * S, rng.uniform(0.016, 0.03 + 0.012 * near) * S))
    mo = stage._build_moss("lever_moss", pts, mats["moss"], coll, rng, squash=(0.6, 0.95))
    stage._add_fuzz(mo, 3000, 0.012 * S, 0, 21, radius=0.0017 * S, rand=0.6, tip=0.3)
    return [mo]


def build(coll, mats, S, stage, floor=lambda x, y: 0.0, seed=6):
    rng = random.Random(seed)
    plate = _plate(mats, rng, floor).obj(coll, S)
    handle = _handle(mats, coll, rng)
    for v in handle.data.vertices:
        v.co *= S
    handle.location = Vector(lg.PIVOT) * S
    slot = _slot(mats, coll, floor)
    for v in slot.data.vertices:
        v.co *= S
    moss = _moss(mats, coll, rng, stage, S, floor)
    return {"plate": plate, "handle": handle, "slot": slot, "moss": moss}


def set_throw(parts, t, limits=None):
    """Tip the handle to t of the throw (0 thrown left, 1 thrown right): about the pin, along the board's x. limits:
    lg.throw_limits for this square (the set in the way)."""
    parts["handle"].rotation_euler = (0, lg.throw(t, limits), 0)
