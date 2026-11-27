# The lever square, for Cycles (Wesley 2026-11-26, look A, ~/.dos/scratch/d84406ef/lever/a-up.png): a big chunky floor
# lever, a stout oak handle with an iron ball knob in a slotted, chipped, mossy stone block at the back of the square,
# a rusty chain from the block's foot into a crack in the floor. Rendered in the set like the gate (build_gate_cycles.py):
# a browser-lit lever looked "GameCube" next to the baked set. Shapes from lever_parts.py / lever_geom.py, materials
# from prop_mats.py (the gate's iron and photo oak), the set's stone and moss.
#
#   Blender -b --python build_lever_cycles.py -- --out DIR [--res 1600 --samples 128 --states left,right
#       --square 4,0 --zoom 0]
# writes DIR/lever-{state}.png (states: left, right, or a fraction of the throw like 0.5) and DIR/lever-limits.json
# (the square's throw angles: shorter where the set is in the way, lever_geom.throw_limits).
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
ap.add_argument("--knob_rust", type=float, default=lg.KNOB_RUST)  # the knob's rust (damp_iron amount): a hand still grips it, so less than the chain
ap.add_argument("--oak_val", type=float, default=0.42)
ap.add_argument("--save", default="")                  # also save the scene as a .blend (for a look round)
a = ap.parse_args(argv)
os.makedirs(a.out, exist_ok=True)

H = 1.7
S = 1.2 * H
from level_camera import ASPECT, stop_camera
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

# the slab's height under a point of the square (square units above `top`): the chain and the crack lie on it
inv = slab.matrix_world.inverted()


def floor(x, y):
    o = inv @ Vector((cx + x * S, cy + y * S, top + 0.5 * S))
    d = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
    hit, loc, _, _ = slab.ray_cast(o, d)
    return ((slab.matrix_world @ loc).z - top) / S if hit else 0.0


# ---------------- materials: the gate's and the set's own ----------------
MATS = {"oak": pm.photo_oak("lever_oak", S, wood_sat=a.handle_sat, oak_val=a.oak_val, foot=False),
        # old dungeon iron (prop_mats.damp_iron): the gate keeps its baked, lighter iron
        "iron": pm.iron_mat(0.05 * S, name="lever_iron", rust="damp", rust_at=(0.42, 0.58), worn="edges", disp=0.03),
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
parts = lp.build(coll, MATS, S, stage, floor)
for k in ("block", "handle", "chain", "crack"):
    parts[k].parent = root
for m_ in parts["moss"]:
    m_.parent = root
# the crack: a real cut in the slab (a decal read as drawn on), its walls the slab's own stone
import bmesh
cg = lp.crack_cutter(floor)
for v in cg.verts:
    v.co = Vector((cx, cy, top)) + v.co * S
cme = bpy.data.meshes.new("lever_slab_cut"); cg.to_mesh(cme); cg.free()
cut = bpy.data.objects.new("lever_slab_cut", cme); coll.objects.link(cut); cut.hide_render = True; cut.hide_viewport = True
bo = slab.modifiers.new("lever_crack", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.object = cut; bo.solver = "FLOAT"  # EXACT leaves the set's non-manifold slab uncut
print("CHECK floor under the hole %.4f, under the block %.4f" % (floor(*lg.HOLE), floor(0, lg.BLOCK_Y)), flush=True)

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


LIMITS = lg.throw_limits(set_dist)
print("CHECK set near the square: %s" % ", ".join(n for n, *_ in near_trees), flush=True)
print("CHECK throw limits left %.1f right %.1f deg (gap at them %.3f %.3f squares)" % (
    LIMITS + (lg.handle_gap(-math.radians(LIMITS[0]), set_dist), lg.handle_gap(math.radians(LIMITS[1]), set_dist))), flush=True)
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
