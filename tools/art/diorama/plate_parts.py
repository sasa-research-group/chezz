# The bronze sun pressure plate's meshes for Cycles (concept ~/.dos/scratch/d84406ef/lever/P1.png): a round bronze
# disc with the sun in relief (plate_geom.relief), a ring of mossy stone blocks round it, a thin dark gap between, a
# black well under the gap, moss tufts on the ring. Shapes from plate_geom.py, bronze from prop_mats.bronze_mat, the
# set's own stone and moss. build_plate_cycles.py places it in the set and cuts the slab under the well.
#
# build(coll, mats, S, stage, floor) -> {"disc", "ring", "well", "moss": [objs], "zref"}
#   mats: {"bronze", "stone", "moss", "crack"}; S: one square in set units; floor(x, y): the slab's height above the
#   plate's origin at (x, y), square units. Every mesh is built in square units and scaled by S about the plate's origin
#   (the square's centre on the floor): parent them to an empty to place it. The disc's origin is the centre of its flat
#   top, set_press moves it.
import bmesh, bpy, math, random
from mathutils import Vector
import plate_geom as pg

NA, NR = 512, 150          # the disc's top: angular and radial samples (the relief needs it dense)
CUT_R = pg.R_IN + 0.025    # the slab is opened inside this radius: its edge is under the stone ring


