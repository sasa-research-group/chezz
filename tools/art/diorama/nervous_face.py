# The king's nervous face, for the "in check" loop (Wesley 2026-11-20 picked draft C,
# ~/.dos/scratch/d84406ef/check/face-drafts.jpg): worried brows (inner ends up, outer ends down), bigger glossy
# eyes with a white glint, clenched teeth showing under the mustache, a sweat drop on his temple.
# His normal face (face A) is sculpted and painted into the Meshy mesh with no face controls. What didn't work:
# moving only the brow vertices (tore the skin), pressing the brows flat, and covering them with a skin patch and
# new brows (Wesley: "a skin-colored bandage with eyebrows on top"). So:
#   1. warp: his own brows are bent by a smooth field that moves everything there together (see _warp)
#   2. paint out: a copy of his texture with the old painted eyes filled in skin colour
#   3. new clay pieces parented to the Head bone, so they follow every pose: eyes with a glint, clenched teeth,
#      a sweat drop
# Call apply(arm, body) on the king at rest (right after import, before posing). Returns the added objects.
import bpy, math
import numpy as np
from mathutils import Vector, Matrix

BROW = dict(x=0.102, z=1.252, rx=0.088, rz=0.046)  # each old brow's middle and half-size (rest pose, m)
EYE = dict(x=0.112, z=1.163, w=0.034, h=0.042)     # each old painted eye: centre and half-size
EYE_GROW = 1.12      # the new eye bead, this much bigger than the old paint
TEETH_Z = 0.957      # just under the mustache middle
TEETH_COLS, TEETH_GAP = 4, 0.027  # teeth per row, spacing
WARP_TILT = 25       # each brow's bottom edge slants this much (deg), inner end up
WARP_MID = 0.035     # between the brows (|x| under this) all rise like the inner ends
WARP_BAND = (1.16, 1.20, 1.215, 1.29)  # z (m): eases in above the eyes, full along the brows' bottom edge, none
                                       # at their top edge (against the crown)
WARP_SIDE = (0.15, 0.19)  # and none at the hair by his temples
FILL_R = 0.01        # painting out: each spot takes the colour of the skin this close round it on the face
FILL_KEEP, FILL_FADE = 0.02, 0.05 # pixels this close to that colour stay as they are, fading to replaced



def _mat(name, rgb, rough, **kw):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = rough
    for k, v in kw.items():
        p.inputs[k].default_value = v
    m["clay_ified"] = True  # stage.clay_ify leaves it be: glossy eyes, glint and drop, not matte clay
    return m


def _tex_node(body):
    return next(n for n in body.active_material.node_tree.nodes if n.type == "TEX_IMAGE")


def _vertex_data(body):
    """per-vertex world position (rest), uv, and texture colour (0..1 as stored)"""
    me = body.data
    img = _tex_node(body).image
    W, H = img.size
    px = np.array(img.pixels[:]).reshape(H, W, 4)
    uv = np.zeros((len(me.vertices), 2))
    luv = me.uv_layers.active.data
    for l in me.loops:
        uv[l.vertex_index] = luv[l.index].uv
    col = px[np.clip((uv[:, 1] * H).astype(int), 0, H - 1), np.clip((uv[:, 0] * W).astype(int), 0, W - 1), :3]
    co = np.array([body.matrix_world @ v.co for v in me.vertices])
    return co, uv, col, px


def oval(co, cx, cz, rx, rz):
    """distance in oval units from (cx, cz) on the face's front plane (x, z)"""
    return np.hypot((co[..., 0] - cx) / rx, (co[..., 2] - cz) / rz)


def paint_regions(co):
    """1 where a point is on an old painted eye (either side), front of the face only"""
    front = co[..., 1] < -0.2
    r = np.zeros(co.shape[:-1], bool)
    for s in (-1, 1):
        r |= oval(co, s * EYE["x"], EYE["z"], EYE["w"] * 1.5, EYE["h"] * 1.45) < 1.0
    return r & front & (np.abs(co[..., 0]) < 0.186)


