# blender -b --python dump_set.py -- N : build the stage for an NxN board and list its objects (name, type, bbox centre/size)
import bpy, sys, os, json
from mathutils import Vector
STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
import stage
argv = sys.argv[sys.argv.index("--") + 1:]
n = int(argv[0])
KING = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/rig/rigged_character_glb__rigged_character.glb")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=KING)
for o in list(bpy.data.objects):  # measure him as tools/render_v4.py does
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
stage.relax_arms(next(o for o in bpy.data.objects if o.type == "ARMATURE"))
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in bpy.data.objects:
    if o.type == "MESH":
        e = o.evaluated_get(dg)
        for v in e.to_mesh().vertices:
            p = e.matrix_world @ v.co
            for i in range(3):
                mn[i] = min(mn[i], p[i]); mx[i] = max(mx[i], p[i])
H = mx.z - mn.z
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
stage.build_stage(bpy.context.scene, H, board=n)
bpy.context.view_layer.update()
out = []
for o in bpy.data.objects:
    bb = [o.matrix_world @ Vector(b) for b in o.bound_box]
    c = sum(bb, Vector()) / 8
    lo = Vector([min(b[i] for b in bb) for i in range(3)]); hi = Vector([max(b[i] for b in bb) for i in range(3)])
    out.append((o.name, o.type, [round(v, 2) for v in c], [round(v, 2) for v in hi - lo]))
print("H", H, "S", 1.2 * H)
for r in out:
    print("OBJ", *r)
for o in bpy.data.objects:
    if o.type == "LIGHT":
        L = o.data
        d = o.matrix_world.to_3x3() @ Vector((0, 0, -1))
        print("LIGHT", o.name, L.type, "loc/H", [round(v / H, 2) for v in o.matrix_world.translation], "dir", [round(v, 2) for v in d],
              "E", round(L.energy, 1), "col", [round(c, 3) for c in L.color], "size", round(getattr(L, "shadow_soft_size", 0) / H, 2),
              "spot", round(getattr(L, "spot_size", 0), 2) if L.type == "SPOT" else "", "area", (round(L.size / H, 2) if L.type == "AREA" else ""))
