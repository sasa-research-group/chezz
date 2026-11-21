# Headless check of nervous_face.py: the mouth pieces must stay on the beard when he turns his head.
#   Blender -b --python test_nervous_face.py
# (The beard round the mouth is only ~63% Head bone; teeth pinned to the Head bone slid off it in a glance.)
import bpy, os, sys, math
from mathutils import Vector, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nervous_face

GLB = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/rig/rigged_character_glb__rigged_character.glb")


def world_verts(o):
    dg = bpy.context.evaluated_depsgraph_get()
    e = o.evaluated_get(dg)
    return [e.matrix_world @ v.co for v in e.data.vertices]


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None:
            bpy.data.objects.remove(o)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm)
    out = nervous_face.apply(arm, body)
    names = {o.name for o in out}
    assert {"nf_mouth", "nf_eye-1", "nf_eye+1", "nf_drop"} <= names, names
    # teeth come in even rows, mirrored left/right: name nf_tooth<column><row>
    teeth = sorted(n[8:] for n in names if n.startswith("nf_tooth"))
    tops, bottoms = {t[0] for t in teeth if t[1] == "0"}, {t[0] for t in teeth if t[1] == "1"}
    assert tops == bottoms and len(tops) >= 2, teeth
    cols = nervous_face.TEETH_COLS
    assert all(str(cols - 1 - int(c)) in tops for c in tops), teeth
    # no tooth on top of the mustache: all sit low, on the mouth
    m = bpy.data.objects["nf_mouth"].matrix_world.translation
    for o in out:
        if o.name.startswith("nf_tooth"):
            assert abs(o.matrix_world.translation.z - m.z) < 0.03 and (o.matrix_world.translation - m).length < 0.07, o.name

    # each eye's glint shows: it sits in front of its eye, not inside it
    for side in ("-1", "+1"):
        eye, gl = bpy.data.objects["nf_eye" + side], bpy.data.objects["nf_glint" + side]
        bpy.context.view_layer.update()
        n = eye.matrix_world.to_3x3().col[1].normalized() * -1
        c = gl.matrix_world.translation
        assert nervous_face.clearance(eye, c, n) > 0, "glint %s is inside its eye" % side

    mouth = bpy.data.objects["nf_mouth"]
    bpy.context.view_layer.update()
    # every tooth sits in front of the beard (none sunk in with only a tip showing)
    for o in out:
        if o.name.startswith("nf_tooth"):
            c = o.matrix_world.translation
            depth = nervous_face.clearance(body, c, o.matrix_world.to_3x3().col[1].normalized() * -1)
            assert depth > 0.004, "%s sunk %.4f into the beard" % (o.name, depth)
            # and in front of the dark mouth, not behind it with only a tip poking through
            mn = mouth.matrix_world.to_3x3().col[1].normalized() * -1
            ahead = (c - mouth.matrix_world.translation).dot(mn)
            assert ahead > 0.007, "%s sits behind the mouth (%.4f)" % (o.name, ahead)
    rest = sum(world_verts(mouth), Vector()) / len(mouth.data.vertices)
    # the beard vertex nearest the mouth, at rest
    bv = world_verts(body)
    near = min(range(len(bv)), key=lambda i: (bv[i] - rest).length if bv[i].y < -0.2 else 9)
    gap0 = (bv[near] - rest).length

    # a hard glance: head turned 35 degrees and shoulders shrugged, like the check loop
    pb = arm.pose.bones["Head"]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Quaternion(Vector((0, 1, 0)), math.radians(35)) @ Quaternion(Vector((1, 0, 0)), math.radians(10))
    for s in ("LeftShoulder", "RightShoulder"):
        b = arm.pose.bones[s]; b.rotation_mode = "QUATERNION"; b.rotation_quaternion = Quaternion(Vector((0, 0, 1)), math.radians(12))
    bpy.context.view_layer.update()
    posed = sum(world_verts(mouth), Vector()) / len(mouth.data.vertices)
    bv = world_verts(body)
    gap1 = (bv[near] - posed).length
    moved = (posed - rest).length
    print("TEST mouth moved %.3f, gap to beard rest %.4f posed %.4f" % (moved, gap0, gap1))
    assert moved > 0.01, "the pose should move the mouth"
    assert gap1 < gap0 + 0.004, "mouth slid off the beard: gap %.4f -> %.4f" % (gap0, gap1)
    print("TEST nervous_face OK")


try:
    main()
except AssertionError as e:
    print("TEST FAILED", e)
    sys.exit(1)
