# Headless check of spear_pose.py (the patrol guard's idle): runs it without previews, then loads its guard.json
# the way the bake does (king_motion.load_guard / attach_held) and checks the spear and fist.
#   Blender -b --python test_spear_pose.py
import bpy, os, sys, json, subprocess, tempfile, math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import king_motion as km

CHAR = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/guardrig/rigged_character_glb__rigged_character.glb")
SPEAR = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/spear/model_glb__model.glb")


def main():
    out = tempfile.mkdtemp()
    r = subprocess.run([bpy.app.binary_path, "-b", "--python", os.path.join(HERE, "spear_pose.py"), "--", out, "render=0"],
                       capture_output=True, text=True)
    assert "ARM Right miss 0.000" in r.stdout, r.stdout[-2000:]
    g = json.load(open(os.path.join(out, "guard.json")))
    assert g["bone"] == "RightForeArm" and len(g["fists"]) == 1 and g["fists"][0]["side"] == "Right"
    assert 0.2 < g["grip"] < 0.6, g["grip"]  # the fist is low on the shaft: most of the spear rises above him

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=CHAR)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None:
            bpy.data.objects.remove(o)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    pose, g2 = km.load_guard(os.path.join(out, "guard.json"))
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    km.apply_pose(arm, pose)
    bpy.context.view_layer.update()
    sp = km.attach_held(arm, SPEAR, g2)
    co = [sp.matrix_world @ v.co for v in sp.data.vertices]
    zs = [c.z for c in co]
    floor = g["floor"]
    # upright, butt on the floor, as long as asked, standing where the fist is
    assert abs(min(zs) - floor) < 0.02, (min(zs), floor)
    assert abs(max(zs) - min(zs) - g["sword_world_length"]) < 0.03, (min(zs), max(zs))
    ax = sp.matrix_world.to_3x3() @ Vector((1, 0, 0))
    assert math.degrees(ax.angle(Vector((0, 0, 1)))) < 1.0, ax  # local x (butt -> head) points straight up
    head = [c for c in co if c.z > max(zs) - 0.1 * g["sword_world_length"]]
    tip = sum(head, Vector()) / len(head)
    k = g["knobs"]
    assert (Vector((tip.x, tip.y)) - Vector((k["hx"], k["hy"]))).length < 0.05, tip
    # the clay fist closes round the shaft at the grip height, beside his right side (-x)
    fist = next(o for o in bpy.data.objects if o.name.startswith("fist_"))
    fc = fist.matrix_world.translation
    assert abs(fc.z - k["hz"]) < 0.08 and fc.x < 0, fc
    rh = arm.matrix_world @ arm.pose.bones["RightHand"].head
    assert (rh - Vector((k["hx"], k["hy"], k["hz"]))).length < 0.12, rh  # his wrist meets the fist
    print("TEST spear pose OK grip %.3f tip %s" % (g["grip"], tuple(round(v, 3) for v in tip)))


try:
    main()
except AssertionError as e:
    print("TEST FAILED", e)
    sys.exit(1)
