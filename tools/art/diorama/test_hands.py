# Headless check of hands.py: an empty ("solid") fist has no hole through it along the grip, a fist round a handle
# keeps its hole, and fist_bone falls back to the side's forearm.
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
    return bvh.ray_cast(c + Vector((-1, 0, 0)), Vector((1, 0, 0)), 2.0)[0]


def main():
    assert fist(True) is not None, "the empty fist has a hole through it"
    assert fist(False) is None, "the fist round a handle lost its hole"
    assert hands.fist_bone(dict(side="Left")) == "LeftForeArm"
    assert hands.fist_bone(dict(side="Left", bone="LeftHand")) == "LeftHand"
    print("test_hands OK")


main()
