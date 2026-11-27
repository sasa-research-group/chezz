# The pressure plate square, for Cycles (concept ~/.dos/scratch/d84406ef/lever/P1.png): a round worn bronze plate
# with a sun in relief, in a ring of mossy stone, a thin dark gap round its edge so it reads as able to sink. Rendered in
# the set like the lever (build_lever_cycles.py): a browser-lit prop looked "GameCube" next to the baked set. Shapes
# from plate_parts.py / plate_geom.py, bronze from prop_mats.py, the set's stone and moss.
#
#   Blender -b --python build_plate_cycles.py -- --out DIR [--res 1600 --samples 128 --states up,down
#       --square 4,0 --zoom 0]
# writes DIR/plate-{state}.png (states: up, down, or a fraction of the press like 0.5). Look-check stills only: no bake yet.
import bpy, sys, os, math, argparse
from mathutils import Vector

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import stage
import plate_geom as pg
import plate_parts as pp
import prop_mats as pm
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=1600)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--states", default="up,down")
ap.add_argument("--square", default="4,0")             # the near-right corner of the 5x5 board
ap.add_argument("--nx", type=int, default=5)
ap.add_argument("--ny", type=int, default=5)
ap.add_argument("--stop", default="")
ap.add_argument("--zoom", type=float, default=0.0)
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
coll = bpy.data.collections.new("Plate"); sc.collection.children.link(coll)

# the slab's height under a point of the square (square units above `top`): the ring and its moss lie on it
inv = slab.matrix_world.inverted()


def floor(x, y):
    o = inv @ Vector((cx + x * S, cy + y * S, top + 0.5 * S))
    d = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
    hit, loc, _, _ = slab.ray_cast(o, d)
    return ((slab.matrix_world @ loc).z - top) / S if hit else 0.0


# ---------------- materials: bronze, the set's stone and moss ----------------
crack = bpy.data.materials.new("plate_crack"); crack.use_nodes = True
cb = crack.node_tree.nodes["Principled BSDF"]
cb.inputs["Base Color"].default_value = (0.006, 0.005, 0.004, 1); cb.inputs["Roughness"].default_value = 1.0
MATS = {"bronze": pm.bronze_mat(0.05 * S), "stone": stage._stone_mat(), "moss": pm.set_moss(sc, stage), "crack": crack}
print("CHECK moss material %s" % MATS["moss"].name, flush=True)

# ---------------- the plate ----------------
root = bpy.data.objects.new("plate_root", None); coll.objects.link(root)
root.location = (cx, cy, top)
parts = pp.build(coll, MATS, S, stage, floor)
for k in ("disc", "ring", "well"):
    parts[k].parent = root
for m_ in parts["moss"]:
    m_.parent = root

# the well: the slab's faces inside the ring's inner circle go (no boolean: on the set's non-manifold slab EXACT cuts
# nothing and FLOAT took stray vertices; the lever's slot cut, build_lever_cycles.py). The hole's edge is under the stone
# ring. Slice along the polygon's sides first: some of the slab's faces span the whole hole with no corner inside it.
import bmesh
planes = pp.slab_cut_planes()
slab.data = slab.data.copy()   # the cut is this square's alone
sg_ = bmesh.new(); sg_.from_mesh(slab.data); mw_ = slab.matrix_world
sg_.transform(mw_)   # cut in world space (the slab's matrix flips and squashes its axes)
for nx_, ny_, d_ in planes:
    bmesh.ops.bisect_plane(sg_, geom=sg_.verts[:] + sg_.edges[:] + sg_.faces[:],
                           plane_co=(cx + nx_ * d_ * S, cy + ny_ * d_ * S, 0.0), plane_no=(nx_, ny_, 0.0))


def inside(c):
    px, py = (c.x - cx) / S, (c.y - cy) / S
    return all(nx_ * px + ny_ * py < d_ + 1e-6 for nx_, ny_, d_ in planes)


gone_ = [f_ for f_ in sg_.faces if inside(f_.calc_center_median())]
bmesh.ops.delete(sg_, geom=gone_, context="FACES"); sg_.transform(mw_.inverted())
sg_.to_mesh(slab.data); sg_.free()
print("CHECK well cut %d slab faces; floor under the well %.4f, ring zref %.4f" % (len(gone_), floor(0.0, 0.0), parts["zref"]), flush=True)

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
if a.save:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save))

import time
for name in a.states.split(","):
    t = pg.STATES.get(name)
    t = float(name) if t is None else t
    pp.set_press(parts, t)
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(a.out, "plate-%s.png" % name)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("CHECK rendered %s in %.1f s" % (sc.render.filepath, time.time() - t0), flush=True)
print("PLATE STILLS OK", flush=True)
