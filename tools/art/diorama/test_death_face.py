# Headless check of the death's faces (nervous_face.py moods woe and dead) and of mathutils_free.held_knobs.
#   Blender -b --python test_death_face.py
import bpy, os, sys, math, random
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nervous_face
from mathutils_free import held_knobs

GLB = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/rig/rigged_character_glb__rigged_character.glb")


def held_matches_blender():
    rnd = random.Random(7)
    for _ in range(500):
        q = Quaternion((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
        t = Vector((rnd.uniform(-2, 2), rnd.uniform(-2, 2), rnd.uniform(-2, 2)))
        m = Matrix.Translation(t) @ q.to_matrix().to_4x4() @ Matrix.Scale(rnd.uniform(0.01, 3), 4)
        k = held_knobs([list(r) for r in m])
        got = Quaternion((k["hqw"], k["hqx"], k["hqy"], k["hqz"]))
        assert abs(abs(got.dot(q)) - 1) < 1e-6, (q, got)  # q and -q are the same turn
        assert (Vector((k["hx"], k["hy"], k["hz"])) - t).length < 1e-6


def main():
    held_matches_blender()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None:
            bpy.data.objects.remove(o)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm)
    woe = {o.name for o in nervous_face.apply(arm, body, "woe")}
    dead = {o.name for o in nervous_face.pieces(arm, body, "dead")}
    print("TEST woe", sorted(woe), "dead", sorted(dead))
    # stumbling: round eyes and an open frown, no grin of teeth and no sweat drop
    assert "nf_woe_mouth" in woe and {"nf_woe_eye-1", "nf_woe_eye+1"} <= woe, woe
    assert not any("tooth" in n or "drop" in n for n in woe), woe
    # dead: X eyes (two bars an eye, no glint) and a tongue; and the two sets don't share an object
    xs = [n for n in dead if "_x" in n]
    assert len(xs) == 4, dead
    assert not any("glint" in n for n in dead), dead
    assert {"nf_dead_mouth", "nf_dead_tongue"} <= dead, dead
    assert not (woe & dead), woe & dead
    # each X's bars cross: same centre, turned 90 degrees apart about the face
    for side in ("-1", "+1"):
        bars = [bpy.data.objects[n] for n in xs if side in n]
        assert len(bars) == 2, (side, xs)
        a, b = bars
        # one just in front of the other (so they don't z-fight), centred on the same spot
        assert (a.matrix_world.translation - b.matrix_world.translation).length < 0.004
        ang = a.matrix_world.to_quaternion().rotation_difference(b.matrix_world.to_quaternion()).angle
        assert abs(math.degrees(ang) - 90) < 1, math.degrees(ang)
    print("TEST death face OK")


try:
    main()
except AssertionError as e:
    print("TEST FAILED", e)
    sys.exit(1)