def _paint_out(body, co, col, px):
    """a copy of the texture with the old brows and eyes painted over. Each vertex there takes the average colour of
    the skin around it on the face (within FILL_R, in 3D: neighbours in the texture file can be anywhere on him), and
    the faces there are filled smoothly between their vertices' colours"""
    me = body.data
    H, W = px.shape[:2]
    lum = col.mean(1)
    region = paint_regions(co)
    skin_v = (lum > 0.6) & (col[:, 2] / np.maximum(col[:, 0], 1e-3) > 0.68) & ~region
    face = (co[:, 2] > 1.05) & (co[:, 2] < 1.32) & (np.abs(co[:, 0]) < 0.22) & (co[:, 1] < -0.15)
    K = np.where(skin_v & face)[0]
    skin = np.median(col[K], axis=0)
    luv = me.uv_layers.active.data
    polys = [p for p in me.polygons if region[list(p.vertices)].any()]
    R = np.unique([v for p in polys for v in p.vertices])
    fill = np.zeros((len(me.vertices), 3))
    for c0 in range(0, len(R), 500):
        r = R[c0:c0 + 500]
        d2 = ((co[r, None, :] - co[None, K, :]) ** 2).sum(-1)
        w = np.exp(-d2 / (2 * FILL_R ** 2))
        fill[r] = (w @ col[K]) / np.maximum(w.sum(1, keepdims=True), 1e-9)
    out = px.copy()
    n = 0
    for poly in polys:
        vs = list(poly.vertices)
        uvs = np.array([luv[i].uv for i in poly.loop_indices]) * [W, H]
        cs = fill[vs]
        for k in range(1, len(uvs) - 1):  # fan into triangles, fill each
            t = np.array([uvs[0], uvs[k], uvs[k + 1]]); tc = np.array([cs[0], cs[k], cs[k + 1]])
            x0, y0 = np.floor(t.min(0)).astype(int) - 1
            x1, y1 = np.ceil(t.max(0)).astype(int) + 1
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            (ax, ay), (bx, by), (cx, cy) = t
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9:
                continue
            l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
            l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
            l3 = 1 - l1 - l2
            inside = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
            c = l1[..., None] * tc[0] + l2[..., None] * tc[1] + l3[..., None] * tc[2]
            # only where it isn't skin already (the old eye paint), fading in: his own skin keeps its shading
            o = px[y0:y1 + 1, x0:x1 + 1, :3]
            a = np.clip((np.linalg.norm(o - c, axis=-1) - FILL_KEEP) / FILL_FADE, 0, 1)[..., None]
            out[y0:y1 + 1, x0:x1 + 1, :3][inside] = (o * (1 - a) + c * a)[inside]
            n += int(inside.sum())
    img = _tex_node(body).image
    new = img.copy()
    new.name = img.name + "_nervous"
    new.pixels.foreach_set(out.ravel().astype(np.float32))
    new.pack()
    _tex_node(body).image = new
    return n, skin


def _ramp(v, a, b):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _warp(body, co):
    """bend his own brows into a worried slant. His mesh is one fused surface (crown, brows and skin joined), so a
    smooth field moves every vertex there together: nothing tears and no hidden layer shows. The brows' top edges
    touch the crown and stay put (moving them bent the crown's rim, Wesley 2026-11-20); their bottom edges, which
    are what reads, slant WARP_TILT about the brow's middle: up toward the nose, down toward the temples"""
    me = body.data
    inv = body.matrix_world.inverted()
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    new = co.copy()
    front = np.clip((-0.2 - y) / 0.04, 0, 1)
    k = math.tan(math.radians(WARP_TILT))
    ax = np.maximum(np.abs(x), WARP_MID)  # between the brows all rise like the inner ends, so the nose isn't pulled
    dz = k * (BROW["x"] - ax)
    band = _ramp(z, WARP_BAND[0], WARP_BAND[1]) * (1 - _ramp(z, WARP_BAND[2], WARP_BAND[3]))
    side = 1 - _ramp(np.abs(x), WARP_SIDE[0], WARP_SIDE[1])
    new[:, 2] += dz * band * side * front
    moved = np.where(np.abs(new - co).max(1) > 1e-6)[0]
    for i in moved:
        me.vertices[i].co = inv @ Vector(new[i])
    me.update()
    return len(moved)


