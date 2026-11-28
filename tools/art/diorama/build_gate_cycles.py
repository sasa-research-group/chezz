# The gate square, for Cycles (Wesley 2026-11-26, look "Middle 1"): a round mossy stone arch between the wall's posts
# over two weathered oak doors with iron straps, ring pulls and woody vines; open, the doors swing back against the
# posts. Rendered in the set like the trapdoor and snare: a browser-lit gate looked "GameCube" next to the baked set.
# Shapes from gate_parts.py / gate_geom.py; the walls either side are the game's own wall pieces (walls.ts), placed
# from a JSON list of pieces (see --walls).
#
#   Blender -b --python build_gate_cycles.py -- --out DIR [--res 1600 --samples 128 --states shut,open
#       --square 2,2 --walls walls.json | --posts --zoom 0 --turn 0]
# writes DIR/gate-{state}.png (states: shut, open, or a fraction like 0.5). With --bake (runs from rungatebake.sh):
# the swing's sprite frames instead, DIR/swing0_NN.png (under figures) + front0_NN.png (over the figure in the
# doorway) + swing.json / front.json.
import bpy, sys, os, math, argparse, json
from mathutils import Vector

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import stage
import gate_geom as gg
import gate_parts as gp
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--states", default="shut,open")
ap.add_argument("--square", default="2,2")
ap.add_argument("--turn", type=float, default=0.0)     # radians: a quarter turn when the wall runs front to back
ap.add_argument("--fwd", type=float, default=0.06)     # gate.ts GATE_FWD
ap.add_argument("--walls", default="")                 # {"WALL_H", "WALL_T", "PILLAR_W", "PILLAR_H", "pieces": [...]}
ap.add_argument("--nx", type=int, default=5)
ap.add_argument("--ny", type=int, default=5)
ap.add_argument("--stop", default="")
ap.add_argument("--zoom", type=float, default=0.0)
ap.add_argument("--wood", default="1.85,2.9,5.6")      # WOOD_TINT, as the trapdoor's door
ap.add_argument("--wood_sat", type=float, default=0.7)
ap.add_argument("--oak_val", type=float, default=0.42)
ap.add_argument("--vine_val", type=float, default=0.45)  # the vines: the same oak, darker
ap.add_argument("--posts", action="store_true")       # the walls either side made here (a run through the gate), not --walls
ap.add_argument("--bake", action="store_true")        # the swing's sprite frames for this square (two layers) instead of the stills
ap.add_argument("--glow-k", type=float, default=16.0)  # as the snare: light over 1.0 that goes to the glow sheet
ap.add_argument("--frames", type=int, default=0)  # 0: gate_geom.SWING_FRAMES
a = ap.parse_args(argv)
a.frames = a.frames or gg.SWING_FRAMES
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
print("CHECK square %d,%d centre %.3f %.3f top %.4f" % (i, j, cx, cy, top), flush=True)
coll = bpy.data.collections.new("Gate"); sc.collection.children.link(coll)


# ---------------- materials: the set's own (prop_mats.py, shared with the lever) ----------------
import prop_mats as pm


def iron_mat(u):
    return pm.iron_mat(u)


def oak(name, val):
    return pm.oak(stage, name, val, wood=a.wood, wood_sat=a.wood_sat)


def door_oak(name):
    """The doors' oak: the photo oak (prop_mats.photo_oak) on per-plank UVs from gate_parts (each plank its own
    strip, its own tone), the foot weathered grey."""
    return pm.photo_oak(name, S, wood_sat=a.wood_sat, oak_val=a.oak_val)


_moss = sc.objects.get("Moss")
MATS = {"oak": door_oak("gate_oak"), "vine": oak("gate_vine", a.vine_val), "iron": iron_mat(0.1 * S),
        "stone": stage._stone_mat(), "moss": _moss.active_material if _moss is not None else stage._moss_mat()}
