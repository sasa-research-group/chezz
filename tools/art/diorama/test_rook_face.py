# Headless check of the rebel rook's face (nervous_face.py, FIGURE rook): his closed helm has no face, so his eyes are
# white clay in the visor's dark crossbar slit (measured from an ortho front render: x within +-0.108, z 1.365..1.419),
# no mouth, and his painted helm is left as it is.
#   Blender -b --python test_rook_face.py
import bpy, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import nervous_face

GLB = os.path.expanduser("~/.dos/scratch/d84406ef/paid/out/rook2rig/rigged_character_glb__rigged_character.glb")
SLIT_X, SLIT_Z = 0.108, (1.365, 1.419)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None:
            bpy.data.objects.remove(o)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm)
    nervous_face.use("rook")
    images = {i.name for i in bpy.data.images}
    woe = nervous_face.apply(arm, body, "woe")
    dead = nervous_face.pieces(arm, body, "dead")
    assert {i.name for i in bpy.data.images} == images, "the helm's paint must not be touched"
    wn = sorted(o.name for o in woe)
    assert wn == ["nf_woe_eye+1", "nf_woe_eye-1", "nf_woe_pupil+1", "nf_woe_pupil-1"], wn  # no mouth, no drop
    assert len(dead) == 4 and all("_x" in o.name for o in dead), [o.name for o in dead]  # an X per eye
    bpy.context.view_layer.update()
    for o in woe + dead:
        c = o.matrix_world.translation
        assert abs(c.x) < SLIT_X and SLIT_Z[0] < c.z < SLIT_Z[1], (o.name, tuple(c))  # in the slit
        n = o.matrix_world.to_3x3().col[1].normalized() * -1
        assert nervous_face.clearance(body, c, n) > 0, "%s is inside the helm" % o.name  # on it, not sunk in
    for s in ("-1", "+1"):  # woe: the pupils look up
        e, p = (next(o for o in woe if o.name == "nf_woe_%s%s" % (k, s)) for k in ("eye", "pupil"))
        assert p.matrix_world.translation.z > e.matrix_world.translation.z + 0.003, s
    print("TEST rook_face OK")


try:
    main()
except AssertionError as e:
    print("TEST FAILED", e)
    sys.exit(1)
