# Packs the Meshy wall block (Wesley 2026-11-21: "low A", one stone block per wall square) for the web:
# centres it on the floor (bottom at z 0, glTF y), scales it to a unit cube footprint (the game scales it to the
# square and WALL_H), drops the metallic map, keeps Meshy's ~29k triangles (decimating smears
# the texture) and shrinks textures to 512 px WebP (a square is
# about 70-115 px wide on screen), and writes public/diorama/wall.glb.
#   Blender -b --python pack_wall.py -- IN.glb OUT.glb
import bpy, sys
from mathutils import Vector
src, dst = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1:
    bpy.ops.object.join()
o = bpy.context.view_layer.objects.active
o.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
pts = [Vector(c) for c in o.bound_box]
lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
size = hi - lo
for v in o.data.vertices:  # unit footprint and height, centred, bottom on the floor
    v.co = Vector(((v.co.x - (lo.x + hi.x) / 2) / size.x, (v.co.y - (lo.y + hi.y) / 2) / size.y, (v.co.z - lo.z) / size.z))
for m in o.data.materials:
    if not m or not m.use_nodes:
        continue
    b = m.node_tree.nodes.get("Principled BSDF")
    if b and b.inputs["Metallic"].is_linked:  # stone: no metal
        m.node_tree.links.remove(b.inputs["Metallic"].links[0])
        b.inputs["Metallic"].default_value = 0.0
for im in bpy.data.images:
    if im.size[0] > 512:
        im.scale(512, 512)
for o2 in list(bpy.data.objects):
    if o2 is not o:
        bpy.data.objects.remove(o2)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="WEBP", export_yup=True)
print("PACKED", dst, "tris", len(o.data.polygons), "src size", tuple(round(s, 3) for s in size))