print("CHECK moss material %s" % MATS["moss"].name, flush=True)

# ---------------- the gate ----------------
root = bpy.data.objects.new("gate_root", None); coll.objects.link(root)
root.location = (cx - math.sin(a.turn) * -a.fwd * S, cy + math.cos(a.turn) * -a.fwd * S, top)
root.rotation_euler = (0, 0, a.turn)
gp.OAK_TEX = os.path.join(HERE, "tex", "gate_oak.png")
parts = gp.build(coll, MATS, S, stage)
for k in ("arch", "leafL", "leafR"):
    parts[k].parent = root
parts["moss"][0].parent = root

# ---------------- the walls either side: the game's own pieces ----------------
WALLS = {"WALL_H": 0.65, "WALL_T": 0.26, "PILLAR_W": 0.36, "PILLAR_H": 1.25}  # walls.ts
pub = os.path.join(HERE, "..", "..", "..", "public", "diorama")
GLBS = {"seg": "wall-seg.glb", "half": "wall-half.glb", "pil": "wall-pil.glb"}


def wall_piece(n_, kind, x, y, turn, mirror, W):
    """One wall piece at stage (x, y) on the floor, as Diorama.tsx Wall stands it up."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(pub, GLBS[kind]))
    new = [o for o in bpy.data.objects if o not in before]
    holder = bpy.data.objects.new("wall_%d" % n_, None); coll.objects.link(holder)
    holder.location = (x, y, top)
    holder.rotation_euler = (0, 0, turn)
    inner = bpy.data.objects.new("wall_%d_s" % n_, None); coll.objects.link(inner); inner.parent = holder
    h = W["WALL_H"] * H
    # the glb is a y-up unit box (z-up here after import): x along the wall, y its depth, z its height
    if kind == "pil":
        inner.scale = (W["PILLAR_W"] * S, W["PILLAR_W"] * S, W["PILLAR_H"] * h)
    else:
        inner.scale = ((-1 if mirror else 1) * (1 if kind == "seg" else 0.5) * S, W["WALL_T"] * S, h)
    for o in new:
        if o.parent is None:
            o.parent = inner
        o["wall"] = 1


n_wall = 0
if a.walls:
    W = json.load(open(a.walls))
    for p in W["pieces"]:
        sx_, sy_ = p["sq"]
        wall_piece(n_wall, p["kind"], (sx_ - (NX - 1) / 2 + p["x"]) * S, (sy_ - (NY - 1) / 2 + p["y"]) * S, p["turn"], p["mirror"], W)
        n_wall += 1
elif a.posts:
    # a wall run through the gate (the common case): on each side that is on the board, the neighbour's stretch and the
    # post at its edge against the gate (walls.ts wallPieces: posts at 0.5 - PILLAR_W / 2 from the neighbour's centre)
    ax = (math.cos(a.turn), math.sin(a.turn))
    e = 0.5 - WALLS["PILLAR_W"] / 2
    for side in (-1, 1):
        ni, nj = (i + side, j) if abs(ax[0]) > 0.5 else (i, j + side)
        if not (0 <= ni < NX and 0 <= nj < NY):
            continue
        nx_, ny_ = cx + side * ax[0] * S, cy + side * ax[1] * S
        wall_piece(n_wall, "seg", nx_, ny_, a.turn, False, WALLS); n_wall += 1
        wall_piece(n_wall, "pil", nx_ - side * ax[0] * e * S, ny_ - side * ax[1] * e * S, 0.0, False, WALLS); n_wall += 1
print("CHECK walls %d pieces" % n_wall, flush=True)

bpy.context.view_layer.update()
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
    # The square's sprites, two layers per swing frame, as the snare's (build_snare_cycles.py --bake): each frame is
    # the whole set rendered with the gate in it; two value passes (AOVs, filtered like the picture, so edges are soft)
    # cut the layers out of the same render. "mine": the gate (arch, doors, moss, vines) and its own floor slab with
    # the gate's shadow on it, the back layer; "front": the gate's parts nearer the camera than the vertical plane
    # through the square's centre (where a figure stands in the open doorway), the front layer drawn over that
    # figure. The walls either side stay in the render (their shadows and their posts' cover fall where the game's
    # live walls stand) but out of both layers: the game draws them itself.
    import time
    import gpu_retry
    import OpenImageIO as oiio
    import numpy as np
    vl = bpy.context.view_layer
    for nm in ("mine", "front"):
        if nm not in vl.aovs:
            ao = vl.aovs.add(); ao.name = nm; ao.type = "VALUE"
    M = cam.matrix_world; cpos = M.translation.copy()
    fwd = -(M.to_3x3() @ Vector((0, 0, 1))); right = M.to_3x3() @ Vector((1, 0, 0)); up = M.to_3x3() @ Vector((0, 1, 0))
    fh = Vector((fwd.x, fwd.y, 0)).normalized()
    centre = Vector((cx, cy, top))
    tagged = set()

    def tag(mat):
        """Write both value passes from this material. Shared ones (the stone, the moss) are used all over the set:
        the object's own gate_mine / gate_front properties (0 when missing) keep the rest of the set out."""
        if mat is None or mat.name in tagged or not mat.use_nodes:
            return
        tagged.add(mat.name)
        nt = mat.node_tree
        am = nt.nodes.new("ShaderNodeAttribute"); am.attribute_type = "OBJECT"; am.attribute_name = "gate_mine"
        om = nt.nodes.new("ShaderNodeOutputAOV"); om.aov_name = "mine"
        nt.links.new(am.outputs["Fac"], om.inputs["Value"])
        af = nt.nodes.new("ShaderNodeAttribute"); af.attribute_type = "OBJECT"; af.attribute_name = "gate_front"
        ge = nt.nodes.new("ShaderNodeNewGeometry")
        sub = nt.nodes.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"; sub.inputs[1].default_value = centre
        dot = nt.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"; dot.inputs[1].default_value = fh
        lt = nt.nodes.new("ShaderNodeMath"); lt.operation = "LESS_THAN"; lt.inputs[1].default_value = 0.0
        mu = nt.nodes.new("ShaderNodeMath"); mu.operation = "MULTIPLY"
        of = nt.nodes.new("ShaderNodeOutputAOV"); of.aov_name = "front"
        nt.links.new(ge.outputs["Position"], sub.inputs[0]); nt.links.new(sub.outputs["Vector"], dot.inputs[0])
        nt.links.new(dot.outputs["Value"], lt.inputs[0]); nt.links.new(lt.outputs["Value"], mu.inputs[0])
        nt.links.new(af.outputs["Fac"], mu.inputs[1]); nt.links.new(mu.outputs["Value"], of.inputs["Value"])

    gate_objs = [o for o in coll.all_objects if o.type == "MESH" and not o.get("wall")]
    slab["gate_mine"] = 1
    for ms in slab.material_slots:
        tag(ms.material)
    for o in gate_objs:
        o["gate_mine"] = 1; o["gate_front"] = 1
        for ms in o.material_slots:
            tag(ms.material)
    print("CHECK gate objects %d" % len(gate_objs), flush=True)

    # crop: the slab and the gate at every frame of the swing, snapped to whole pixels
    rx, ry = sc.render.resolution_x, sc.render.resolution_y
    pts = [slab.matrix_world @ Vector(c) for c in slab.bound_box]
    for k in range(a.frames):
        gp.set_leaves(parts, gg.swing_open(k, a.frames)); bpy.context.view_layer.update()
        for o in gate_objs:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    uv_ = [world_to_camera_view(sc, cam, p) for p in pts]
    u0, u1 = math.floor(max(0, min(q.x for q in uv_)) * rx) / rx, math.ceil(min(1, max(q.x for q in uv_)) * rx) / rx
    v0, v1 = math.floor(max(0, min(q.y for q in uv_)) * ry) / ry, math.ceil(min(1, max(q.y for q in uv_)) * ry) / ry
    r_ = sc.render
    r_.use_border = True; r_.use_crop_to_border = True
    r_.border_min_x, r_.border_max_x, r_.border_min_y, r_.border_max_y = u0, u1, v0, v1
    r_.film_transparent = True
    print("CROP", u0, u1, v0, v1, "px", round((u1 - u0) * rx), round((v1 - v0) * ry), flush=True)
    F0 = Vector((cx, cy, 0.0))  # the square's centre: the game slides the quad from here (as the snare's)
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
        return np.stack([ch("Combined.R"), ch("Combined.G"), ch("Combined.B")], -1), val("mine"), val("front")

    def write(png, rgb, al):
        h_, w_ = al.shape
        sp = oiio.ImageSpec(w_, h_, 4, "uint8"); sp.attribute("oiio:UnassociatedAlpha", 1)
        ob = oiio.ImageBuf(sp); ob.set_pixels(oiio.ROI(), (np.concatenate([srgb(rgb), al[..., None]], -1) * 255 + 0.5).astype(np.uint8)); ob.write(png)
        glow = np.clip((rgb - 1.0) / a.glow_k, 0, 1) * (al[..., None] > 0.02)  # no glow on the gate: kept for the sheet's shape
        gb = oiio.ImageBuf(oiio.ImageSpec(w_, h_, 3, "uint8")); gb.set_pixels(oiio.ROI(), (np.sqrt(glow) * 255 + 0.5).astype(np.uint8))
        gb.write(png[:-4] + "-glow.png")

    def shoot(k):
        tag_ = "%02d" % k
        back = os.path.join(a.out, "swing0_%s.png" % tag_)
        if os.path.exists(back) and os.path.exists(os.path.join(a.out, "front0_%s.png" % tag_)):  # resumes after a Metal crash
            return
        gp.set_leaves(parts, gg.swing_open(k, a.frames)); bpy.context.view_layer.update()
        exr = os.path.join(a.out, "f%s.exr" % tag_); sc.render.filepath = exr
        t0 = time.time(); gpu_retry.render()
        rgb, mine_, front_ = read_exr(exr)
        write(back, rgb, mine_)
        write(os.path.join(a.out, "front0_%s.png" % tag_), rgb, np.minimum(front_, mine_))
        print("RENDER_SECONDS %s %.1f front %.4f" % (tag_, time.time() - t0, float(front_.mean())), flush=True)

    for k in range(a.frames):
        shoot(k)
    info = {"H": H, "S": S, "res": [rx, ry], "crop": [u0, v0, u1, v1], "right": list(right), "up": list(up),
            "fwd": list(fwd), "camera": list(cpos), "d0": d0, "dq": dq, "anchor": list(P0), "quad": quad,
            "exposure": 0.0, "glowK": a.glow_k, "headings": 1, "samples": a.samples, "square": [i, j], "turn": a.turn,
            "centre": [cx, cy], "frames": a.frames, "fps": gg.SWING_FPS,
            "open": [gg.swing_open(k, a.frames) for k in range(a.frames)]}
    json.dump(info, open(os.path.join(a.out, "swing.json"), "w"), indent=1)
    json.dump(info, open(os.path.join(a.out, "front.json"), "w"), indent=1)
    print("GATE BAKE OK", flush=True)
    sys.exit(0)
for name in a.states.split(","):
    f = {"shut": 0.0, "open": 1.0}.get(name)
    f = float(name) if f is None else f
    gp.set_open(parts, f)
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(a.out, "gate-%s.png" % name)
    bpy.ops.render.render(write_still=True)
    print("CHECK rendered", sc.render.filepath, flush=True)
print("GATE STILLS OK", flush=True)
