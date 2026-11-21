# Headless check of lunge_pose.py (the patrol guard's capture): solves the key poses, then loads them the way the
# bake does (king_motion.load_guard / apply_pose / attach_held) and checks the spear and both fists.
#   Blender -b --python test_lunge_pose.py
import bpy, os, sys, json, subprocess, tempfile, math
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import king_motion as km
import lunge_pose as lp


def placed(path):
    """the guard posed from a guard.json, with the spear and fists attached: (spear points, fist centres, g)"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=lp.ENV["CHAR_GLB"])
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None:
            bpy.data.objects.remove(o)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    pose, g = km.load_guard(path)
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    km.apply_pose(arm, pose)
    bpy.context.view_layer.update()
    sp = km.attach_held(arm, lp.ENV["PROP_GLB"], g)
    co = [sp.matrix_world @ v.co for v in sp.data.vertices]
    fists = {o.name: o.matrix_world.translation.copy() for o in bpy.data.objects if o.name.startswith("fist_")}
    return co, sp.matrix_world.to_3x3() @ Vector((1, 0, 0)), fists, g


def main():
    out = tempfile.mkdtemp()
    r = subprocess.run([sys.executable if "python" in os.path.basename(sys.executable) else "python3",
                        os.path.join(HERE, "lunge_pose.py"), out, "--keys"], capture_output=True, text=True)
    miss = [l for l in r.stdout.splitlines() if l.startswith("frame")]
    assert len(miss) == len(lp.KEYS), r.stdout[-2000:] + r.stderr[-2000:]
    for l in miss:  # both hands reach the shaft in every key (0.05 is the wrist's offset from the fist)
        L, R = float(l.split("L")[1].split()[0]), float(l.split("R")[1])
        assert L < 0.07 and R < 0.07, l
    for f, _, _ in lp.KEYS:
        co, ax, fists, g = placed(os.path.join(out, "f%02d" % f, "guard.json"))
        assert len(fists) == 2 and abs(g["sword_world_length"] - 2.0) < 1e-6
        # each fist closes on the shaft: its centre lies on the spear's axis (within the shaft and a little clay)
        P0 = sum(co, Vector()) / len(co)
        for n, c in fists.items():
            d = c - P0
            off = (d - ax * d.dot(ax)).length
            assert off < g["fists"][0]["gr"] + 0.04, (f, n, off)
        if f == lp.HIT:  # the hit: the spear level and pointing ahead (-y), its head well in front of him
            assert math.degrees(ax.angle(Vector((0, -1, 0)))) < 12, (f, ax)
            assert min(c.y for c in co) < -1.0, min(c.y for c in co)
        if f == 0:  # ready: the head up at his left (+x), the shaft across his chest
            assert ax.z > 0.7 and ax.x > 0.3, ax
    print("TEST lunge pose OK %d keys" % len(lp.KEYS))


try:
    main()
except AssertionError as e:
    print("TEST FAILED", e)
    sys.exit(1)
