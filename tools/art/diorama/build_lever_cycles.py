# The lever square, for Cycles (Wesley 2026-11-26, look A, ~/.dos/scratch/d84406ef/lever/a-up.png): a big chunky floor
# lever, a stout oak handle with an iron ball knob coming up out of a slot in the middle of the square, the slot
# lined by a riveted iron plate set into the slab (no base block: Wesley 2026-11-27). Rendered in the set like the gate (build_gate_cycles.py):
# a browser-lit lever looked "GameCube" next to the baked set. Shapes from lever_parts.py / lever_geom.py, materials
# from prop_mats.py (the gate's iron and photo oak), the set's stone and moss.
#
#   Blender -b --python build_lever_cycles.py -- --out DIR [--res 1600 --samples 128 --states left,right
#       --square 4,0 --zoom 0]
# writes DIR/lever-{state}.png (states: left, right, or a fraction of the throw like 0.5) and DIR/lever-limits.json
# (the square's throw angles: shorter where the set is in the way, lever_geom.throw_limits). With --bake (runs from
# runleverbake.sh): the throw's sprite frames instead, DIR/throw0_NN.png (lever_geom.sheet_t: right, then left) +
# throw.json.
import bpy, sys, os, math, argparse
from mathutils import Vector

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import stage
import lever_geom as lg
import lever_parts as lp
import prop_mats as pm
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--states", default="left,right")
ap.add_argument("--square", default="4,0")             # the near-right corner of the 5x5 board
ap.add_argument("--nx", type=int, default=5)
ap.add_argument("--ny", type=int, default=5)
ap.add_argument("--stop", default="")
ap.add_argument("--zoom", type=float, default=0.0)
ap.add_argument("--wood_sat", type=float, default=0.7)
ap.add_argument("--handle_sat", type=float, default=0.9)  # the handle: the draft's golden polished oak, warmer than the gate's weathered doors
ap.add_argument("--knob_rust", type=float, default=lg.KNOB_RUST)  # the knob's rust (damp_iron amount): a hand still grips it, so less than full
ap.add_argument("--oak_val", type=float, default=0.42)
ap.add_argument("--bake", action="store_true")        # the throw's sprite frames for this square (one layer) instead of the stills
ap.add_argument("--glow-k", type=float, default=16.0)  # as the gate: light over 1.0 that goes to the glow sheet
ap.add_argument("--size", type=float, default=lg.SIZE)  # the whole lever, scaled about the square's centre
ap.add_argument("--save", default="")                  # also save the scene as a .blend (for a look round)
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)

H = 1.7
S = 1.2 * H
from level_camera import ASPECT, FOCAL, stop_camera
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
uv_c = world_to_camera_view(sc, cam, Vector((cx, cy, top)))
print("CHECK square %d,%d centre %.3f %.3f top %.4f on screen %.2f %.2f" % (i, j, cx, cy, top, uv_c.x, uv_c.y), flush=True)
coll = bpy.data.collections.new("Lever"); sc.collection.children.link(coll)

# the slab's height under a point of the square (square units above `top`): the plate and its moss lie on it
inv = slab.matrix_world.inverted()


def floor(x, y):
    o = inv @ Vector((cx + x * S, cy + y * S, top + 0.5 * S))
    d = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
    hit, loc, _, _ = slab.ray_cast(o, d)
    return ((slab.matrix_world @ loc).z - top) / S if hit else 0.0


# ---------------- materials: the gate's and the set's own ----------------
MATS = {"oak": pm.photo_oak("lever_oak", S, wood_sat=a.handle_sat, oak_val=a.oak_val, foot=False),
        # old dungeon iron (prop_mats.damp_iron): the gate keeps its baked, lighter iron
        "iron": pm.iron_mat(0.05 * S, name="lever_iron", rust="damp", rust_at=(0.42, 0.58), worn="edges", disp=0.03, amount=0.3),   # dark iron, rust in blooms (judge: read as all rust)
        "knob": pm.iron_mat(0.06 * S, name="lever_knob", rust="damp", rust_at=(0.46, 0.6), rough=0.62, worn="top", disp=0.025, amount=a.knob_rust),   # hand-worn on top
        "rust": pm.iron_mat(0.035 * S, name="lever_rust", rust="damp", rust_at=(0.42, 0.55), rough=0.6, worn="edges", disp=0.035),
        "stone": stage._stone_mat(), "moss": pm.set_moss(sc, stage)}
