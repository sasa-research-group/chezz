# Bake the king for the browser: the clay/felt colour and relief that stage.clay_ify builds as Cycles nodes,
# baked onto his UVs, then a lighter mesh with the Idle clip, exported as one small glb.
#
#   cd <stage dir> && source tools/base_r78.env && \
#   Blender -b --python tools/art/diorama/bake_king.py -- --out public/diorama/king.glb
#
# The browser lights him live (MeshPhysicalMaterial with sheen, a fresnel rim, felt shells); this only
# carries the colours and the clay relief, so nothing here depends on the stage lights.
import bpy, sys, os, argparse
from mathutils import Vector

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
import stage

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--src", default=os.path.expanduser(
    "~/.dos/scratch/d84406ef/paid/out/rig/animations_0_animation_glb__animation.glb"))  # Meshy action 0 = Idle
ap.add_argument("--out", required=True)
ap.add_argument("--tex", type=int, default=1024)
ap.add_argument("--ratio", type=float, default=0.22)  # decimate: 76k verts -> ~17k
ap.add_argument("--samples", type=int, default=16)
a = ap.parse_args(argv)

os.environ.pop("KING_FUR", None)  # no fibre curves: the browser fakes fuzz with sheen and shells
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.src)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
mesh = next(o for o in bpy.data.objects if o.type == "MESH")
# bake in the bind pose so Generated coordinates match what clay_ify sees
arm.data.pose_position = "REST"
bpy.context.view_layer.update()
stage.clay_ify(arm)

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "GPU"
sc.cycles.samples = a.samples
sc.cycles.use_denoising = False
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
except Exception as e:
    print("GPU setup", e)

mat = mesh.material_slots[0].material
nt = mat.node_tree
def bake(kind, colorspace, **kw):
    img = bpy.data.images.new("king_" + kind.lower(), a.tex, a.tex, alpha=False, float_buffer=False)
    img.colorspace_settings.name = colorspace
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    for n in nt.nodes:
        n.select = False
    node.select = True
    nt.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.bake(type=kind, margin=8, **kw)
    nt.nodes.remove(node)
    print("BAKED", kind, flush=True)
    return img

albedo = bake("DIFFUSE", "sRGB", pass_filter={"COLOR"})
normal = bake("NORMAL", "Non-Color", normal_space="TANGENT")
# fresh simple material for the export
mat2 = bpy.data.materials.new("King")
mat2.use_nodes = True
n2 = mat2.node_tree
bs = next(n for n in n2.nodes if n.type == "BSDF_PRINCIPLED")
ti = n2.nodes.new("ShaderNodeTexImage"); ti.image = albedo
n2.links.new(ti.outputs["Color"], bs.inputs["Base Color"])
tn = n2.nodes.new("ShaderNodeTexImage"); tn.image = normal
nm = n2.nodes.new("ShaderNodeNormalMap")
n2.links.new(tn.outputs["Color"], nm.inputs["Color"])
n2.links.new(nm.outputs["Normal"], bs.inputs["Normal"])
bs.inputs["Roughness"].default_value = 0.9
mesh.data.materials.clear()
mesh.data.materials.append(mat2)

# lighter mesh: decimate before the armature modifier so the bind pose is what gets reduced
bpy.context.view_layer.objects.active = mesh
dec = mesh.modifiers.new("Dec", "DECIMATE")
dec.ratio = a.ratio
bpy.ops.object.modifier_move_to_index(modifier="Dec", index=0)
bpy.ops.object.modifier_apply(modifier="Dec")
print("VERTS", len(mesh.data.vertices), "TRIS", sum(len(p.vertices) - 2 for p in mesh.data.polygons), flush=True)
arm.data.pose_position = "POSE"

# keep only the Idle action
for act in list(bpy.data.actions):
    print("ACTION", act.name, flush=True)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", export_image_format="JPEG",
                          export_jpeg_quality=88, export_animations=True, export_apply=False,
                          export_yup=True)
print("EXPORTED", a.out, os.path.getsize(a.out), flush=True)