def _surface(body, x, z, y0=-1.0, also=()):
    """the front surface point of the king (or an object in also) at (x, z), shot from the camera side"""
    best = (None, None)
    for ob in (body, *also):
        inv = ob.matrix_world.inverted()
        o, d = inv @ Vector((x, y0, z)), (inv.to_3x3() @ Vector((0, 1, 0))).normalized()
        hit, loc, nrm, _ = ob.ray_cast(o, d)
        if hit:
            loc = ob.matrix_world @ loc
            if best[0] is None or loc.y < best[0].y:
                best = (loc, (ob.matrix_world.to_3x3() @ nrm).normalized())
    return best


def clearance(body, p, d):
    """how far p sits in front of the king's surface, looking back along -d; negative when p is inside him"""
    inv = body.matrix_world.inverted()
    hit, loc, n, _ = body.ray_cast(inv @ p, (inv.to_3x3() @ -d).normalized())
    if not hit:
        return 1.0
    loc = body.matrix_world @ loc
    n = (body.matrix_world.to_3x3() @ n).normalized()
    dist = (loc - p).length
    return dist if n.dot(d) > 0 else -dist


def _bead(name, loc, nrm, sx, sy, sz, mat, arm, segs=24, skin=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, radius=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sy, sz)
    o.rotation_euler = nrm.to_track_quat("-Y", "Z").to_euler()  # local -y along the surface normal
    o.location = loc
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    if skin is not None:
        _to_skin(o, arm, *skin)
    else:
        _to_head(o, arm)
    return o


def _to_head(o, arm):
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = arm
    o.parent_type = "BONE"
    o.parent_bone = "Head"
    bpy.context.view_layer.update()
    o.matrix_world = mw


def _tri(body, co, loc, span=0.012):
    """three front verts around loc (nearest, one to the side, one below) for a vertex-triangle parent"""
    p = np.array(loc)
    front = co[:, 1] < -0.2
    d = np.where(front, np.linalg.norm(co - p, axis=1), 9.0)
    a = int(np.argmin(d))
    out = [a]
    for off in ((span, 0, 0), (0, 0, -span)):
        t = co[a] + np.array(off)
        dd = np.where(front, np.linalg.norm(co - t, axis=1), 9.0)
        for i in np.argsort(dd)[:20]:  # skip seam duplicates sitting on a vertex already picked
            if all(np.linalg.norm(co[i] - co[j]) > span * 0.5 for j in out):
                out.append(int(i)); break
    return out


def _to_skin(o, arm, body, verts):
    """bend with the beard under it: the beard round the mouth is only ~63% Head (the rest follows the shoulders),
    so a piece pinned to the Head bone slides off it when he turns his head. Give it the beard's own bone weights
    (averaged over a few verts) and the same armature."""
    names = {g.index: g.name for g in body.vertex_groups}
    w = {}
    for i in verts:
        for g in body.data.vertices[i].groups:
            w[names[g.group]] = w.get(names[g.group], 0) + g.weight / len(verts)
    tot = sum(w.values())
    idx = [v.index for v in o.data.vertices]
    for n, x in w.items():
        if x > 0.005:
            o.vertex_groups.new(name=n).add(idx, x / tot, "REPLACE")
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = arm
    o.parent_type = "OBJECT"
    bpy.context.view_layer.update()
    o.matrix_world = mw
    o.modifiers.new("arm", "ARMATURE").object = arm


