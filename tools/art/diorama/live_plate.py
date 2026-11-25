# The plate for live sludge (build_sludge_cycles.py --live 1): what the browser needs to draw the bubbling itself over
# one Cycles render, so a player-built level needs one bake, not a 30-minute loop.
#
# Writes into --out:
#   plate.png        the board with the ooze lying still (no swell, bubbles, splatter, tears or blobs)
#   mask.png         alpha = how much of each pixel is ooze the camera sees (stones in front hold it out)
#   basis_NN.png     the ooze region rendered again with its normal turned by a fixed tilt (BASIS below): the
#                    browser blends the four nearest for each pixel's live normal, so a bubble catches the same
#                    lanterns, reflections and glow Cycles gives it
#   tear_NN.png      the same basis with the skin torn open everywhere (the tear colour, shine kept): the browser
#                    blends towards it by the live tear, and uses the gap between the two as the diffuse light a
#                    crease shades
#   probe_K_F.exr    the room seen from sheet K's ooze, five faces (up and the four sides, FACES below), float: the
#                    clear coat's sharp mirror reflection is drawn live from it, so the basis renders leave the coat off
#   sheet_K.bin      each ooze sheet's still mesh: float32 xyz (local) then uint32 triangle indices
#   live.json        camera, region, basis tilts, sheets (matrix, counts) and their bubble events (sludge_bubbles.py)
import bpy, os, math, json
import numpy as np
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

TILTS = (15, 30, 45, 60)   # degrees off the still surface's normal
TURNS = 8                  # directions round it, from +x
PROBE = 256                # pixels a side of each reflection face
# the reflection faces: (forward, up) in world space; a face's camera looks along forward with up at the top
FACES = (((0, 0, 1), (0, 1, 0)), ((1, 0, 0), (0, 0, 1)), ((-1, 0, 0), (0, 0, 1)),
         ((0, 1, 0), (0, 0, 1)), ((0, -1, 0), (0, 0, 1)))


def basis():
    """[(tilt deg, turn deg)]: the untilted normal first, then each ring."""
    out = [(0, 0)]
    for t in TILTS:
        out += [(t, 360 * k / TURNS) for k in range(TURNS)]
    return out


def mat_list(m):
    return [[m[r][c] for c in range(4)] for r in range(4)]


def event_json(e):
    d = {k: getattr(e, k) for k in ("x", "y", "r", "t0", "sz", "bursts", "ts", "tb", "tz", "ang", "stretch",
                                    "h1", "h2", "s1", "s2", "dome")}
    d["drops"] = [{k: getattr(q, k) for k in ("x0", "y0", "x1", "y1", "r", "apex", "t0", "tf")} for q in e.drops]
    return d


def probe_faces(sc, cam, anim, a, out):
    """Five 90 degree renders of the room from each sheet's middle, as half-float EXR (linear, unclipped: a lantern
    stays brighter than white, so its mirror image in the ooze comes out as sharp and bright as Cycles' coat)."""
    from mathutils import Matrix
    r = sc.render
    keep = dict(res=(r.resolution_x, r.resolution_y, r.resolution_percentage), fmt=r.image_settings.file_format,
                depth=r.image_settings.color_depth, mode=r.image_settings.color_mode, comp=r.use_compositing,
                samples=sc.cycles.samples, cam=sc.camera)
    hidden = [surf for surf, _ in anim if not surf.hide_render]
    for surf in hidden:
        surf.hide_render = True
    # the pings (small hard lights just over the ooze) stay out of the mirror image: they are too near for one
    # probe to place, so the browser draws their highlight itself (pings() below)
    pings = [o for o in sc.objects if o.type == "LIGHT" and o.name.startswith("sludge_ping")]
    seen = [(o, o.visible_camera, o.visible_glossy) for o in pings]
    for o in pings:
        o.visible_camera = False
    pc = bpy.data.cameras.new("probe_cam"); pc.lens_unit = "FOV"; pc.angle = math.radians(90)
    pc.clip_start = 0.001; pc.clip_end = cam.data.clip_end
    po = bpy.data.objects.new("probe_cam", pc); sc.collection.objects.link(po)
    sc.camera = po
    r.resolution_x = r.resolution_y = PROBE; r.resolution_percentage = 100
    r.image_settings.file_format = "OPEN_EXR"; r.image_settings.color_depth = "16"; r.image_settings.color_mode = "RGB"
    r.use_compositing = False
    sc.cycles.samples = a.basis_samples
    centres = []
    for k, (surf, _r) in enumerate(anim):
        ws = [surf.matrix_world @ v.co for v in surf.data.vertices]
        c = sum(ws, Vector()) / len(ws)
        centres.append([c.x, c.y, c.z])
        for fi, (f, u) in enumerate(FACES):
            f, u = Vector(f), Vector(u)
            rgt = f.cross(u)
            m = Matrix.Identity(4)
            for row in range(3):  # camera axes: x right, y up, z backwards
                m[row][0], m[row][1], m[row][2], m[row][3] = rgt[row], u[row], -f[row], c[row]
            po.matrix_world = m
            r.filepath = os.path.join(out, "probe_%d_%d.exr" % (k, fi))
            bpy.ops.render.render(write_still=True)
        print("CHECK live probe %d" % k, flush=True)
    for surf in hidden:
        surf.hide_render = False
    for o, v, g in seen:
        o.visible_camera, o.visible_glossy = v, g
    sc.camera = keep["cam"]
    bpy.data.objects.remove(po)
    r.resolution_x, r.resolution_y, r.resolution_percentage = keep["res"]
    r.image_settings.file_format = keep["fmt"]; r.image_settings.color_depth = keep["depth"]
    r.image_settings.color_mode = keep["mode"]; r.use_compositing = keep["comp"]
    sc.cycles.samples = keep["samples"]
    return centres


