# Does the blade pass through the king? For each frame of a strike.json (strike_pose.py), poses the rig, puts
# the sword where the frame says (sword_in_hand on the forearm bone), samples points along the blade from just
# past the guard to the tip and measures how far any of them sits inside his body (cape, beard, head, crown).
#   Blender -b --python strike_check.py -- strike.json [max_depth=0] [margin=0.03]
# The blade has thickness (and the felt fuzz sticks out), so a point within `margin` of the surface counts too:
# depth = how far a blade point is inside him, plus the margin. Prints "CLIP frame N depth D" per frame and
# "CLIP_MAX D at frame N"; exits 1 when D > max_depth. It also fails when any part of him (the tunic hem, with
# king_motion.fix_skirt as the baker applies it) dips more than 3 cm below where he stands in frame 0.
import bpy, sys, os, json
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
clip = json.load(open(argv[0]))
LIMIT = float(argv[1]) if len(argv) > 1 else 0.0
MARGIN = float(argv[2]) if len(argv) > 2 else 0.03
KING = os.environ.get("CHAR_GLB") or os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/rig/rigged_character_glb__rigged_character.glb")
# the guard's spear (lunge_pose.py, knobs spear=1): its head is +x, the grip at the origin; the whole shaft is checked,
# butt to point, but not the stretch his fists cover (they hold it, so the hands touch it there)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KING)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
arm.animation_data_clear()
body = [o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm]
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import king_motion as km
km.fix_skirt(arm, body[0])  # as the baker does for the strike
FLOOR_SLACK = 0.03  # how far below his standing floor (frame 0) any part may dip (the hem brushing the ground)


def blade_points(g, n=40):
    """world points along the blade: the guard sits ~0.1 of the length past the grip, the tip at 0.835"""
    L = g["sword_world_length"]
    M = arm.matrix_world @ arm.pose.bones[g.get("bone", "RightForeArm")].matrix @ Matrix(g["sword_in_hand"])
    k = g.get("knobs", {})
    if k.get("spear"):
        # skip only the fists themselves (each flen long, centred gap/2 either side of the grip centre); the hands and
        # forearms are skipped below by vertex group. (2026-11-21: skipping the whole stretch between the hands hid
        # the fists sitting inside his chest, with the shaft through him.)
        sl, fl = k.get("slide", 0.0), k.get("flen", 0.10) / 2 + 0.02
        ts = [(-g["grip"] + i / (2 * n - 1)) * L for i in range(2 * n)]  # every 2.5 cm
        ts = [t for t in ts if min(abs(t + sl - k["gap"] / 2), abs(t + sl + k["gap"] / 2)) > fl]
        global LAST_T
        LAST_T = ts
        return [M @ Vector((t, 0, 0)) for t in ts]
    a, b = 0.14 * L, g["grip"] * L
    return [M @ Vector((-(a + (b - a) * i / (n - 1)), 0, 0)) for i in range(n)]


LAST_T = None
SKIP_GROUPS = {"LeftHand", "RightHand", "LeftForeArm", "RightForeArm"} if clip["frames"][0].get("knobs", {}).get("spear") else set()


def grp(o, fi):
    """the vertex group weighing most on a face (which part of him it is)"""
    vg = {}
    for vi in o.data.polygons[fi].vertices:
        for ge in o.data.vertices[vi].groups:
            nm = o.vertex_groups[ge.group].name
            vg[nm] = vg.get(nm, 0) + ge.weight
    return max(vg, key=vg.get) if vg else o.name
def inside(bvh, q):
    """second vote for "inside him": a ray up from q crosses his surface an odd number of times. The nearest face's
    normal alone misfires for a point well away from him (a prop lying on the floor beside a thin limb)"""
    from mathutils import Vector
    up, n, o = Vector((0.0001, 0.0002, 1.0)).normalized(), 0, q.copy()
    for _ in range(64):
        hit, _nrm, _fi, _d = bvh.ray_cast(o, up)
        if hit is None:
            break
        n += 1
        o = hit + up * 1e-4
    return n % 2 == 1
worst = (0.0, -1)
floor0, sink = None, (0.0, -1)
for f, g in enumerate(clip["frames"]):
    for n, v in g["pose"].items():
        pb = arm.pose.bones[n]
        pb.location = v[0]; pb.rotation_quaternion = v[1]
        if len(v) > 2:
            pb.scale = v[2]
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pts = blade_points(g)
    depth = 0.0
    where = None
    for o in body:
        bvh = BVHTree.FromObject(o, dg)  # in the object's local space
        inv = o.matrix_world.inverted()
        for p in pts:
            q = inv @ p
            hit, nrm, fi, dist = bvh.find_nearest(q)
            if hit is None:
                continue
            if SKIP_GROUPS and fi is not None and grp(o, fi) in SKIP_GROUPS:
                continue
            d = (o.matrix_world @ hit - p).length  # world units (he is ~1.4 tall)
            sd = -d if (q - hit).dot(nrm) < 0 and inside(bvh, q) else d  # negative: inside him
            if MARGIN - sd > depth and os.environ.get("CLIP_WHERE"):
                vg = {}
                for vi in o.data.polygons[fi].vertices:
                    for ge in o.data.vertices[vi].groups:
                        vg[o.vertex_groups[ge.group].name] = vg.get(o.vertex_groups[ge.group].name, 0) + ge.weight
                where = (max(vg, key=vg.get) if vg else o.name, "t=%.2f" % LAST_T[pts.index(p)] if LAST_T else pts.index(p), len(pts), tuple(round(c, 2) for c in p))
            depth = max(depth, MARGIN - sd)
    low = min(min((o.evaluated_get(dg).matrix_world @ v.co).z for v in o.evaluated_get(dg).to_mesh().vertices) for o in body)
    floor0 = low if floor0 is None else floor0
    if floor0 - low > sink[0]:
        sink = (floor0 - low, f)
    print("CLIP frame %2d depth %.3f below-floor %.3f" % (f, depth, floor0 - low) + (" at %s" % (where,) if where else ""), flush=True)
    if depth > worst[0]:
        worst = (depth, f)
print("CLIP_MAX %.3f at frame %d" % worst, flush=True)
print("FLOOR_MAX %.3f at frame %d" % sink, flush=True)
sys.exit(1 if worst[0] > LIMIT or sink[0] > FLOOR_SLACK else 0)