def _sm(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ring_zref(floor):
    """The slab's mean height under the ring: the plate's reference floor (the disc's and the ring's heights hang from it)."""
    hs = [floor(m * math.cos(a), m * math.sin(a)) for m in (pg.R_IN + 0.02, pg.R_IN + 0.06) for a in (2 * math.pi * k / 24 for k in range(24))]
    return sum(hs) / len(hs)


def _wear(r, th):
    """0 in a cavity .. 1 on a high point or worn edge: what bronze_mat reads. From the height field: raised parts bright,
    the flats a dull mid, grooves and the foot of every rise dark."""
    h = pg.relief(r, th)
    x, y = r * math.cos(th), r * math.sin(th)
    d = 0.009
    ns = []
    for k in range(8):
        a = math.pi / 4 * k
        qx, qy = x + d * math.cos(a), y + d * math.sin(a)
        ns.append(pg.relief(math.hypot(qx, qy), math.atan2(qy, qx)))
    cav = sum(ns) / 8 - h   # > 0 in a hollow, < 0 on a crest
    w = 0.2 + 0.68 * _sm(h / 0.009)
    w += min(0.3, max(0.0, -cav) * 40) - min(0.35, max(0.0, cav) * 45)
    if h < -0.001:
        w -= 0.15
    if r > pg.DISC_R - 0.007:
        w = max(w, 0.8)   # the edge, rubbed bright by every foot
    return max(0.0, min(1.0, w))


def _disc(mats, rng):
    """The disc: a dense polar grid for the top (the relief and the wear colour), a wall down to its underside."""
    g = bmesh.new()
    wl = g.loops.layers.float_color.new("wear")
    uvl = g.loops.layers.uv.new("UVMap")
    top = [[g.verts.new((0.0, 0.0, pg.relief(0.0, 0.0)))]]
    for i in range(1, NR + 1):
        r = pg.DISC_R * i / NR
        row = []
        for j in range(NA):
            th = 2 * math.pi * j / NA
            row.append(g.verts.new((r * math.cos(th), r * math.sin(th), pg.relief(r, th))))
        top.append(row)
    for j in range(NA):
        g.faces.new([top[0][0], top[1][j], top[1][(j + 1) % NA]])
    for i in range(1, NR):
        for j in range(NA):
            g.faces.new([top[i][j], top[i + 1][j], top[i + 1][(j + 1) % NA], top[i][(j + 1) % NA]])
    rim = top[-1]
    wall = [[g.verts.new((v.co.x, v.co.y, z)) for v in rim] for z in (-pg.EDGE_DROP, -0.02, -pg.DISC_T)]
    wall[0] = rim
    for a, b in zip(wall, wall[1:]):
        for j in range(NA):
            g.faces.new([a[j], a[(j + 1) % NA], b[(j + 1) % NA], b[j]])
    g.faces.new(wall[-1][::-1])
    bmesh.ops.recalc_face_normals(g, faces=g.faces)
    wv = {}   # each vertex's wear: the top from the height field, the wall's foot dark
    for row in top:
        for v in row:
            wv[v] = _wear(math.hypot(v.co.x, v.co.y), math.atan2(v.co.y, v.co.x))
    for row, w in zip(wall[1:], (0.4, 0.1)):
        for v in row:
            wv[v] = w
    for f in g.faces:
        f.smooth = True
        for lp in f.loops:
            w = wv[lp.vert]
            lp[wl] = (w, w, w, 1.0)
            lp[uvl].uv = (lp.vert.co.x / (2 * pg.DISC_R) + 0.5, lp.vert.co.y / (2 * pg.DISC_R) + 0.5)
    return g


def _stone_piece(i, a0, a1, zb, floor, rng, zref):
    """One ring block between angles a0 and a1: a profile (chamfered top corners) swept round, its top following the
    slab and a little lumpy, its ends rolled over; UVs 0..1 over its own bounds as the set's stone reads its rim from."""
    g = bmesh.new()
    rm = (pg.R_IN + pg.R_OUT) / 2
    L = (a1 - a0) * rm
    b = 0.006
    prof = [(pg.R_IN, None), (pg.R_IN, -0.007), (pg.R_IN + 0.0025, -0.003), (pg.R_IN + b, 0.0),
            (pg.R_OUT - 0.009, 0.0), (pg.R_OUT - 0.004, -0.003), (pg.R_OUT, -0.008), (pg.R_OUT, None)]
    inner = [0.0, 0.0025, 0.005, 0.0085, 0.0125]
    ss = inner + [L * k / 10 for k in range(1, 10) if 0.0125 < L * k / 10 < L - 0.0125] + [L - s for s in inner[::-1]]
    h_i = pg.RING_H * rng.uniform(0.85, 1.2)
    tilt = rng.uniform(-0.004, 0.004)
    ph = [rng.uniform(0, 6.3) for _ in range(2)]
    grid = []
    for s in ss:
        a = a0 + s / rm
        drop = 0.009 * (1 - _sm(min(s, L - s) / 0.011))   # the ends rolled over
        row = []
        for r, dz in prof:
            rr = r + rng.uniform(-0.0012, 0.0012)
            x, y = rr * math.cos(a), rr * math.sin(a)
            if dz is None:
                z = zb
            else:
                z = floor(x, y) + h_i + dz - drop + tilt * (s / L - 0.5) / 0.5 + 0.0016 * math.sin(x * 61 + ph[0]) * math.sin(y * 53 + ph[1]) + rng.uniform(-0.0006, 0.0006)
                z = max(z, zb + 0.01)
            row.append(g.verts.new((x, y, z)))
        grid.append(row)
    n = len(prof)
    for r0, r1 in zip(grid, grid[1:]):
        for p in range(n):
            g.faces.new([r0[p], r0[(p + 1) % n], r1[(p + 1) % n], r1[p]])
    g.faces.new(grid[0][::-1]); g.faces.new(grid[-1])
    bmesh.ops.recalc_face_normals(g, faces=g.faces)
    return g


def _ring(mats, rng, floor, zref, S, coll):
    g_all = bmesh.new()
    zb = min(floor(m * math.cos(a), m * math.sin(a)) for m in (pg.R_IN, pg.R_OUT) for a in (2 * math.pi * k / 48 for k in range(48))) - 0.03
    cuts = [2 * math.pi * (k + rng.uniform(-0.22, 0.22)) / pg.STONES + 0.37 for k in range(pg.STONES)]
    rm = (pg.R_IN + pg.R_OUT) / 2
    for k in range(pg.STONES):
        a0, a1 = cuts[k] + 0.004 / rm, cuts[(k + 1) % pg.STONES] + (2 * math.pi if k == pg.STONES - 1 else 0.0) - 0.004 / rm
        g = _stone_piece(k, a0, a1, zb, floor, rng, zref)
        uvl = g.loops.layers.uv.new("UVMap")
        lo = [min(v.co[q] for v in g.verts) for q in range(3)]
        sz = [max(1e-6, max(v.co[q] for v in g.verts) - lo[q]) for q in range(3)]
        for f in g.faces:
            f.smooth = True
            ax = max(range(3), key=lambda q: abs(f.normal[q]))
            a_, b_ = [q for q in range(3) if q != ax]
            for lp in f.loops:
                c = lp.vert.co
                lp[uvl].uv = ((c[a_] - lo[a_]) / sz[a_], (c[b_] - lo[b_]) / sz[b_])
        me = bpy.data.meshes.new("tmp"); g.to_mesh(me); g.free()
        g_all.from_mesh(me); bpy.data.meshes.remove(me)
    return _obj("plate_ring", g_all, mats["stone"], coll, S)


def _well(mats, floor, zref, S, coll):
    """The black well under the gap: a lining just inside the ring's inner wall, and a floor, so the gap reads dark."""
    g = bmesh.new()
    n = 64
    r = pg.R_IN - 0.002
    top = zref + 0.003
    lo = [g.verts.new((r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), -pg.WELL_DEPTH)) for k in range(n)]
    hi = [g.verts.new((r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), top)) for k in range(n)]
    for k in range(n):
        g.faces.new([lo[k], hi[k], hi[(k + 1) % n], lo[(k + 1) % n]])   # facing in
    g.faces.new(lo[::-1])
    bmesh.ops.recalc_face_normals(g, faces=g.faces)
    return _obj("plate_well", g, mats["crack"], coll, S)


