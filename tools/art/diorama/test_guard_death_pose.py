# Headless check of guard_death_pose.py (the patrol guard taken): solves every frame, then checks the story beats
# (on his feet and the spear in the air at first; flat on his back with the spear on the floor beside him at the
# end; the faces: woe, then X eyes from the landing) and that nothing clips (strike_check.py with his rig).
#   Blender -b --python test_guard_death_pose.py
import bpy, os, sys, json, subprocess, tempfile
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import king_motion as km
import lunge_pose as lp
import guard_death_pose as gd


def placed(g_path):
    """the guard posed from a guard.json with the spear attached: (spear vertices in world, head bone z)"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=lp.ENV["CHAR_GLB"])
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None:
            bpy.data.objects.remove(o)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    pose, g = km.load_guard(g_path)
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    km.apply_pose(arm, pose)
    bpy.context.view_layer.update()
    sp = km.attach_held(arm, lp.ENV["PROP_GLB"], g)
    head = (arm.matrix_world @ arm.pose.bones["Head"].head).z
    return [sp.matrix_world @ v.co for v in sp.data.vertices], head


def main():
    # the moods: woe until he lands, then dead
    assert [gd.face_at(f) for f in (0, gd.LAND - 1, gd.LAND, 25)] == [2, 2, 3, 3]
    assert gd.knobs_at(0)["let"] == 1.0 and gd.knobs_at(gd.FALL_F)["drop"] == 1.0
    out = tempfile.mkdtemp()
    r = subprocess.run(["python3", os.path.join(HERE, "guard_death_pose.py"), out, "--jobs", "8"],
                       capture_output=True, text=True)
    dj = os.path.join(out, "death.json")
    assert os.path.exists(dj), r.stdout[-2000:] + r.stderr[-2000:]
    d = json.load(open(dj))
    assert d["fps"] == 24 and d["hit"] == 0 and len(d["frames"]) == gd.KEYS[-1][0] + 1
    co, head = placed(os.path.join(out, "f00", "guard.json"))
    assert head > 0.8, head  # on his feet when the blow lands
    assert max(c.z for c in co) > 1.0, max(c.z for c in co)  # the spear still up in the air
    co, head = placed(os.path.join(out, "f%02d" % gd.KEYS[-1][0], "guard.json"))
    assert head < 0.45, head  # on his back (head and shoulders raised a little so the face reads)
    zs = [c.z for c in co]
    assert max(zs) < 0.08, max(zs)  # the spear flat on the floor
    xs = [c.x for c in co]
    assert max(xs) < -0.3, max(xs)  # at his right side (-x), clear of him
    r = subprocess.run([bpy.app.binary_path, "-b", "--python", os.path.join(HERE, "strike_check.py"), "--", dj],
                       capture_output=True, text=True, env=lp.ENV)
    worst = [l for l in r.stdout.splitlines() if l.startswith("CLIP_MAX")]
    assert worst and float(worst[0].split()[1]) < 0.03, (worst, r.stdout[-1500:])
    print("TEST guard death OK %d frames, %s" % (len(d["frames"]), worst[0]))


try:
    main()
except AssertionError as e:
    print("TEST FAILED", e)
    sys.exit(1)
