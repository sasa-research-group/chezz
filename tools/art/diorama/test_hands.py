# Headless check of hands.py: an empty ("solid") fist has no hole through it along the grip, a fist round a handle
# keeps its hole, fist_bone falls back to the side's forearm, and a hand wears the body's skin (skin_uv picks a pink
# arm pixel, wear_body_skin puts every hand UV on it).
#   Blender -b --python test_hands.py
import bpy, os, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hands


def fist(solid):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.object.armature_add()
    arm = bpy.context.object
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.mesh.primitive_cube_add(size=0.1, location=(5, 5, 5))
    body = bpy.context.object
    f = dict(side="Right", m=[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]], r=0.15, len=0.19, gr=0.034,
             wrist=[0, 0, -0.2], solid=solid)
    o = hands.attach_fingered_fists(arm, body, [f], "Bone", dict(skin=(0.8, 0.5, 0.4), fsx=1.3))[0]
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(o, dg)
    # a ray along the grip, inside the hole on the fingers' side (the wrist is on -z), in the fist's own frame
    c = Vector((0, 0, 0.5 * f["gr"]))
    hit = bvh.ray_cast(c + Vector((-1, 0, 0)), Vector((1, 0, 0)), 2.0)[0]
    fist.size[solid] = o.dimensions.y  # thickness across the grip
    return hit


fist.size = {}


def skin():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    me = bpy.data.meshes.new("body")  # two quads: one mapped onto the pink half of the texture, one onto the grey
    me.from_pydata([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0), (2, 0, 0), (2, 1, 0)], [], [(0, 1, 2, 3), (1, 4, 5, 2)])
    lay = me.uv_layers.new(name="UVMap")
    uv = {0: (0.1, 0.1), 1: (0.4, 0.1), 2: (0.4, 0.9), 3: (0.1, 0.9), 4: (0.9, 0.1), 5: (0.9, 0.9)}
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            lay.data[li].uv = uv[vi] if poly.index == 0 or vi in (4, 5) else (0.6 + 0.1 * (vi == 2), 0.5)
    body = bpy.data.objects.new("body", me); bpy.context.scene.collection.objects.link(body)
    body.vertex_groups.new(name="LeftArm").add(list(range(6)), 1.0, "REPLACE")
    img = bpy.data.images.new("tex", 4, 2)
    px = []
    for y in range(2):
        for x in range(4):
            px += [0.9, 0.6, 0.55, 1.0] if x < 2 else [0.5, 0.5, 0.5, 1.0]
    img.pixels[:] = px
    mat = bpy.data.materials.new("skin"); mat.use_nodes = True
    mat.node_tree.nodes.new("ShaderNodeTexImage").image = img
    me.materials.append(mat)
    u, v = hands.skin_uv(body, groups=("LeftArm",))
    assert u < 0.5, "skin_uv picked a grey pixel, not the pink arm skin: %r" % ((u, v),)
    bpy.ops.mesh.primitive_cube_add()
    hand = bpy.context.object
    hands.wear_body_skin(hand, mat, (u, v))
    assert list(hand.data.materials) == [mat], "the hand does not wear the body's material"
    uvs = [tuple(round(c, 5) for c in d.uv) for d in hand.data.uv_layers.active.data]
    assert set(uvs) == {(round(u, 5), round(v, 5))}, "the hand's UVs are not all on the skin pixel"


def main():
    assert fist(True) is not None, "the empty fist has a hole through it"
    assert fist(False) is None, "the fist round a handle lost its hole"
    # an empty fist closes tight, or it looks like it holds a tube (empty_gr)
    assert fist.size[True] < 0.85 * fist.size[False], "the empty fist is as big as one round a handle: %r" % fist.size
    assert hands.fist_bone(dict(side="Left")) == "LeftForeArm"
    assert hands.fist_bone(dict(side="Left", bone="LeftHand")) == "LeftHand"
    skin()
    print("test_hands OK")


main()