def _obj(name, g, mat, coll, S):
    for v in g.verts:
        v.co *= S
    me = bpy.data.meshes.new(name)
    g.to_mesh(me); g.free()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me); coll.objects.link(o)
    return o


def _moss(mats, coll, rng, stage, S, floor):
    """The set's moss in a few tufts on the ring, not a collar: three patches (thicker on the far side and to the
    right, where the set's moss runs on), a couple of clumps spilling onto the slab, gaps between; the set's fuzz."""
    patches = [(math.radians(35), 0.6, 10), (math.radians(150), 0.45, 7), (math.radians(255), 0.45, 7), (math.radians(325), 0.35, 5)]
    pts = []
    for centre, spread, n in patches:
        for _ in range(n):
            a = centre + rng.uniform(-spread, spread) * 0.8
            r = rng.uniform(pg.R_IN + 0.012, pg.R_OUT + 0.012)
            x, y = r * math.cos(a), r * math.sin(a)
            pts.append((x * S, y * S, (floor(x, y) + pg.RING_H * 0.9) * S, rng.uniform(0.018, 0.034) * S))
    mo = stage._build_moss("plate_moss", pts, mats["moss"], coll, rng, squash=(0.6, 0.95))
    stage._add_fuzz(mo, 2400, 0.012 * S, 0, 17, radius=0.0017 * S, rand=0.6, tip=0.3)
    return [mo]


def slab_cut_planes(n=32):
    """The cut in the slab, a regular n-gon of circumradius CUT_R inscribed so no point of it is outside the circle:
    [(nx, ny, d)]: inside is every point with nx x + ny y < d for all planes. Square units about the plate's centre."""
    ap = CUT_R * math.cos(math.pi / n)
    return [(math.cos(2 * math.pi * (k + 0.5) / n), math.sin(2 * math.pi * (k + 0.5) / n), ap) for k in range(n)]


def build(coll, mats, S, stage, floor=lambda x, y: 0.0, seed=7):
    rng = random.Random(seed)
    zref = ring_zref(floor)
    me = bpy.data.meshes.new("plate_disc")
    g = _disc(mats, rng)
    for v in g.verts:
        v.co *= S
    g.to_mesh(me); g.free()
    me.materials.append(mats["bronze"])
    disc = bpy.data.objects.new("plate_disc", me); coll.objects.link(disc)
    ring = _ring(mats, rng, floor, zref, S, coll)
    well = _well(mats, floor, zref, S, coll)
    moss = _moss(mats, coll, rng, stage, S, floor)
    parts = {"disc": disc, "ring": ring, "well": well, "moss": moss, "zref": zref, "S": S}
    set_press(parts, 0.0)
    return parts


def set_press(parts, t):
    """The disc at t of the press (0 up .. 1 down): moves along z."""
    parts["disc"].location = (0.0, 0.0, (parts["zref"] + pg.disc_z(t)) * parts["S"])