def apply(arm, body):
    co, uv, col, px = _vertex_data(body)
    painted, skin = _paint_out(body, co, col, px)
    warped = _warp(body, co)
    black = _mat("nf_eye", (0.015, 0.012, 0.012), 0.25)
    white = _mat("nf_white", (0.95, 0.93, 0.88), 0.35)
    teeth = _mat("nf_teeth", (0.93, 0.9, 0.82), 0.5)
    mouth = _mat("nf_mouth", (0.18, 0.05, 0.05), 0.7)
    drop = _mat("nf_drop", (0.35, 0.75, 0.95), 0.12, **{"Transmission Weight": 0.35, "Coat Weight": 0.6})
    out = []
    for side in (-1, 1):
        loc, nrm = _surface(body, side * EYE["x"], EYE["z"])
        w, h = EYE["w"] * EYE_GROW, EYE["h"] * EYE_GROW
        eye = _bead("nf_eye%+d" % side, loc + nrm * 0.002, nrm, w, 0.012, h, black, arm)
        out.append(eye)
        # glint: up and toward the viewer's left on both eyes (one light), sat on the eye's own front surface.
        # (A fixed nudge sank it inside his left eye, where the face curves away.)
        off = Vector((-0.011, 0, 0.016))
        off -= nrm * off.dot(nrm)
        inv = eye.matrix_world.inverted()
        hit, sp_, _, _ = eye.ray_cast(inv @ (loc + off + nrm * 0.05), (inv.to_3x3() @ -nrm).normalized())
        gl = (eye.matrix_world @ sp_ if hit else loc + nrm * 0.014 + off) + nrm * 0.001
        out.append(_bead("nf_glint%+d" % side, gl, nrm, 0.0085, 0.004, 0.0085, white, arm, 16))
    # clenched teeth: a dark mouth slot with two rows of rounded teeth, set into the beard under the mustache
    loc, nrm = _surface(body, 0.0, TEETH_Z)
    pin = (body, _tri(body, co, loc))  # every mouth piece rides the same beard triangle
    mc = loc + nrm * 0.004
    out.append(_bead("nf_mouth", mc, nrm, 0.07, 0.006, 0.03, mouth, arm, skin=pin))
    # rows go up/down along the beard's slope, not straight up/down: the beard leans out under the mustache,
    # so a row stacked straight down sank into it and only one tooth tip poked out below the mouth
    up = (Vector((0, 0, 1)) - nrm * nrm.z).normalized()
    # 4 columns x 2 rows, always in matched pairs: a column whose tooth is buried in the mustache wing (pushing it
    # out puts it on top of the mustache) is dropped with its mirror, so the rows stay even and symmetric
    cols = {}
    for c in range(TEETH_COLS):
        x = (c - (TEETH_COLS - 1) / 2) * TEETH_GAP
        l2, _ = _surface(body, x, TEETH_Z)
        l2 = (l2 if l2 is not None else loc) + nrm * 0.013
        col, ok = [], True
        for row, dz in ((0, 0.0135), (1, -0.0135)):
            t = l2 + up * dz
            t += nrm * max(0.0, 0.009 - (t - mc).dot(nrm))  # in front of the flat dark mouth (the beard curves back at the corners)
            t0 = t.copy()
            for _ in range(3):  # and clear of the beard right behind it
                t += nrm * max(0.0, 0.011 - clearance(body, t, nrm))
            ok &= (t - t0).length <= 0.006
            col.append((row, t))
        cols[c] = col if ok else None
    for c, col in cols.items():
        if col is None or cols[TEETH_COLS - 1 - c] is None:
            continue
        for row, t in col:
            out.append(_bead("nf_tooth%d%d" % (c, row), t, nrm, 0.0138, 0.008, 0.014, teeth, arm, 12, skin=pin))
    # sweat drop on his temple (viewer's right), point up
    loc, nrm = _surface(body, 0.19, 1.256)  # over the gap between brow tip and hair
    up = Vector((0.3, -1, 0)).normalized()  # upright, facing out (the hair slopes here)
    d = _bead("nf_drop", loc + nrm * 0.022, up, 0.026, 0.018, 0.036, drop, arm)
    for v in d.data.vertices:  # pinch the top into a point
        if v.co.z > 0:
            k = 1 - 0.85 * v.co.z ** 1.5
            v.co.x *= k; v.co.y *= k; v.co.z *= 1 + 0.6 * v.co.z
    out.append(d)
    print("NERVOUS_FACE painted %d px (skin %s), warped %d verts, %d pieces" % (painted, np.round(skin, 2), warped, len(out)), flush=True)
    return out