crack = bpy.data.materials.new("lever_crack"); crack.use_nodes = True
cb = crack.node_tree.nodes["Principled BSDF"]
cb.inputs["Base Color"].default_value = (0.006, 0.005, 0.004, 1); cb.inputs["Roughness"].default_value = 1.0
MATS["crack"] = crack
print("CHECK moss material %s" % MATS["moss"].name, flush=True)

# ---------------- the lever ----------------
root = bpy.data.objects.new("lever_root", None); coll.objects.link(root)
root.location = (cx, cy, top)
root.scale = (a.size,) * 3   # Wesley 2026-11-27: "just a little too big"
HOLE = (lg.PIVOT[0] * a.size, lg.PIVOT[1] * a.size)   # the slot's middle
def floor_l(x, y):
    """floor() for the scaled lever: lever_parts builds in the unscaled lever's units, the root scales it by --size."""
    return floor(x * a.size, y * a.size) / a.size


parts = lp.build(coll, MATS, S, stage, floor_l)
for k in ("plate", "handle", "slot"):
    parts[k].parent = root
for m_ in parts["moss"]:
    m_.parent = root
# the slot: a real cut in the slab, lined by the lever's own walls and floor
import bmesh
cg = lp.slot_cutter(floor_l)
for v in cg.verts:
    v.co = Vector((cx, cy, top)) + v.co * S * a.size
cme = bpy.data.meshes.new("lever_slab_cut"); cg.to_mesh(cme); cg.free()
cut = bpy.data.objects.new("lever_slab_cut", cme); coll.objects.link(cut); cut.hide_render = True; cut.hide_viewport = True
# no boolean: on the set's non-manifold slab EXACT cuts nothing and FLOAT took 8 of its 21857 vertices (the slot
# showed the slab's top, 2026-11-27). Instead the slab's faces over the slot's outline go; the hole's ragged edge
# sits under the iron plate, which overlaps the slot by 0.04 a side and more.
cwb = [cut.matrix_world @ v.co for v in cme.vertices]
kx0, kx1 = min(p_.x for p_ in cwb), max(p_.x for p_ in cwb)
ky0, ky1 = min(p_.y for p_ in cwb), max(p_.y for p_ in cwb)
slab.data = slab.data.copy()   # the cut is this square's alone
sg_ = bmesh.new(); sg_.from_mesh(slab.data); mw_ = slab.matrix_world
sg_.transform(mw_)   # cut in world space (the slab's matrix flips and squashes its axes)
for co_, no_ in (((kx0, 0, 0), (1, 0, 0)), ((kx1, 0, 0), (1, 0, 0)), ((0, ky0, 0), (0, 1, 0)), ((0, ky1, 0), (0, 1, 0))):
    # slice along the slot's sides first: some of the slab's faces span the whole slot with no corner inside it
    bmesh.ops.bisect_plane(sg_, geom=sg_.verts[:] + sg_.edges[:] + sg_.faces[:], plane_co=co_, plane_no=no_)
gone_ = [f_ for f_ in sg_.faces if kx0 < f_.calc_center_median().x < kx1 and ky0 < f_.calc_center_median().y < ky1]
bmesh.ops.delete(sg_, geom=gone_, context="FACES"); sg_.transform(mw_.inverted())
sg_.to_mesh(slab.data); sg_.free()
print("CHECK slot cut %d slab faces" % len(gone_), flush=True)
print("CHECK floor under the slot %.4f, plate bottom/top %.4f %.4f" % ((floor(*HOLE),) + lp.plate_heights(floor_l)), flush=True)

bpy.context.view_layer.update()
# the set in the way: the near-right corner's birch trunk stands inside square 4,0, and a full 35 degree throw right
# put the knob 0.07 of a square into it. Measure every set mesh near the square and shorten the throw only there.
from mathutils.bvhtree import BVHTree
SKIP = ("Ground", "Slab_", "GroutMoss", "Moss", "HazeVolume", "FrameBase", "lever")
dg = bpy.context.evaluated_depsgraph_get()
near_trees = []
for o in sc.objects:
    if o.type != "MESH" or o.hide_render or o.name.startswith(SKIP):
        continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    if max(p.x for p in bb) < cx - S or min(p.x for p in bb) > cx + S or max(p.y for p in bb) < cy - S or min(p.y for p in bb) > cy + S:
        continue
    near_trees.append((o.name, BVHTree.FromObject(o, dg, deform=True), o.matrix_world.copy(), o.matrix_world.inverted()))