def pings(sc, anim):
    """Each ping light: the sheet it lights, where it is, its size and power, so the browser can draw its sharp
    mirror image in the coat exactly (it is too near the ooze for the probe)."""
    names = [surf.name for surf, _ in anim]
    out = []
    for o in sc.objects:
        if o.type != "LIGHT" or not o.name.startswith("sludge_ping"):
            continue
        rc = o.light_linking.receiver_collection
        lit = [names.index(x.name) for x in (rc.objects if rc else []) if x.name in names]
        p_ = o.matrix_world.translation
        for k in lit or range(len(names)):
            out.append({"sheet": k, "at": [p_.x, p_.y, p_.z], "size": o.data.size, "power": o.data.energy,
                        "color": list(o.data.color)})
    return out


def room_box(sc, anim):
    """The world box the room's walls, floor and props fill (the ooze left out): the probe lookup is corrected to
    it (box projection), so a lantern near one end of a pond still shows where Cycles puts it."""
    skip = {surf.name for surf, _ in anim}
    lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
    for o in sc.objects:
        if o.type != "MESH" or o.hide_render or o.name in skip:
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return [list(lo), list(hi)]


def write(a, sc, cam, anim, drops, ooze, swell, S, groups, slab_top):
    out = a.out
    rx, ry = sc.render.resolution_x, sc.render.resolution_y
    dg = bpy.context.evaluated_depsgraph_get()
    bubs_of = {surf.name: b for surf, b in drops}
    sheets, world = [], []
    for k, (surf, _rebuild) in enumerate(anim):
        me = surf.data
        co = np.array([c for v in me.vertices for c in v.co], dtype=np.float32)
        tri = []
        for p_ in me.polygons:
            vs = list(p_.vertices)
            for q in range(1, len(vs) - 1):
                tri += [vs[0], vs[q], vs[q + 1]]
        tri = np.array(tri, dtype=np.uint32)
        with open(os.path.join(out, "sheet_%d.bin" % k), "wb") as f:
            f.write(co.tobytes()); f.write(tri.tobytes())
        b = bubs_of.get(surf.name)
        sheets.append({"name": surf.name, "matrix": mat_list(surf.matrix_world), "verts": len(me.vertices),
                       "tris": len(tri) // 3, "events": [event_json(e) for e in (b.events if b else [])],
                       "splat": [list(s_) for s_ in (b.splat if b else [])]})
        world += [surf.matrix_world @ v.co for v in me.vertices]
    proj = cam.calc_matrix_camera(dg, x=rx, y=ry, scale_x=sc.render.pixel_aspect_x, scale_y=sc.render.pixel_aspect_y)

    r = sc.render
    sc.render.use_persistent_data = True
    # 1. the plate
    r.filepath = os.path.join(out, "plate.png")
    bpy.ops.render.render(write_still=True)
    print("CHECK live plate", flush=True)

    # 2. the ooze's coverage: everything else held out
    keep = {surf.name for surf, _ in anim}
    held = []
    for o in sc.objects:
        if o.type in ("MESH", "CURVES", "CURVE") and o.name not in keep and not o.is_holdout:
            o.is_holdout = True; held.append(o)
    samples, denoise, comp = sc.cycles.samples, sc.cycles.use_denoising, r.use_compositing
    sc.cycles.samples, sc.cycles.use_denoising, r.use_compositing = 16, False, False
    r.film_transparent = True; r.image_settings.color_mode = "RGBA"
    r.filepath = os.path.join(out, "mask.png")
    bpy.ops.render.render(write_still=True)
    for o in held:
        o.is_holdout = False
    sc.cycles.samples, sc.cycles.use_denoising, r.use_compositing = samples, denoise, comp
    r.film_transparent = False; r.image_settings.color_mode = "RGB"
    print("CHECK live mask (%d held out)" % len(held), flush=True)

    # 3. the room as the ooze's clear coat mirrors it, from the middle of each sheet (the ooze itself hidden)
    principled = next(n_ for n_ in ooze.node_tree.nodes if n_.type == "BSDF_PRINCIPLED")
    coat = {k_: principled.inputs[k_].default_value for k_ in ("Coat Weight", "Coat Roughness", "Coat IOR")}
    probes = probe_faces(sc, cam, anim, a, out)
    principled.inputs["Coat Weight"].default_value = 0.0

    # 4. the normal basis, over the ooze's region only
    uv = [world_to_camera_view(sc, cam, p_) for p_ in world]
    pad = 0.03
    u0, u1 = max(0.0, min(p_.x for p_ in uv) - pad), min(1.0, max(p_.x for p_ in uv) + pad)
    v0, v1 = max(0.0, min(p_.y for p_ in uv) - pad), min(1.0, max(p_.y for p_ in uv) + pad)
    # whole pixels, so the browser can place the crop exactly
    px0, px1 = math.floor(u0 * rx), math.ceil(u1 * rx)
    py0, py1 = math.floor(v0 * ry), math.ceil(v1 * ry)
    r.use_border = True; r.use_crop_to_border = True
    r.border_min_x, r.border_max_x = px0 / rx, px1 / rx
    r.border_min_y, r.border_max_y = py0 / ry, py1 / ry
    sc.cycles.samples = a.basis_samples
    rot = ooze.node_tree.nodes["basis_tilt"]
    tilts = basis()
    for k, (t, f) in enumerate(tilts):
        fr = math.radians(f)
        rot.inputs["Axis"].default_value = (-math.sin(fr), math.cos(fr), 0.0)
        rot.inputs["Angle"].default_value = math.radians(t)
        r.filepath = os.path.join(out, "basis_%02d.png" % k)
        bpy.ops.render.render(write_still=True)
        print("CHECK live basis %d/%d tilt %d turn %d" % (k + 1, len(tilts), t, f), flush=True)
    # the same tilts with the skin torn open everywhere: only the coat's shine and the tear colour are left
    tm = ooze.node_tree.nodes["tear_mix"]
    tear_links = [l_ for l_ in ooze.node_tree.links if l_.to_socket == tm.inputs["Fac"]]
    tear_from = [l_.from_socket for l_ in tear_links]
    for l_ in tear_links:
        ooze.node_tree.links.remove(l_)
    tm.inputs["Fac"].default_value = 1.0
    for k, (t, f) in enumerate(tilts):
        fr = math.radians(f)
        rot.inputs["Axis"].default_value = (-math.sin(fr), math.cos(fr), 0.0)
        rot.inputs["Angle"].default_value = math.radians(t)
        r.filepath = os.path.join(out, "tear_%02d.png" % k)
        bpy.ops.render.render(write_still=True)
        print("CHECK live tear basis %d/%d" % (k + 1, len(tilts)), flush=True)
    tm.inputs["Fac"].default_value = 0.0
    for fs in tear_from:
        ooze.node_tree.links.new(fs, tm.inputs["Fac"])
    principled.inputs["Coat Weight"].default_value = coat["Coat Weight"]
    rot.inputs["Angle"].default_value = 0.0
    r.use_border = False
    img = bpy.data.images.load(os.path.join(out, "basis_00.png"))
    cw, ch = img.size

    json.dump({
        "res": [rx, ry],
        "camera": {"matrix": mat_list(cam.matrix_world), "projection": mat_list(proj),
                   "clip": [cam.data.clip_start, cam.data.clip_end]},
        # the basis crop in image pixels from the top left
        "region": {"x": px0, "y": ry - py1, "w": cw, "h": ch},
        "basis": [{"tilt": t, "turn": f} for t, f in tilts],
        "tilts": list(TILTS), "turns": TURNS,
        "loop_s": a.loop_s, "S": S, "swell": swell * S,
        "sheets": sheets,
        # the coat drawn live: weight, roughness, ior; the probes' faces and each sheet's probe centre (world)
        "coat": [coat["Coat Weight"], coat["Coat Roughness"], coat["Coat IOR"]],
        "probe": {"size": PROBE, "faces": [list(f) + list(u) for f, u in FACES], "centres": probes,
                  "box": room_box(sc, anim)},
        "pings": pings(sc, anim),
        # Standard view: display colour = sRGB(linear * 2^exposure)
        "view": {"transform": sc.view_settings.view_transform, "exposure": sc.view_settings.exposure},
    }, open(os.path.join(out, "live.json"), "w"))
    print("CHECK live json: %d sheets, %d events, region %dx%d" % (
        len(sheets), sum(len(s_["events"]) for s_ in sheets), cw, ch), flush=True)