def set_dist(x, y, z):
    """Square units from a lever point (about the square's centre, on its floor) to the nearest set mesh. Unsigned:
    the set's walls and hanging moss are open sheets with no inside (a normal-sign test called the lever "inside"
    them); throw_limits steps out from upright and stops at first touch, so it never needs to see inside a trunk."""
    pw = Vector((cx + x * S, cy + y * S, top + z * S))
    best = 9.0
    for _, tr, m, mi in near_trees:
        pl = mi @ pw
        loc, nrm, _, _ = tr.find_nearest(pl)
        if loc is None:
            continue
        d = (m @ loc - pw).length / S
        best = min(best, d)
    return best


def set_dist_l(x, y, z):
    """set_dist in the unscaled lever's units (throw_limits and handle_gap measure the lever as lever_geom draws it)."""
    return set_dist(x * a.size, y * a.size, z * a.size) / a.size


LIMITS = lg.throw_limits(set_dist_l)
print("CHECK set near the square: %s" % ", ".join(n for n, *_ in near_trees), flush=True)
print("CHECK throw limits left %.1f right %.1f deg (gap at them %.3f %.3f squares)" % (
    LIMITS + (lg.handle_gap(-math.radians(LIMITS[0]), set_dist_l), lg.handle_gap(math.radians(LIMITS[1]), set_dist_l))), flush=True)
root["throw_limits"] = list(LIMITS)
import json
with open(os.path.join(a.out, "lever-limits.json"), "w") as f_:
    json.dump({"square": a.square, "left_deg": LIMITS[0], "right_deg": LIMITS[1]}, f_)
if a.zoom:
    corners = [Vector((cx + dx * S, cy + dy * S, top + dz * S)) for dx in (-1, 1) for dy in (-0.5, 0.5) for dz in (0, 1)]
    uvs = [world_to_camera_view(sc, cam, p) for p in corners]
    rx, ry = sc.render.resolution_x, sc.render.resolution_y
    box = (min(p.x for p in uvs), max(p.x for p in uvs), min(p.y for p in uvs), max(p.y for p in uvs))
    cx_, cy_ = (box[0] + box[1]) / 2, (box[2] + box[3]) / 2
    hwz = (box[1] - box[0]) * a.zoom / 2
    hh = hwz * rx / ry * 0.75
    r_ = sc.render
    r_.use_border = True; r_.use_crop_to_border = True
    r_.border_min_x, r_.border_max_x = max(0, cx_ - hwz), min(1, cx_ + hwz)
    r_.border_min_y, r_.border_max_y = max(0, cy_ - hh), min(1, cy_ + hh)
if a.bake:
    # The square's sprite, one layer per throw frame (the gate's bake, build_gate_cycles.py --bake, with only its back
    # layer): each frame is the whole set rendered with the lever in it, and a value pass (an AOV, filtered like the
    # picture, so edges are soft) cuts out the lever (plate, slot, handle, moss) and its own floor slab with the
    # lever's shadow on it. One layer, drawn under figures: nobody stands on the lever's square, and its knob stays below the
    # feet of a figure on the square behind.
    import time
    import gpu_retry
    import OpenImageIO as oiio
    import numpy as np
    vl = bpy.context.view_layer
    if "mine" not in vl.aovs:
        ao = vl.aovs.add(); ao.name = "mine"; ao.type = "VALUE"
    M = cam.matrix_world; cpos = M.translation.copy()
    fwd = -(M.to_3x3() @ Vector((0, 0, 1))); right = M.to_3x3() @ Vector((1, 0, 0)); up = M.to_3x3() @ Vector((0, 1, 0))
    tagged = set()

    def tag(mat):
        """Write the value pass from this material. Shared ones (the stone, the moss) are used all over the set: the
        object's own lever_mine property (0 when missing) keeps the rest of the set out."""
        if mat is None or mat.name in tagged or not mat.use_nodes:
            return
        tagged.add(mat.name)
        nt = mat.node_tree
        am = nt.nodes.new("ShaderNodeAttribute"); am.attribute_type = "OBJECT"; am.attribute_name = "lever_mine"
        om = nt.nodes.new("ShaderNodeOutputAOV"); om.aov_name = "mine"
        nt.links.new(am.outputs["Fac"], om.inputs["Value"])

    def tag_hole(mat, r):
        """The set's ground, seen through the slot where the cut opens the slab's underside: in the layer only within
        r of the hole (a position test in the shader), so the game's uncut floor does not show in it."""
        nt = mat.node_tree
        ge = nt.nodes.new("ShaderNodeNewGeometry")
        sub = nt.nodes.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"
        sub.inputs[1].default_value = (cx + HOLE[0] * S, cy + HOLE[1] * S, 0.0)
        mul = nt.nodes.new("ShaderNodeVectorMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = (1, 1, 0)
        ln = nt.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"
        lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = r
        om = nt.nodes.new("ShaderNodeOutputAOV"); om.aov_name = "mine"
        nt.links.new(ge.outputs["Position"], sub.inputs[0]); nt.links.new(sub.outputs["Vector"], mul.inputs[0])
        nt.links.new(mul.outputs["Vector"], ln.inputs[0]); nt.links.new(ln.outputs["Value"], lt.inputs[0])
        nt.links.new(lt.outputs["Value"], om.inputs["Value"])

    lever_objs = [o for o in coll.all_objects if o.type == "MESH" and not o.hide_render]
    for o in sc.objects:
        if o.type == "MESH" and o.name.startswith("Ground"):
            for ms in o.material_slots:
                if ms.material is not None and ms.material.use_nodes and ms.material.name not in tagged:
                    tagged.add(ms.material.name); tag_hole(ms.material, 0.6 * lg.SLOT_L * a.size * S)
    for o in lever_objs + [slab]:
        o["lever_mine"] = 1
        for ms in o.material_slots:
            tag(ms.material)
    print("CHECK lever objects %d" % len(lever_objs), flush=True)
    # what the camera sees down the slot: it must be the lever's own (its walls and black floor), or the
    # layer is see-through there and the game's uncut floor shows in the hole
    seen = {}
    cw_ = [parts["slot"].matrix_world @ v.co for v in parts["slot"].data.vertices]
    zf_ = min(p_.z for p_ in cw_)   # the slot's black floor
    cen_ = Vector((cx + HOLE[0] * S, cy + HOLE[1] * S, zf_ + 0.005 * S))
    for p_ in [cen_] + [cen_ + Vector((0.4 * lg.SLOT_L * a.size * S * math.cos(q_), 0.3 * lg.SLOT_W * a.size * S * math.sin(q_), 0)) for q_ in range(6)]:
        o_, d_, nm_ = cpos.copy(), (p_ - cpos).normalized(), "nothing"
        for _ in range(8):  # through the haze (a volume: its box is no surface)
            hit_, loc_, _, _, ob_, _ = sc.ray_cast(bpy.context.evaluated_depsgraph_get(), o_, d_)
            if not hit_:
                break
            if ob_.name.startswith("HazeVolume"):
                o_ = loc_ + d_ * 1e-3; continue
            nm_ = ob_.name; break
        seen[nm_] = seen.get(nm_, 0) + 1
    print("CHECK seen in the slot: %s" % ", ".join("%s x%d" % kv for kv in seen.items()), flush=True)
    TS = lg.sheet_t()

    # crop: the slab and the lever at every angle it reaches, snapped to whole pixels
    rx, ry = sc.render.resolution_x, sc.render.resolution_y
    pts = [slab.matrix_world @ Vector(c) for c in slab.bound_box]
    for t_ in (0.0, 0.25, 0.5, 0.75, 1.0):
        lp.set_throw(parts, t_, LIMITS); bpy.context.view_layer.update()
        for o in lever_objs:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    uv_ = [world_to_camera_view(sc, cam, p) for p in pts]
    u0, u1 = math.floor(max(0, min(q.x for q in uv_)) * rx) / rx, math.ceil(min(1, max(q.x for q in uv_)) * rx) / rx
    v0, v1 = math.floor(max(0, min(q.y for q in uv_)) * ry) / ry, math.ceil(min(1, max(q.y for q in uv_)) * ry) / ry
    r_ = sc.render
    r_.use_border = True; r_.use_crop_to_border = True
    r_.border_min_x, r_.border_max_x, r_.border_min_y, r_.border_max_y = u0, u1, v0, v1
    r_.film_transparent = True
    print("CROP", u0, u1, v0, v1, "px", round((u1 - u0) * rx), round((v1 - v0) * ry), flush=True)
    F0 = Vector((cx, cy, 0.0))  # the square's centre: the game slides the quad from here (as the gate's)
    d0 = (F0 - cpos).dot(fwd)
    dq = min((p - cpos).dot(fwd) for p in pts) - 0.03 * H
    tanX = 18.0 / FOCAL; tanY = tanX / ASPECT
    at_plane = lambda u_, v_: cpos + (fwd + (2 * u_ - 1) * tanX * right + (2 * v_ - 1) * tanY * up) * dq
    P0 = cpos + (F0 - cpos) * (dq / d0)
    cn = [at_plane(u_, v_) - P0 for u_, v_ in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
    quad = {"x0": cn[0].dot(right), "x1": cn[1].dot(right), "y0": cn[0].dot(up), "y1": cn[2].dot(up)}
    im_ = sc.render.image_settings
    im_.media_type = "MULTI_LAYER_IMAGE"; im_.file_format = "OPEN_EXR_MULTILAYER"; im_.color_depth = "32"; im_.color_mode = "RGBA"

    def srgb(x):
        x = np.clip(x, 0, 1)
        return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)

    def read_exr(exr):
        img = oiio.ImageInput.open(exr); chans, j_ = {}, 0
        while img.seek_subimage(j_, 0):
            sp_ = img.spec()
            px_ = np.asarray(img.read_image(j_, 0, 0, sp_.nchannels, "float")).reshape(sp_.height, sp_.width, sp_.nchannels)
            for q, nm in enumerate(sp_.channelnames):
                chans[nm] = px_[:, :, q]
            j_ += 1
        img.close()
        os.remove(exr)
        ch = lambda s_: next(v for nm, v in chans.items() if nm.endswith(s_) and "Noisy" not in nm)
        val = lambda s_: np.clip(next(v for nm, v in chans.items() if (nm.endswith("." + s_ + ".X") or nm.endswith("." + s_ + ".V")
                                                                         or nm.endswith("." + s_)) and "Noisy" not in nm), 0, 1)
        return np.stack([ch("Combined.R"), ch("Combined.G"), ch("Combined.B")], -1), val("mine")

    def write(png, rgb, al):
        h_, w_ = al.shape
        sp = oiio.ImageSpec(w_, h_, 4, "uint8"); sp.attribute("oiio:UnassociatedAlpha", 1)
        ob = oiio.ImageBuf(sp); ob.set_pixels(oiio.ROI(), (np.concatenate([srgb(rgb), al[..., None]], -1) * 255 + 0.5).astype(np.uint8)); ob.write(png)
        glow = np.clip((rgb - 1.0) / a.glow_k, 0, 1) * (al[..., None] > 0.02)  # no glow on the lever: kept for the sheet's shape
        gb = oiio.ImageBuf(oiio.ImageSpec(w_, h_, 3, "uint8")); gb.set_pixels(oiio.ROI(), (np.sqrt(glow) * 255 + 0.5).astype(np.uint8))
        gb.write(png[:-4] + "-glow.png")

    for k, t_ in enumerate(TS):
        png = os.path.join(a.out, "throw0_%02d.png" % k)
        if os.path.exists(png):  # resumes after a Metal crash
            continue
        lp.set_throw(parts, t_, LIMITS); bpy.context.view_layer.update()
        exr = os.path.join(a.out, "f%02d.exr" % k); sc.render.filepath = exr
        t0 = time.time(); gpu_retry.render()
        rgb, mine_ = read_exr(exr)
        write(png, rgb, mine_)
        print("RENDER_SECONDS %02d %.1f t %.3f" % (k, time.time() - t0, t_), flush=True)
    info = {"H": H, "S": S, "res": [rx, ry], "crop": [u0, v0, u1, v1], "right": list(right), "up": list(up),
            "fwd": list(fwd), "camera": list(cpos), "d0": d0, "dq": dq, "anchor": list(P0), "quad": quad,
            "exposure": 0.0, "glowK": a.glow_k, "headings": 1, "samples": a.samples, "square": [i, j],
            "centre": [cx, cy], "frames": len(TS), "fps": lg.THROW_FPS, "throwFrames": lg.THROW_FRAMES,
            "limits": list(LIMITS), "t": TS}
    json.dump(info, open(os.path.join(a.out, "throw.json"), "w"), indent=1)
    print("LEVER BAKE OK", flush=True)
    sys.exit(0)
if a.save:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save))

import time
for name in a.states.split(","):
    t = lg.STATES.get(name)
    t = float(name) if t is None else t
    lp.set_throw(parts, t, LIMITS)
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(a.out, "lever-%s.png" % name)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("CHECK rendered %s in %.1f s" % (sc.render.filepath, time.time() - t0), flush=True)
print("LEVER STILLS OK", flush=True)
