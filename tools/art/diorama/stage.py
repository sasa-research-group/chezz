import re
"""Clay-diorama render stage for Blender (Cycles).

    import sys; sys.path.insert(0, "<dir of this file>"); import stage
    stage.clay_ify(obj)
    stage.build_stage(scene, H)
    stage.setup_render(scene, res=540, samples=96)

All distances in build_stage are derived from H (figurine height in scene units).
"""
import math, os, sys
import random

import bmesh
import bpy
from mathutils import Matrix, Vector, noise


# --------------------------------------------------------------------------
# node helpers
# --------------------------------------------------------------------------
def _node(nt, idname, x=0, y=0, **props):
    n = nt.nodes.new(idname)
    n.location = (x, y)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def _link(nt, a, b):
    nt.links.new(a, b)


def _set(n, name, val):
    n.inputs[name].default_value = val


def _math(nt, op, a=None, b=None, c=None, clamp=False, x=0, y=0):
    n = _node(nt, "ShaderNodeMath", x, y, operation=op, use_clamp=clamp)
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, bpy.types.NodeSocket):
            _link(nt, v, n.inputs[i])
        else:
            n.inputs[i].default_value = v
    return n.outputs[0]


def _vmath(nt, op, a=None, b=None, x=0, y=0):
    n = _node(nt, "ShaderNodeVectorMath", x, y, operation=op)
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, bpy.types.NodeSocket):
            _link(nt, v, n.inputs[i])
        else:
            n.inputs[i].default_value = v
    return n.outputs[0]


def _mix(nt, fac, a, b, blend="MIX", x=0, y=0):
    """RGBA mix. fac float or socket; a/b color tuple or socket. Returns result socket."""
    n = _node(nt, "ShaderNodeMix", x, y, data_type="RGBA", blend_type=blend)
    for idx, v in ((0, fac), (6, a), (7, b)):
        if isinstance(v, bpy.types.NodeSocket):
            _link(nt, v, n.inputs[idx])
        else:
            n.inputs[idx].default_value = v
    return n.outputs[2]


def _ramp(nt, fac, stops, x=0, y=0, interp="LINEAR"):
    n = _node(nt, "ShaderNodeValToRGB", x, y)
    n.color_ramp.interpolation = interp
    cr = n.color_ramp
    while len(cr.elements) < len(stops):
        cr.elements.new(0.5)
    for e, (pos, col) in zip(cr.elements, stops):
        e.position = pos
        e.color = col
    if isinstance(fac, bpy.types.NodeSocket):
        _link(nt, fac, n.inputs["Fac"])
    return n


def _noise(nt, vec, scale, detail=2.0, rough=0.5, dist=0.0, x=0, y=0):
    n = _node(nt, "ShaderNodeTexNoise", x, y, noise_dimensions="3D")
    _set(n, "Scale", scale)
    _set(n, "Detail", detail)
    _set(n, "Roughness", rough)
    _set(n, "Distortion", dist)
    if vec is not None:
        _link(nt, vec, n.inputs["Vector"])
    return n


def _mapping(nt, vec, scale, loc=(0, 0, 0), x=0, y=0):
    n = _node(nt, "ShaderNodeMapping", x, y)
    _link(nt, vec, n.inputs["Vector"])
    n.inputs["Scale"].default_value = scale
    n.inputs["Location"].default_value = loc
    return n.outputs[0]


def _new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = _node(nt, "ShaderNodeOutputMaterial", 1400, 0)
    bsdf = _node(nt, "ShaderNodeBsdfPrincipled", 1100, 0)
    _link(nt, bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m, nt, bsdf


def _principled_defaults(b, rough=0.7, spec=0.2):
    _set(b, "Roughness", rough)
    _set(b, "Specular IOR Level", spec)


# CC0 scanned textures (Poly Haven), see assets/LICENSES.txt. Missing files -> procedural fallback.
ASSETS = os.path.join(os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage")), "assets")


def _img(nt, rel, vec, noncolor=False, box=0.0, x=0, y=0):
    """Image texture node on `vec` (box projection when box>0). Returns the node or None."""
    p = os.path.join(ASSETS, rel)
    if not os.path.exists(p):
        return None
    im = bpy.data.images.load(p, check_existing=True)
    if noncolor:
        im.colorspace_settings.name = "Non-Color"
    n = _node(nt, "ShaderNodeTexImage", x, y)
    n.image = im
    n.interpolation = "Linear"
    if box > 0:
        n.projection = "BOX"
        n.projection_blend = box
    _link(nt, vec, n.inputs["Vector"])
    return n


# --------------------------------------------------------------------------
# pose helper (T-pose figurine -> arms hanging)
# --------------------------------------------------------------------------
def relax_arms(arm, deg_out=15):
    """Lower the T-pose arms to hang beside the body."""
    arm.animation_data_clear()
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    for side in ("Left", "Right"):
        pb = arm.pose.bones[side + "Arm"]
        fb = arm.pose.bones[side + "ForeArm"]
        h = pb.head.copy()
        d = (fb.head - pb.head).normalized()
        sx = 1 if d.x > 0 else -1
        t = Vector((sx * math.sin(math.radians(deg_out)), 0.0, -math.cos(math.radians(deg_out))))
        R = d.rotation_difference(t).to_matrix().to_4x4()
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")


# --------------------------------------------------------------------------
# 1. clay_ify
# --------------------------------------------------------------------------
def _meshes_of(obj):
    out = []
    if obj.type == "MESH":
        out.append(obj)
    for c in obj.children_recursive:
        if c.type == "MESH":
            out.append(c)
    return out


def _local_dims_world(me_obj):
    """Size of the mesh bbox in world units per local axis (Generated coords span the bbox)."""
    bb = [Vector(c) for c in me_obj.bound_box]
    mn = Vector((min(v[i] for v in bb) for i in range(3)))
    mx = Vector((max(v[i] for v in bb) for i in range(3)))
    d = mx - mn
    s = me_obj.matrix_world.to_scale()
    return Vector((max(abs(d[i] * s[i]), 1e-4) for i in range(3)))


def _clay_material(mat, dims, H, bump, fine):
    """Rewire an imported (glTF Principled) material into matte clay, in place."""
    if not mat or not mat.use_nodes:
        return
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return
    if mat.get("clay_ified"):
        return
    mat["clay_ified"] = True

    # keep: base colour link / colour, existing normal map link
    def src(sock_name):
        s = bsdf.inputs[sock_name]
        return s.links[0].from_socket if s.is_linked else None

    base_src = src("Base Color")
    base_col = tuple(bsdf.inputs["Base Color"].default_value)
    normal_src = src("Normal")
    metal_src = src("Metallic")
    metal_val = bsdf.inputs["Metallic"].default_value

    for name in ("Metallic", "Roughness", "Normal", "Base Color"):
        s = bsdf.inputs[name]
        for l in list(s.links):
            nt.links.remove(l)

    # --- generated coords scaled so features are isotropic in world space ---
    tc = _node(nt, "ShaderNodeTexCoord", -1800, -600)
    gen = tc.outputs["Generated"]

    def world_map(freq_per_H, loc=(0, 0, 0), y=-600):
        # freq_per_H: feature cells per figurine height
        sc = Vector((freq_per_H * dims[i] / H for i in range(3)))
        return _mapping(nt, gen, sc, loc, x=-1600, y=y)

    # --- surface relief -----------------------------------------------------
    # (a) fingerprint swirls: concentric rings around Voronoi cell centres, only in some cells
    vc = _node(nt, "ShaderNodeTexVoronoi", -1300, -300, feature="F1")
    _link(nt, world_map(5.0, (3.1, 1.7, 0.4), -300), vc.inputs["Vector"])
    _set(vc, "Randomness", 1.0)
    local = _vmath(nt, "SUBTRACT", world_map(5.0, (3.1, 1.7, 0.4), -380), vc.outputs["Position"], x=-1100, y=-300)
    wv = _node(nt, "ShaderNodeTexWave", -900, -300, wave_type="RINGS", wave_profile="SIN", rings_direction="SPHERICAL")
    _link(nt, local, wv.inputs["Vector"])
    _set(wv, "Scale", 5.0 * 16.0)  # ~16 ridges across a patch
    _set(wv, "Distortion", 3.5)
    _set(wv, "Detail", 1.0)
    _set(wv, "Detail Scale", 2.0)
    sepc = _node(nt, "ShaderNodeSeparateColor", -1100, -450)
    _link(nt, vc.outputs["Color"], sepc.inputs["Color"])
    cell_on = _ramp(nt, sepc.outputs["Red"], [(0.55, (0, 0, 0, 1)), (0.6, (1, 1, 1, 1))], x=-900, y=-450)
    edge_fade = _ramp(nt, vc.outputs["Distance"], [(0.12, (1, 1, 1, 1)), (0.38, (0, 0, 0, 1))], x=-900, y=-560)
    fp = _math(nt, "MULTIPLY", wv.outputs["Color"], cell_on.outputs["Color"], x=-700, y=-300)
    fp = _math(nt, "MULTIPLY", fp, edge_fade.outputs["Color"], x=-550, y=-300)

    # (b) sparse little dents (thumb pokes / pinches)
    vd = _node(nt, "ShaderNodeTexVoronoi", -1300, -750, feature="F1")
    _link(nt, world_map(14.0, (9, 4, 2), -750), vd.inputs["Vector"])
    sepd = _node(nt, "ShaderNodeSeparateColor", -1100, -800)
    _link(nt, vd.outputs["Color"], sepd.inputs["Color"])
    dent_on = _ramp(nt, sepd.outputs["Green"], [(0.72, (0, 0, 0, 1)), (0.76, (1, 1, 1, 1))], x=-900, y=-800)
    dent_shape = _ramp(nt, vd.outputs["Distance"], [(0.0, (1, 1, 1, 1)), (0.32, (0, 0, 0, 1))], x=-900, y=-900,
                       interp="EASE")
    dent = _math(nt, "MULTIPLY", dent_on.outputs["Color"], dent_shape.outputs["Color"], x=-700, y=-850)

    # (c) tool streaks: stretched noise (long thin drags along the body)
    stk_map = _mapping(nt, gen, Vector((18 * dims[0] / H, 18 * dims[1] / H, 3.5 * dims[2] / H)), (5, 2, 8), x=-1300,
                       y=-1050)
    stk = _noise(nt, stk_map, 1.0, detail=3.0, rough=0.6, x=-1100, y=-1050)
    stk_r = _ramp(nt, stk.outputs["Fac"], [(0.42, (0, 0, 0, 1)), (0.62, (1, 1, 1, 1))], x=-900, y=-1050)

    # (d) soft lumps + fine grain (clay is never flat)
    lump = _noise(nt, world_map(7.0, (1, 5, 3), -1250), 1.0, detail=3.0, rough=0.5, x=-1100, y=-1250)
    grain = _noise(nt, world_map(90.0 * fine, (0, 0, 0), -1350), 1.0, detail=4.0, rough=0.55, x=-1100, y=-1400)

    h = _math(nt, "MULTIPLY", fp, 0.8, x=-400, y=-300)  # swirls
    h = _math(nt, "SUBTRACT", h, _math(nt, "MULTIPLY", dent, 0.85, x=-400, y=-850), x=-250, y=-400)
    h = _math(nt, "ADD", h, _math(nt, "MULTIPLY", stk_r.outputs["Color"], 0.35, x=-400, y=-1050), x=-100, y=-450)
    h = _math(nt, "ADD", h, _math(nt, "MULTIPLY", lump.outputs["Fac"], 0.8, x=-400, y=-1250), x=50, y=-500)
    h = _math(nt, "ADD", h, _math(nt, "MULTIPLY", grain.outputs["Fac"], 0.18, x=-400, y=-1400), x=200, y=-550)

    felt = None
    felt_surf = None
    if os.environ.get("CLAY_FELT"):
        # felt/velvet over the clay: mask skin (pale, low-sat peach) vs cloth (everything else that is not metal)
        if base_src is not None:
            bcol = base_src
        else:
            bc_ = _node(nt, "ShaderNodeRGB", -1600, 900)
            bc_.outputs[0].default_value = base_col
            bcol = bc_.outputs[0]
        hsv = _node(nt, "ShaderNodeSeparateColor", -1400, 900)
        hsv.mode = "HSV"
        _link(nt, bcol, hsv.inputs["Color"])
        v_on = _ramp(nt, hsv.outputs[2], [(0.55, (0, 0, 0, 1)), (0.65, (1, 1, 1, 1))], x=-1200, y=900)
        s_on = _ramp(nt, hsv.outputs[1], [(0.2, (0, 0, 0, 1)), (0.3, (1, 1, 1, 1))], x=-1200, y=1000)
        h_on = _ramp(nt, hsv.outputs[0], [(0.0, (0, 0, 0, 1)), (0.03, (1, 1, 1, 1)), (0.15, (1, 1, 1, 1)),
                                          (0.18, (0, 0, 0, 1))], x=-1200, y=1100).outputs["Color"]
        skin = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", v_on.outputs["Color"], s_on.outputs["Color"], x=-1000, y=950),
                     h_on, x=-850, y=1000)
        if os.environ.get("SKIN_HMAX"):
            # yellow above SKIN_HMAX and below the crown line = the collar: cloth. (The crown keeps its skin flag so
            # KING_TONE can split it off by height later.)
            hmx = float(os.environ["SKIN_HMAX"])
            hi_ = _ramp(nt, hsv.outputs[0], [(hmx - 0.005, (0, 0, 0, 1)), (hmx + 0.005, (1, 1, 1, 1))], x=-1200,
                        y=1200).outputs["Color"]
            sepz_ = _node(nt, "ShaderNodeSeparateXYZ", -1400, 1250)
            _link(nt, gen, sepz_.inputs[0])
            czz = float(os.environ.get("KCROWN_Z", 0.8))
            below_ = _ramp(nt, sepz_.outputs[2], [(czz - 0.015, (1, 1, 1, 1)), (czz + 0.015, (0, 0, 0, 1))], x=-1200,
                           y=1250).outputs["Color"]
            collar_ = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", skin, hi_, x=-900, y=1200), below_, x=-800, y=1200)
            skin = _math(nt, "SUBTRACT", skin, collar_, clamp=True, x=-700, y=1150)
        if os.environ.get("COLLAR_Z"):
            z0_, z1_ = (float(x) for x in os.environ["COLLAR_Z"].split(","))
            ch_ = float(os.environ.get("COLLAR_H", 0.075))
            hi2 = _ramp(nt, hsv.outputs[0], [(ch_ - 0.004, (0, 0, 0, 1)), (ch_ + 0.004, (1, 1, 1, 1))], x=-1200,
                        y=1500).outputs["Color"]
            sz2 = _node(nt, "ShaderNodeSeparateXYZ", -1400, 1550)
            _link(nt, gen, sz2.inputs[0])
            band = _ramp(nt, sz2.outputs[2], [(z0_ - 0.01, (0, 0, 0, 1)), (z0_ + 0.01, (1, 1, 1, 1)),
                                               (z1_ - 0.01, (1, 1, 1, 1)), (z1_ + 0.01, (0, 0, 0, 1))], x=-1200,
                         y=1550).outputs["Color"]
            col2 = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", skin, hi2, x=-900, y=1500), band, x=-800, y=1500)
            skin = _math(nt, "SUBTRACT", skin, col2, clamp=True, x=-700, y=1450)
        mm_ = (_math(nt, "MULTIPLY", metal_src, 1.0, clamp=True, x=-1000, y=1300) if metal_src is not None
               else _math(nt, "ADD", metal_val, 0.0, x=-1000, y=1300))
        if os.environ.get("SKIN_HMAX"):  # pupils (near black) are not cloth either
            eyev_ = _ramp(nt, hsv.outputs[2], [(0.08, (0, 0, 0, 1)), (0.12, (1, 1, 1, 1))], x=-1200, y=1400)
            mm_ = _math(nt, "MAXIMUM", mm_, _math(nt, "SUBTRACT", 1.0, eyev_.outputs["Color"], x=-900, y=1400),
                        x=-800, y=1350)
        cloth = _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", 1.0, skin, x=-700, y=1000) if not os.environ.get("SKIN_FELT")
                      else 1.0,  # SKIN_FELT (the rook): bare skin gets the cloth's felt surface too; the tone still sees skin
                      _math(nt, "SUBTRACT", 1.0, mm_, clamp=True, x=-700, y=1300), x=-550, y=1100)
        fib = _noise(nt, world_map(float(os.environ.get("FELT_FREQ", 700.0)), (4, 9, 2), 1500), 1.0, detail=2.0,
                     rough=0.7, x=-1100, y=1500)
        h = _math(nt, "ADD", h, _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", fib.outputs["Fac"], cloth, x=-400, y=1500),
                                      float(os.environ.get("FELT_BUMP", 0.25)), x=-250, y=1500), x=350, y=-600)
        felt = (skin, cloth, mm_)
        if os.environ.get("FELT_SURF"):
            # matted fibre relief: a second, distorted fibre noise + sparse little pills (bobbles) on the cloth
            fib2 = _noise(nt, world_map(float(os.environ.get("FELT_FREQ2", 260.0)), (7, 1, 5), 1700), 1.0, detail=3.0,
                          rough=0.75, dist=1.5, x=-1100, y=1700)
            pv = _node(nt, "ShaderNodeTexVoronoi", -1300, 1900, feature="F1")
            _link(nt, world_map(float(os.environ.get("PILL_FREQ", 55.0)), (2, 6, 9), 1900), pv.inputs["Vector"])
            pse = _node(nt, "ShaderNodeSeparateColor", -1100, 1900)
            _link(nt, pv.outputs["Color"], pse.inputs["Color"])
            pon = _ramp(nt, pse.outputs["Red"], [(1 - float(os.environ.get("PILL_P", 0.12)), (0, 0, 0, 1)),
                                                 (1 - float(os.environ.get("PILL_P", 0.12)) + 0.01, (1, 1, 1, 1))],
                        x=-900, y=1900)
            psh = _ramp(nt, pv.outputs["Distance"], [(0.0, (1, 1, 1, 1)), (0.22, (0, 0, 0, 1))], x=-900, y=2000,
                        interp="EASE")
            pill = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", pon.outputs["Color"], psh.outputs["Color"], x=-700,
                                               y=1950), cloth, x=-550, y=1950)
            h = _math(nt, "ADD", h, _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", fib2.outputs["Fac"], cloth, x=-400,
                                                                y=1700),
                                          float(os.environ.get("FELT_BUMP2", 0.35)), x=-250, y=1700), x=450, y=-650)
            h = _math(nt, "ADD", h, _math(nt, "MULTIPLY", pill, float(os.environ.get("PILL_BUMP", 0.9)), x=-250,
                                          y=1950), x=550, y=-700)
            felt_surf = (pill, fib2.outputs["Fac"])
        if os.environ.get("FELT_DEBUG"):
            print("FELT mask built", flush=True)
    bump_n = _node(nt, "ShaderNodeBump", 600, -400)
    _set(bump_n, "Strength", min(1.0, 0.55 * bump))
    _set(bump_n, "Distance", 0.012 * H)
    _link(nt, h, bump_n.inputs["Height"])
    if normal_src is not None:
        _link(nt, normal_src, bump_n.inputs["Normal"])
    _link(nt, bump_n.outputs["Normal"], bsdf.inputs["Normal"])
    ftex = None
    if felt is not None and os.environ.get("FELT_TEX"):
        img_ = bpy.data.images.get("felt_wool_h") or bpy.data.images.load(os.environ["FELT_TEX"])
        img_.name = "felt_wool_h"
        img_.colorspace_settings.name = "Non-Color"
        tx_ = _node(nt, "ShaderNodeTexImage", -1100, 2500)
        tx_.image = img_
        tx_.projection = "BOX"
        tx_.projection_blend = 0.3
        tx_.interpolation = "Cubic"
        _link(nt, world_map(float(os.environ.get("FTEX_SCALE", 2.0)), (0.3, 0.7, 0.1), 2500), tx_.inputs["Vector"])
        ftex = tx_.outputs["Color"]
        fb = _node(nt, "ShaderNodeBump", 800, -400)
        _set(fb, "Strength", float(os.environ.get("FTEX_BUMP", 0.5)))
        _set(fb, "Distance", float(os.environ.get("FTEX_DIST", 0.004)) * H)
        _link(nt, _math(nt, "MULTIPLY", ftex, felt[1], x=650, y=-500), fb.inputs["Height"])
        _link(nt, bump_n.outputs["Normal"], fb.inputs["Normal"])
        _link(nt, fb.outputs["Normal"], bsdf.inputs["Normal"])

    # --- colour: painted clay = keep texture, tiny hand-mottling, slightly chalky ---
    mott = _noise(nt, world_map(9.0, (2, 8, 1), -1500), 1.0, detail=4.0, rough=0.6, x=-1100, y=-1600)
    if base_src is not None:
        col = base_src
    else:
        c = _node(nt, "ShaderNodeRGB", 100, 300)
        c.outputs[0].default_value = base_col
        col = c.outputs[0]
    hs = _node(nt, "ShaderNodeHueSaturation", 300, 300)
    _set(hs, "Saturation", 1.02)
    _set(hs, "Value", 1.0)
    _link(nt, col, hs.inputs["Color"])
    mot_col = _mix(nt, _math(nt, "MULTIPLY", mott.outputs["Fac"], 0.22, x=500, y=500), hs.outputs["Color"],
                   (0.78, 0.74, 0.7, 1.0), blend="MULTIPLY", x=700, y=300)
    # crease darkening: dents and ridges get a little darker (paint pooling)
    dark = _mix(nt, _math(nt, "MULTIPLY", dent, 0.5, x=500, y=420), mot_col, (0.5, 0.42, 0.36, 1.0), blend="MULTIPLY",
                x=850, y=300)
    if felt is not None and os.environ.get("KING_TONE"):
        # tone down the glowing orange: skin -> soft peach clay, crown -> muted antique gold
        skin_, cloth_, mm2 = felt
        # the crown's gold shares the skin's hue and is not metal in the texture: split it off by height
        sepg = _node(nt, "ShaderNodeSeparateXYZ", 700, 1100)
        _link(nt, gen, sepg.inputs[0])
        cz = float(os.environ.get("KCROWN_Z", 0.8))
        ztop_ = _ramp(nt, sepg.outputs[2], [(cz - 0.015, (0, 0, 0, 1)), (cz + 0.015, (1, 1, 1, 1))], x=850, y=1100)
        crown = _math(nt, "MULTIPLY", skin_, ztop_.outputs["Color"], x=1000, y=1100)
        skin_ = _math(nt, "SUBTRACT", skin_, crown, clamp=True, x=1000, y=1200)
        mm2 = _math(nt, "MAXIMUM", mm2, crown, x=1000, y=1300)
        felt = (skin_, cloth_, mm2)
        ks, kv, kh = (float(os.environ.get(k_, d_)) for k_, d_ in (("KSKIN_SAT", 0.6), ("KSKIN_VAL", 0.85), ("KSKIN_HUE", -0.03)))
        ms, mv = float(os.environ.get("KMETAL_SAT", 0.7)), float(os.environ.get("KMETAL_VAL", 0.8))
        sat = _math(nt, "SUBTRACT", _math(nt, "SUBTRACT", 1.0, _math(nt, "MULTIPLY", skin_, 1 - ks, x=950, y=600), x=1050, y=600),
                    _math(nt, "MULTIPLY", mm2, 1 - ms, x=950, y=700), x=1150, y=600)
        val = _math(nt, "SUBTRACT", _math(nt, "SUBTRACT", 1.0, _math(nt, "MULTIPLY", skin_, 1 - kv, x=950, y=800), x=1050, y=800),
                    _math(nt, "MULTIPLY", mm2, 1 - mv, x=950, y=900), x=1150, y=800)
        hue = _math(nt, "ADD", 0.5, _math(nt, "MULTIPLY", skin_, kh, x=950, y=1000), x=1150, y=1000)
        hue = _math(nt, "ADD", hue, _math(nt, "MULTIPLY", mm2, float(os.environ.get("KMETAL_HUE", 0.0)), x=950, y=1050), x=1200, y=1050)
        ht = _node(nt, "ShaderNodeHueSaturation", 1300, 300)
        _link(nt, dark, ht.inputs["Color"])
        _link(nt, sat, ht.inputs["Saturation"])
        _link(nt, val, ht.inputs["Value"])
        _link(nt, hue, ht.inputs["Hue"])
        dark = ht.outputs["Color"]
        if os.environ.get("KCROWN_DEBUG"):
            dark = _mix(nt, crown, dark, (0.0, 0.2, 1.0, 1.0), x=1450, y=300)
    if felt is not None and felt_surf is not None:
        cl_ = felt[1]
        pill_, fibf = felt_surf
        mo1 = _noise(nt, world_map(float(os.environ.get("MOTT_FREQ", 40.0)), (3, 3, 7), 2200), 1.0, detail=4.0,
                     rough=0.6, x=1100, y=1500)
        mo2 = _noise(nt, world_map(18.0, (8, 2, 4), 2300), 1.0, detail=2.0, rough=0.5, x=1100, y=1650)
        amp = float(os.environ.get("MOTT_V", 0.06))
        # noise Fac sits ~0.3..0.7: (fac-0.5)*4*amp ~ +-amp; fine fibre noise adds speckle
        vv_ = _math(nt, "MULTIPLY", _math(nt, "ADD", _math(nt, "SUBTRACT", mo1.outputs["Fac"], 0.5, x=1250, y=1500),
                                          _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", fibf, 0.5, x=1250, y=1700), 0.5,
                                                x=1350, y=1700), x=1400, y=1500), 4 * amp, x=1500, y=1500)
        vv_ = _math(nt, "ADD", 1.0, _math(nt, "MULTIPLY", vv_, cl_, x=1600, y=1500), x=1700, y=1500)
        hh_ = _math(nt, "ADD", 0.5, _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", mo2.outputs["Fac"],
                                                                                         0.5, x=1250, y=1650),
                                                                 float(os.environ.get("MOTT_H", 0.06)), x=1400, y=1650),
                                           cl_, x=1500, y=1650), x=1600, y=1650)
        hm = _node(nt, "ShaderNodeHueSaturation", 1800, 300)
        _link(nt, dark, hm.inputs["Color"])
        _link(nt, vv_, hm.inputs["Value"])
        _link(nt, hh_, hm.inputs["Hue"])
        dark = _mix(nt, _math(nt, "MULTIPLY", pill_, float(os.environ.get("PILL_LIGHT", 0.35)), x=1850, y=450),
                    hm.outputs["Color"], (1, 1, 1, 1), blend="SCREEN", x=2000, y=300)
    if ftex is not None:
        # +-FTEX_V value from the wool texture on the cloth (height ~0.55 mean)
        fv = _math(nt, "ADD", 1.0, _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", ftex, 0.55,
                                                                                    x=2050, y=600),
                                                                2 * float(os.environ.get("FTEX_V", 0.10)), x=2150,
                                                                y=600), felt[1], x=2250, y=600), x=2350, y=600)
        fh = _node(nt, "ShaderNodeHueSaturation", 2450, 300)
        _link(nt, dark, fh.inputs["Color"])
        _link(nt, fv, fh.inputs["Value"])
        dark = fh.outputs["Color"]
    if felt is not None and os.environ.get("FELT_RIM"):
        # velvet rim: cloth lightens toward grazing angles (Layer Weight facing), patchy with the wool texture;
        # sheen tint = a lighter version of the cloth colour instead of white (both carry to three.js)
        lw = _node(nt, "ShaderNodeLayerWeight", 2300, 900)
        lw.inputs["Blend"].default_value = 0.45
        rim = _math(nt, "POWER", lw.outputs["Facing"], 2.0, x=2450, y=900)
        if ftex is not None:
            rim = _math(nt, "MULTIPLY", rim, _math(nt, "ADD", 0.5, ftex, x=2450, y=800), x=2550, y=850)
        rim = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", rim, felt[1], x=2650, y=900),
                    float(os.environ["FELT_RIM"]), clamp=True, x=2750, y=900)
        lift = _node(nt, "ShaderNodeMix", 2900, 700)
        lift.data_type = "RGBA"; lift.blend_type = "SCREEN"
        lift.inputs[0].default_value = 0.55
        _link(nt, dark, lift.inputs[6]); lift.inputs[7].default_value = (1.0, 0.96, 0.9, 1)
        rm = _node(nt, "ShaderNodeMix", 3050, 700)
        rm.data_type = "RGBA"
        _link(nt, rim, rm.inputs[0]); _link(nt, dark, rm.inputs[6]); _link(nt, lift.outputs[2], rm.inputs[7])
        _link(nt, lift.outputs[2], bsdf.inputs["Sheen Tint"])
        dark = rm.outputs[2]
    _link(nt, dark, bsdf.inputs["Base Color"])

    # --- matte clay response ---
    # metal mask (gold etc) -> only a faint satin sheen, never a metal look
    if metal_src is not None:
        mmask = _math(nt, "MULTIPLY", metal_src, 1.0, clamp=True, x=500, y=-100)
    else:
        mmask = _math(nt, "ADD", metal_val, 0.0, x=500, y=-100)
    rn = _math(nt, "MULTIPLY", lump.outputs["Fac"], 0.12, x=500, y=-200)
    rough = _math(nt, "ADD", _math(nt, "SUBTRACT", 0.64, _math(nt, "MULTIPLY", mmask, 0.14, x=650, y=-100), x=800,
                                   y=-100), rn, x=900, y=-150)
    if felt is not None and felt_surf is not None:
        fr = float(os.environ.get("FELT_ROUGH", 0.95))
        rough0 = _math(nt, "ADD", _math(nt, "SUBTRACT", 0.64, _math(nt, "MULTIPLY", mmask, 0.14, x=650, y=-120),
                                        x=800, y=-120), rn, x=900, y=-170)
        # lerp(rough0, fr, cloth) = rough0 + cloth*(fr - rough0)
        rough = _math(nt, "ADD", rough0, _math(nt, "MULTIPLY", felt[1],
                                               _math(nt, "SUBTRACT", fr, rough0, x=1000, y=-200), x=1100, y=-200),
                      clamp=True, x=1200, y=-170)
    _link(nt, rough, bsdf.inputs["Roughness"])
    _set(bsdf, "Metallic", 0.0)
    if felt is not None and os.environ.get("KMETAL_MET"):  # a little real metal on the crown
        _link(nt, _math(nt, "MULTIPLY", felt[2], float(os.environ["KMETAL_MET"]), x=950, y=-50), bsdf.inputs["Metallic"])
    spec = _math(nt, "ADD", 0.14, _math(nt, "MULTIPLY", mmask, 0.1, x=700, y=-300), x=900, y=-300)
    if felt is not None and felt_surf is not None:
        spec = _math(nt, "MULTIPLY", spec, _math(nt, "SUBTRACT", 1.0, _math(nt, "MULTIPLY", felt[1], 0.7, x=1000,
                                                                              y=-330), x=1100, y=-330), x=1200, y=-300)
    _link(nt, spec, bsdf.inputs["Specular IOR Level"])
    _set(bsdf, "IOR", 1.45)
    # warm subsurface (polymer clay is slightly translucent)
    _set(bsdf, "Subsurface Weight", float(os.environ.get("CLAY_SSS", 0.08)))
    _set(bsdf, "Subsurface Radius", (1.0, 0.45, 0.28))
    _set(bsdf, "Subsurface Scale", 0.018 * H)
    # dusty soft edge (fingerprints and lint on the clay)
    _set(bsdf, "Sheen Weight", float(os.environ.get("CLAY_SHEEN", 0.08)))
    _set(bsdf, "Sheen Roughness", 0.55)
    if felt is not None:
        skin, cloth, mm_ = felt
        sw = _math(nt, "ADD", _math(nt, "MULTIPLY", cloth, float(os.environ.get("FELT_W", 0.7)), x=1000, y=-500),
                   _math(nt, "ADD", _math(nt, "MULTIPLY", skin, float(os.environ.get("FELT_SKIN", 0.15)), x=1000, y=-600),
                         _math(nt, "MULTIPLY", mm_, 0.08, x=1000, y=-700), x=1150, y=-650), x=1300, y=-550)
        _link(nt, sw, bsdf.inputs["Sheen Weight"])
        _set(bsdf, "Sheen Roughness", float(os.environ.get("FELT_R", 0.4)))
        try:
            bsdf.inputs["Sheen Tint"].default_value = (0.95, 0.95, 0.93, 1.0)
        except Exception:
            pass
        if os.environ.get("FELT_DEBUG"):  # show the cloth mask as emission to check it
            for l in list(bsdf.inputs["Base Color"].links):
                nt.links.remove(l)
            _link(nt, cloth, bsdf.inputs["Base Color"])
    _set(bsdf, "Coat Weight", 0.0)


_EYE_V = set()


def _felt_fur(m, H):
    """KING_FUR: short dense felt fibres on the cloth only (vertex mask from the base-colour texture)."""
    import numpy as np
    import colorsys
    mat = m.material_slots[0].material if m.material_slots else None
    if mat is None or not mat.use_nodes:
        return
    imgs = [n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]
    base = next((im for im in imgs if im.colorspace_settings.name == "sRGB"), None)
    mr = next((im for im in imgs if im is not base and "normal" not in im.name.lower()), None)
    if base is None:
        return
    def arr(im):
        w_, h_ = im.size
        return np.array(im.pixels[:], dtype=np.float32).reshape(h_, w_, 4), w_, h_
    B, bw, bh = arr(base)
    M = arr(mr) if mr is not None else None
    me = m.data
    uvl = me.uv_layers.active.data
    nv = len(me.vertices)
    acc = np.zeros(nv); cnt = np.zeros(nv)
    zs = np.array([v.co.z for v in me.vertices])
    zmin, zmax = zs.min(), zs.max()
    cz = float(os.environ.get("FUR_CROWN_Z", os.environ.get("KCROWN_Z", 0.8)))
    _hd = []
    _EYE_V.clear()
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            u, v = uvl[li].uv
            px = min(bw - 1, max(0, int((u % 1.0) * bw))); py = min(bh - 1, max(0, int((v % 1.0) * bh)))
            r, g, b = B[py, px, :3]
            hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
            skin = (vv > 0.6) and (ss > 0.25) and (0.03 < hh < 0.15)
            metal = False
            if M is not None:
                MM, mw, mh = M
                metal = MM[min(mh - 1, int((v % 1.0) * mh)), min(mw - 1, int((u % 1.0) * mw)), 2] > 0.5
            crown = skin and (zs[vi] - zmin) / max(1e-6, zmax - zmin) > cz
            if skin and not crown and os.environ.get("SKIN_HMAX") and hh >= float(os.environ["SKIN_HMAX"]):
                skin = False  # the collar: cloth
            if skin and os.environ.get("COLLAR_Z"):
                z0_, z1_ = (float(x) for x in os.environ["COLLAR_Z"].split(","))
                zf_ = (zs[vi] - zmin) / max(1e-6, zmax - zmin)
                if z0_ <= zf_ <= z1_ and hh >= float(os.environ.get("COLLAR_H", 0.075)):
                    skin = False  # the pale yellow collar at shoulder height: cloth
            zf2_ = (zs[vi] - zmin) / max(1e-6, zmax - zmin)
            if os.environ.get("CROWN_ALL") and zf2_ > float(os.environ["CROWN_ALL"]):
                crown = True  # everything above the crown line, whatever its colour (jewels, gold, band)
            if os.environ.get("JEWEL_Z") and zf2_ > float(os.environ["JEWEL_Z"]) and ss > 0.4 and vv > 0.15 \
                    and (hh < 0.03 or hh > 0.45):
                crown = True  # blue and red gems
            eye = vv < float(os.environ.get("FUR_EYE_V", 0.1))  # pupils and eye whites stay clean
            if os.environ.get("HUE_DEBUG") and (vv > 0.6) and (ss > 0.25) and (0.03 < hh < 0.15):
                _hd.append(((zs[vi] - zmin) / max(1e-6, zmax - zmin), hh, ss, vv))
            if skin and os.environ.get("SKIN_FELT"):  # the rook: his bare skin is felt too, fuzz and all
                skin = False
            acc[vi] += 0.0 if (skin or metal or crown or eye) else 1.0
            if eye and vv < 0.1:
                _EYE_V.add(vi)
            cnt[vi] += 1
    if os.environ.get("HUE_DEBUG"):
        _h = np.array(_hd)
        for z0 in np.arange(0.3, 1.0, 0.05):
            sel = _h[(_h[:, 0] >= z0) & (_h[:, 0] < z0 + 0.05)]
            if len(sel):
                print("CHECK hue z%.2f n=%d hue p10/50/90=%.3f/%.3f/%.3f sat50=%.2f" % (z0, len(sel), *np.percentile(sel[:, 1], [10, 50, 90]), np.median(sel[:, 2])), flush=True)
    wts = acc / np.maximum(cnt, 1)
    vg = m.vertex_groups.new(name="felt")
    for i in range(nv):
        if wts[i] > 0:
            vg.add([i], float(wts[i]), "REPLACE")
    print("CHECK fur mask cloth verts %d of %d" % (int((wts > 0.5).sum()), nv), flush=True)
    if os.environ.get("KING_SHELL"):
        _felt_shells(m, H, wts, base)
    if os.environ.get("KING_FIBRES"):
        _felt_fibres(m, H, wts, base)
        return
    if os.environ.get("KING_SHELL"):
        if not os.environ.get("KING_STRAY"):
            return
    # fibre material: colour from the texture under the root, lighter tips, matte with sheen; no subsurface
    fm = bpy.data.materials.new("felt_fibre")
    fm.use_nodes = True
    nt = fm.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    uvn = nt.nodes.new("ShaderNodeUVMap")
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = base
    nt.links.new(uvn.outputs["UV"], tx.inputs["Vector"])
    hi = nt.nodes.new("ShaderNodeHairInfo")
    tip = nt.nodes.new("ShaderNodeMix"); tip.data_type = "RGBA"; tip.blend_type = "SCREEN"
    fl = nt.nodes.new("ShaderNodeMath"); fl.operation = "MULTIPLY"
    nt.links.new(hi.outputs["Intercept"], fl.inputs[0]); fl.inputs[1].default_value = float(os.environ.get("FUR_TIP", 0.25))
    nt.links.new(fl.outputs[0], tip.inputs[0])
    nt.links.new(tx.outputs["Color"], tip.inputs[6]); tip.inputs[7].default_value = (1, 1, 1, 1)
    nt.links.new(tip.outputs[2], bs.inputs["Base Color"])
    if os.environ.get("STRAY_DEBUG"):
        for l in list(bs.inputs["Base Color"].links):
            nt.links.remove(l)
        bs.inputs["Base Color"].default_value = (1, 0, 0, 1)
        bs.inputs["Emission Color"].default_value = (1, 0, 0, 1)
        bs.inputs["Emission Strength"].default_value = 3.0
    bs.inputs["Roughness"].default_value = 0.8
    bs.inputs["Sheen Weight"].default_value = 0.5
    bs.inputs["Sheen Roughness"].default_value = 0.4
    bs.inputs["Subsurface Weight"].default_value = 0.0
    me.materials.append(fm)
    # particle hair (after the armature modifier, so it grows from the posed mesh)
    mod = m.modifiers.new("felt_fur", "PARTICLE_SYSTEM")
    ps = mod.particle_system
    st = ps.settings
    st.type = "HAIR"
    st.count = int(float(os.environ.get("FUR_N", 150000)))
    stray = int(float(os.environ.get("KING_STRAY", 0)))
    osc = m.matrix_world.to_scale()[0] if os.environ.get("FUR_WORLD_HAIR") else 1.0
    st.hair_length = float(os.environ.get("FUR_L", 0.006)) * H
    st.emit_from = "FACE"
    st.use_emit_random = True
    st.normal_factor = 1.0
    st.factor_random = float(os.environ.get("FUR_RAND", 0.6))
    st.display_step = 2
    st.render_step = 2
    st.material = len(me.materials)
    st.root_radius = 1.0
    st.tip_radius = 0.1
    st.radius_scale = float(os.environ.get("FUR_R", 0.0005)) * H
    st.child_type = "NONE"
    st.use_hair_bspline = False
    ps.vertex_group_density = "felt"
    ps.vertex_group_length = "felt"
    ps.seed = 11
    if stray:
        # few long flyaway fibres: parents + interpolated curly children, random directions (some lie down, some
        # stand out past the silhouette), thin, lighter tips catch the light as a fuzzy halo
        ch = int(os.environ.get("STRAY_CH", 4))
        st.count = max(1, stray // ch)
        st.hair_length = float(os.environ.get("STRAY_L", 0.03)) * H
        st.hair_step = int(os.environ.get("STRAY_STEP", 6))
        st.display_step = 2
        st.render_step = int(os.environ.get("STRAY_RSTEP", 4))
        st.normal_factor = float(os.environ.get("STRAY_NORMAL", 0.5))
        st.factor_random = float(os.environ.get("STRAY_RAND", 1.0))
        st.brownian_factor = float(os.environ.get("STRAY_BROWN", 0.0))
        st.child_type = "SIMPLE"
        st.child_percent = ch
        st.rendered_child_count = ch
        st.child_radius = 0.03 * H / osc
        st.child_length = 1.0
        st.child_length_threshold = 0.4  # children vary in length
        st.kink = "CURL"
        st.kink_amplitude = float(os.environ.get("STRAY_CURL", 0.004)) * H / osc
        st.kink_frequency = 3.0
        st.kink_shape = 0.0
        st.roughness_1 = 0.004 * H / osc
        st.roughness_1_size = 0.3
        st.roughness_endpoint = 0.006 * H / osc
        st.roughness_2 = 0.006 * H / osc
        st.roughness_2_size = 0.5
        st.roughness_2_threshold = 0.3
        st.root_radius = 1.0
        st.tip_radius = 0.2
        st.radius_scale = float(os.environ.get("STRAY_R", 0.0005)) * H / osc
        ps.vertex_group_length = ""
        st.hair_length = float(os.environ.get("STRAY_L", 0.03)) * H / osc  # last: normal/random factors rescale it
        try:
            dg = bpy.context.evaluated_depsgraph_get()
            ev = m.evaluated_get(dg)
            pse = ev.particle_systems[-1]
            ls_ = []
            for pa in list(pse.particles)[:200]:
                ks = pa.hair_keys
                if len(ks) > 1:
                    ls_.append((Vector(ks[-1].co) - Vector(ks[0].co)).length)
            print("CHECK stray world scale", tuple(round(v, 5) for v in m.matrix_world.to_scale()), flush=True)
            print("CHECK stray n=%d set_len=%.4f H=%.3f measured median=%.4f max=%.4f" % (
                len(pse.particles), st.hair_length, H, sorted(ls_)[len(ls_) // 2] if ls_ else -1, max(ls_) if ls_ else -1),
                flush=True)
        except Exception as e_:
            print("CHECK stray eval failed", e_, flush=True)
    try:
        bpy.context.scene.cycles_curves.shape = os.environ.get("FUR_SHAPE", "RIBBONS")
    except Exception as e_:
        print("CHECK fur shape", e_)


FIBRE_ROOTS = {}


def _felt_fibres(m, H, wts, base):
    """KING_FIBRES=N: N short matted fibres + FLY_N long flyaways as a separate world-space hair-curves object
    (particle hair fights the king's 0.01 object scale). Lengths and radii are fractions of the king height H."""
    import numpy as np
    rng = np.random.default_rng(int(os.environ.get("FIB_SEED", 7)))
    dg = bpy.context.evaluated_depsgraph_get()
    ev = m.evaluated_get(dg)
    me = ev.to_mesh()
    if len(me.vertices) != len(wts):
        print("CHECK fibres: evaluated vert count differs, using rest mesh", flush=True)
        ev.to_mesh_clear()
        me = m.data
    me.calc_loop_triangles()
    mw = m.matrix_world
    nv = len(me.vertices)
    co = np.empty(nv * 3); me.vertices.foreach_get("co", co); co = co.reshape(nv, 3)
    co = co @ np.array(mw.to_3x3()).T + np.array(mw.translation)
    nt_ = len(me.loop_triangles)
    tv = np.empty(nt_ * 3, dtype=np.int64); me.loop_triangles.foreach_get("vertices", tv); tv = tv.reshape(nt_, 3)
    tl = np.empty(nt_ * 3, dtype=np.int64); me.loop_triangles.foreach_get("loops", tl); tl = tl.reshape(nt_, 3)
    uvd = me.uv_layers.active.data
    uv = np.empty(len(uvd) * 2); uvd.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
    w3 = np.asarray(wts)[tv]
    keep = w3.min(axis=1) > 0.5
    a, b, c = co[tv[:, 0]], co[tv[:, 1]], co[tv[:, 2]]
    cr = np.cross(b - a, c - a)
    area = np.linalg.norm(cr, axis=1)
    nrm = cr / np.maximum(area[:, None], 1e-12)
    area = np.where(keep, area, 0.0)
    if area.sum() <= 0:
        print("CHECK fibres: no cloth triangles", flush=True)
        return
    pr = area / area.sum()

    _last, ROOTS = [], []

    def sample(n):
        ti = rng.choice(nt_, size=n, p=pr)
        r1, r2 = rng.random(n), rng.random(n)
        s = np.sqrt(r1)
        wa, wb, wc = 1 - s, s * (1 - r2), s * r2
        p = a[ti] * wa[:, None] + b[ti] * wb[:, None] + c[ti] * wc[:, None]
        u = uv[tl[ti, 0]] * wa[:, None] + uv[tl[ti, 1]] * wb[:, None] + uv[tl[ti, 2]] * wc[:, None]
        _last[:] = [tv[ti], np.stack([wa, wb, wc], 1)]  # root triangle + barycentrics, for FIBRE_ROOTS
        return p, nrm[ti], u

    def frame(n_):
        t = np.cross(n_, np.array([0.0, 0.0, 1.0]))
        bad = np.linalg.norm(t, axis=1) < 1e-3
        t[bad] = np.cross(n_[bad], np.array([1.0, 0.0, 0.0]))
        t /= np.linalg.norm(t, axis=1)[:, None]
        return t, np.cross(n_, t)

    V2 = bool(os.environ.get("FIB_V2"))

    def _nn(ref, q, chunk=4000):  # nearest ref point for each q (numpy, no scipy in Blender)
        d_out = np.empty(len(q)); i_out = np.empty(len(q), dtype=np.int64)
        for s0 in range(0, len(q), chunk):
            d2 = ((q[s0:s0 + chunk, None, :] - ref[None, :, :]) ** 2).sum(-1)
            i_ = d2.argmin(1)
            i_out[s0:s0 + chunk] = i_
            d_out[s0:s0 + chunk] = np.sqrt(d2[np.arange(len(i_)), i_])
        return d_out, i_out
    SH = []
    TW, TH = base.size
    TEX = np.array(base.pixels[:], dtype=np.float32).reshape(TH, TW, 4)
    eyes = co[sorted(_EYE_V)] if _EYE_V else None
    print("CHECK fibres eye verts %d" % (0 if eyes is None else len(eyes)), flush=True)

    def fibres(n, L, tilt_lo, tilt_hi, npts, curl, R):
        p, n_, u = sample(n)
        if V2 and eyes is not None and len(eyes):
            dd, _ = _nn(eyes, p)
            ok = dd > float(os.environ.get("EYE_CLEAR", 0.05)) * H
            p, n_, u = p[ok], n_[ok], u[ok]
            _last[:] = [_last[0][ok], _last[1][ok]]
            n = len(p)
        t, bt = frame(n_)
        ang = rng.random(n) * 2 * np.pi
        tang = t * np.cos(ang)[:, None] + bt * np.sin(ang)[:, None]
        tilt = np.radians(tilt_lo + (tilt_hi - tilt_lo) * rng.random(n))
        d = n_ * np.cos(tilt)[:, None] + tang * np.sin(tilt)[:, None]
        if V2:
            ln = L * H * (0.35 + 1.3 * rng.random(n) ** float(os.environ.get("FIB_SHORT", 2.5)))
        else:
            ln = L * H * (0.45 + 0.75 * rng.random(n))
        side = np.cross(d, n_)
        side /= np.maximum(np.linalg.norm(side, axis=1)[:, None], 1e-9)
        ph = rng.random(n) * 2 * np.pi
        wav = 1.2 + 2.0 * rng.random(n)
        pts = []
        root = p - n_ * (0.002 * H)  # start just under the skin so no root gap shows
        for k in range(npts):
            f = k / (npts - 1)
            q = root + d * (ln * f)[:, None]
            # matted fibres sag back toward the surface; flyaways wave sideways (curl)
            if V2:
                # tangled wavy fibre: a helix whose radius scales with the fibre length, sagging back onto the surface
                q -= n_ * (ln * float(os.environ.get("FIB_SAG", 0.35)) * f * f * (tilt > np.radians(45)))[:, None]
                w_ = ph + f * wav * 2 * np.pi
                amp = (curl * ln * np.minimum(1.0, f * 3.0))[:, None]
                q = q + (side * np.sin(w_)[:, None] + (np.cross(side, d)) * np.cos(w_)[:, None]) * amp
            else:
                q -= n_ * (ln * 0.25 * f * f * (tilt > np.radians(45)))[:, None]
                q = q + (side * np.sin(ph + f * 5.0)[:, None] + n_ * (0.5 * np.cos(ph + f * 5.0))[:, None]) * (curl * H * f)
            pts.append(q)
        P = np.stack(pts, axis=1)  # n x npts x 3
        sh = np.ones(n)
        if V2 and float(os.environ.get("FIB_CLUMP", 0)) > 0 and n > 100:
            # locks: sample the texture under each root; brown fibres join the nearest clump centre and lean with it
            import colorsys
            px_ = np.clip((np.mod(u[:, 0], 1) * TW).astype(int), 0, TW - 1)
            py_ = np.clip((np.mod(u[:, 1], 1) * TH).astype(int), 0, TH - 1)
            rgb = TEX[py_, px_, :3]
            mx_, mn_ = rgb.max(1), rgb.min(1)
            sat = (mx_ - mn_) / np.maximum(mx_, 1e-6)
            brown = (sat > 0.3) & (mx_ < float(os.environ.get("BROWN_V", 0.5))) & (rgb[:, 0] >= rgb[:, 2])
            if brown.sum() > 50:
                cr_ = float(os.environ.get("CLUMP_R", 0.045)) * H
                bi = np.nonzero(brown)[0]
                nc = max(8, int(len(bi) * float(os.environ.get("CLUMP_FRAC", 0.004))))
                cidx = bi[rng.choice(len(bi), size=nc, replace=False)]
                dd, ci = _nn(p[cidx], p[bi])
                cn = n_[cidx][ci]
                down = np.array([0.0, 0.0, -1.0])
                cdir = cn * 0.45 + down * 0.9  # locks hang down and out
                cdir /= np.linalg.norm(cdir, axis=1)[:, None]
                k_ = float(os.environ["FIB_CLUMP"])
                lnb = ln[bi] * float(os.environ.get("CLUMP_LEN", 1.6))
                cen = p[cidx][ci]
                for k in range(npts):
                    f = k / (npts - 1)
                    straight = P[bi, 0] + cdir * (lnb * f)[:, None]
                    # tips converge toward the clump axis -> a lock shape
                    axis = cen + cdir * (lnb * f)[:, None]
                    straight = straight + (axis - straight) * (0.5 * f * k_)
                    P[bi, k] = P[bi, k] * (1 - k_) + straight * k_
                q_ = np.clip(dd / cr_, 0, 1)
                sh[bi] = (float(os.environ.get("CLUMP_HI", 1.15)) - float(os.environ.get("CLUMP_DEPTH", 0.35)) * q_ * q_) * \
                    float(os.environ.get("BROWN_GAIN", 1.0))
                print("CHECK clumps brown=%d clumps=%d" % (len(bi), nc), flush=True)
        SH.append(sh)
        rad = R * H * np.linspace(1.0, 0.25, npts)[None, :].repeat(n, 0)
        ROOTS.append((_last[0], _last[1], npts))
        return P, rad, u

    n_m = int(float(os.environ.get("KING_FIBRES", 30000)))
    n_f = int(float(os.environ.get("FLY_N", 3000)))
    sets = []
    if n_m:
        sets.append(fibres(n_m, float(os.environ.get("FIB_L", 0.025)), float(os.environ.get("FIB_TILT_LO", 40)), 85,
                           int(os.environ.get("FIB_PTS", 3)), float(os.environ.get("FIB_CURL", 0.002)),
                           float(os.environ.get("FIB_R", 0.0012))))
    if n_f:
        sets.append(fibres(n_f, float(os.environ.get("FLY_L", 0.07)), 10, 70, int(os.environ.get("FLY_PTS", 4)),
                           float(os.environ.get("FLY_CURL", 0.006)),
                           float(os.environ.get("FLY_R", 0.0005))))
    hc = bpy.data.hair_curves.new("felt_fibres")
    sizes = []
    for P, rad, u in sets:
        sizes += [P.shape[1]] * P.shape[0]
    hc.add_curves(sizes)
    pos = np.concatenate([P.reshape(-1, 3) for P, _, _ in sets])
    rads = np.concatenate([r.reshape(-1) for _, r, _ in sets])
    uvs = np.concatenate([u for _, _, u in sets])
    hc.attributes["position"].data.foreach_set("vector", pos.ravel())
    ra = hc.attributes.get("radius") or hc.attributes.new("radius", "FLOAT", "POINT")
    ra.data.foreach_set("value", rads)
    ua = hc.attributes.new("uvr", "FLOAT2", "CURVE")
    ua.data.foreach_set("vector", uvs.ravel())
    if SH:
        sa = hc.attributes.new("shade", "FLOAT", "CURVE")
        sa.data.foreach_set("value", np.concatenate(SH).astype(np.float32))
    ob = bpy.data.objects.new("felt_fibres", hc)
    # where each curve is rooted (body triangle, barycentrics), so a posed or animated body can carry them
    # (bake_king_sprites --clip, via king_motion.FibreBinder)
    FIBRE_ROOTS[hc.name] = {"tri": np.concatenate([r[0] for r in ROOTS]), "bary": np.concatenate([r[1] for r in ROOTS]),
                            "npts": np.concatenate([np.full(len(r[0]), r[2]) for r in ROOTS])}
    for col in m.users_collection:
        col.objects.link(ob)
    # material: colour from the king texture under the root, lighter tips, matte + sheen, no subsurface
    fm = bpy.data.materials.new("felt_fibre2")
    fm.use_nodes = True
    nt = fm.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    at = nt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "uvr"
    tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = base
    nt.links.new(at.outputs["Vector"], tx.inputs["Vector"])
    hi = nt.nodes.new("ShaderNodeHairInfo")
    tip = nt.nodes.new("ShaderNodeMix"); tip.data_type = "RGBA"; tip.blend_type = "SCREEN"
    fl = nt.nodes.new("ShaderNodeMath"); fl.operation = "MULTIPLY"
    nt.links.new(hi.outputs["Intercept"], fl.inputs[0]); fl.inputs[1].default_value = float(os.environ.get("FIB_TIP", 0.12))
    nt.links.new(fl.outputs[0], tip.inputs[0])
    nt.links.new(tx.outputs["Color"], tip.inputs[6]); tip.inputs[7].default_value = (1, 1, 1, 1)
    nt.links.new(tip.outputs[2], bs.inputs["Base Color"])
    if V2:
        for l in list(bs.inputs["Base Color"].links):
            nt.links.remove(l)
        sc = nt.nodes.new("ShaderNodeVectorMath"); sc.operation = "SCALE"
        nt.links.new(tx.outputs["Color"], sc.inputs[0]); sc.inputs["Scale"].default_value = 1.0 + float(os.environ.get("FIB_LIFT", 0.08))
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
        nt.links.new(hi.outputs["Intercept"], mx.inputs[0])
        nt.links.new(tx.outputs["Color"], mx.inputs[6]); nt.links.new(sc.outputs[0], mx.inputs[7])
        sat_ = nt.nodes.new("ShaderNodeAttribute"); sat_.attribute_name = "shade"
        shm = nt.nodes.new("ShaderNodeMix"); shm.data_type = "RGBA"; shm.blend_type = "MULTIPLY"
        shm.inputs[0].default_value = 1.0
        nt.links.new(mx.outputs[2], shm.inputs[6]); nt.links.new(sat_.outputs["Fac"], shm.inputs[7])
        nt.links.new(shm.outputs[2], bs.inputs["Base Color"])
    # sheen tint = a lighter version of the fibre colour (white sheen made the fibres look frosty)
    shl = nt.nodes.new("ShaderNodeMix"); shl.data_type = "RGBA"; shl.blend_type = "SCREEN"
    shl.inputs[0].default_value = float(os.environ.get("FIB_SHEEN_LIFT", 0.35))
    nt.links.new(tx.outputs["Color"], shl.inputs[6]); shl.inputs[7].default_value = (1, 1, 1, 1)
    nt.links.new(shl.outputs[2], bs.inputs["Sheen Tint"])
    bs.inputs["Roughness"].default_value = 0.9
    bs.inputs["Sheen Weight"].default_value = 1.0
    bs.inputs["Sheen Roughness"].default_value = 0.6
    bs.inputs["Subsurface Weight"].default_value = 0.0
    bs.inputs["Specular IOR Level"].default_value = 0.2
    if V2:
        bs.inputs["Roughness"].default_value = 1.0
        bs.inputs["Transmission Weight"].default_value = float(os.environ.get("FIB_TRANS", 0.3))
        bs.inputs["Sheen Weight"].default_value = float(os.environ.get("FIB_SHEEN", 0.6))
    if os.environ.get("STRAY_DEBUG"):
        for l in list(bs.inputs["Base Color"].links):
            nt.links.remove(l)
        bs.inputs["Base Color"].default_value = (1, 0, 0, 1)
        bs.inputs["Emission Color"].default_value = (1, 0, 0, 1)
        bs.inputs["Emission Strength"].default_value = 3.0
    hc.materials.append(fm)
    if os.environ.get("KING_RIM"):
        # soft warm backlight behind and above the king, linked to the king, his shells and fibres only, so the
        # fuzz edge glows (sheen and flyaways only show at grazing angles)
        rc = bpy.data.collections.new("KingRimRecv")
        rcv = [ob] + [o for o in bpy.data.objects if o.name.startswith(m.name + "_shell")]
        if not os.environ.get("KING_RIM_FIBONLY"):
            rcv.append(m)
        for o_ in rcv:
            rc.objects.link(o_)
        ctr = co.mean(axis=0)
        top = co[:, 2].max()
        rl = bpy.data.lights.new("king_rim", "AREA")
        rl.shape = "DISK"
        rl.size = float(os.environ.get("KING_RIM_S", 0.6)) * H
        rl.energy = float(os.environ["KING_RIM"]) * H * H
        rl.color = _envf3("KING_RIM_C", (1.0, 0.82, 0.6))
        try:
            rl.cycles.cast_shadow = False
        except Exception:
            pass
        ro = bpy.data.objects.new("king_rim", rl)
        for col in m.users_collection:
            col.objects.link(ro)
        ry = float(os.environ.get("KING_RIM_Y", 1.2))
        ro.location = (ctr[0] + float(os.environ.get("KING_RIM_X", 0.3)) * H, ctr[1] + ry * H, top + float(os.environ.get("KING_RIM_Z", 0.5)) * H)
        d_ = Vector(ctr) - Vector(ro.location)
        ro.rotation_euler = d_.to_track_quat("-Z", "Y").to_euler()
        ro.light_linking.receiver_collection = rc
    span = pos.max(axis=0) - pos.min(axis=0)
    print("CHECK fibres matted=%d fly=%d pts=%d span=%s H=%.3f" % (n_m, n_f, len(pos), tuple(round(float(x), 3) for x in span),
                                                                   H), flush=True)


def _felt_shells(m, H, wts, base):
    """KING_SHELL fallback for real curves: N offset copies of the king pushed out along the normals (cloth only),
    each cut by an alpha mask of tiny fibre dots that thin out toward the outer shells (tapered fibres)."""
    import numpy as np
    me = m.data
    n_sh = int(os.environ.get("KING_SHELL", 4))
    L = float(os.environ.get("SHELL_L", 0.008)) * H
    osc = m.matrix_world.to_scale()[0] if os.environ.get("FUR_WORLD") else 1.0  # king mesh is scaled 0.01
    L = L / osc
    freq = float(os.environ.get("SHELL_FREQ", 450.0))
    dims = _local_dims_world(m)
    for k in range(1, n_sh + 1):
        t = k / n_sh
        sm = m.copy()
        sm.data = me.copy()
        sm.name = "%s_shell%d" % (m.name, k)
        for c in m.users_collection:
            c.objects.link(sm)
        # cloth weight as a colour attribute for the shader (vertex groups are not visible to Cycles shaders)
        at = sm.data.color_attributes.new("feltw", "FLOAT_COLOR", "POINT")
        cols = np.repeat(wts.astype(np.float32), 4).reshape(-1, 4)
        cols[:, 3] = 1.0
        at.data.foreach_set("color", cols.ravel())
        for md in list(sm.modifiers):
            if md.type == "PARTICLE_SYSTEM":
                sm.modifiers.remove(md)
        # cut skin, crown and metal out of the shell: only cloth faces get fur (no coincident copies on the skin)
        import bmesh
        bm = bmesh.new(); bm.from_mesh(sm.data)
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if wts[v.index] < 0.5], context="VERTS")
        bm.to_mesh(sm.data); bm.free()
        dp = sm.modifiers.new("shell", "DISPLACE")
        dp.direction = "NORMAL"
        dp.mid_level = 0.0
        dp.strength = L * (t ** float(os.environ.get("SHELL_POW", 1.0)))
        dp.vertex_group = "felt"
        sm.data.materials.clear()
        mat = bpy.data.materials.new("felt_shell%d" % k)
        mat.use_nodes = True
        try:
            mat.blend_method = "HASHED"
        except Exception:
            pass
        nt = mat.node_tree
        out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        uvn = nt.nodes.new("ShaderNodeUVMap")
        tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = base
        _link(nt, uvn.outputs["UV"], tx.inputs["Vector"])
        tip = _mix(nt, float(os.environ.get("SHELL_TIP", 0.25)) * t, tx.outputs["Color"], (1, 1, 1, 1), blend="SCREEN")
        _link(nt, tip, bs.inputs["Base Color"])
        _set(bs, "Roughness", 0.9)
        _set(bs, "Sheen Weight", 0.6)
        _set(bs, "Sheen Roughness", 0.35)
        _set(bs, "Subsurface Weight", 0.0)
        _set(bs, "Specular IOR Level", 0.1)
        # fibre dots: Voronoi cells per figurine height; each cell's fibre has its own length (cell colour)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sc = Vector((freq * dims[i] / H for i in range(3)))
        mp = _mapping(nt, tc.outputs["Generated"], sc, (1.3, 2.1, 0.7))
        # slight per-shell drift so fibres lean and wander instead of standing as straight columns
        mp2 = _mapping(nt, mp, (1, 1, 1), (0.08 * k, 0.05 * k, 0.03 * k))
        vo = nt.nodes.new("ShaderNodeTexVoronoi")
        vo.feature = "F1"
        _link(nt, mp2, vo.inputs["Vector"])
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        _link(nt, vo.outputs["Color"], sep.inputs["Color"])
        rad = float(os.environ.get("SHELL_R", 0.32)) * (1.0 - 0.6 * t)
        dot = _math(nt, "LESS_THAN", vo.outputs["Distance"], rad)
        alive = _math(nt, "GREATER_THAN", sep.outputs["Red"], t * float(os.environ.get("SHELL_KEEP", 0.9)))  # length
        attr = nt.nodes.new("ShaderNodeAttribute"); attr.attribute_name = "feltw"
        cw = _math(nt, "GREATER_THAN", attr.outputs["Fac"], 0.5)
        alpha = _math(nt, "MULTIPLY", dot, alive)  # skin is cut out of the shell mesh, so no cloth mask needed
        if os.environ.get("SHELL_NOISE"):
            nz = nt.nodes.new("ShaderNodeTexNoise")
            _link(nt, _mapping(nt, tc.outputs["Generated"], Vector((30 * dims[i] / H for i in range(3))),
                               (5.1, 0.3, 2.2)), nz.inputs["Vector"])
            nz.inputs["Detail"].default_value = 3.0
            keep = _math(nt, "GREATER_THAN", nz.outputs["Fac"],
                         0.35 + float(os.environ["SHELL_NOISE"]) * 0.3 * t)  # outer shells keep less
            alpha = _math(nt, "MULTIPLY", alpha, keep)
        if os.environ.get("SHELL_DEBUG"):
            em = nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value = (1, 0, 0, 1)
            bs = em
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        mx = nt.nodes.new("ShaderNodeMixShader")
        _link(nt, alpha, mx.inputs[0])
        _link(nt, tr.outputs[0], mx.inputs[1])
        _link(nt, bs.outputs[0], mx.inputs[2])
        _link(nt, mx.outputs[0], out.inputs["Surface"])
        sm.data.materials.append(mat)
    try:
        bpy.context.scene.cycles.transparent_max_bounces = max(bpy.context.scene.cycles.transparent_max_bounces,
                                                               4 * n_sh + 4)
    except Exception:
        pass
    print("CHECK felt shells %d len %.4f" % (n_sh, L), flush=True)


def clay_ify(obj, bump=1.0, fine=1.0):
    """Turn an imported figurine (and its child meshes) into matte hand-made clay.

    Keeps the base-colour texture and any normal map. bump scales surface marks."""
    meshes = _meshes_of(obj)
    bpy.context.view_layer.update()
    # figurine height for scale-aware parameters
    zs = []
    for m in meshes:
        for c in m.bound_box:
            zs.append((m.matrix_world @ Vector(c)).z)
    H = max(zs) - min(zs) if zs else 1.0
    H = max(H, 0.05)
    for m in meshes:
        dims = _local_dims_world(m)
        # for armature-parented meshes, matrix_world of mesh already includes parent scale
        for slot in m.material_slots:
            _clay_material(slot.material, dims, H, bump, fine)
        if os.environ.get("KING_FUR"):
            _felt_fur(m, H)
    return obj


# --------------------------------------------------------------------------
# 2. stage
# --------------------------------------------------------------------------
def _stone_mat():
    """Grey flagstone: mottled, fine grain, thin dark cracks, grime and chips toward the slab rim.
    Slabs carry a UV map spanning 0..1 over their footprint (edge distance) and are modelled in place,
    so Object coords differ per slab."""
    m, nt, b = _new_mat("stage_stone")
    tc = _node(nt, "ShaderNodeTexCoord", -1700, 0)
    oi = _node(nt, "ShaderNodeObjectInfo", -1700, 300)
    obj = tc.outputs["Object"]
    n1 = _noise(nt, _mapping(nt, obj, (1.4, 1.4, 1.4), x=-1400, y=0), 1.0, detail=6, rough=0.62, x=-1200, y=0)
    n2 = _noise(nt, _mapping(nt, obj, (16, 16, 16), x=-1400, y=-200), 1.0, detail=6, rough=0.7, x=-1200, y=-200)
    n3 = _noise(nt, _mapping(nt, obj, (0.55, 0.55, 0.55), (4, 2, 1), x=-1400, y=250), 1.0, detail=3, rough=0.5,
                x=-1200, y=300)
    # edge distance from the slab UV (0 centre .. 1 rim)
    uvn = _node(nt, "ShaderNodeUVMap", -1700, -700)
    sep = _node(nt, "ShaderNodeSeparateXYZ", -1500, -700)
    _link(nt, uvn.outputs["UV"], sep.inputs[0])
    ex = _math(nt, "ABSOLUTE", _math(nt, "SUBTRACT", sep.outputs[0], 0.5, x=-1350, y=-650), x=-1200, y=-650)
    ey = _math(nt, "ABSOLUTE", _math(nt, "SUBTRACT", sep.outputs[1], 0.5, x=-1350, y=-750), x=-1200, y=-750)
    edge = _math(nt, "MULTIPLY", _math(nt, "MAXIMUM", ex, ey, x=-1050, y=-700), 2.0, x=-900, y=-700)
    edge_n = _math(nt, "ADD", edge, _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", n2.outputs["Fac"], 0.5), 0.12),
                   x=-750, y=-700)
    grime = _ramp(nt, edge_n, [(0.72, (1, 1, 1, 1)), (0.98, (0.42, 0.42, 0.38, 1))], x=-600, y=-700)

    col = _ramp(nt, n1.outputs["Fac"], [(0.32, (0.11, 0.108, 0.10, 1)), (0.5, (0.25, 0.24, 0.225, 1)),
                                         (0.68, (0.42, 0.41, 0.385, 1))], x=-900, y=100)
    # scanned rock (CC0) for the stone grain: about 0.9 slab per tile, box-projected so the rims get it too
    smap = _mapping(nt, obj, (0.45, 0.45, 0.45), (0.37, 0.71, 0.0), x=-1400, y=900)
    sdif = _img(nt, "rock_surface/rock_surface_diff_2k.jpg", smap, box=0.25, x=-1200, y=900)
    snor = _img(nt, "rock_surface/rock_surface_nor_gl_2k.jpg", smap, noncolor=True, box=0.25, x=-1200, y=1150)
    srgh = _img(nt, "rock_surface/rock_surface_rough_2k.jpg", smap, noncolor=True, box=0.25, x=-1200, y=1400)
    var = _ramp(nt, oi.outputs["Random"], [(0.0, (0.66, 0.70, 0.76, 1)), (0.5, (1.0, 0.99, 0.96, 1)),
                                           (1.0, (1.22, 1.14, 1.0, 1))], x=-900, y=300)
    warm = _ramp(nt, n3.outputs["Fac"], [(0.45, (1, 1, 1, 1)), (0.66, (1.08, 1.03, 0.95, 1))], x=-900, y=450)
    col_out = col.outputs["Color"]
    if sdif is not None:
        # neutralise the scan's brown and lift it to the flagstone palette, keep its light/dark structure
        bw = _node(nt, "ShaderNodeRGBToBW", -1000, 900)
        _link(nt, sdif.outputs["Color"], bw.inputs[0])
        sc_ = _math(nt, "MULTIPLY", bw.outputs[0], 3.2, x=-850, y=900)
        sc_col = _mix(nt, 0.0, sc_, sdif.outputs["Color"], x=-700, y=900)
        col_out = _mix(nt, 1.0, col_out, sc_col, blend="MULTIPLY", x=-650, y=800)
        col_out = _mix(nt, 1.0, col_out, (1.0, 1.12, 1.38, 1), blend="MULTIPLY", x=-600, y=800)
    c = _mix(nt, 1.0, col_out, var.outputs["Color"], blend="MULTIPLY", x=-650, y=250)
    c = _mix(nt, 1.0, c, warm.outputs["Color"], blend="MULTIPLY", x=-500, y=250)
    # fine speckle / pores
    spk = _ramp(nt, n2.outputs["Fac"], [(0.35, (0.72, 0.72, 0.70, 1)), (0.6, (1, 1, 1, 1)), (0.78, (1.15, 1.14, 1.1, 1))],
                x=-900, y=-150)
    c = _mix(nt, 1.0, c, spk.outputs["Color"], blend="MULTIPLY", x=-350, y=150)
    # lichen / moss stain creeping in from the rim
    lich_n = _noise(nt, _mapping(nt, obj, (5, 5, 5), (7, 3, 1), x=-1400, y=550), 1.0, detail=4, rough=0.6, x=-1200,
                    y=550)
    lich = _math(nt, "MULTIPLY", _ramp(nt, lich_n.outputs["Fac"], [(0.58, (0, 0, 0, 1)), (0.7, (1, 1, 1, 1))],
                                        x=-900, y=600).outputs["Color"],
                 _ramp(nt, edge, [(0.6, (0.15, 0.15, 0.15, 1)), (0.95, (1, 1, 1, 1))], x=-900, y=750).outputs["Color"],
                 x=-650, y=600)
    c = _mix(nt, _math(nt, "MULTIPLY", lich, 0.75, x=-500, y=600), c, (0.07, 0.10, 0.03, 1), x=-250, y=300)
    c = _mix(nt, 1.0, c, grime.outputs["Color"], blend="MULTIPLY", x=-100, y=200)

    # cracks: thin iso-lines of a distorted noise, broken up by a mask, plus a few polygonal (voronoi) ones
    cn = _noise(nt, _mapping(nt, obj, (0.7, 0.7, 0.7), (11, 5, 2), x=-1400, y=-450), 1.0, detail=2, rough=0.45,
                dist=0.1, x=-1200, y=-450)
    cl = _math(nt, "ABSOLUTE", _math(nt, "SUBTRACT", cn.outputs["Fac"], 0.5, x=-1050, y=-450), x=-900, y=-450)
    crack1 = _ramp(nt, cl, [(0.0, (0, 0, 0, 1)), (0.0055, (1, 1, 1, 1))], x=-750, y=-450)
    vor = _node(nt, "ShaderNodeTexVoronoi", -1200, -950, feature="DISTANCE_TO_EDGE")
    _set(vor, "Scale", 0.7)
    vwarp = _noise(nt, _mapping(nt, obj, (3, 3, 3), x=-1550, y=-1000), 1.0, detail=2, x=-1400, y=-1000)
    wsc = _vmath(nt, "SCALE", vwarp.outputs["Color"], None, x=-1300, y=-1050)
    wsc.node.inputs["Scale"].default_value = 0.35
    vv = _vmath(nt, "ADD", _mapping(nt, obj, (0.75, 0.75, 0.75), (3, 1, 2), x=-1550, y=-900), wsc, x=-1300, y=-950)
    _link(nt, vv, vor.inputs["Vector"])
    crack2 = _ramp(nt, vor.outputs["Distance"], [(0.0, (0, 0, 0, 1)), (0.008, (1, 1, 1, 1))], x=-750, y=-950)
    mk = _noise(nt, _mapping(nt, obj, (1.6, 1.6, 1.6), (2, 9, 4), x=-1400, y=-1200), 1.0, detail=2, x=-1200, y=-1200)
    mask = _ramp(nt, mk.outputs["Fac"], [(0.48, (0, 0, 0, 1)), (0.55, (1, 1, 1, 1))], x=-900, y=-1200)
    mask1 = _ramp(nt, mk.outputs["Fac"], [(0.6, (0, 0, 0, 1)), (0.65, (1, 1, 1, 1))], x=-900, y=-1350)
    c1 = _mix(nt, mask1.outputs["Color"], (1, 1, 1, 1), crack1.outputs["Color"], x=-600, y=-600)
    c2 = _mix(nt, mask.outputs["Color"], (1, 1, 1, 1), crack2.outputs["Color"], x=-600, y=-900)
    cr = _math(nt, "MINIMUM", c1, c2, x=-400, y=-800)  # 0 in a crack, 1 elsewhere
    c = _mix(nt, 1.0, c, _mix(nt, cr, (0.18, 0.17, 0.16, 1), (1, 1, 1, 1), x=-250, y=-500), blend="MULTIPLY",
             x=50, y=150)
    # dust settles in hollows, chips and cracks: AO (local only) -> pale grey-brown, matte
    ao = _node(nt, "ShaderNodeAmbientOcclusion", -200, 700, only_local=True, samples=6)
    _set(ao, "Distance", 0.09)
    dust_n = _noise(nt, _mapping(nt, obj, (9, 9, 9), (1, 2, 3), x=-400, y=850), 1.0, detail=3, x=-250, y=850)
    ao_src = ao.outputs["AO"] if os.environ.get("STAGE_AO") else 1.0
    dust = _ramp(nt, ao_src, [(0.45, (1, 1, 1, 1)), (0.92, (0, 0, 0, 1))], x=0, y=700)
    dust = _math(nt, "MULTIPLY", dust.outputs["Color"],
                 _ramp(nt, dust_n.outputs["Fac"], [(0.35, (0.35, 0.35, 0.35, 1)), (0.65, (1, 1, 1, 1))], x=0,
                       y=850).outputs["Color"], x=200, y=750)
    c = _mix(nt, _math(nt, "MULTIPLY", dust, 0.55, x=350, y=750), c, (0.30, 0.27, 0.22, 1), x=450, y=300)
    _link(nt, c, b.inputs["Base Color"])

    h = _math(nt, "ADD", _math(nt, "MULTIPLY", n1.outputs["Fac"], 0.5, x=-500, y=-100),
              _math(nt, "MULTIPLY", n2.outputs["Fac"], 0.3, x=-500, y=-200), x=-300, y=-150)
    h = _math(nt, "ADD", h, _math(nt, "MULTIPLY", cr, 0.22, x=-300, y=-450), x=-120, y=-250)
    bump = _node(nt, "ShaderNodeBump", 500, -250)
    _set(bump, "Strength", 1.0)
    _set(bump, "Distance", 0.04)
    _link(nt, h, bump.inputs["Height"])
    if snor is not None:
        nm = _node(nt, "ShaderNodeNormalMap", 300, -450)
        _set(nm, "Strength", 1.4)
        _link(nt, snor.outputs["Color"], nm.inputs["Color"])
        _link(nt, nm.outputs["Normal"], bump.inputs["Normal"])
    _link(nt, bump.outputs["Normal"], b.inputs["Normal"])
    _principled_defaults(b, 0.8, 0.22)
    # roughness: scan detail + two low-frequency layers (handled / waxy patches) + matte dust
    rgh = _ramp(nt, n2.outputs["Fac"], [(0.3, (0.68, 0.68, 0.68, 1)), (0.7, (0.9, 0.9, 0.9, 1))], x=600, y=200)
    r = rgh.outputs["Color"]
    if srgh is not None:
        r = _math(nt, "ADD", _math(nt, "MULTIPLY", srgh.outputs["Color"], 0.5, x=600, y=400),
                  _math(nt, "MULTIPLY", r, 0.5, x=600, y=300), x=750, y=350)
    lf = _noise(nt, _mapping(nt, obj, (0.35, 0.35, 0.35), (8, 1, 4), x=400, y=550), 1.0, detail=2, x=550, y=550)
    r = _math(nt, "ADD", r, _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", lf.outputs["Fac"], 0.5), 0.3, x=700, y=550),
              x=850, y=400)
    r = _math(nt, "ADD", r, _math(nt, "MULTIPLY", dust, 0.25, x=850, y=600), clamp=True, x=950, y=400)
    _link(nt, r, b.inputs["Roughness"])
    return m


def _moss_mat(name="stage_moss", dark=1.0, tip=1.0, grey=0.0, sheen=0.6, tint=(1, 1, 1)):
    """Cushion moss: varied greens (olive, yellow-green, dark) at two scales, lighter fuzz tips."""
    m, nt, b = _new_mat(name)
    tc = _node(nt, "ShaderNodeTexCoord", -1500, 0)
    obj = tc.outputs["Object"]
    n1 = _noise(nt, _mapping(nt, obj, (30, 30, 30), x=-1300, y=0), 1.0, detail=4, rough=0.65, x=-1100, y=0)
    n2 = _noise(nt, _mapping(nt, obj, (2.2, 2.2, 2.2), x=-1300, y=-200), 1.0, detail=3, rough=0.55, x=-1100, y=-200)
    n3 = _noise(nt, _mapping(nt, obj, (0.7, 0.7, 0.7), (5, 1, 3), x=-1300, y=-400), 1.0, detail=2, x=-1100, y=-400)
    mixv = _math(nt, "ADD", _math(nt, "MULTIPLY", n1.outputs["Fac"], 0.55, x=-900, y=0),
                 _math(nt, "MULTIPLY", n2.outputs["Fac"], 0.6, x=-900, y=-200), x=-700, y=-100)
    d = dark
    col = _ramp(nt, mixv, [(0.38, (0.018 * d, 0.040 * d, 0.010 * d, 1)), (0.55, (0.06 * d, 0.12 * d, 0.020 * d, 1)),
                           (0.70, (0.15 * d, 0.24 * d, 0.035 * d, 1)), (0.86, (0.32 * d, 0.38 * d, 0.07 * d, 1))],
                x=-500, y=0)
    # broad hue drift: some patches olive-brown, some bluer-green
    hue = _ramp(nt, n3.outputs["Fac"], [(0.35, (1.06, 0.96, 0.72, 1)), (0.5, (1, 1, 1, 1)), (0.68, (0.82, 1.0, 0.9, 1))],
                x=-500, y=-300)
    c = _mix(nt, 1.0, col.outputs["Color"], hue.outputs["Color"], blend="MULTIPLY", x=-300, y=-100)
    if tuple(tint) != (1, 1, 1):
        c = _mix(nt, 1.0, c, tuple(tint) + (1,), blend="MULTIPLY", x=-200, y=-150)
    if grey > 0:
        lum = _node(nt, "ShaderNodeRGBToBW", -150, -250)
        _link(nt, c, lum.inputs[0])
        c = _mix(nt, grey, c, _mix(nt, 1.0, lum.outputs[0], (1.3, 1.25, 1.0, 1), blend="MULTIPLY"), x=-50, y=-150)
    hi = _node(nt, "ShaderNodeHairInfo", -500, 300)
    tipf = _math(nt, "MULTIPLY", _math(nt, "POWER", hi.outputs["Intercept"], 1.5, x=-300, y=300), 0.6 * tip,
                 x=-150, y=300)
    c = _mix(nt, tipf, c, _mix(nt, 1.0, c, (2.2, 2.0, 1.2, 1), blend="MULTIPLY", x=-50, y=350), x=100, y=100)
    _link(nt, c, b.inputs["Base Color"])
    bump = _node(nt, "ShaderNodeBump", 500, -250)
    _set(bump, "Strength", 0.9)
    _set(bump, "Distance", 0.02)
    _link(nt, n1.outputs["Fac"], bump.inputs["Height"])
    _link(nt, bump.outputs["Normal"], b.inputs["Normal"])
    _principled_defaults(b, 0.88, 0.12)
    _set(b, "Sheen Weight", sheen)
    _set(b, "Sheen Roughness", 0.35)
    _set(b, "Sheen Tint", (0.75, 0.9, 0.45, 1))
    return m


def _wood_mat():
    """Warm worn oak (CC0 scan, grain along the board's local X) with chunky hand-planed grain,
    darker grime in the corners and lighter worn edges."""
    m, nt, b = _new_mat("stage_wood")
    tc = _node(nt, "ShaderNodeTexCoord", -1500, 0)
    obj = tc.outputs["Object"]
    oi = _node(nt, "ShaderNodeObjectInfo", -1500, 300)
    st = _noise(nt, _mapping(nt, obj, (0.35, 9, 9), x=-1250, y=0), 1.0, detail=8, rough=0.62, dist=0.6, x=-1000, y=0)
    fine = _noise(nt, _mapping(nt, obj, (1.2, 60, 60), x=-1250, y=-250), 1.0, detail=4, rough=0.6, x=-1000, y=-250)
    blot = _noise(nt, _mapping(nt, obj, (1.0, 1.0, 1.0), (3, 7, 1), x=-1250, y=250), 1.0, detail=3, x=-1000, y=250)
    g = _math(nt, "ADD", _math(nt, "MULTIPLY", st.outputs["Fac"], 0.75), _math(nt, "MULTIPLY", fine.outputs["Fac"], 0.35),
              x=-800, y=-100)
    col = _ramp(nt, g, [(0.38, (0.045, 0.024, 0.012, 1)), (0.55, (0.12, 0.068, 0.034, 1)),
                        (0.72, (0.22, 0.135, 0.07, 1))], x=-600, y=0).outputs["Color"]
    wmap = _mapping(nt, obj, (0.28, 0.9, 0.9), (0.3, 0.1, 0.0), x=-1250, y=600)
    wdif = _img(nt, "wood_table_worn/wood_table_worn_diff_2k.jpg", wmap, box=0.2, x=-1000, y=600)
    wnor = _img(nt, "wood_table_worn/wood_table_worn_nor_gl_2k.jpg", wmap, noncolor=True, box=0.2, x=-1000, y=850)
    if wdif is not None:
        sc_ = _mix(nt, 1.0, wdif.outputs["Color"], (0.5, 0.42, 0.36, 1), blend="MULTIPLY", x=-750, y=600)
        col = _mix(nt, 0.7, col, sc_, x=-550, y=400)
    var = _ramp(nt, blot.outputs["Fac"], [(0.35, (0.78, 0.78, 0.8, 1)), (0.65, (1.12, 1.04, 0.95, 1))], x=-600, y=250)
    c = _mix(nt, 1.0, col, var.outputs["Color"], blend="MULTIPLY", x=-350, y=100)
    if os.environ.get("WOOD_TINT"):  # cooler, darker frame (concept)
        c = _mix(nt, 1.0, c, _envf3("WOOD_TINT", (1, 1, 1)) + (1,), blend="MULTIPLY", x=-300, y=150)
    # dark grime in hollows (AO), lighter rubbed edges (bevel-normal vs flat-normal difference)
    ao = _node(nt, "ShaderNodeAmbientOcclusion", -600, -500, only_local=True, samples=4)
    _set(ao, "Distance", 0.25)
    c = _mix(nt, _ramp(nt, ao.outputs["AO"] if os.environ.get("STAGE_AO") else 1.0, [(0.4, (0.75, 0.75, 0.75, 1)), (0.9, (0, 0, 0, 1))], x=-400,
                       y=-500).outputs["Color"], c, (0.02, 0.012, 0.007, 1), x=-150, y=0)
    _link(nt, c, b.inputs["Base Color"])
    bump = _node(nt, "ShaderNodeBump", 300, -250)
    _set(bump, "Strength", 0.5)
    _set(bump, "Distance", 0.02)
    _link(nt, g, bump.inputs["Height"])
    if wnor is not None:
        nm = _node(nt, "ShaderNodeNormalMap", 100, -450)
        _set(nm, "Strength", 1.5)
        _link(nt, wnor.outputs["Color"], nm.inputs["Color"])
        _link(nt, nm.outputs["Normal"], bump.inputs["Normal"])
    _link(nt, bump.outputs["Normal"], b.inputs["Normal"])
    _principled_defaults(b, 0.55, 0.3)
    rr = _ramp(nt, fine.outputs["Fac"], [(0.3, (0.45, 0.45, 0.45, 1)), (0.7, (0.7, 0.7, 0.7, 1))], x=100, y=-150)
    _link(nt, rr.outputs["Color"], b.inputs["Roughness"])
    return m


def _birch_mat():
    """Miniature birch: chalky cream bark, black horizontal lenticel dashes, black bands, dark 'eyes'
    where branches leave the trunk (point attribute birch_dark), darker and rougher toward the foot."""
    m, nt, b = _new_mat("stage_birch")
    tc = _node(nt, "ShaderNodeTexCoord", -1500, 0)
    obj = tc.outputs["Object"]
    sep = _node(nt, "ShaderNodeSeparateXYZ", -1300, 500)
    _link(nt, obj, sep.inputs[0])
    # lenticels: thin horizontal dashes (fast in z, slow around)
    mk = _noise(nt, _mapping(nt, obj, (3.5, 3.5, 34), (0, 0, 0), x=-1300, y=0), 1.0, detail=2, rough=0.55, dist=0.4,
                x=-1100, y=0)
    sm = _noise(nt, _mapping(nt, obj, (2, 2, 3), x=-1300, y=-250), 1.0, detail=3, rough=0.6, x=-1100, y=-250)
    mk_r = _ramp(nt, mk.outputs["Fac"], [(0.60, (1, 1, 1, 1)), (0.645, (0.025, 0.022, 0.02, 1))], x=-800, y=0)
    mk_m = _mix(nt, _ramp(nt, sm.outputs["Fac"], [(0.35, (0.15, 0.15, 0.15, 1)), (0.6, (1, 1, 1, 1))], x=-800,
                          y=-250).outputs["Color"], (1, 1, 1, 1), mk_r.outputs["Color"], x=-550, y=0)
    # bigger black bands / scars, broad and horizontal
    bd = _noise(nt, _mapping(nt, obj, (1.6, 1.6, 7.0), (5, 3, 1), x=-1300, y=-450), 1.0, detail=3, rough=0.6,
                dist=0.8, x=-1100, y=-450)
    bd_r = _ramp(nt, bd.outputs["Fac"], [(0.66, (1, 1, 1, 1)), (0.70, (0.03, 0.028, 0.025, 1))], x=-800, y=-450)
    # base colour: cream white with grey and warm drift
    white = _mix(nt, _math(nt, "MULTIPLY", sm.outputs["Fac"], 0.8, x=-550, y=-250), (0.78, 0.74, 0.64, 1),
                 (0.46, 0.43, 0.37, 1), x=-350, y=-100)
    col = _mix(nt, 1.0, white, mk_m, blend="MULTIPLY", x=-150, y=0)
    col = _mix(nt, 1.0, col, bd_r.outputs["Color"], blend="MULTIPLY", x=0, y=0)
    # branch 'eyes'
    at = _node(nt, "ShaderNodeAttribute", -500, 300, attribute_type="GEOMETRY", attribute_name="birch_dark")
    eye = _ramp(nt, _math(nt, "ADD", at.outputs["Fac"], _math(nt, "MULTIPLY", _math(nt, "SUBTRACT", mk.outputs["Fac"], 0.5),
                                                                  0.5), x=-300, y=300),
                [(0.35, (0, 0, 0, 1)), (0.5, (1, 1, 1, 1))], x=-150, y=300)
    col = _mix(nt, eye.outputs["Color"], col, (0.03, 0.026, 0.022, 1), x=150, y=100)
    # foot: earthy and mossy
    foot = _ramp(nt, _math(nt, "ADD", sep.outputs[2], _math(nt, "MULTIPLY", sm.outputs["Fac"], 0.5), x=-1100, y=500),
                 [(0.15, (1, 1, 1, 1)), (0.85, (0, 0, 0, 1))], x=-800, y=500)
    col = _mix(nt, _math(nt, "MULTIPLY", foot.outputs["Color"], 0.75, x=-500, y=550), col, (0.09, 0.1, 0.04, 1),
               x=300, y=150)
    _link(nt, col, b.inputs["Base Color"])
    # chunky, papery bark relief: horizontal ridges + peel edges
    rid = _node(nt, "ShaderNodeTexWave", -1100, -700, wave_type="BANDS", bands_direction="Z", wave_profile="SIN")
    _set(rid, "Scale", 1.0)
    _set(rid, "Distortion", 6.0)
    _set(rid, "Detail", 2.0)
    _link(nt, _mapping(nt, obj, (2.0, 2.0, 2.6), x=-1300, y=-700), rid.inputs["Vector"])
    h = _math(nt, "ADD", _math(nt, "MULTIPLY", rid.outputs["Fac"], 0.35, x=-800, y=-700),
              _math(nt, "SUBTRACT", 1.0, mk.outputs["Fac"], x=-800, y=-600), x=-600, y=-650)
    h = _math(nt, "ADD", h, _math(nt, "MULTIPLY", sm.outputs["Fac"], 0.8, x=-600, y=-750), x=-400, y=-700)
    bump = _node(nt, "ShaderNodeBump", 300, -250)
    _set(bump, "Strength", 0.75)
    _set(bump, "Distance", 0.03)
    _link(nt, h, bump.inputs["Height"])
    _link(nt, bump.outputs["Normal"], b.inputs["Normal"])
    _principled_defaults(b, 0.72, 0.18)
    _set(b, "Subsurface Weight", 0.08)
    _set(b, "Subsurface Radius", (1.0, 0.7, 0.5))
    _set(b, "Subsurface Scale", 0.03)
    return m


def _soil_mat():
    m, nt, b = _new_mat("stage_soil")
    _set(b, "Base Color", (0.03, 0.025, 0.018, 1))
    _principled_defaults(b, 0.95, 0.05)
    return m


def _strand_mat():
    """Spanish moss: grey-olive strands, sage tips; translucent so the fairy lights glow through the hanks
    (Translucent BSDF, not subsurface: SSS on curves hangs Metal)."""
    m, nt, b = _new_mat("stage_strand")
    tc = _node(nt, "ShaderNodeTexCoord", -900, 0)
    n1 = _noise(nt, _mapping(nt, tc.outputs["Object"], (3, 3, 0.8), x=-700, y=0), 1.0, detail=3, x=-500, y=0)
    n2 = _noise(nt, _mapping(nt, tc.outputs["Object"], (14, 14, 3), x=-700, y=-200), 1.0, detail=2, x=-500, y=-200)
    v = _math(nt, "ADD", _math(nt, "MULTIPLY", n1.outputs["Fac"], 0.7), _math(nt, "MULTIPLY", n2.outputs["Fac"], 0.4),
              x=-350, y=-100)
    col = _ramp(nt, v, [(0.40, (0.07, 0.075, 0.03, 1)), (0.55, (0.24, 0.24, 0.10, 1)),
                        (0.72, (0.46, 0.43, 0.20, 1))], x=-250, y=0)
    st_ = tuple(float(x) for x in os.environ.get("STRAND_TINT", "1,1,1").split(","))
    if st_ != (1.0, 1.0, 1.0):
        col = type("C", (), {"outputs": {"Color": _mix(nt, 1.0, col.outputs["Color"], st_ + (1,), blend="MULTIPLY", x=-100, y=0)}})()
    _link(nt, col.outputs["Color"], b.inputs["Base Color"])
    _principled_defaults(b, 0.8, 0.15)
    _set(b, "Sheen Weight", 0.6)
    _set(b, "Sheen Roughness", 0.4)
    _set(b, "Sheen Tint", (1.0, 0.85, 0.5, 1))
    tr = _node(nt, "ShaderNodeBsdfTranslucent", 1100, -300)
    _link(nt, _mix(nt, 1.0, col.outputs["Color"], (1.3, 1.2, 0.7, 1), blend="MULTIPLY", x=900, y=-300), tr.inputs["Color"])
    ms = _node(nt, "ShaderNodeMixShader", 1250, 0)
    ms.inputs[0].default_value = float(os.environ.get("STRAND_TR", 0.3))
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    _link(nt, b.outputs["BSDF"], ms.inputs[1])
    _link(nt, tr.outputs[0], ms.inputs[2])
    _link(nt, ms.outputs[0], out.inputs["Surface"])
    return m


def _emit_mat(name, color=(1.0, 0.62, 0.25), strength=25.0, kelvin=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = _node(nt, "ShaderNodeOutputMaterial", 400, 0)
    e = _node(nt, "ShaderNodeEmission", 100, 0)
    _set(e, "Color", color + (1.0,))
    if kelvin:
        bb = _node(nt, "ShaderNodeBlackbody", -150, 0)
        _set(bb, "Temperature", kelvin)
        # hot core: blackbody pulled toward white so the clipped centre reads yellow-white, not orange
        _link(nt, _mix(nt, 0.4, bb.outputs[0], (1.0, 0.9, 0.7, 1), x=-50, y=0), e.inputs["Color"])
    _set(e, "Strength", strength)
    _link(nt, e.outputs[0], out.inputs["Surface"])
    return m


def _camera_only(o):
    o.visible_diffuse = False
    o.visible_glossy = False
    o.visible_transmission = False
    o.visible_volume_scatter = False
    o.visible_shadow = False


def _halo_mat():
    """Additive glow: transparent + emission that falls off from the sphere's centre (facing)."""
    m = bpy.data.materials.new("stage_halo")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = _node(nt, "ShaderNodeOutputMaterial", 600, 0)
    lw = _node(nt, "ShaderNodeLayerWeight", -400, 0)
    _set(lw, "Blend", 0.5)
    f = _math(nt, "POWER", _math(nt, "SUBTRACT", 1.0, lw.outputs["Facing"], x=-200, y=0), 9.0, x=-50, y=0)
    e = _node(nt, "ShaderNodeEmission", 150, -100)
    _set(e, "Color", (1.0, 0.55, 0.2, 1))
    _link(nt, _math(nt, "MULTIPLY", f, 3.0, x=50, y=-150), e.inputs["Strength"])
    tr = _node(nt, "ShaderNodeBsdfTransparent", 150, 100)
    add = _node(nt, "ShaderNodeAddShader", 400, 0)
    _link(nt, tr.outputs[0], add.inputs[0])
    _link(nt, e.outputs[0], add.inputs[1])
    _link(nt, add.outputs[0], out.inputs["Surface"])
    return m


def _haze_mat():
    """Faint warm-green haze card: strongest low down, broken up by soft noise."""
    m = bpy.data.materials.new("stage_haze")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = _node(nt, "ShaderNodeOutputMaterial", 700, 0)
    tc = _node(nt, "ShaderNodeTexCoord", -900, 0)
    at = _node(nt, "ShaderNodeAttribute", -900, -300, attribute_type="OBJECT", attribute_name="haze_amt")
    sep = _node(nt, "ShaderNodeSeparateXYZ", -700, 0)
    _link(nt, tc.outputs["Generated"], sep.inputs[0])
    g = _math(nt, "POWER", _math(nt, "SUBTRACT", 1.0, sep.outputs[2], x=-550, y=0), 1.8, x=-400, y=0)
    edge_x = _math(nt, "MINIMUM", _math(nt, "MULTIPLY", sep.outputs[0], 4.0), _math(nt, "MULTIPLY",
                   _math(nt, "SUBTRACT", 1.0, sep.outputs[0]), 4.0), clamp=True, x=-550, y=150)
    g = _math(nt, "MULTIPLY", g, edge_x, x=-300, y=50)
    n1 = _noise(nt, _mapping(nt, tc.outputs["Generated"], (3, 3, 1.5)), 1.0, detail=2, x=-550, y=-200)
    nm = _ramp(nt, n1.outputs["Fac"], [(0.3, (0.35, 0.35, 0.35, 1)), (0.7, (1, 1, 1, 1))], x=-400, y=-200)
    s = _math(nt, "MULTIPLY", _math(nt, "MULTIPLY", g, nm.outputs["Color"], x=-200, y=-100), at.outputs["Fac"],
              x=-50, y=-100)
    e = _node(nt, "ShaderNodeEmission", 200, -100)
    _set(e, "Color", (0.55, 0.6, 0.4, 1))
    _link(nt, _math(nt, "MULTIPLY", s, 0.1, x=50, y=-150), e.inputs["Strength"])
    tr = _node(nt, "ShaderNodeBsdfTransparent", 200, 100)
    add = _node(nt, "ShaderNodeAddShader", 450, 0)
    _link(nt, tr.outputs[0], add.inputs[0])
    _link(nt, e.outputs[0], add.inputs[1])
    _link(nt, add.outputs[0], out.inputs["Surface"])
    return m


def _mesh_obj(name, bm, mat, coll, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    if mat is not None:
        o.data.materials.append(mat)
    return o


def _add_box(bm, cx, cy, cz, sx, sy, sz):
    r = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=r["verts"])
    bmesh.ops.translate(bm, vec=(cx, cy, cz), verts=r["verts"])
    return r["verts"]


def _plane_grid(name, x0, x1, y0, y1, nx, ny, mat, coll, plane="XY", at=0.0):
    """Subdivided quad plane. plane XY (z=at), XZ (y=at) or YZ (x=at)."""
    bm = bmesh.new()
    verts = []
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            u = x0 + (x1 - x0) * i / nx
            v = y0 + (y1 - y0) * j / ny
            if plane == "XY":
                co = (u, v, at)
            elif plane == "XZ":
                co = (u, at, v)
            else:
                co = (at, u, v)
            row.append(bm.verts.new(co))
        verts.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    return _mesh_obj(name, bm, mat, coll, smooth=True)


_TILE_CACHE = {}


def _sculpted_tile(path):
    """Import a sculpted tile model once (glb from Meshy). Returns (mesh, material) normalised so the
    footprint is 1 x 1 centred on the origin, the top surface's mean height is z=0 and the
    thickness is 1 (scale per slab)."""
    if path in _TILE_CACHE:
        return _TILE_CACHE[path]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    bm = bmesh.new()
    for o in meshes:
        tmp = o.data.copy()
        tmp.transform(o.matrix_world)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    mat = meshes[0].data.materials[0] if meshes[0].data.materials else None
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
    # make the thinnest axis z (glb is Y-up but the importer already converts; guard anyway)
    ext = [max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)]
    thin = ext.index(min(ext))
    if thin != 2:
        rot = Matrix.Rotation(math.radians(90), 4, "X" if thin == 1 else "Y")
        bmesh.ops.transform(bm, matrix=rot, verts=list(bm.verts))
        xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    sx, sy, sz = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
    zmin = min(zs)
    # top = mean z of upward-facing verts in the middle of the footprint
    tops = [v.co.z for v in bm.verts if abs(v.co.x - cx) < sx * 0.3 and abs(v.co.y - cy) < sy * 0.3
            and v.co.z > zmin + sz * 0.5]
    ztop = sum(tops) / max(1, len(tops))
    for v in bm.verts:
        v.co.x = (v.co.x - cx) / sx
        v.co.y = (v.co.y - cy) / sy
        v.co.z = (v.co.z - ztop) / (ztop - zmin)
    me = bpy.data.meshes.new("SculptedTile")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    if mat:
        # darken and cool the baked paint toward the concept's slate grey (TILE_VAL, TILE_SAT)
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf and bsdf.inputs["Base Color"].links:
            src = bsdf.inputs["Base Color"].links[0].from_socket
            hsv = nt.nodes.new("ShaderNodeHueSaturation")
            hsv.inputs["Saturation"].default_value = float(os.environ.get("TILE_SAT", "0.8"))
            tv = float(os.environ.get("TILE_VAL", "0.6"))
            hsv.inputs["Value"].default_value = tv
            tvar = float(os.environ.get("TILE_VAR", "0"))
            if tvar:  # per-slab brightness and hue drift so the grid is not uniform
                oi = nt.nodes.new("ShaderNodeObjectInfo")
                mv = nt.nodes.new("ShaderNodeMapRange")
                mv.inputs["To Min"].default_value = tv * (1 - tvar)
                mv.inputs["To Max"].default_value = tv * (1 + tvar)
                nt.links.new(oi.outputs["Random"], mv.inputs["Value"])
                nt.links.new(mv.outputs["Result"], hsv.inputs["Value"])
                mh = nt.nodes.new("ShaderNodeMapRange")
                mh.inputs["To Min"].default_value = 0.5 - 0.03 * tvar / 0.2
                mh.inputs["To Max"].default_value = 0.5 + 0.03 * tvar / 0.2
                nt.links.new(oi.outputs["Random"], mh.inputs["Value"])
                nt.links.new(mh.outputs["Result"], hsv.inputs["Hue"])
            nt.links.new(src, hsv.inputs["Color"])
            out_ = hsv.outputs["Color"]
            if os.environ.get("TILE_TINT"):  # multiply toward the concept's olive slate
                mt = nt.nodes.new("ShaderNodeMixRGB")
                mt.blend_type = "MULTIPLY"
                mt.inputs["Fac"].default_value = 1.0
                mt.inputs["Color2"].default_value = _envf3("TILE_TINT", (1, 1, 1)) + (1,)
                nt.links.new(out_, mt.inputs["Color1"])
                out_ = mt.outputs["Color"]
            nt.links.new(out_, bsdf.inputs["Base Color"])
        if bsdf and os.environ.get("TILE_SHEEN"):  # damp satin slate: noisy roughness ~0.5, a thin clear coat
            r0 = float(os.environ.get("TILE_ROUGH", 0.5)); rv = float(os.environ.get("TILE_RVAR", 0.08))
            tc_ = nt.nodes.new("ShaderNodeTexCoord")
            nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = float(os.environ.get("TILE_RSCALE", 3.0))
            nz.inputs["Detail"].default_value = 4.0
            nt.links.new(tc_.outputs["Object"], nz.inputs["Vector"])
            mr_ = nt.nodes.new("ShaderNodeMapRange")
            mr_.inputs["From Min"].default_value = 0.3; mr_.inputs["From Max"].default_value = 0.7
            mr_.inputs["To Min"].default_value = r0 - rv; mr_.inputs["To Max"].default_value = r0 + rv
            nt.links.new(nz.outputs["Fac"], mr_.inputs["Value"])
            nt.links.new(mr_.outputs["Result"], bsdf.inputs["Roughness"])
            bsdf.inputs["Metallic"].default_value = 0.0
            for l_ in list(bsdf.inputs["Metallic"].links):
                nt.links.remove(l_)
            bsdf.inputs["Coat Weight"].default_value = float(os.environ.get("TILE_COAT", 0.1))
            bsdf.inputs["Coat Roughness"].default_value = float(os.environ.get("TILE_COATR", 0.35))
        me.materials.append(mat)
    _TILE_CACHE[path] = (me, mat)
    return me, mat


_GLB_CACHE = {}


def _import_glb_mesh(path, mode, tint=None, val=1.0):
    """Import a Meshy glb once and join it into one mesh. mode 'upright': centred on x/y, base at z=0,
    height 1 (tallest axis z). mode 'panel': thin axis y (face toward -y), width x = 1, height z = 1,
    centred on x, base z=0, back face at y=0. tint multiplies the baked colour; val scales brightness."""
    key = (path, mode)
    if key in _GLB_CACHE:
        return _GLB_CACHE[key]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    bm = bmesh.new()
    for o in meshes:
        tmp = o.data.copy()
        tmp.transform(o.matrix_world)
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    mat = meshes[0].data.materials[0] if meshes[0].data.materials else None
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    def ext():
        xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
        return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))
    (x0, x1), (y0, y1), (z0, z1) = ext()
    e = [x1 - x0, y1 - y0, z1 - z0]
    if mode == "upright" and e.index(max(e)) != 2:  # ('hang' keeps the model as imported: wide curtains stay wide)
        bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.radians(90), 4, "X" if e.index(max(e)) == 1 else "Y"), verts=list(bm.verts))
    if mode == "panel" and e.index(min(e)) != 1:
        bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.radians(90), 4, "X" if e.index(min(e)) == 2 else "Z"), verts=list(bm.verts))
    (x0, x1), (y0, y1), (z0, z1) = ext()
    for v in bm.verts:
        if mode in ("upright", "hang"):
            sc = 1.0 / (z1 - z0)
            v.co.x = (v.co.x - (x0 + x1) / 2) * sc
            v.co.y = (v.co.y - (y0 + y1) / 2) * sc
            v.co.z = (v.co.z - z0) * sc
            tz = (v.co.z - 0.78) / 0.22 * (z1 - z0) * sc
            if mode == "upright" and tz > 0 and path not in os.environ.get("NOTAPER", ""):  # taper the top into a point so no sawn log end shows from above
                f = max(0.08, 1.0 - tz) ** 0.7
                v.co.x *= f
                v.co.y *= f
        else:
            v.co.x = (v.co.x - (x0 + x1) / 2) / (x1 - x0)
            v.co.y = (v.co.y - y1) / (x1 - x0)
            v.co.z = (v.co.z - z0) / (z1 - z0)
    me = bpy.data.meshes.new("GLB_" + mode)
    bm.to_mesh(me)
    bm.free()
    for p_ in me.polygons:
        p_.use_smooth = True
    if mat:
        mat = mat.copy()
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf and bsdf.inputs["Base Color"].links:
            src = bsdf.inputs["Base Color"].links[0].from_socket
            hsv = nt.nodes.new("ShaderNodeHueSaturation")
            hsv.inputs["Value"].default_value = val
            gj = float(os.environ.get("GLB_JIT", 0))
            if gj:  # per-object brightness/hue drift: no two placed props identical
                oi = nt.nodes.new("ShaderNodeObjectInfo")
                mv = nt.nodes.new("ShaderNodeMapRange")
                mv.inputs["To Min"].default_value = val * (1 - gj)
                mv.inputs["To Max"].default_value = val * (1 + gj)
                nt.links.new(oi.outputs["Random"], mv.inputs["Value"])
                nt.links.new(mv.outputs["Result"], hsv.inputs["Value"])
                mh = nt.nodes.new("ShaderNodeMapRange")
                mh.inputs["To Min"].default_value = 0.5 - 0.15 * gj
                mh.inputs["To Max"].default_value = 0.5 + 0.15 * gj
                nt.links.new(oi.outputs["Random"], mh.inputs["Value"])
                nt.links.new(mh.outputs["Result"], hsv.inputs["Hue"])
                ms = nt.nodes.new("ShaderNodeMapRange")
                ms.inputs["To Min"].default_value = 1 - 0.5 * gj
                ms.inputs["To Max"].default_value = 1 + 0.5 * gj
                nt.links.new(oi.outputs["Location"], ms.inputs["Value"])  # decorrelate from value
                nt.links.new(ms.outputs["Result"], hsv.inputs["Saturation"])
            nt.links.new(src, hsv.inputs["Color"])
            out = hsv.outputs["Color"]
            if tint:
                mx = nt.nodes.new("ShaderNodeMixRGB")
                mx.blend_type = "MULTIPLY"
                mx.inputs[0].default_value = 1.0
                mx.inputs[2].default_value = tuple(tint) + (1.0,)
                nt.links.new(out, mx.inputs[1])
                out = mx.outputs[0]
            nt.links.new(out, bsdf.inputs["Base Color"])
        me.materials.append(mat)
    _GLB_CACHE[key] = me
    return me


def _bark_detail(mat):
    """BARK_DETAIL: procedural birch surface on top of the baked texture, in object space (mesh height 1).
    Shallow horizontal ridges + peeling curls (bump), dark horizontal lenticel dashes, sparse black knot
    scars at irregular heights, grey-green lichen patches low on the trunk."""
    m = mat.copy()
    nt = m.node_tree
    N = nt.nodes.new; L = nt.links.new
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return m
    f = lambda k, d: float(os.environ.get(k, d))
    tc = N("ShaderNodeTexCoord")
    def mapped(sx, sz):
        mp = N("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (sx, sx, sz)
        L(tc.outputs["Object"], mp.inputs["Vector"]); return mp.outputs["Vector"]
    # ridges: wave bands along z with distortion
    wv = N("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Z"
    wv.inputs["Scale"].default_value = f("BARK_RIDGE", 9.0); wv.inputs["Distortion"].default_value = 6.0
    wv.inputs["Detail"].default_value = 3.0
    L(mapped(1.0, 1.0), wv.inputs["Vector"])
    # peel: stretched noise, thresholded into curled flakes
    pn = N("ShaderNodeTexNoise"); pn.inputs["Scale"].default_value = 1.0; pn.inputs["Detail"].default_value = 6.0
    L(mapped(f("BARK_PEEL_X", 14), f("BARK_PEEL_Z", 70)), pn.inputs["Vector"])
    pr_ = N("ShaderNodeValToRGB"); pr_.color_ramp.elements[0].position = 0.55; pr_.color_ramp.elements[1].position = 0.62
    L(pn.outputs["Fac"], pr_.inputs["Fac"])
    hsum = N("ShaderNodeMath"); hsum.operation = "MULTIPLY_ADD"; hsum.inputs[1].default_value = 0.4
    L(wv.outputs["Fac"], hsum.inputs[0]); L(pr_.outputs["Color"], hsum.inputs[2])
    bump = N("ShaderNodeBump"); bump.inputs["Strength"].default_value = f("BARK_BUMP", 0.5)
    bump.inputs["Distance"].default_value = f("BARK_BUMPD", 0.004)
    L(hsum.outputs["Value"], bump.inputs["Height"])
    if bsdf.inputs["Normal"].links:
        L(bsdf.inputs["Normal"].links[0].from_socket, bump.inputs["Normal"])
    L(bump.outputs["Normal"], bsdf.inputs["Normal"])
    # colour layers
    bc = bsdf.inputs["Base Color"]
    col = bc.links[0].from_socket if bc.links else None
    def mix(c_in, fac, rgb):
        mx = N("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MIX"
        L(fac, mx.inputs["Factor"])
        if c_in is not None: L(c_in, mx.inputs[6])
        else: mx.inputs[6].default_value = bc.default_value
        mx.inputs[7].default_value = rgb + (1.0,)
        return mx.outputs[2]
    ln = N("ShaderNodeTexNoise"); ln.inputs["Scale"].default_value = 1.0; ln.inputs["Detail"].default_value = 2.0
    L(mapped(f("BARK_LEN_X", 9), f("BARK_LEN_Z", 110)), ln.inputs["Vector"])
    lr = N("ShaderNodeValToRGB"); lr.color_ramp.elements[0].position = 0.64; lr.color_ramp.elements[1].position = 0.70
    L(ln.outputs["Fac"], lr.inputs["Fac"])
    col = mix(col, lr.outputs["Color"], (0.05, 0.045, 0.04))
    kv = N("ShaderNodeTexVoronoi"); kv.inputs["Scale"].default_value = 1.0
    L(mapped(f("BARK_KNOT_X", 3), f("BARK_KNOT_Z", 7)), kv.inputs["Vector"])
    kr = N("ShaderNodeValToRGB"); kr.color_ramp.elements[0].position = 0.06; kr.color_ramp.elements[1].position = 0.10
    kr.color_ramp.elements[0].color = (1, 1, 1, 1); kr.color_ramp.elements[1].color = (0, 0, 0, 1)
    L(kv.outputs["Distance"], kr.inputs["Fac"])
    col = mix(col, kr.outputs["Color"], (0.015, 0.013, 0.012))
    # lichen: low on the trunk, patchy
    sep = N("ShaderNodeSeparateXYZ"); L(tc.outputs["Object"], sep.inputs["Vector"])
    lo = N("ShaderNodeMapRange"); lo.inputs["From Min"].default_value = f("BARK_LICHEN_H", 0.3); lo.inputs["From Max"].default_value = 0.0
    L(sep.outputs["Z"], lo.inputs["Value"])
    cn = N("ShaderNodeTexNoise"); cn.inputs["Scale"].default_value = 1.0; cn.inputs["Detail"].default_value = 8.0
    L(mapped(18, 18), cn.inputs["Vector"])
    cr = N("ShaderNodeValToRGB"); cr.color_ramp.elements[0].position = 0.5; cr.color_ramp.elements[1].position = 0.6
    L(cn.outputs["Fac"], cr.inputs["Fac"])
    lf = N("ShaderNodeMath"); lf.operation = "MULTIPLY"; L(lo.outputs["Result"], lf.inputs[0]); L(cr.outputs["Color"], lf.inputs[1])
    lf2 = N("ShaderNodeMath"); lf2.operation = "MULTIPLY"; lf2.inputs[1].default_value = f("BARK_LICHEN", 0.7); L(lf.outputs["Value"], lf2.inputs[0])
    col = mix(col, lf2.outputs["Value"], _envf3("BARK_LICHEN_C", (0.36, 0.40, 0.32)))
    L(col, bc)
    return m


def _envf3(k, d):
    v = os.environ.get(k)
    return tuple(float(x) for x in v.split(",")) if v else d


def _make_slab_obj(name, sx, sy, th, rng, mat, coll, cx=0.0, cy=0.0, rot=0.0, S=None, tilt=(0.0, 0.0), dz=0.0):
    """Bevel-ready flagstone, modelled in place (origin at the board origin) so Object texture
    coords differ per slab. UV = footprint 0..1 (used for rim grime). Irregular outline, uneven
    top, chipped rim."""
    S = S or max(sx, sy)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, th), verts=list(bm.verts))
    bmesh.ops.translate(bm, vec=(0, 0, -th / 2), verts=list(bm.verts))
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=17, use_grid_fill=True)
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for lp in f.loops:
            lp[uvl].uv = (lp.vert.co.x / sx + 0.5, lp.vert.co.y / sy + 0.5)
    sd = rng.uniform(0, 1000)
    for v in bm.verts:
        p = v.co.copy()
        ex, ey = abs(p.x) / (sx / 2), abs(p.y) / (sy / 2)
        edge = max(ex, ey)
        top = p.z > -th * 0.15
        # gently irregular outline (low frequency so neighbours stay parallel-ish)
        v.co.x += noise.noise(Vector((p.x * 1.2 / sx, p.y * 1.2 / sy, sd))) * 0.028 * sx
        v.co.y += noise.noise(Vector((p.x * 1.2 / sx, p.y * 1.2 / sy, sd + 17))) * 0.028 * sy
        if top:
            v.co.z += noise.noise(Vector((p.x * 2.0 / sx, p.y * 2.0 / sy, sd + 33))) * 0.10 * th
            v.co.z += noise.noise(Vector((p.x * 7.0 / sx, p.y * 7.0 / sy, sd + 3))) * 0.025 * th
            v.co.z -= 0.16 * th * (edge ** 3)  # pillowy, hand-pressed top
        # chips bitten out of the rim: affect the top ring and the upper side verts
        if edge > 0.995:
            c = noise.noise(Vector((p.x * 7.5 / sx, p.y * 7.5 / sy, sd + 51)))
            c2 = noise.noise(Vector((p.x * 23 / sx, p.y * 23 / sy, sd + 9)))
            chip = max(0.0, c * 1.6 + c2 * 0.45 - 0.05)
            w = max(0.0, min(1.0, (p.z + th * 0.7) / (th * 0.7)))
            pull = chip * 0.035 * S * w
            if ex >= ey:
                v.co.x -= math.copysign(pull, p.x)
            if ey >= ex:
                v.co.y -= math.copysign(pull, p.y)
            if top:
                v.co.z -= min(chip, 1.0) * 0.7 * th
        elif top and edge > 0.9:
            c = noise.noise(Vector((p.x * 7.5 / sx, p.y * 7.5 / sy, sd + 51)))
            v.co.z -= min(1.0, max(0.0, c * 1.6 - 0.05)) * 0.3 * th
    ca, sa = math.cos(rot), math.sin(rot)
    for v in bm.verts:
        x, y = v.co.x, v.co.y
        v.co.z += dz + tilt[0] * x + tilt[1] * y  # each slab sits a little proud or sunk, slightly tipped
        v.co.x, v.co.y = cx + x * ca - y * sa, cy + x * sa + y * ca
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.data.materials.append(mat)
    return o, me


def _clump_template(rings=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=rings, radius=1.0)
    verts = [v.co.copy() for v in bm.verts]
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return verts, faces


def _build_moss(name, points, mat, coll, rng, axis="z", sign=1.0, squash=(0.45, 0.8)):
    """points: list of (x,y,z,r). Lumpy squashed blobs merged in one mesh.
    axis: direction the clumps bulge toward (z for ground, y/x for walls), sign +-1."""
    tv, tf = _clump_template(1)
    verts, faces = [], []
    for (x, y, z, r) in points:
        base = len(verts)
        sq = rng.uniform(*squash)
        ang = rng.uniform(0, 6.283)
        ca, sa = math.cos(ang), math.sin(ang)
        el = rng.uniform(0.8, 1.4)
        for p in tv:
            j = 1.0 + rng.uniform(-0.28, 0.28)
            px, py, pz = p.x * r * el * j, p.y * r / el * j, p.z * r * sq * j
            qx, qy, qz = px * ca - py * sa, px * sa + py * ca, max(pz, -r * 0.2) * sign
            if axis == "z":
                verts.append((x + qx, y + qy, z + qz))
            elif axis == "y":
                verts.append((x + qx, y + qz, z + qy))
            else:
                verts.append((x + qz, y + qx, z + qy))
        for f in tf:
            faces.append([base + i for i in (f if sign > 0 else reversed(f))])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.data.materials.append(mat)
    return o


def _add_fuzz(obj, count, length, mat_index=0, seed=1, radius=0.0008, rand=0.0, tip=0.25, steps=2):
    import os
    if os.environ.get("STAGE_NOFUZZ") and os.environ["STAGE_NOFUZZ"] in obj.name:
        return None
    """Hair-particle fuzz over a mesh (moss fuzz). rand tilts hairs randomly (fuzzier pile)."""
    ps = obj.modifiers.new("fuzz", "PARTICLE_SYSTEM")
    s = ps.particle_system.settings
    s.type = "HAIR"
    s.count = int(count)
    s.hair_length = length
    s.child_type = "NONE"
    s.use_advanced_hair = False
    s.render_step = steps
    s.display_step = 1
    s.root_radius = 1.0
    s.tip_radius = tip
    s.radius_scale = radius
    s.use_emit_random = True
    s.use_even_distribution = True
    ps.particle_system.seed = seed
    return ps


def _make_tube(name, pts, radii, segs, mat, coll, rng, rough=0.0):
    """tube along a list of centre points; radii per ring."""
    bm = bmesh.new()
    rings = []
    for (p, r) in zip(pts, radii):
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            rr = r * (1 + rough * (noise.noise(Vector((p.x * 7, p.y * 7 + math.cos(a) * 1.2, p.z * 9 + math.sin(a) * 1.2))))
                      )
            ring.append(bm.verts.new((p.x + math.cos(a) * rr, p.y + math.sin(a) * rr, p.z)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(segs):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return _mesh_obj(name, bm, mat, coll)


def _make_branch(name, base, direction, length, r0, mat, coll, rng):
    bm = bmesh.new()
    n, segs = 8, 8
    d = Vector(direction).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(up).normalized()
    v = d.cross(u).normalized()
    rings = []
    bend = Vector((rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), 0.15))
    for i in range(n + 1):
        t = i / n
        c = Vector(base) + d * length * t + bend * length * t * t
        r = r0 * (1 - 0.85 * t)
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            ring.append(bm.verts.new(c + u * math.cos(a) * r + v * math.sin(a) * r))
        rings.append(ring)
    for i in range(n):
        for k in range(segs):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    return _mesh_obj(name, bm, mat, coll)


def _limb(name, pts, radii, segs, mat, coll, lump=0.0, seed=0.0):
    """Tube along an arbitrary 3D polyline with rings perpendicular to the path (parallel-transport frames).
    lump: low-frequency radius wobble (hand-rolled clay)."""
    bm = bmesh.new()
    rings = []
    n = len(pts)
    tan0 = (pts[1] - pts[0]).normalized()
    ref = Vector((0, 0, 1)) if abs(tan0.z) < 0.9 else Vector((1, 0, 0))
    u = tan0.cross(ref).normalized()
    prev_t = tan0
    for i, (p, r) in enumerate(zip(pts, radii)):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        # parallel transport of u
        axis = prev_t.cross(t)
        if axis.length > 1e-6:
            ang = prev_t.angle(t)
            u = Matrix.Rotation(ang, 3, axis.normalized()) @ u
        u = (u - t * u.dot(t)).normalized()
        v = t.cross(u).normalized()
        prev_t = t
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            w = 1.0
            if lump:
                w += lump * noise.noise(Vector((i * 0.18 + seed, math.cos(a) * 0.9, math.sin(a) * 0.9)))
            ring.append(bm.verts.new(p + (u * math.cos(a) + v * math.sin(a)) * r * w))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(segs):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return _mesh_obj(name, bm, mat, coll)


def _bent_path(base, direction, length, n, rng, up=0.0, wiggle=0.0, seed=0.0):
    """Polyline from base along direction, curving upward by `up` (fraction of length) with a gentle wobble."""
    d = Vector(direction).normalized()
    side = d.cross(Vector((0, 0, 1)))
    side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
    pts = []
    for i in range(n):
        t = i / (n - 1)
        p = Vector(base) + d * length * t
        p.z += up * length * t * t
        w = wiggle * length * noise.noise(Vector((t * 2.2, seed, 0.3)))
        p += side * w
        pts.append(p)
    return pts


def _strands(name, anchors, rng, H, mat, coll, length=(0.3, 1.2), radius=0.006, tall=None, per=(3, 7)):
    """Spanish-moss: clusters of kinky, tapering strands drooping from anchor points (x,y,z,outx,outy)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 1
    cu.bevel_depth = radius * H
    cu.bevel_resolution = 0
    for (x, y, z, dx, dy) in anchors:
        Lc = (length[0] + (length[1] - length[0]) * rng.random() ** 1.7) * H
        # shared spine: the hank sways as one, strands hug it (beard-like tufts)
        ns = 24
        spine = []
        vx, vy, sx_, sy_ = 0.0, 0.0, 0.0, 0.0
        out = rng.uniform(0.02, 0.15)
        for i in range(ns):
            vx = vx * 0.85 + rng.gauss(0, 0.05)
            vy = vy * 0.85 + rng.gauss(0, 0.05)
            sx_ += (vx + dx * out) * Lc / (ns - 1)
            sy_ += (vy + dy * out) * Lc / (ns - 1)
            spine.append((sx_, sy_))
        spread = rng.uniform(0.02, 0.05) * H
        for _k in range(rng.randint(*per)):
            L = Lc * rng.uniform(0.3, 1.0)
            n = max(6, int(10 + 14 * L / H))
            step = L / (n - 1)
            ox, oy = rng.gauss(0, spread), rng.gauss(0, spread)
            conv = rng.uniform(0.2, 1.1)  # <1: strands gather toward the tip
            jx = jy = wx = wy = 0.0
            pz = z + rng.uniform(0, 0.05) * H
            kink = rng.uniform(0.008, 0.02) * H
            sp = cu.splines.new("POLY")
            sp.points.add(n - 1)
            r0 = rng.uniform(0.7, 1.3)
            for i in range(n):
                t = i / (n - 1)
                si = spine[min(ns - 1, int(t * L / Lc * (ns - 1)))]
                f = 1.0 + (conv - 1.0) * t
                s = 1 if i % 2 else -1
                kx, ky = s * kink * rng.uniform(0.3, 1.0), -s * kink * rng.uniform(0.3, 1.0)
                wx = wx * 0.8 + rng.gauss(0, 0.12) * step
                wy = wy * 0.8 + rng.gauss(0, 0.12) * step
                jx += wx
                jy += wy
                sp.points[i].co = (x + si[0] + ox * f + jx + kx * (abs(dy) + 0.4),
                                   y + si[1] + oy * f + jy + ky * (abs(dx) + 0.4), pz - step * i, 1.0)
                sp.points[i].radius = r0 * (1.0 - 0.7 * t)
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    o.data.materials.append(mat)
    return o


def _board(name, length, depth, z0, z1, mat, coll, loc, rotz=0.0, bevel=0.02):
    """Wood board, long along local X (grain), placed at loc (x, y) and rotated about Z."""
    bm = bmesh.new()
    _add_box(bm, 0, 0, (z0 + z1) / 2, length, depth, z1 - z0)
    o = _mesh_obj(name, bm, mat, coll, smooth=False)
    o.location = (loc[0], loc[1], 0)
    o.rotation_euler[2] = rotz
    bv = o.modifiers.new("bevel", "BEVEL")
    bv.width = bevel
    bv.segments = 2
    return o


def build_camera(scene, H, center=(0.0, 0.0), zoom=1.0, elevation=60.0, focal=85.0, fstop=None, dof=0.0011,
                 aspect=1.0, look_ahead=0.6):
    """Square-on camera (looks +Y, `elevation` deg down) with shallow DOF focused on the figure.
    Replaces scene.camera. zoom 1.0 frames ~2.7 squares wide."""
    S = 1.2 * H
    cx, cy = center
    coll = bpy.data.collections.get("Stage") or scene.collection
    old = bpy.data.objects.get("StageCam")
    if old is not None:
        bpy.data.objects.remove(old)
    cam_data = bpy.data.cameras.new("StageCam")
    cam_data.lens = focal
    cam_data.sensor_width = 36
    cam_data.sensor_fit = "HORIZONTAL" if aspect >= 1 else "VERTICAL"
    vis_w = 2.7 * S / zoom
    dist = focal * vis_w / 36.0
    el = math.radians(elevation)
    target = Vector((cx, cy + look_ahead * S / zoom, 0.42 * H))
    cam = bpy.data.objects.new("StageCam", cam_data)
    coll.objects.link(cam)
    fwd = Vector((0, math.cos(el), -math.sin(el)))
    cam.location = target - fwd * dist
    cam.rotation_euler = (math.radians(90 - elevation), 0, 0)
    scene.camera = cam
    # focus on the figure's chest
    fig = Vector((cx, cy, 0.7 * H))
    focus = (fig - cam.location).dot(fwd)
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = focus
    if fstop is None:
        # blur (as a fraction of frame width) for something 0.85*H off the focus plane = `dof`;
        # tiny so the figure stays crisp, but the far wall (3-4 H behind) goes ~4x softer. Zoom-independent.
        A = dof * dist * vis_w / (0.85 * H)  # aperture diameter in scene units (1 unit = 1 m)
        fstop = (focal / 1000.0) / A
    cam_data.dof.aperture_fstop = fstop
    return cam



def build_camera_low(scene, H, center=(0.0, 0.0), zoom=0.42, elevation=36.0, focal=85.0, fstop_real=2.8,
                     real_height=0.05, look_ahead=0.35):
    """Alternative lower view (35-45 deg down) with real-scale miniature depth of field: the scene is
    H units tall per figurine, a real clay king is ~5 cm, so a real f/N lens is f/(N * real/H) here."""
    fstop = fstop_real * real_height / H
    return build_camera(scene, H, center=center, zoom=zoom, elevation=elevation, focal=focal, fstop=fstop,
                        look_ahead=look_ahead)


def build_stage(scene, H, center=(0.0, 0.0), board=5, zoom=1.0, elevation=60.0, focal=85.0, seed=7,
                fstop=None, dof=0.0011, aspect=1.0, look_ahead=0.6, quality=1.0):
    """Build the mossy shadow-box diorama around a figurine of height H.

    The figure stands on the centre square (centre = its world XY). Square size = 1.2*H.
    The camera is square-on (looks +Y), `elevation` degrees down, long lens, shallow DOF
    focused on the figure. zoom>1 tightens, zoom<1 widens (1.0 frames ~3.2 squares wide).
    board: n (an n x n board) or (nx, ny): nx squares across (x, left-right on screen), ny deep (y, into the
    screen). A rectangle is built as the square of its short side stretched at the same density: whatever is
    counted per wall (trees, hanging moss, hedge mounds, bulbs, ...) scales with that wall's length, and the
    front lights repeat along the long axis (_light_segments). Squares build exactly as before.
    Returns a dict of created objects."""
    rng = random.Random(seed)
    cx, cy = center
    S = 1.2 * H
    if isinstance(board, (tuple, list)):
        nx, ny = int(board[0]), int(board[1])
    else:
        nx = ny = int(board)
    n = min(nx, ny)  # the short side: the square this board is stretched from
    half = n * S / 2
    hx, hy = nx * S / 2, ny * S / 2  # board half extents
    strip = 0.28 * S  # mossy ground strip between slabs and walls
    W = half + strip  # inner half-extent of the short-side square (reference for per-wall counts)
    Wx, Wy = hx + strip, hy + strip  # inner half-extents of the box: side walls at x = +-Wx, back wall at y = Wy
    fx_, fy_ = Wx / W, Wy / W  # wall length over the short-side square's: back wall fx_, side walls fy_

    def cnt(c, f):  # a per-wall count stretched with its wall (exactly c on the square)
        return c if f == 1.0 else int(round(c * f))

    def back_trunk(t, thr):  # is this trunk on the back wall (not a side wall)?
        if nx == ny:
            return t[1] > thr * W
        return (Wy - t[1]) < (Wx - abs(t[0]))
    Hw = float(os.environ.get("WALL_H", 3.0)) * H  # wall height
    gap = 0.058 * S
    th = 0.12 * H

    coll = bpy.data.collections.get("Stage")
    if coll is None:
        coll = bpy.data.collections.new("Stage")
        scene.collection.children.link(coll)

    # parent empty so the whole set can be moved: everything is built in local coords then offset
    root = bpy.data.objects.new("StageRoot", None)
    coll.objects.link(root)
    root.location = (cx, cy, 0)

    objs = {"root": root}

    def adopt(o, key=None):
        o.parent = root
        if key:
            objs[key] = o
        return o

    stone, moss, wood, birch, soil, strand = _stone_mat(), _moss_mat(dark=0.5, tint=(1.0, 0.92, 0.7)), _wood_mat(), _birch_mat(), _soil_mat(), _strand_mat()
    moss_wall = _moss_mat("stage_moss_wall", dark=0.2, tip=0.8, sheen=0.25, tint=(0.6, 1.1, 0.7))
    moss_deep = _moss_mat("stage_moss_deep", dark=0.09, tip=0.5, sheen=0.15, tint=(0.55, 1.1, 0.7))

    # ---- ground (soil) under the slabs ----
    g = _plane_grid("Ground", -Wx - 0.02 * H, Wx + 0.02 * H, -Wy - 0.02 * H, Wy + 0.02 * H, 2, 2, soil, coll, "XY",
                    at=-th * 0.85)
    adopt(g, "ground")

    # ---- slabs ----
    slabs = []
    tile_glb = os.environ.get("TILE_GLB")
    for i in range(nx):
        for j in range(ny):
            x = (i - (nx - 1) / 2) * S
            y = (j - (ny - 1) / 2) * S
            sx = S - gap + rng.uniform(-0.018, 0.008) * S
            sy = S - gap + rng.uniform(-0.018, 0.008) * S
            if tile_glb:
                tme, tmat = _sculpted_tile(rng.choice(tile_glb.split(",")))
                if os.environ.get("TILE_MAT") == "stage":
                    tmat = stone
                o = bpy.data.objects.new("Slab_%d_%d" % (i, j), tme)
                coll.objects.link(o)
                if tmat is not None and os.environ.get("TILE_MAT") == "stage":
                    o.material_slots[0].link = "OBJECT"
                    o.material_slots[0].material = tmat
                q = rng.randrange(4)  # quarter turns + mirroring so neighbours never look copied
                flip = rng.choice((1, -1))
                jt = float(os.environ.get("TILE_JIT", "1.0"))
                o.rotation_euler = (rng.uniform(-0.03, 0.03) * jt, rng.uniform(-0.03, 0.03) * jt,
                                    q * math.pi / 2 + rng.uniform(-0.014, 0.014))
                fill = float(os.environ.get("TILE_FILL", "1.04"))  # bbox includes bulges; top face is smaller
                o.scale = (fill * flip * (sx if q % 2 == 0 else sy), fill * (sy if q % 2 == 0 else sx),
                           th * float(os.environ.get("TILE_TH", "1.0")))
                o.location = (x + rng.uniform(-0.008, 0.008) * S, y + rng.uniform(-0.008, 0.008) * S,
                              rng.uniform(-0.022, 0.014) * H * jt)
                o.parent = root
                slabs.append(o)
                continue
            o, me = _make_slab_obj("Slab_%d_%d" % (i, j), sx, sy, th, rng, stone, coll,
                                   cx=x + rng.uniform(-0.008, 0.008) * S, cy=y + rng.uniform(-0.008, 0.008) * S,
                                   rot=rng.uniform(-0.014, 0.014), S=S,
                                   tilt=(rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03)),
                                   dz=rng.uniform(-0.022, 0.014) * H)
            o.location = (0, 0, 0)
            bev = o.modifiers.new("bevel", "BEVEL")
            bev.width = 0.045 * S
            bev.segments = 4
            bev.limit_method = "ANGLE"
            bev.angle_limit = math.radians(55)
            bev.harden_normals = False
            o.parent = root
            slabs.append(o)
    objs["slabs"] = slabs

    # ---- moss: fine cushion moss, thin in the joints, mounding up toward the walls ----
    pts = []
    d_clump = 0.011 * H
    ztop = -0.035 * H  # joints sit a little below the slab tops
    # axis 0: the nx+1 seams at constant x, running along y; axis 1: the ny+1 seams at constant y, along x
    # (one loop over both, in the square's order: seam k, step q, axis)
    seam_n, seam_L = (nx, ny), (2 * hy, 2 * hx)
    seam_m = tuple(int(L_ / d_clump) for L_ in seam_L)
    for k in range(max(nx, ny) + 1):
        for q in range(max(seam_m)):
            for axis in (0, 1):
                if k > seam_n[axis] or q >= seam_m[axis]:
                    continue
                line = (k - seam_n[axis] / 2) * S
                L, m = seam_L[axis], seam_m[axis]
                t = -L / 2 + (q + rng.random()) * L / m
                # patchy: bare gritty soil shows between runs of moss
                GE = os.environ.get("GROUT_EVEN")
                if GE:  # even cushion moss along every seam: no bare stretches, uniform width, slightly raised
                    gw = float(os.environ.get("GROUT_R", 0.021)) * H
                    gz = float(os.environ.get("GROUT_Z", 0.006)) * H
                    for _rep in range(int(float(GE))):
                        tt = t + rng.uniform(-0.5, 0.5) * L / m
                        GWV = os.environ.get("GROUT_WV")
                        if GWV:  # width wanders +-GWV along each seam, plus rare tiny tufts
                            wv = noise.noise(Vector((line * 3.0 / S + 0.7 * axis, tt * 1.6 / S, 8.3)))
                            r = gw * rng.uniform(0.92, 1.08) * (1 + float(GWV) * max(-1.0, min(1.0, 1.8 * wv)))
                        else:
                            r = gw * rng.uniform(0.85, 1.15) * (1 + 0.12 * noise.noise(Vector((line * 3.0 / S, tt * 3.0 / S, 5.7))))
                        off = rng.gauss(0, gap * 0.08)
                        z = ztop + gz + rng.uniform(-0.004, 0.004) * H
                        if GWV and rng.random() < float(os.environ.get("GROUT_TUFT", 0.01)):
                            r *= 1.5
                            z += 0.006 * H
                        pts.append((line + off, tt, z, r) if axis == 0 else (tt, line + off, z, r))
                    continue
                if noise.noise(Vector((line * 1.7 / S + 0.3 * axis, t * 2.2 / S, 3.1))) < 0.02:
                    continue
                JM = float(os.environ.get("JOINT_MOSS", "1.0"))
                r = rng.uniform(0.014, 0.028) * H * (1 + 0.6 * (JM - 1) * rng.random())
                off = rng.gauss(0, gap * 0.14)
                # occasional cushions that bulge up out of the joint
                z = ztop + rng.uniform(-0.012, 0.004) * H
                if rng.random() < 0.05 * JM ** 2:
                    r *= 1.5 + 0.3 * (JM - 1)
                    z += 0.02 * H * JM
                pts.append((line + off, t, z, r) if axis == 0 else (t, line + off, z, r))
    # joint crossings get small puffs
    for i in range(nx + 1):
        for j in range(ny + 1):
            JM = float(os.environ.get("JOINT_MOSS", "1.0"))
            if os.environ.get("GROUT_EVEN"):  # small soft bulge at each crossing
                pk = float(os.environ.get("GROUT_R", 0.034)) / 0.034
                for _ in range(4):
                    pts.append(((i - nx / 2) * S + rng.gauss(0, gap * 0.2), (j - ny / 2) * S + rng.gauss(0, gap * 0.2),
                                ztop + float(os.environ.get("GROUT_Z", 0.006)) * H + rng.uniform(0.0, 0.008) * H, rng.uniform(0.022, 0.03) * H * pk))
                if rng.random() < float(os.environ.get("GROUT_SPILL", 0)):  # moss creeping onto one tile corner
                    dx, dy = rng.choice((-1, 1)), rng.choice((-1, 1))
                    for _ in range(rng.randint(3, 6)):
                        u_ = rng.uniform(0.02, 0.07) * S
                        pts.append(((i - nx / 2) * S + dx * (u_ + rng.uniform(0, 0.03) * S),
                                    (j - ny / 2) * S + dy * (u_ * rng.uniform(0.3, 1.0)),
                                    ztop + float(os.environ.get("GROUT_Z", 0.006)) * H - 0.004 * H, rng.uniform(0.012, 0.02) * H))
                continue
            for _ in range(int(5 * JM)):
                pts.append(((i - nx / 2) * S + rng.gauss(0, gap * 0.3 * JM), (j - ny / 2) * S + rng.gauss(0, gap * 0.3 * JM),
                            ztop + rng.uniform(0.0, 0.03 * JM) * H, rng.uniform(0.02, 0.04) * H * JM))
    # moss creeping over slab rims (tiny, sparse)
    for _ in range(int(45 * n) if nx == ny else int(round(45 * nx * ny / n))):  # same count per square
        i, j = rng.randrange(nx), rng.randrange(ny)
        x = (i - (nx - 1) / 2) * S
        y = (j - (ny - 1) / 2) * S
        side = rng.randrange(4)
        a = rng.uniform(-0.48, 0.48) * S
        e = S / 2 - gap / 2 - rng.uniform(0, 0.03) * S
        p = [(x + a, y + e), (x + a, y - e), (x + e, y + a), (x - e, y + a)][side]
        pts.append((p[0], p[1], rng.uniform(-0.03, -0.012) * H, rng.uniform(0.008, 0.016) * H))
    gend = len(pts)  # everything above is joint/grout moss
    # perimeter strip: deep mounded moss, rising toward the walls
    area = (2 * W) ** 2 - (2 * half) ** 2 if nx == ny else (2 * Wx) * (2 * Wy) - (2 * hx) * (2 * hy)
    d_per = 0.03 * H
    for _ in range(int(area / (d_per * d_per) * 0.9)):
        x, y = rng.uniform(-Wx, Wx), rng.uniform(-Wy, Wy)
        if abs(x) < hx - gap and abs(y) < hy - gap:
            continue
        dist = max(abs(x) - hx, abs(y) - hy) / strip  # 0 at the board edge .. 1 at the wall
        dist = max(0.0, dist)
        if y < -hy and rng.random() < 0.3:  # front edge: lower, sparser
            continue
        hgt = (0.02 + 0.22 * dist ** 1.6) * H * (0.5 if y < -hy else 1.0)
        r = rng.uniform(0.02, 0.04) * H * (1 + 1.4 * dist)
        pts.append((x, y, -th * 0.4 + hgt, r))
    if os.environ.get("GROUT_SPLIT"):  # grout moss as its own object with a darker, desaturated olive
        gpts, pts = pts[:gend], pts[gend:]
        gm = moss.copy()
        gnt = gm.node_tree
        gb = next((n_ for n_ in gnt.nodes if n_.type == "BSDF_PRINCIPLED"), None)
        if gb is not None:
            mul = gnt.nodes.new("ShaderNodeMix")
            mul.data_type = "RGBA"
            mul.blend_type = "MULTIPLY"
            mul.inputs["Factor"].default_value = 1.0
            mul.inputs[7].default_value = tuple(_envf3("GROUT_C", (0.6, 0.6, 0.5))) + (1.0,)
            hs_ = gnt.nodes.new("ShaderNodeHueSaturation")
            hs_.inputs["Saturation"].default_value = float(os.environ.get("GROUT_SAT", 0.7))
            bc = gb.inputs["Base Color"]
            if bc.links:
                gnt.links.new(bc.links[0].from_socket, mul.inputs[6])
            else:
                mul.inputs[6].default_value = bc.default_value
            gnt.links.new(mul.outputs[2], hs_.inputs["Color"])
            gnt.links.new(hs_.outputs["Color"], bc)
        go = _build_moss("GroutMoss", gpts, gm, coll, rng)
        adopt(go)
        _add_fuzz(go, 160000 * quality, 0.010 * H, 0, seed + 7, radius=0.0035 * H, rand=0.6, tip=0.3)
        objs["grout"] = go
    mo = _build_moss("Moss", pts, moss, coll, rng)
    adopt(mo, "moss")
    _add_fuzz(mo, 420000 * quality, 0.016 * H, 0, seed, radius=0.0042 * H, rand=0.6, tip=0.3)

    # ---- back + side walls: deep, dark foliage and moss ----
    def wall(nm, x0, x1, plane, at, f=1.0):
        w = _plane_grid(nm, x0, x1, -th, Hw, cnt(60, f), 40, moss_deep, coll, plane, at)
        ds = w.modifiers.new("disp", "DISPLACE")
        tex = bpy.data.textures.new(nm + "_tex", "CLOUDS")
        tex.noise_scale = 0.12 * H
        tex.noise_depth = 3
        ds.texture = tex
        ds.strength = 0.09 * H
        ds.mid_level = 0.5
        return w

    wb = wall("WallBack", -Wx, Wx, "XZ", Wy, fx_)
    wl = wall("WallLeft", -Wy, Wy, "YZ", -Wx, fy_)
    wr = wall("WallRight", -Wy, Wy, "YZ", Wx, fy_)
    wr.data.flip_normals()  # (back and left walls already face the room)
    for w_ in (wb, wl, wr):
        adopt(w_)
    objs["walls"] = [wb, wl, wr]

    # layered relief: big dark foliage masses behind, mid cushions in front, mounds at the foot
    walls_spec = (("Back", "y", -1.0, lambda u, v, d: (u, Wy - d, v)),
                  ("Left", "x", 1.0, lambda u, v, d: (-Wx + d, u, v)),
                  ("Right", "x", -1.0, lambda u, v, d: (Wx - d, u, v)))
    wm_glb = os.environ.get("WALLMOSS_GLB")
    if wm_glb:
        pme = _import_glb_mesh(wm_glb, "panel", tint=_envf3("WALLMOSS_TINT", (1.0, 1.0, 1.0)),
                               val=float(os.environ.get("WALLMOSS_VAL", "0.8")))
        pw = float(os.environ.get("WALLMOSS_SIZE", "1.5")) * H
        dep = float(os.environ.get("WALLMOSS_DEPTH", "1.0"))
        rows = int(math.ceil((Hw + th) / (pw * 0.85)))
        DVAR = float(os.environ.get("WALLMOSS_DVAR", 0))
        HCUT = float(os.environ.get("HEDGE_FRONT_CUT", 0))
        HREC = float(os.environ.get("HEDGE_FRONT_RECESS", 0))
        HDARK = float(os.environ.get("HEDGE_FRONT_DARK", 0))
        _dmats = {}
        if os.environ.get("HEDGE_WALL_DARK"):  # the bare wall behind the cut reads as deep shadow
            dm_ = _simple_mat("WallDeep", _envf3("WALLDEEP_C", (0.012, 0.016, 0.009)), (0.03, 0.04, 0.02), 0.9, 6.0, 0.0)
            for w_ in (wl, wr):
                w_.data.materials.clear()
                w_.data.materials.append(dm_)
        _drng = random.Random(4242)
        pw0, rows0 = pw, rows
        HL = os.environ.get("HEDGE_LAYERS")
        for k, (nm, axis, sign, mk) in enumerate(walls_spec):
            pw, rows = pw0, rows0
            U = Wx if nm == "Back" else Wy  # this wall's half length
            if nm == "Back" and os.environ.get("HEDGE_BACK_SIZE"):
                pw = pw0 * float(os.environ["HEDGE_BACK_SIZE"])
                rows = int(math.ceil((Hw + th) / (pw * 0.85)))
            for j in range(rows):
                off = (j % 2) * 0.4 * pw
                u = -U + (0.45 if nm == "Back" else float(os.environ.get("WALLMOSS_FRONT", 0.45))) * pw + off
                i = 0
                while u < U - 0.4 * pw:
                    o = bpy.data.objects.new("WallPanel%s_%d_%d" % (nm, j, i), pme)
                    zc = -th - 0.1 * H + j * pw * 0.85 + rng.uniform(-0.05, 0.05) * pw
                    d = 0.02 * H + rng.uniform(0, 0.04) * H
                    ps = pw * rng.uniform(1.0, 1.15)
                    dvk = 1.0
                    if nm != "Back" and HCUT and u < -U + HCUT * 2 * W:
                        u += pw * 0.82
                        i += 1
                        continue  # no big flat panels in the side foreground: dark wall depth shows
                    if nm != "Back" and HREC:  # shallower (recessed, shadowed) toward the front edge
                        dvk *= 1.0 - HREC * max(0.0, min(1.0, (0.2 * W - (u if U == W else u + U - W)) / (1.2 * W)))
                    if DVAR:  # hedge depth jitter on its own rng so the rest of the scene is unchanged
                        dvk *= 1.0 + DVAR * (2 * _drng.random() - 1)
                        d += DVAR * _drng.uniform(0.0, 0.12) * H
                    if zc + ps > Hw + 0.05 * H:  # keep the top row under the rim
                        zc = Hw + 0.05 * H - ps
                    hl_lv = None
                    if nm == "Back" and HL:  # 3 depth layers from a smooth field: near clumps forward + lighter, deep pockets back + near black
                        nf = noise.noise(Vector((u * float(os.environ.get("HL_FREQ", 0.9)) / H, (zc + 0.5 * ps) * float(os.environ.get("HL_FREQ", 0.9)) / H, 11.0)))
                        hl_lv = 0 if nf < -0.12 else (2 if nf > 0.15 else 1)
                        d = 0.01 * H + hl_lv * float(os.environ.get("HL_D", 0.22)) * H + _drng.uniform(0, 0.03) * H
                        dvk *= _envf3("HL_DV", (0.55, 0.9, 1.25))[hl_lv]
                    flip = rng.choice((-1, 1))
                    if nm == "Back":
                        o.location = (u, Wy - d, zc)
                        o.rotation_euler = (0, 0, 0)
                    elif nm == "Left":
                        o.location = (-Wx + d, u, zc)
                        o.rotation_euler = (0, 0, math.pi / 2)
                    else:
                        o.location = (Wx - d, u, zc)
                        o.rotation_euler = (0, 0, -math.pi / 2)
                    o.rotation_euler[2 if nm == "Back" else 2] += rng.uniform(-0.03, 0.03)
                    o.scale = (ps * flip, ps * 0.6 * dep * dvk, ps)
                    if nm != "Back" and HDARK:  # darker toward the front edge: dark depth, not a lit green slab
                        t_ = max(0.0, min(1.0, (0.3 * W - (u if U == W else u + U - W)) / (1.0 * W)))
                        lv = min(4, int(t_ * 5))
                        if lv:
                            if lv not in _dmats:
                                _dmats[lv] = _dark_copy(pme.materials[0], 1.0 - HDARK * lv / 4.0)
                            o.material_slots[0].link = "OBJECT"
                            o.material_slots[0].material = _dmats[lv]
                    if hl_lv is not None:
                        fv = _envf3("HL_VAL", (0.12, 0.6, 1.1))[hl_lv]
                        if ("hl", hl_lv) not in _dmats:
                            _dmats[("hl", hl_lv)] = _dark_copy(pme.materials[0], fv)
                        o.material_slots[0].link = "OBJECT"
                        o.material_slots[0].material = _dmats[("hl", hl_lv)]
                    coll.objects.link(o)
                    adopt(o)
                    u += pw * 0.82
                    i += 1
        walls_spec = ()
    for k, (nm, axis, sign, mk) in enumerate(walls_spec):
        big, mid = [], []
        U, f_ = (Wx, fx_) if nm == "Back" else (Wy, fy_)
        for _ in range(int(1100 * quality * f_)):
            u = rng.uniform(-U, U)
            v = rng.uniform(-0.1 * H, Hw)
            big.append(mk(u, v, -0.02 * H) + (rng.uniform(0.05, 0.12) * H,))
        for _ in range(int(2600 * quality * f_)):
            u = rng.uniform(-U, U)
            v = Hw * (rng.random() ** 1.6)  # denser toward the foot
            foot = max(0.0, 1.0 - v / (0.9 * H))
            if foot < 0.3 and noise.noise(Vector((u * 0.9 / H, v * 0.9 / H, 3.0 + k))) < -0.18:
                continue  # dark hollows in the foliage
            mid.append(mk(u, v, (0.03 + 0.12 * foot) * H) + (rng.uniform(0.025, 0.06) * H * (1 + foot),))
        bo = _build_moss("WallFoliage" + nm, big, moss_deep, coll, rng, axis=axis, sign=sign, squash=(0.7, 1.0))
        mo_ = _build_moss("WallMoss" + nm, mid, moss_wall, coll, rng, axis=axis, sign=sign, squash=(0.7, 1.0))
        for o_ in (bo, mo_):
            ds = o_.modifiers.new("lumps", "DISPLACE")
            tex = bpy.data.textures.new(o_.name + "_tex", "CLOUDS")
            tex.noise_scale = 0.018 * H
            tex.noise_depth = 2
            ds.texture = tex
            ds.strength = 0.05 * H
            adopt(o_)
        _add_fuzz(mo_, 110000 * quality, 0.028 * H, 0, 11 + k, radius=0.004 * H, tip=0.3)
        _add_fuzz(bo, 90000 * quality, 0.04 * H, 0, 21 + k, radius=0.0045 * H, tip=0.3)

    if os.environ.get("WALLPROPS"):
        objs["wallprops"] = _wall_props(W, half, H, S, th, coll, adopt, moss, seed=seed, Wxy=(Wx, Wy))

    # ---- wood shadow-box frame: front lip, side and back boards, inward top rim ----
    f_t = 0.24 * S  # board thickness
    f_d = float(os.environ.get("FRAME_RIM_D", 0.16)) * S  # top rim depth (deeper: hides the birch tops, as in the concept)
    zb = -th - 0.04 * H
    top_z = Hw + 0.22 * H
    lip_top = 0.5 * H
    fo = 0.12 * H  # boards sit behind the displaced wall sheets
    Lx_out, Ly_out = 2 * (Wx + fo + f_t), 2 * (Wy + fo + f_t)  # outer length of the front/back and the side boards
    boards = [
        _board("FrameLip", Lx_out, f_t + fo, zb, lip_top, wood, coll, (0, -(Wy + (f_t + fo) / 2)), 0.0, 0.03 * H),
        _board("FrameBack", Lx_out, f_t, zb, top_z, wood, coll, (0, Wy + fo + f_t / 2), 0.0, 0.03 * H),
        _board("FrameLeft", Ly_out, f_t, zb, top_z, wood, coll, (-(Wx + fo + f_t / 2), 0), math.pi / 2, 0.03 * H),
        _board("FrameRight", Ly_out, f_t, zb, top_z, wood, coll, (Wx + fo + f_t / 2, 0), math.pi / 2, 0.03 * H),
        _board("FrameRimBack", 2 * (Wx + fo), f_d + fo, Hw, top_z, wood, coll, (0, Wy + (fo - f_d) / 2), 0.0, 0.02 * H),
        _board("FrameRimLeft", 2 * Wy - f_d, f_d + fo, Hw, top_z, wood, coll, (-(Wx + (fo - f_d) / 2), -f_d / 2), math.pi / 2,
               0.02 * H),
        _board("FrameRimRight", 2 * Wy - f_d, f_d + fo, Hw, top_z, wood, coll, (Wx + (fo - f_d) / 2, -f_d / 2), math.pi / 2,
               0.02 * H),
        _board("FrameBase", Lx_out + 0.6 * S, Ly_out + 0.6 * S, zb - 0.2 * H, zb, wood, coll, (0, 0), 0.0, 0.02 * H),
    ]
    pw_ = float(os.environ.get("FRAME_POSTS", 0.0)) * S
    if pw_:  # front corner posts: the frame border runs up the sides of the opening (concept)
        for sg in (-1, 1):
            ln = fo + f_t + pw_
            boards.append(_board("FramePost%d" % sg, ln, f_t + fo, zb, top_z, wood, coll,
                                 (sg * (Wx + fo + f_t - ln / 2), -(Wy + (f_t + fo) / 2)), 0.0, 0.03 * H))
    fcoll = bpy.data.collections.new("StageFrameRecv")
    for bd in boards:
        adopt(bd)
        fcoll.objects.link(bd)
    # dim warm key that lights ONLY the frame (light linking), so the dark wood reads around the opening
    fk = bpy.data.lights.new("framekey", "AREA")
    fk.shape = "RECTANGLE"
    fk.size = 4 * S
    fk.size_y = 2 * S
    fk.energy = float(os.environ.get("FRAMEKEY_E", 110.0)) * H * H
    fk.color = _envf3("FRAMEKEY_C", (1.0, 0.88, 0.76))
    fko = bpy.data.objects.new("framekey", fk)
    coll.objects.link(fko)
    fko.location = (-0.8 * S, -W - 2.5 * S, Hw + 3.0 * H)
    fko.rotation_euler = (math.radians(40), 0, math.radians(-12))
    fko.light_linking.receiver_collection = fcoll
    adopt(fko)
    objs["frame"] = boards[0]
    objs["frame_boards"] = boards

    # ---- birch trees: bent, tapering trunks with branches and twigs, dark 'eyes' at the joints ----
    trunks = []
    nbk = int(os.environ.get("TREES_BACK", 4))
    back_x = [-0.8, -0.3, 0.32, 0.78] if nbk == 4 else [-0.86 + 1.72 * i / (nbk - 1) for i in range(nbk)]
    for k, bx in enumerate(_stretch_line([fx * W for fx in back_x], W, Wx)):
        x = bx + rng.uniform(-0.05, 0.05) * S
        y = Wy - (rng.uniform(0.2, 0.55) + float(os.environ.get("BIRCH_IN", 0))) * strip
        trunks.append((x, y, 0.14 * H * rng.uniform(0.85, 1.2)))
    for sgn in (-1, 1):
        nsd = int(os.environ.get("TREES_SIDE", 2))
        for by in _stretch_line([fy * W for fy in ((0.1, 0.55) if nsd == 2 else [-0.75 + 1.4 * i / max(1, nsd - 1) for i in range(nsd)])], W, Wy):
            x = sgn * (Wx - (rng.uniform(0.2, 0.5) + float(os.environ.get("BIRCH_IN", 0))) * strip)
            y = by + rng.uniform(-0.1, 0.1) * S
            trunks.append((x, y, 0.13 * H * rng.uniform(0.85, 1.15)))
    tvar = [0] * len(trunks)
    tyaw = None
    if os.environ.get("TREEPLAN"):
        trunks, tvar, tyaw = _tree_plan(W, strip, S, H, Wxy=(Wx, Wy))
    z0 = -th * 0.8
    Lz = Hw - 0.06 * H - z0  # tops stay inside the box, tucked into the hanging moss
    birch_glb = os.environ.get("BIRCH_GLB")
    if birch_glb:
        glbs = [birch_glb] + [g for g in os.environ.get("BIRCH_GLBS", "").split(",") if g]
        bmes = [_import_glb_mesh(g, "upright", tint=_envf3("BIRCH_TINT", (0.93, 0.86, 0.74)),
                                 val=float(os.environ.get("BIRCH_VAL", "0.75"))) for g in glbs]
        if os.environ.get("BIRCH_VSAT"):  # pull the orange cast out of the new variants' baked bark colour
            for me_ in bmes[1:]:
                for m_ in me_.materials:
                    for n_ in m_.node_tree.nodes:
                        if n_.type == "HUE_SAT":
                            n_.inputs["Saturation"].default_value = float(os.environ["BIRCH_VSAT"])
                    if os.environ.get("BIRCH_VTINT"):
                        dc = _dark_copy(m_, 1.0)
                        mul = [n_ for n_ in dc.node_tree.nodes if n_.type == "MIX"][-1]
                        mul.inputs[7].default_value = tuple(_envf3("BIRCH_VTINT", (1, 1, 1))) + (1.0,)
                        me_.materials[0] = dc
        if os.environ.get("BARK_DETAIL"):
            for me_ in bmes:
                for i_, m_ in enumerate(me_.materials):
                    me_.materials[i_] = _bark_detail(m_)
        bw = float(os.environ.get("BIRCH_W", "1.4"))
        wks = [1.0] * len(bmes)
        if len(bmes) > 1:  # same lower-trunk thickness for every variant; trim flat base discs
            import bmesh
            def _lw(me_):
                cs = [v.co for v in me_.vertices if 0.12 < v.co.z < 0.3]
                return ((max(c.x for c in cs) - min(c.x for c in cs)) + (max(c.y for c in cs) - min(c.y for c in cs))) / 2
            for me_ in bmes[1:]:
                low = [v.co for v in me_.vertices if v.co.z < 0.03]
                if low and (max(c.x for c in low) - min(c.x for c in low)) > 1.5 * _lw(me_):
                    bm = bmesh.new(); bm.from_mesh(me_)
                    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < 0.05], context="VERTS")
                    for v in bm.verts:
                        v.co.z -= 0.05
                    bm.to_mesh(me_); bm.free()
                    print("CHECK birch base disc trimmed", me_.name)
            ref = _lw(bmes[0])
            wks = [ref / _lw(me_) for me_ in bmes]
            print("CHECK birch width factors", ["%.2f" % w for w in wks])
        for k, (x, y, r) in enumerate(trunks):
            bme = bmes[tvar[k] % len(bmes)]
            bwk = bw * wks[tvar[k] % len(bmes)]
            o = bpy.data.objects.new("BirchGLB_%d" % k, bme)
            hz = Lz * rng.uniform(1.0, 1.12) * float(os.environ.get("BIRCH_H", 1.0))
            if tyaw is not None:
                hz = Lz * float(os.environ.get("BIRCH_H", 1.0)) * tyaw[k][1]
                if os.environ.get("TREE_TO_RIM"):  # trunk runs up into the frame's top rim; its top is never seen
                    hz = (Hw + float(os.environ.get("TREE_TO_RIM")) * H - z0) / (max(v.co.z for v in bme.vertices) or 1.0)
            o.location = (x, y, z0)
            o.scale = (hz * bwk * rng.choice((-1, 1)), hz * bwk, hz)
            if os.environ.get("TREEDBG"):
                print("CHECK treedbg", k, tvar[k], bme.name, "%.2f %.2f" % (x / S, y / S), "hz=%.2f" % (hz / H), "zr=%.2f..%.2f" % (min(v.co.z for v in bme.vertices), max(v.co.z for v in bme.vertices)))
            bl_ = float(os.environ.get("BIRCH_LEAN", 0.04))
            o.rotation_euler = (rng.uniform(-bl_, bl_), rng.uniform(-bl_, bl_), rng.uniform(0, 6.283))
            if tyaw is not None:  # plan-owned: mirror, lean and yaw don't drift when other scene parts change
                _tr = random.Random(1000 + k)
                o.scale = (hz * bwk * _tr.choice((-1, 1)), hz * bwk, hz)
                o.rotation_euler = (_tr.uniform(-bl_, bl_), _tr.uniform(-bl_, bl_), tyaw[k][0])
                # keep-out: the trunk above knee height must stay clear of the hedge face
                keep = float(os.environ.get("TREE_KEEP", 0.12)) * S
                cos_ = [v.co.copy() for v in bme.vertices if v.co.z > 0.15][::7]
                on_back = abs(y) > abs(x) if nx == ny else (Wy - y) < (Wx - abs(x))
                def _over(yw):
                    e_ = o.rotation_euler.copy()
                    e_[2] = yw
                    M = Matrix.LocRotScale(Vector(o.location), e_.to_quaternion(), Vector(o.scale))
                    pts = [M @ c for c in cos_]
                    if on_back:
                        return max(p_.y for p_ in pts) - (Wy - keep)
                    sg_ = 1 if x > 0 else -1
                    return max(sg_ * p_.x for p_ in pts) - (Wx - keep)
                # turn the tree so branches/curves run along the wall, keeping its planned yaw when it fits
                cands = [tyaw[k][0] + j * math.pi / 6 for j in range(12)]
                best = min(cands, key=lambda yw: (max(0.0, _over(yw)) > 0.02 * S, abs(((yw - tyaw[k][0]) + math.pi) % (2 * math.pi) - math.pi), _over(yw)))
                if max(0.0, _over(best)) > 0.02 * S:
                    best = min(cands, key=_over)
                o.rotation_euler[2] = best
                over = _over(best)
                if over > 0:
                    if on_back:
                        o.location.y -= over
                    else:
                        o.location.x -= (1 if x > 0 else -1) * over
                if over > 0:
                    print("CHECK tree %d pushed %.2fS off the hedge" % (k, over / S))
                    trunks[k] = (o.location.x, o.location.y, r)
            coll.objects.link(o)
            adopt(o)
            nbr = int(os.environ.get("BIRCH_BRANCH", 0))
            if nbr:  # short broken branch stubs, angled up and into the room
                mid = [v.co for v in bme.vertices if 0.4 < v.co.z < 0.6]
                rx = (max(c.x for c in mid) - min(c.x for c in mid)) / 2 if mid else 0.05
                rw = rx * hz * bw
                inward = Vector((-x, -y - 0.6 * Wy, 0)).normalized()
                for bi in range(rng.randint(max(1, nbr - 1), nbr + 1)):
                    zb_ = z0 + hz * rng.uniform(0.3, 0.75)
                    hd = Matrix.Rotation(rng.uniform(-1.2, 1.2), 3, "Z") @ inward
                    dv = Vector((hd.x, hd.y, rng.uniform(0.3, 0.9))).normalized()
                    ln_ = rng.uniform(1.5, 3.2) * rw * float(os.environ.get("BRANCH_LEN", 1.0))
                    r0 = rw * rng.uniform(0.25, 0.4) * float(os.environ.get("BRANCH_R", 1.0))
                    bmb = bmesh.new()
                    bmesh.ops.create_cone(bmb, cap_ends=True, segments=10, radius1=r0, radius2=r0 * 0.45, depth=ln_)
                    bmesh.ops.translate(bmb, vec=Vector((0, 0, ln_ / 2)), verts=list(bmb.verts))
                    bmesh.ops.rotate(bmb, cent=Vector((0, 0, 0)), matrix=dv.to_track_quat("Z", "Y").to_matrix(), verts=list(bmb.verts))
                    meb = bpy.data.meshes.new("BirchBranch")
                    bmb.to_mesh(meb)
                    bmb.free()
                    meb.materials.append(bme.materials[0])
                    ob = bpy.data.objects.new("BirchBranch_%d_%d" % (k, bi), meb)
                    ob.location = Vector((x, y, zb_)) + dv * (rw * 0.6)
                    coll.objects.link(ob)
                    adopt(ob)
        bb_ = float(os.environ.get("BIRCH_BANDS", 0))
        if bb_ and bme.materials and not bme.get("banded"):  # dark lenticel dashes and bands on the bark
            bme["banded"] = 1
            nt = bme.materials[0].node_tree
            bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
            src = bsdf.inputs["Base Color"].links[0].from_socket
            tc = nt.nodes.new("ShaderNodeTexCoord")
            mp = nt.nodes.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (14.0, 14.0, 110.0)
            nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
            nz = nt.nodes.new("ShaderNodeTexNoise")
            nz.inputs["Scale"].default_value = 1.0
            nz.inputs["Detail"].default_value = 3.0
            nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
            cr = nt.nodes.new("ShaderNodeValToRGB")
            cr.color_ramp.elements[0].position = float(os.environ.get("BAND_T", 0.6))
            cr.color_ramp.elements[1].position = float(os.environ.get("BAND_T", 0.6)) + 0.05
            nt.links.new(nz.outputs["Fac"], cr.inputs["Fac"])
            fm = nt.nodes.new("ShaderNodeMath")
            fm.operation = "MULTIPLY"
            fm.inputs[1].default_value = bb_
            nt.links.new(cr.outputs["Color"], fm.inputs[0])
            mx = nt.nodes.new("ShaderNodeMixRGB")
            mx.inputs["Color2"].default_value = (0.05, 0.045, 0.04, 1)
            nt.links.new(fm.outputs[0], mx.inputs["Fac"])
            nt.links.new(src, mx.inputs["Color1"])
            nt.links.new(mx.outputs["Color"], bsdf.inputs["Base Color"])
        trunks_iter = []
    else:
        trunks_iter = trunks
    for k, (x, y, r) in enumerate(trunks_iter):
        sd = 10.0 + k * 3.7
        npts = 40
        lean = Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.04, 0.02), 0))
        pts_, radii = [], []
        for i in range(npts):
            t = i / (npts - 1)
            z = z0 + Lz * t
            ox = 0.16 * H * noise.noise(Vector((t * 1.3, sd, 0.1))) + 0.04 * H * noise.noise(Vector((t * 5, sd, 2.1)))
            oy = 0.10 * H * noise.noise(Vector((t * 1.3, sd, 5.3))) + 0.03 * H * noise.noise(Vector((t * 5, sd, 7.7)))
            pts_.append(Vector((x + ox + lean.x * (z - z0), y + oy + lean.y * (z - z0), z)))
            tip = max(0.0, (t - 0.82) / 0.18)
            radii.append(r * (1.0 - 0.32 * t) * (1 + 0.7 * math.exp(-t * 16)) * (1.0 - 0.75 * tip * tip))
        # branches: decide first so the trunk can carry dark eyes where they leave
        inward = Vector((-x, -y, 0)).normalized()
        joints = []
        nb = rng.randint(1, 3)
        for bi in range(nb):
            t = rng.uniform(0.28, 0.82)
            i0 = int(t * (npts - 1))
            p0 = pts_[i0]
            ang = rng.uniform(-1.3, 1.3)
            hd = Matrix.Rotation(ang, 3, "Z") @ inward
            hd.y -= 0.35  # lean toward the camera a little so they read
            dvec = Vector((hd.x, hd.y, rng.uniform(0.25, 0.9)))
            joints.append((p0, dvec.normalized(), radii[i0]))
        for _ in range(rng.randint(1, 3)):  # scars without a branch
            t = rng.uniform(0.15, 0.9)
            i0 = int(t * (npts - 1))
            a_ = rng.uniform(0, 6.283)
            joints.append((pts_[i0], Vector((math.cos(a_), math.sin(a_), 0.3)).normalized(), radii[i0] * 0.6))
        tr = _limb("Birch_%d" % k, pts_, radii, 22, birch, coll, lump=0.09, seed=sd)
        me = tr.data
        att = me.attributes.new("birch_dark", "FLOAT", "POINT")
        vals = [0.0] * len(me.vertices)
        for vi, v in enumerate(me.vertices):
            best = 0.0
            for (p0, dv, rj) in joints:
                rel = v.co - p0
                hdir = Vector((dv.x, dv.y, 0)).normalized()
                face = Vector((rel.x, rel.y, 0)).normalized().dot(hdir)  # 1 on the branch side
                dz = rel.z + 0.25 * rj  # eye hangs below the joint
                q = (dz / (1.3 * rj)) ** 2 + ((1 - face) / 0.9) ** 2
                best = max(best, math.exp(-q * 2.0))
            vals[vi] = best
        att.data.foreach_set("value", vals)
        adopt(tr)
        for bi, (p0, dv, rj) in enumerate(joints[:nb]):
            L = rng.uniform(0.35, 0.85) * H
            bp = _bent_path(p0, dv, L, 14, rng, up=rng.uniform(0.1, 0.35), wiggle=0.12, seed=sd + bi)
            r0 = rj * rng.uniform(0.38, 0.5)
            br_r = [r0 * (1 - 0.8 * (i / 13)) for i in range(14)]
            adopt(_limb("Branch_%d_%d" % (k, bi), bp, br_r, 10, birch, coll, lump=0.06, seed=sd + bi))
            for ti in range(rng.randint(0, 2)):
                f = rng.uniform(0.35, 0.8)
                ii = int(f * 13)
                tdir = (bp[min(ii + 1, 13)] - bp[ii]).normalized()
                tdir = Matrix.Rotation(rng.choice((-1, 1)) * rng.uniform(0.5, 0.9), 3,
                                       tdir.cross(Vector((0, 0, 1))).normalized() if abs(tdir.z) < 0.95 else Vector((1, 0, 0))
                                       ) @ tdir
                tdir.z += 0.25
                tl = rng.uniform(0.2, 0.45) * H
                tp = _bent_path(bp[ii], tdir, tl, 8, rng, up=0.15, wiggle=0.15, seed=sd + bi * 7 + ti)
                tr_r = [br_r[ii] * 0.55 * (1 - 0.8 * (i / 7)) for i in range(8)]
                adopt(_limb("Twig_%d_%d_%d" % (k, bi, ti), tp, tr_r, 6, birch, coll, seed=sd + ti))
    objs["trunks"] = trunks

    if os.environ.get("HEDGE_MOUNDS"):  # back hedge relief: moss mounds at 3 depths, dark foot band, ragged top
        mr = random.Random(int(os.environ.get("HEDGE_MSEED", 515)))
        nmd = int(float(os.environ.get("HEDGE_MOUNDS")) * 60 * fx_)  # back wall only: scales with its length
        lay = {0: [], 1: [], 2: []}
        sz = float(os.environ.get("HM_MSIZE", 1.0))
        for _ in range(nmd):
            for _t in range(30):
                u = mr.uniform(-Wx, Wx); v = mr.uniform(-0.05 * H, Hw)
                if noise.noise(Vector((u * 1.2 / H, v * 1.2 / H, 23.0))) > -0.1:
                    break  # clusters; leave hollows between them
            lv = mr.choice((0, 1, 1, 2))
            R = mr.uniform(0.12, 0.28) * H * sz
            dep_ = (0.05, 0.13, 0.22)[lv] * H
            for _p in range(int(20 * R / (0.2 * H)) + 8):
                a_ = mr.uniform(0, 6.283); rr = R * math.sqrt(mr.random())
                x_ = u + rr * math.cos(a_); z_ = v + rr * math.sin(a_) * 0.8
                bulge = dep_ * (1.0 - (rr / R) ** 2) ** 0.5
                lay[lv].append((x_, Wy - float(os.environ.get("HEDGE_MOFF", 0.02)) * H - bulge, z_, mr.uniform(0.03, 0.065) * H))
        foot = []
        for _ in range(int(float(os.environ.get("HEDGE_FOOT", 1.0)) * 260 * fx_)):  # dark band where the hedge meets the floor
            u = mr.uniform(-Wx, Wx); v = -th + mr.uniform(-0.05, 0.3) * H * (0.6 + 0.4 * mr.random())
            foot.append((u, Wy - float(os.environ.get("HEDGE_MOFF", 0.02)) * H - mr.uniform(0.0, 0.18) * H, v, mr.uniform(0.04, 0.09) * H))
        top_ = []
        for _ in range(int(float(os.environ.get("HEDGE_TOP", 1.0)) * 120 * fx_)):  # small bumps breaking the top edge
            u = mr.uniform(-Wx, Wx)
            top_.append((u, Wy - float(os.environ.get("HEDGE_MOFF", 0.02)) * H - mr.uniform(0.0, 0.1) * H, Hw - mr.uniform(-0.05, 0.25) * H, mr.uniform(0.03, 0.08) * H))
        tk = float(os.environ.get("HEDGE_TKEEP", 0.16)) * H
        btr = [t for t in trunks if back_trunk(t, 0.6)]  # back-wall trunks only
        def clear(pt):
            return all(abs(pt[0] - tx) > tk + pt[3] for (tx, ty, _r) in btr)
        nb_ = sum(len(v) for v in lay.values()) + len(foot) + len(top_)
        for k_ in lay:
            lay[k_] = [q for q in lay[k_] if clear(q)]
        top_ = [q for q in top_ if clear(q)]
        foot = [q for q in foot if abs(q[1] - Wy) < 0.5 * H and all(abs(q[0] - tx) > 0.6 * tk + q[3] for (tx, ty, _r) in btr)]
        print("CHECK hedge mounds trunk keep-out removed %d of %d" % (nb_ - sum(len(v) for v in lay.values()) - len(foot) - len(top_), nb_))
        mdeep = _dark_copy(moss_deep, float(os.environ.get("HEDGE_DEEPV", 0.35)))
        mnear = _dark_copy(moss_wall, float(os.environ.get("HEDGE_NEARV", 1.15)))
        m1_ = moss_deep
        if os.environ.get("HEDGE_SAT"):  # deeper, desaturated olive mounds that sit in the moss instead of popping
            m1_ = _dark_copy(moss_deep, 1.0)
            for m_ in (mdeep, m1_, mnear):
                _olive(m_, float(os.environ["HEDGE_SAT"]), float(os.environ.get("HEDGE_V", 1.0)),
                       float(os.environ.get("HEDGE_HUE", 0.5)))
        specs = (("HMound0", lay[0] + foot, mdeep), ("HMound1", lay[1] + top_, m1_), ("HMound2", lay[2], mnear))
        hm_objs = []
        for k_, (nm_, pts_, m_) in enumerate(specs):
            if not pts_:
                continue
            o_ = _build_moss(nm_, pts_, m_, coll, rng, axis="y", sign=-1.0, squash=(0.6, 0.9))
            ds = o_.modifiers.new("lumps", "DISPLACE")
            tex = bpy.data.textures.new(o_.name + "_tex", "CLOUDS")
            tex.noise_scale = 0.02 * H; tex.noise_depth = 2
            ds.texture = tex; ds.strength = 0.04 * H
            adopt(o_)
            _add_fuzz(o_, int(len(pts_) * 120 * quality), 0.022 * H, 0, 61 + k_, radius=0.0035 * H, rand=0.5, tip=0.3)
            hm_objs.append(o_)
        bp_ = [o for o in bpy.data.objects if o.name.startswith("WallPanelBack")]
        if bp_:
            yv = [v.co.y for v in bp_[0].data.vertices]
            face = max(Wy - (o.location.y + min(yv) * o.scale.y) for o in bp_)
            fmed = sorted(Wy - (o.location.y + min(yv) * o.scale.y) for o in bp_)[len(bp_) // 2]
            print("CHECK hedge panel face depth max=%.2fH median=%.2fH" % (face / H, fmed / H))
        print("CHECK hedge mounds near=%d mid=%d deep=%d foot=%d top=%d" % (len(lay[2]), len(lay[1]), len(lay[0]), len(foot), len(top_)))
        objs["hedgemounds"] = hm_objs

    # ---- hanging Spanish moss under the top rim ----
    strand_pts = []
    top = Hw + 0.02 * H
    def keep(t, sd):  # patchy fringe: thick clusters with darker gaps between
        return noise.noise(Vector((t * 1.1 / S, sd, 0.5))) > -0.12
    MN = float(os.environ.get("MOSS_N", 1.0))
    ML = float(os.environ.get("MOSS_LEN", 1.0))
    for _ in range(int(270 * quality * MN * fx_)):
        t = rng.uniform(-Wx, Wx)
        if not keep(t, 1.3):
            continue
        strand_pts.append((t, Wy - rng.uniform(0.04, 0.2) * S, top - rng.uniform(0, 0.12) * H, 0, -1))
    for sgn in (-1, 1):
        for _ in range(int(100 * quality * MN * fy_)):
            t = rng.uniform(-Wy, Wy)
            if not keep(t, 4.7 + sgn):
                continue
            strand_pts.append((sgn * (Wx - rng.uniform(0.04, 0.2) * S), t, top - rng.uniform(0, 0.12) * H, -sgn, 0))
    NCL = int(os.environ.get("MOSS_CLUMPS", 0))
    if NCL:
        # separate beard-like hanks with dark gaps between them (concept): clump centres along each wall,
        # anchors packed around each centre, short strands at the top make a dense tuft
        strand_pts = []
        CW = float(os.environ.get("MOSS_CW", 0.22))
        for wall_i, (sgn, nc) in enumerate(((0, cnt(NCL, fx_)), (-1, cnt(max(2, NCL // 2), fy_)), (1, cnt(max(2, NCL // 2), fy_)))):
            U = Wx if sgn == 0 else Wy
            for c in range(nc):
                u0 = -U + (2 * U) * (c + 0.5 + rng.uniform(-0.25, 0.25)) / nc
                for _ in range(int(rng.uniform(28, 46) * MN)):
                    u = u0 + rng.gauss(0, CW * S)
                    if abs(u) > U:
                        continue
                    d_ = rng.uniform(0.04, 0.22) * S
                    zz = top - rng.uniform(0, 0.1) * H
                    if sgn == 0:
                        strand_pts.append((u, Wy - d_, zz, 0, -1))
                    else:
                        strand_pts.append((sgn * (Wx - d_), u, zz, -sgn, 0))
    back_pts = [p for p in strand_pts if p[4] != 0]
    side_pts = [p for p in strand_pts if p[4] == 0]
    SR = float(os.environ.get("MOSS_R", 0.0085))
    st = _strands("HangingMoss", back_pts, rng, H, strand, coll, length=(0.35 * ML, 2.0 * ML), radius=SR, per=(14, 26))
    st2 = _strands("HangingMossSides", side_pts, rng, H, strand, coll, length=(0.3 * ML, 1.3 * ML), radius=SR, per=(12, 22))
    adopt(st, "strands")
    adopt(st2)
    hm_glb = os.environ.get("HANGMOSS_GLB")
    if hm_glb:
        hme = _import_glb_mesh(hm_glb, "upright", tint=_envf3("HM_TINT", (0.8, 0.9, 0.62)),
                               val=float(os.environ.get("HM_VAL", "0.7")))
        hn = int(os.environ.get("HM_N", 10))
        hl = float(os.environ.get("HM_LEN", 1.6))
        spots = []
        for wall_i, nc in ((0, cnt(hn, fx_)), (-1, cnt(hn // 2, fy_)), (1, cnt(hn // 2, fy_))):
            U = Wx if wall_i == 0 else Wy
            for c in range(nc):
                u = -U + (2 * U) * (c + 0.5 + rng.uniform(-0.3, 0.3)) / nc
                d_ = rng.uniform(0.1, 0.3) * S
                if wall_i != 0 and u < -U + float(os.environ.get("HM_FRONT", 0.0)) * S:
                    continue  # keep the front corners clear
                spots.append((u, Wy - d_, 1.0) if wall_i == 0 else (wall_i * (Wx - d_), u, float(os.environ.get("HM_SIDE", 1.0))))
        for (tx, ty, tr_) in objs["trunks"]:
            spots.append((tx + rng.uniform(-0.05, 0.05) * S, ty, 1.0))
        if os.environ.get("HM_GLBS"):
            if os.environ.get("SPMOSS") == "crowns":
                _spanish_moss([], hl, top, H, S, rng, coll, adopt, crowns=objs["trunks"])
            objs["hangmoss"] = _hang_variants(W, S, H, top, hl, objs["trunks"], coll, adopt, Wxy=(Wx, Wy))
            spots = []
        elif os.environ.get("SPMOSS") == "crowns":  # keep the GLB clumps, add strand tufts over trunk tops only
            _spanish_moss([], hl, top, H, S, rng, coll, adopt, crowns=objs["trunks"])
        elif os.environ.get("SPMOSS"):  # thin curly Spanish-moss strands instead of the leafy GLB clumps
            _spanish_moss(spots, hl, top, H, S, rng, coll, adopt, crowns=objs["trunks"])
            spots = []
        for k, (x, y, lm_) in enumerate(spots):
            o = bpy.data.objects.new("HangClump_%d" % k, hme)
            hz = hl * H * rng.uniform(0.7, 1.3) * lm_
            o.location = (x, y, top + 0.05 * H - hz)
            hw_ = float(os.environ.get("HM_W", 1.0))
            o.scale = (hz * hw_ * rng.uniform(0.9, 1.3) * rng.choice((-1, 1)), hz * hw_ * rng.uniform(0.6, 1.0), hz)
            o.rotation_euler = (0, 0, rng.uniform(-0.5, 0.5) if os.environ.get("HM_FACE") else rng.uniform(0, 6.283))
            coll.objects.link(o)
            adopt(o)

    if not os.environ.get("FAIRY2"):
        # ---- fairy lights: warm 2300 K bulbs on a thin dark wire draped in swags under the rim ----
        bulb = _emit_mat("stage_bulb", (1.0, 0.5, 0.16), 180.0, kelvin=float(os.environ.get("BULB_K", 2600)))
        wire_m, _, wb_ = _new_mat("stage_wire")
        _set(wb_, "Base Color", (0.02, 0.022, 0.015, 1))
        _principled_defaults(wb_, 0.45, 0.4)
        wire = bpy.data.curves.new("FairyWire", "CURVE")
        wire.dimensions = "3D"
        wire.bevel_depth = 0.009 * H * float(os.environ.get("WIRE_R", 1.0))
        wire.bevel_resolution = 1
        wire.resolution_u = 2
        zt = Hw - 0.12 * H + float(os.environ.get("FAIRY_Z", 0.0)) * H
        yb = Wy - (0.42 + float(os.environ.get("FAIRY_Y", 0.0))) * S
        xs_ = Wx - 0.42 * S
        # anchor points: swags across the back, then down each side toward the front
        nsw, nsd_ = cnt(5, fx_), cnt(4, fy_)  # swags per wall: more on a longer wall
        back_anch = [(-xs_ + (2 * xs_) * i / nsw, yb + rng.uniform(-0.08, 0.08) * S) for i in range(nsw + 1)]
        if os.environ.get("FAIRY_TREES") and objs.get("trunks"):  # drape the wire from tree to tree
            bt_ = sorted((tx, ty) for (tx, ty, _r) in objs["trunks"] if back_trunk((tx, ty), 0.5))
            back_anch = [(-xs_, yb)] + [(tx, ty - float(os.environ.get("FAIRY_TFWD", 0.1)) * S) for (tx, ty) in bt_] + [(xs_, yb)]
        side_anch = lambda sg: [(sg * xs_, yb - (yb + Wy - 0.6 * S) * i / nsd_) for i in range(nsd_ + 1)]
        bulb_pos = []
        for path in ((back_anch, side_anch(-1), side_anch(1)) if os.environ.get("FAIRY_SIDES", "1") == "1" else (back_anch,)):
            sp = wire.splines.new("POLY")
            pts_all = []
            for i in range(len(path) - 1):
                (x0, y0), (x1, y1) = path[i], path[i + 1]
                seg_len = math.hypot(x1 - x0, y1 - y0)
                sag_amt = rng.uniform(0.25, 0.42) * H * float(os.environ.get("FAIRY_SAG", 1.0))
                nq = 12
                nb_ = max(1, int(round(seg_len / (float(os.environ.get("BULB_SP", 0.55)) * S))))
                for q in range(nq):
                    t = q / nq
                    sag = sag_amt * 4 * t * (1 - t)
                    pts_all.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, zt - sag))
                for q in range(nb_):
                    t = (q + 0.5) / nb_
                    sag = sag_amt * 4 * t * (1 - t)
                    bulb_pos.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, zt - sag - 0.035 * H * float(os.environ.get("BULB_R", 1.0))))
            pts_all.append((path[-1][0], path[-1][1], zt))
            sp.points.add(len(pts_all) - 1)
            for i, p in enumerate(pts_all):
                sp.points[i].co = (*p, 1.0)
        wo = bpy.data.objects.new("FairyWire", wire)
        coll.objects.link(wo)
        wo.data.materials.append(wire_m)
        adopt(wo)
        ico = bmesh.new()
        for (x, y, z) in bulb_pos:
            r = bmesh.ops.create_icosphere(ico, subdivisions=3, radius=0.018 * H * float(os.environ.get("BULB_R", 1.0)))
            bmesh.ops.scale(ico, vec=(1, 1, 1.35), verts=r["verts"])  # little teardrop bulbs
            bmesh.ops.translate(ico, vec=(x, y, z), verts=r["verts"])
        bo = _mesh_obj("FairyBulbs", ico, bulb, coll)
        bo.visible_shadow = False
        adopt(bo, "bulbs")
        # real light from every bulb (light tree handles the count)
        for k, (x, y, z) in enumerate(bulb_pos):
            ld = bpy.data.lights.new("fairy_%d" % k, "POINT")
            ld.energy = float(os.environ.get("FAIRY_E", 7.0)) * H * H
            ld.color = (1.0, 1.0, 1.0)
            try:
                ld.use_temperature = True
                ld.temperature = float(os.environ.get("FAIRY_K", 2300))
            except Exception:
                ld.color = (1.0, 0.5, 0.18)
            ld.shadow_soft_size = 0.03 * H
            lo = bpy.data.objects.new("fairy_%d" % k, ld)
            coll.objects.link(lo)
            lo.location = (x, y, z)
            adopt(lo)
    else:
        # FAIRY2: one real string someone hung: catenary swags between 4-5 anchors (rail corners +
        # birch tops), ~8 bulbs on the back, 2-3 per side, irregular gaps, bulbs dangling on drops.
        f2 = random.Random(int(os.environ.get("FAIRY_SEED", 7)))
        kel = float(os.environ.get("BULB_K", 2850))
        wire_m, _, wb_ = _new_mat("stage_wire2")
        _set(wb_, "Base Color", (0.035, 0.04, 0.022, 1))  # dark green-brown
        _principled_defaults(wb_, 0.5, 0.3)
        bulb_ms = []
        for gi, g in enumerate((1.0,) * 4 if os.environ.get("BULB_EVEN") else (0.8, 0.93, 1.07, 1.2)):  # +-20% brightness groups (BULB_EVEN: all alike)
            bm_ = _emit_mat("stage_bulb2_%d" % gi, (1.0, 0.93, 0.78), 60.0 * g * float(os.environ.get("BULB_GLOW", 1.0)), kelvin=kel)
            bulb_ms.append((bm_, g))
        wire = bpy.data.curves.new("FairyWire2", "CURVE")
        wire.dimensions = "3D"
        wire.bevel_depth = 0.006 * H * float(os.environ.get("WIRE_R", 1.0))
        wire.bevel_resolution = 1
        wire.resolution_u = 2
        zt = Hw - 0.06 * H + float(os.environ.get("FAIRY_Z", 0.0)) * H
        xs_ = Wx - 0.42 * S
        yb = Wy - (0.42 + float(os.environ.get("FAIRY_Y", 0.0))) * S
        tf = float(os.environ.get("FAIRY_TFWD", 0.15)) * S
        bt_ = sorted((tx, ty) for (tx, ty, _r) in (objs.get("trunks") or []) if back_trunk((tx, ty), 0.5))
        nbt = cnt(3, fx_)  # tree anchors on the back wall: more on a longer wall
        if len(bt_) > nbt:  # 4-5 anchors total on the square: two rail corners + up to 3 trees, spread out
            idx = sorted({round(i * (len(bt_) - 1) / (nbt - 1)) for i in range(nbt)})
            bt_ = [bt_[i] for i in idx]
        back = [(-xs_, yb, zt)] + [(tx, ty - tf, zt - f2.uniform(0.0, 0.12) * H) for (tx, ty) in bt_] + [(xs_, yb, zt)]
        yf = -Wy + 0.7 * S
        nsp = cnt(2, fy_)  # swags down each side wall

        # FAIRY_SIDE_DZ (H, SIDE_LIGHTS): pins down the side walls hung this much lower than the back corner, so the
        # frame's top rail doesn't hide the wire from the camera (the string drops from the corner pin)
        zs = zt - float(os.environ.get("FAIRY_SIDE_DZ", 0.0)) * H

        def side(sg):
            mids = [(sg * xs_, yb + (yf - yb) * (i + 1) / nsp + f2.uniform(-0.3, 0.3) * S, zs - f2.uniform(0.0, 0.1) * H)
                    for i in range(nsp - 1)] if nsp != 2 else \
                [(sg * xs_, 0.5 * (yb + yf) + f2.uniform(-0.3, 0.3) * S, zs - f2.uniform(0.0, 0.1) * H)]
            return [(sg * xs_, yb, zt)] + mids + [(sg * xs_, yf, zs)]
        sag_k = float(os.environ.get("FAIRY_SAG", 1.0))
        lo_, hi_ = (float(v) for v in os.environ.get("SAG_RANGE", "0.08,0.15").split(","))

        def string(anchors, nbulbs):
            pts = []
            spans = []
            for i in range(len(anchors) - 1):
                p0, p1 = Vector(anchors[i]), Vector(anchors[i + 1])
                span = (p1 - p0).length
                d = f2.uniform(lo_, hi_) * span * sag_k  # uneven swags
                nq = 16
                seg = []
                for q in range(nq + (1 if i == len(anchors) - 2 else 0)):
                    t = q / nq
                    # catenary-ish: cosh profile normalised to depth d at mid-span
                    c = 2.2
                    sag = d * (math.cosh(c) - math.cosh(c * (2 * t - 1))) / (math.cosh(c) - 1)
                    v = p0.lerp(p1, t)
                    v.z -= sag
                    seg.append(v)
                pts += seg
                spans.append(span)
            sp = wire.splines.new("POLY")
            sp.points.add(len(pts) - 1)
            for i, v in enumerate(pts):
                sp.points[i].co = (v.x, v.y, v.z, 1.0)
            # irregular bulb positions along the arc length (gaps 0.7x-1.4x)
            seglen = [(pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)]
            tot = sum(seglen)
            gaps = [f2.uniform(0.7, 1.4) for _ in range(nbulbs + 1)]
            gs = sum(gaps)
            out = []
            acc = 0.0
            for g in gaps[:-1]:
                acc += g / gs * tot
                s_ = acc
                for i, l in enumerate(seglen):
                    if s_ <= l:
                        out.append(pts[i].lerp(pts[i + 1], s_ / max(l, 1e-6)))
                        break
                    s_ -= l
            return out

        sides_ = {sg: side(sg) for sg in (-1, 1)}
        if os.environ.get("FAIRY_PINS"):  # brass tacks where the wire is fixed: it was hung by hand
            pm_, _, pb_ = _new_mat("stage_pin")
            _set(pb_, "Base Color", (0.55, 0.42, 0.2, 1))
            _principled_defaults(pb_, 0.35, 0.9)
            pins = bmesh.new()
            anch = back + (sides_[-1][1:] + sides_[1][1:] if os.environ.get("FAIRY_SIDES", "1") == "1" else [])
            for (ax, ay, az) in anch:
                r = bmesh.ops.create_uvsphere(pins, u_segments=10, v_segments=6, radius=0.011 * H)
                bmesh.ops.scale(pins, vec=(1, 1, 0.6), verts=r["verts"])
                bmesh.ops.translate(pins, vec=(ax, ay + 0.004 * H, az + 0.004 * H), verts=r["verts"])
            adopt(_mesh_obj("FairyPins", pins, pm_, coll))
        hangs = string(back, cnt(int(os.environ.get("FAIRY_NB", 8)), fx_))
        if os.environ.get("FAIRY_SIDES", "1") == "1":
            for sg in (-1, 1):
                hangs += string(sides_[sg], cnt(f2.choice((2, 3)), fy_))
        bulb_pos = []
        for v in hangs:
            drop = f2.uniform(0.05, 0.1) * H * float(os.environ.get("DROP_K", 1.0))
            dy = f2.uniform(-0.12, 0.12) * S  # some tucked behind moss, some in front
            if os.environ.get("FAIRY_TUCK"):  # every bulb just inside the moss, so each wears the same warm halo
                dy = (0.04 * (dy / S + 0.12) / 0.24) * S  # same draw (the rest of the set stays put), remapped
            top = Vector((v.x, v.y, v.z))
            bp = Vector((v.x, v.y + dy, v.z - drop))
            dsp = wire.splines.new("POLY")
            dsp.points.add(1)
            dsp.points[0].co = (*top, 1.0)
            dsp.points[1].co = (*bp, 1.0)
            bulb_pos.append((bp, f2.choice(bulb_ms)))
        wo = bpy.data.objects.new("FairyWire2", wire)
        coll.objects.link(wo)
        wo.data.materials.append(wire_m)
        adopt(wo)
        br = 0.014 * H * float(os.environ.get("BULB_R", 1.0))
        for k, (bp, (bm_, g)) in enumerate(bulb_pos):
            ico = bmesh.new()
            r = bmesh.ops.create_icosphere(ico, subdivisions=3, radius=br)
            bmesh.ops.scale(ico, vec=(1, 1, 1.4), verts=r["verts"])
            bmesh.ops.translate(ico, vec=(bp.x, bp.y, bp.z - br * 1.2), verts=r["verts"])
            bo = _mesh_obj("FairyBulb2_%d" % k, ico, bm_, coll)
            bo.visible_shadow = False
            adopt(bo, "bulbs")
            ld = bpy.data.lights.new("fairy2_%d" % k, "POINT")
            ld.energy = float(os.environ.get("FAIRY_E", 7.0)) * H * H * g
            try:
                ld.use_temperature = True
                ld.temperature = float(os.environ.get("FAIRY_K", kel))
                ld.color = (1.0, 1.0, 1.0)
            except Exception:
                ld.color = (1.0, 0.85, 0.62)
            ld.shadow_soft_size = 0.02 * H
            lo = bpy.data.objects.new("fairy2_%d" % k, ld)
            coll.objects.link(lo)
            lo.location = (bp.x, bp.y, bp.z - br * 1.2)
            adopt(lo)

    # ---- main lantern: warm, soft, from the front and high, so the FRONT rows are brighter ----
    # (far enough away that it grades gently front to back instead of leaving a hotspot)
    ld = bpy.data.lights.new("lantern", "POINT")
    ld.energy = float(os.environ.get("LANTERN_E", 1500.0)) * H * H
    ld.color = tuple(float(x) for x in os.environ.get("LANTERN_C", "1.0,0.92,0.82").split(","))
    ld.shadow_soft_size = 0.9 * H
    lo = bpy.data.objects.new("lantern", ld)
    coll.objects.link(lo)
    lo.location = (cx - 0.9 * S, cy - W - 2.2 * S, 2.6 * H)
    objs["lantern"] = lo
    # soft warm fill from the front for open shadows
    la = bpy.data.lights.new("frontfill", "AREA")
    la.shape = "RECTANGLE"
    la.size = 3.5 * S
    la.size_y = 1.5 * S
    la.energy = float(os.environ.get("FILL_E", 25.0)) * H * H
    la.color = tuple(float(x) for x in os.environ.get("FILL_C", "0.92,0.95,1.0").split(","))
    lf = bpy.data.objects.new("frontfill", la)
    coll.objects.link(lf)
    lf.location = (cx + 0.3 * S, cy - W - 1.5 * S, 3.2 * H)
    lf.rotation_euler = (math.radians(55), 0, 0)
    objs["frontfill"] = lf
    # soft warm pool from above the front edge: lights the middle of the board, lets the corners fall off
    lp_ = bpy.data.lights.new("pool", "SPOT")
    lp_.energy = float(os.environ.get("POOL_E", 2600.0)) * H * H
    lp_.spot_size = math.radians(float(os.environ.get("POOL_SIZE", 62)))
    lp_.spot_blend = 0.9
    lp_.shadow_soft_size = float(os.environ.get("POOL_SOFT", 0.6)) * H
    lp_.color = tuple(float(x) for x in os.environ.get("POOL_C", "1.0,0.86,0.68").split(","))
    lpo = bpy.data.objects.new("pool", lp_)
    coll.objects.link(lpo)
    lpo.location = (cx + 0.2 * S, cy - W - 0.6 * S, 5.5 * H)
    lpo.rotation_euler = (math.radians(32), 0, 0)
    objs["pool"] = lpo
    # WARMFILL: low warm lantern spill from the front edge, aimed at the front rows so it fades toward the back
    if os.environ.get("WARMFILL_E"):
        lw = bpy.data.lights.new("warmfill", "SPOT")
        lw.energy = float(os.environ["WARMFILL_E"]) * H * H
        try:
            lw.use_temperature = True
            lw.temperature = float(os.environ.get("WARMFILL_K", 3000))
            lw.color = (1.0, 1.0, 1.0)
        except Exception:
            lw.color = (1.0, 0.72, 0.45)
        lw.spot_size = math.radians(float(os.environ.get("WARMFILL_SIZE", 110)))
        lw.spot_blend = 1.0
        lw.shadow_soft_size = float(os.environ.get("WARMFILL_SOFT", 0.8)) * H
        lwo = bpy.data.objects.new("warmfill", lw)
        coll.objects.link(lwo)
        lwo.location = Vector((cx, cy - W - float(os.environ.get("WARMFILL_BACK", 0.8)) * S,
                              float(os.environ.get("WARMFILL_Z", 1.6)) * H))
        tgt = Vector((cx, cy - W * float(os.environ.get("WARMFILL_AIM", 0.4)), 0.0))
        lwo.rotation_euler = (tgt - lwo.location).to_track_quat("-Z", "Y").to_euler()
        objs["warmfill"] = lwo
    # WALLBASE: low, soft, warm skim from the front edge toward the back/side wall bases; falls off upward
    if os.environ.get("WALLBASE_E"):
        lb = bpy.data.lights.new("wallbase", "AREA")
        lb.shape = "RECTANGLE"
        lb.size = float(os.environ.get("WALLBASE_W", 2.4)) * Wx
        lb.size_y = float(os.environ.get("WALLBASE_HT", 0.6)) * H
        lb.energy = float(os.environ["WALLBASE_E"]) * H * H * fx_  # a longer strip keeps the same light per length
        try:
            lb.spread = math.radians(float(os.environ.get("WALLBASE_SPREAD", 120)))
        except Exception:
            pass
        try:
            lb.use_temperature = True
            lb.temperature = float(os.environ.get("WALLBASE_K", 3200))
            lb.color = (1.0, 1.0, 1.0)
        except Exception:
            lb.color = (1.0, 0.76, 0.52)
        lbo = bpy.data.objects.new("wallbase", lb)
        coll.objects.link(lbo)
        lbo.location = (cx, cy - Wy - float(os.environ.get("WALLBASE_BACK", 0.3)) * S,
                        float(os.environ.get("WALLBASE_Z", 0.5)) * H)
        lbo.rotation_euler = (math.radians(90 - float(os.environ.get("WALLBASE_TILT", 4))), 0, 0)
        lbo.visible_camera = False
        objs["wallbase"] = lbo
        if os.environ.get("WALLBASE_MODE") == "walls":
            # one strip per wall, just in front of its foot, facing the wall (one-sided: tiles stay dark)
            lb.size = 2.0 * Wx  # (energy already per back-wall length)
            dd = float(os.environ.get("WALLBASE_D", 0.35)) * S
            zz = float(os.environ.get("WALLBASE_Z", 0.12)) * H
            up = math.radians(float(os.environ.get("WALLBASE_TILT", 15)))
            lbo.location = (cx, cy + Wy - dd, zz)
            lbo.rotation_euler = (math.radians(90) + up, 0, 0)  # faces +Y, tilted up
            sm = float(os.environ.get("WALLBASE_SIDE", 1.0))
            for sgn in (-1, 1):
                l2 = lb.copy()
                l2.size = 2.0 * Wy
                l2.energy = lb.energy * sm if nx == ny else lb.energy / fx_ * sm * fy_
                o2 = bpy.data.objects.new("wallbase_s%d" % sgn, l2)
                coll.objects.link(o2)
                o2.location = (cx + sgn * (Wx - dd), cy, zz)
                # face +-X: rotate Z by -+90 after the X tilt
                o2.rotation_euler = (math.radians(90) + up, 0, math.radians(-90 * sgn))
                o2.visible_camera = False
                objs.setdefault("wallbase_side", []).append(o2)
        if os.environ.get("WALLBASE_NAMES"):
            import collections as _c
            print("CHECK names", dict(_c.Counter(re.sub(r"[_.\d].*$", "", o.name) for o in coll.all_objects)))
        WL = os.environ.get("WALLBASE_LINK")
        if WL:  # light only the wall hedge: no tile seams from the one-sided strips, no trunk uplight
            pref = tuple(WL.split(",")) if WL != "1" else ("Wall", "Hedge")
            wlc = bpy.data.collections.new("WallBaseRecv")
            n_ = 0
            for o in coll.all_objects:
                if o.type == "MESH" and o.name.startswith(pref):
                    wlc.objects.link(o)
                    n_ += 1
            for l_ in [lbo] + objs.get("wallbase_side", []):
                l_.light_linking.receiver_collection = wlc
            print("CHECK wallbase link receivers", n_, flush=True)
    # cool moonlight from back-top for rim and moody shadows
    lc = bpy.data.lights.new("moon", "AREA")
    lc.shape = "RECTANGLE"
    lc.size = 3 * S
    lc.size_y = 2 * S
    lc.energy = float(os.environ.get("MOON_E", 45.0)) * H * H
    lc.color = tuple(float(x) for x in os.environ.get("MOON_C", "0.5,0.66,1.0").split(","))
    lm = bpy.data.objects.new("moon", lc)
    coll.objects.link(lm)
    lm.location = (cx - 1.0 * S, cy + 1.6 * S, 3.4 * H)
    lm.rotation_euler = (math.radians(-35), 0, math.radians(-10))
    objs["moon"] = lm
    if os.environ.get("FRAME_EXCL"):  # keep the warm front lights off the frame (concept: near-black lip)
        fx = bpy.data.collections.new("StageFrameExcl")
        for bd in objs["frame_boards"]:
            fx.objects.link(bd)
        for co in fx.collection_objects:
            co.light_linking.link_state = "EXCLUDE"
        for l_ in (lo, lf, lpo):
            l_.light_linking.receiver_collection = fx
    if nx != ny:  # a long board: the square's front lights, fill, pool and moon once per short-side stretch
        segs, fac = _light_segments(W, Wx, Wy)
        for o in (lo, lf, lpo, objs.get("warmfill"), fko, lm):
            if o is None:
                continue
            o.data.energy *= fac
            base = o.location.copy()
            for i, (dx, dy) in enumerate(segs):
                if i and ny > nx and o is lo:
                    # deep board: the lantern stays once, in front. Copies hanging over the floor double the
                    # stretches they sit in (measured: rows up to 2x the square's); the pool, warm fill, front fill
                    # and moon copies alone carry the square's row levels the whole way back
                    break
                o_ = o
                if i:
                    o_ = o.copy()  # shares the light data; keeps rotation and light linking
                    o_.name = "%s_seg%d" % (o.name, i)
                    coll.objects.link(o_)
                    o_.visible_camera = False
                    objs.setdefault("light_copies", []).append(o_)
                o_.location = base + Vector((dx, dy, 0.0))
                if i and ny > nx and o.data.type == "SPOT":
                    # deep board: the pool / warm-fill copy is re-aimed at its own stride, its cone narrowed to
                    # just cover that stride's floor (never wider than the square's cone), so strides don't pile up
                    y0 = segs[i][1] - segs[0][1] - Wy
                    y1 = y0 + (segs[1][1] - segs[0][1])
                    pos = o_.location
                    dirs = [(Vector((cx + sx * Wx, cy + yy, 0.0)) - pos).normalized() for sx in (-1, 1) for yy in (y0, y1)]
                    aim = sum(dirs, Vector()).normalized()
                    half_a = min(max(aim.angle(d_) for d_ in dirs) * 1.08, o.data.spot_size / 2)
                    sd = o.data.copy()
                    sd.spot_size = 2 * half_a
                    o_.data = sd
                    o_.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()

    # ---- MIST: very faint cool mist hugging the wall feet, only over the perimeter strip ----
    if os.environ.get("MIST_D"):
        mm_ = bpy.data.materials.new("stage_mist")
        mm_.use_nodes = True
        mnt = mm_.node_tree
        for n_ in list(mnt.nodes):
            mnt.nodes.remove(n_)
        mout = _node(mnt, "ShaderNodeOutputMaterial", 600, 0)
        pv = _node(mnt, "ShaderNodeVolumePrincipled", 300, 0)
        pv.inputs["Color"].default_value = tuple(_envf3("MIST_C", (0.78, 0.86, 1.0))) + (1.0,)
        tcm = _node(mnt, "ShaderNodeTexCoord", -600, 0)
        sxm = _node(mnt, "ShaderNodeSeparateXYZ", -400, 0)
        mnt.links.new(tcm.outputs["Generated"], sxm.inputs[0])
        fall = _ramp(mnt, sxm.outputs[2], [(0.0, (1, 1, 1, 1)), (1.0, (0, 0, 0, 1))], x=-200, y=0, interp="EASE")
        nz = _noise(mnt, _mapping(mnt, tcm.outputs["Object"], (6 / H, 6 / H, 10 / H), x=-400, y=-250), 1.0, detail=2,
                    rough=0.5, x=-200, y=-250)
        nzr = _ramp(mnt, nz.outputs["Fac"], [(0.35, (0.3, 0.3, 0.3, 1)), (0.65, (1, 1, 1, 1))], x=0, y=-250)
        dd_ = _math(mnt, "MULTIPLY", _math(mnt, "MULTIPLY", fall.outputs["Color"], nzr.outputs["Color"], x=100, y=0),
                    float(os.environ["MIST_D"]) / H, x=200, y=0)
        mnt.links.new(dd_, pv.inputs["Density"])
        mnt.links.new(pv.outputs["Volume"], mout.inputs["Volume"])
        mh = float(os.environ.get("MIST_H", 0.1)) * Hw
        inx = hx + float(os.environ.get("MIST_IN", 0.05)) * S  # never over the board
        iny = hy + float(os.environ.get("MIST_IN", 0.05)) * S
        boxes = ((0, (iny + Wy) / 2, Wy - iny, 2 * Wx), ((inx + Wx) / 2, 0, Wx - inx, 2 * Wy), (-(inx + Wx) / 2, 0, Wx - inx, 2 * Wy))
        for bi, (bx, by, dpt, ln) in enumerate(boxes):
            bpy.ops.mesh.primitive_cube_add(size=1.0)
            ob = bpy.context.active_object
            ob.name = "Mist_%d" % bi
            for c_ in list(ob.users_collection):
                c_.objects.unlink(ob)
            coll.objects.link(ob)
            ob.location = (cx + bx, cy + by, mh / 2 - th)
            ob.scale = ((ln, dpt, mh) if bi == 0 else (dpt, ln, mh))
            ob.data.materials.append(mm_)
            ob.visible_shadow = False
    # ---- haze: a low-density homogeneous volume filling the box (single scatter) ----
    if os.environ.get("STAGE_HAZE", "volume") == "volume":
        hm = bpy.data.materials.new("stage_haze_vol")
        hm.use_nodes = True
        hnt = hm.node_tree
        for n_ in list(hnt.nodes):
            hnt.nodes.remove(n_)
        ho_ = _node(hnt, "ShaderNodeOutputMaterial", 400, 0)
        pv = _node(hnt, "ShaderNodeVolumePrincipled", 100, 0)
        _set(pv, "Color", tuple(float(x) for x in os.environ.get("HAZE_C", "0.85,0.82,0.7").split(",")) + (1,))
        # thicker toward the back and low down, near-clear at the front so the front rows keep contrast
        hD = float(os.environ.get("HAZE_D", 0.05))
        htc = _node(hnt, "ShaderNodeTexCoord", -700, 0)
        hsep = _node(hnt, "ShaderNodeSeparateXYZ", -500, 0)
        _link(hnt, htc.outputs["Generated"], hsep.inputs[0])
        hy = _math(hnt, "ADD", _math(hnt, "MULTIPLY", _math(hnt, "POWER", hsep.outputs[1], 1.6, x=-350, y=50), 1.5,
                                     x=-200, y=50), 0.12, x=-50, y=50)
        hz = _math(hnt, "SUBTRACT", 1.25, _math(hnt, "MULTIPLY", hsep.outputs[2], 0.6, x=-350, y=-100), x=-200, y=-100)
        _link(hnt, _math(hnt, "MULTIPLY", _math(hnt, "MULTIPLY", hy, hz, x=0, y=0), hD, x=0, y=-50),
              pv.inputs["Density"])
        _set(pv, "Anisotropy", 0.45)
        _link(hnt, pv.outputs[0], ho_.inputs["Volume"])
        bmv = bmesh.new()
        _add_box(bmv, 0, 0.1 * S, (Hw + 0.1 * H - th) / 2, 2 * Wx, 2 * Wy - 0.2 * S, Hw + 0.1 * H + th)
        vo = _mesh_obj("HazeVolume", bmv, hm, coll, smooth=False)
        vo.visible_shadow = False
        adopt(vo, "haze")
        if os.environ.get("MOON_NOHAZE") and objs.get("moon"):  # moon lights the set, not the fog (no hard edge)
            hx = bpy.data.collections.new("StageHazeExcl")
            hx.objects.link(vo)
            for co in hx.collection_objects:
                co.light_linking.link_state = "EXCLUDE"
            objs["moon"].light_linking.receiver_collection = hx
    else:
        haze = _haze_mat()
        for k, (fy, hz, amt) in enumerate(((0.08, 1.8, 1.0), (0.26, 1.2, 0.6))):
            hc = _plane_grid("Haze_%d" % k, -Wx, Wx, -0.1 * H, hz * H, 1, 1, haze, coll, "XZ", Wy - fy * S)
            hc["haze_amt"] = amt
            _camera_only(hc)
            adopt(hc)

    # ---- world: very dark cool ----
    w = scene.world or bpy.data.worlds.new("World")
    scene.world = w
    w.use_nodes = True
    bgn = w.node_tree.nodes.get("Background")
    if bgn:
        bgn.inputs["Color"].default_value = (0.012, 0.018, 0.034, 1)
        bgn.inputs["Strength"].default_value = float(os.environ.get("WORLD_S", 0.25))

    objs["camera"] = build_camera(scene, H, center, zoom, elevation, focal, fstop, dof, aspect, look_ahead)
    scene["stage_S"] = S
    if os.environ.get("RAYDBG"):
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        for k, (tx, ty, tr_) in enumerate(objs.get("trunks", [])):
            for zf in (0.6, 1.2, 1.8, 2.4):
                tgt = Vector((tx + cx, ty + cy, zf * H))
                org = tgt + Vector((0, -6 * S, 4 * S))
                dr = (tgt - org).normalized()
                names = []
                o_ = org
                for _ in range(6):
                    hit, loc, nrm, idx, ob, mx = scene.ray_cast(dg, o_, dr)
                    if not hit:
                        break
                    names.append(ob.name)
                    if not ob.name.startswith(("Haze", "Glass")):
                        break
                    o_ = loc + dr * 0.001
                print("CHECK ray tree", k, "z=%.1fH" % zf, names)
    return objs


# --------------------------------------------------------------------------
# 3. render setup
# --------------------------------------------------------------------------
def _setup_compositor(scene):
    """Bloom on the bright bulbs only, then a gentle toy-miniature grade: a touch more saturation,
    warm highlights, cool-tinted shadows, soft vignette, fine animated grain. Idempotent."""
    if os.environ.get("STAGE_NOCOMP"):
        return
    ng = bpy.data.node_groups.get("StageGrade")
    if ng is None:
        ng = bpy.data.node_groups.new("StageGrade", "CompositorNodeTree")
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        N = ng.nodes
        rl = N.new("CompositorNodeRLayers")
        rl.location = (-1200, 0)
        gl = N.new("CompositorNodeGlare")
        gl.location = (-950, 0)
        gl.inputs["Type"].default_value = "Bloom"
        gl.inputs["Quality"].default_value = "High"
        gl.inputs["Threshold"].default_value = float(os.environ.get("BLOOM_T", 1.6))
        gl.inputs["Smoothness"].default_value = 0.6
        gl.inputs["Strength"].default_value = float(os.environ.get("BLOOM_S", 0.55))
        gl.inputs["Size"].default_value = float(os.environ.get("BLOOM_SIZE", 0.7))
        gl.inputs["Tint"].default_value = (1.0, 0.82, 0.6, 1)
        ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
        cb = N.new("CompositorNodeColorBalance")
        cb.location = (-700, 0)
        cb.inputs["Type"].default_value = "Offset/Power/Slope (ASC-CDL)"
        cb.inputs["Factor"].default_value = float(os.environ.get("CB_F", 1.0))
        cb.inputs[10].default_value = (0.0, 0.003, 0.009, 1)   # offset: cool lift in the shadows
        cb.inputs[12].default_value = (0.97, 0.98, 1.02, 1)    # power
        cb.inputs[14].default_value = (1.04, 1.0, 0.95, 1)     # slope: warm highlights
        ng.links.new(gl.outputs["Image"], cb.inputs["Image"])
        hs = N.new("CompositorNodeHueSat")
        hs.location = (-500, 0)
        hs.inputs["Saturation"].default_value = float(os.environ.get("GRADE_SAT", 1.12))
        ng.links.new(cb.outputs["Image"], hs.inputs["Image"])
        # vignette
        ic = N.new("CompositorNodeImageCoordinates")
        ic.location = (-700, -300)
        ng.links.new(rl.outputs["Image"], ic.inputs["Image"])
        ln = N.new("ShaderNodeVectorMath")
        ln.operation = "LENGTH"
        ln.location = (-500, -300)
        ng.links.new(ic.outputs["Normalized"], ln.inputs[0])
        mr = N.new("ShaderNodeMapRange")
        mr.location = (-300, -300)
        mr.inputs["From Min"].default_value = float(os.environ.get("VIG0", 0.55))
        mr.inputs["From Max"].default_value = float(os.environ.get("VIG1", 1.25))
        mr.inputs["To Min"].default_value = 1.0
        mr.inputs["To Max"].default_value = float(os.environ.get("VIGMIN", 0.72))
        ng.links.new(ln.outputs["Value"], mr.inputs["Value"])
        vm = N.new("ShaderNodeMix")
        vm.data_type = "RGBA"
        vm.blend_type = "MULTIPLY"
        vm.location = (-150, 0)
        vm.inputs[0].default_value = 1.0
        ng.links.new(hs.outputs["Image"], vm.inputs[6])
        ng.links.new(mr.outputs["Result"], vm.inputs[7])
        # grain: per-pixel white noise, re-seeded every frame, linear-light at a low factor
        wn = N.new("ShaderNodeTexWhiteNoise")
        wn.noise_dimensions = "4D"
        wn.location = (-300, -550)
        ng.links.new(ic.outputs["Pixel"], wn.inputs["Vector"])
        try:
            fc = wn.inputs["W"].driver_add("default_value")
            fc.driver.expression = "frame"
        except Exception:
            pass
        gm = N.new("ShaderNodeMix")
        gm.data_type = "RGBA"
        gm.blend_type = "OVERLAY"
        gm.location = (50, 0)
        gm.inputs[0].default_value = float(os.environ.get("GRAIN", 0.08))
        ng.links.new(vm.outputs[2], gm.inputs[6])
        ng.links.new(wn.outputs["Value"], gm.inputs[7])
        go = N.new("NodeGroupOutput")
        go.location = (300, 0)
        ng.links.new(gm.outputs[2], go.inputs[0])
    scene.compositing_node_group = ng
    scene.render.use_compositing = True


def setup_render(scene, res=540, samples=96, aspect=1.0, exposure=0.0):
    r = scene.render
    r.engine = "CYCLES"
    r.resolution_x = int(res)
    r.resolution_y = int(round(res / aspect))
    r.resolution_percentage = 100
    r.film_transparent = False
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"
    r.image_settings.color_depth = "8"
    cy = scene.cycles
    cy.samples = int(samples)
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.use_denoising = True
    cy.denoiser = "OPENIMAGEDENOISE"
    try:
        cy.denoising_use_gpu = True
    except Exception:
        pass
    cy.max_bounces = 6
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 3
    cy.transmission_bounces = 2
    cy.volume_bounces = 0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.sample_clamp_indirect = 8.0
    cy.sample_clamp_direct = 0
    cy.pixel_filter_type = "BLACKMAN_HARRIS"
    cy.filter_width = 1.2
    try:
        scene.cycles_curves.shape = os.environ.get("CURVE_SHAPE", "THICK")
        scene.cycles_curves.subdivisions = int(os.environ.get("CURVE_SUBDIV", 2))
    except Exception:
        pass
    # GPU (Metal)
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = os.environ.get("CYCLES_DEVICE") or ("METAL" if sys.platform == "darwin" else "OPTIX")
        try:
            prefs.refresh_devices()
        except Exception:
            pass
        for d in prefs.devices:
            d.use = d.type != "CPU"
        cy.device = "CPU" if os.environ.get("CYCLES_CPU") else "GPU"
        print("GPU", prefs.compute_device_type, [d.name for d in prefs.devices if d.use], flush=True)
    except Exception as e:  # fall back to CPU
        print("GPU setup failed:", e)
        cy.device = "CPU"
    vs = scene.view_settings
    try:
        vs.view_transform = os.environ.get("VIEWT", "Standard")
        if vs.view_transform == "AgX":
            vs.look = os.environ.get("LOOKAGX", "AgX - Punchy")
    except Exception:
        vs.view_transform = "Standard"
    vs.exposure = exposure + float(os.environ.get("EXPO", 0))
    scene.display_settings.display_device = "sRGB"
    cy.volume_step_rate = 4.0
    cy.volume_max_steps = 256
    _setup_compositor(scene)
    return scene

def _spanish_moss(spots, hl, top, H, S, rng, coll, adopt, crowns=()):
    """Each spot: a clump of 40-60 wiry curly strands, dense at the top, ragged and gappy below."""
    cols = [_envf3("SPM_C%d" % i, d) for i, d in enumerate(((0.55, 0.57, 0.42), (0.38, 0.40, 0.26), (0.66, 0.58, 0.38)))]
    mats = []
    for i, c in enumerate(cols):
        m, _, b = _new_mat("stage_spmoss_%d" % i)
        _set(b, "Base Color", tuple(v * float(os.environ.get("SPM_VAL", 1.0)) for v in c) + (1,))
        _principled_defaults(b, 0.85, 0.0)
        try:
            _set(b, "Subsurface Weight", 0.25)
            _set(b, "Subsurface Radius", (0.3, 0.3, 0.15))
            _set(b, "Sheen Weight", 0.4)
        except Exception:
            pass
        mats.append(m)
    cu = bpy.data.curves.new("SpanishMoss", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.0028 * H * float(os.environ.get("SPM_R", 1.0))
    cu.bevel_resolution = 0
    cu.resolution_u = 1
    for m in mats:
        cu.materials.append(m)
    nmin, nmax = (int(v) for v in os.environ.get("SPM_N", "40,60").split(","))
    wk = float(os.environ.get("SPM_W", 0.35))
    nc_ = int(os.environ.get("SPM_CROWN", 0))
    clumps = [(x, y, lm_, None) for (x, y, lm_) in spots] + [(tx, ty, 1.0, tr_) for (tx, ty, tr_) in (crowns if nc_ else ())]
    for (x, y, lm_, crown) in clumps:
        L0 = hl * H * rng.uniform(0.7, 1.3) * lm_
        cw = L0 * wk * rng.uniform(0.8, 1.2)  # clump about 2-3x taller than wide
        if crown is not None:  # dense short tuft draped over a trunk top, hides the cut end
            cw = max(crown * 2.2, 0.05 * H)
        for j in range(nc_ if crown is not None else rng.randint(nmin, nmax)):
            # ragged bottom: most strands short-to-mid, a few long wisps
            ln = L0 * min(1.0, rng.betavariate(2.0, 2.6) * 1.5)
            if crown is not None:
                ln = L0 * rng.uniform(0.12, 0.45)
            x0 = x + rng.gauss(0, 0.33) * cw
            y0 = y + rng.gauss(0, 0.12) * cw
            if crown is not None:  # wrap around the front of the trunk (toward the room centre)
                ang = math.atan2(-y, -x) + rng.uniform(-1.4, 1.4)
                rr = crown * float(os.environ.get("SPM_CR", 1.8)) * rng.uniform(0.9, 1.2)
                x0, y0 = x + rr * math.cos(ang), y + rr * math.sin(ang)
            amp = rng.uniform(0.012, 0.035) * H
            fq = rng.uniform(18, 36) / H
            ph1, ph2 = rng.uniform(0, 6.28), rng.uniform(0, 6.28)
            drift = (rng.uniform(-0.25, 0.25), rng.uniform(-0.1, 0.1))
            nq = max(6, int(ln / (0.025 * H)))
            sp = cu.splines.new("POLY")
            sp.points.add(nq - 1)
            for q in range(nq):
                t = q / (nq - 1)
                z = top + 0.03 * H - ln * t
                a = amp * (0.3 + t)  # tighter at the top, curlier below
                w2 = 0.6 * a * math.sin(fq * 2.7 * ln * t + ph2 * 1.7)  # second, faster kink: less regular
                sp.points[q].co = (x0 + drift[0] * ln * t + a * math.sin(fq * ln * t + ph1) + w2,
                                   y0 + drift[1] * ln * t + a * math.cos(fq * ln * t * 0.8 + ph2) + 0.5 * w2, z, 1.0)
                sp.points[q].radius = 1.0 - 0.6 * t
            sp.material_index = rng.choice((0, 0, 1, 2))
    o = bpy.data.objects.new("SpanishMoss", cu)
    coll.objects.link(o)
    adopt(o, "spmoss")
    return o


def _simple_mat(name, c0, c1, rough=0.8, scale=40.0, sss=0.0):
    """principled with two-colour noise mottling (small props: stones, caps, stems, twigs, fern)."""
    m = bpy.data.materials.get(name)
    if m is not None:
        return m
    m, nt, b = _new_mat(name)
    tc = _node(nt, "ShaderNodeTexCoord", -900, 0)
    n = _noise(nt, _mapping(nt, tc.outputs["Object"], (scale, scale, scale), x=-700, y=0), 1.0, detail=4, rough=0.6, x=-500, y=0)
    mx = _node(nt, "ShaderNodeMix", -250, 0)
    mx.data_type = "RGBA"
    mx.inputs[0].default_value = 0.5
    _link(nt, n.outputs["Fac"], mx.inputs[0])
    mx.inputs[6].default_value = (*c0, 1.0)
    mx.inputs[7].default_value = (*c1, 1.0)
    _link(nt, mx.outputs[2], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    if sss:
        try:
            b.inputs["Subsurface Weight"].default_value = sss
        except Exception:
            pass
    return m


def _blob(name, r, sq, rng, mat, coll, sub=3, bump=0.25, seed=0.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    for v in bm.verts:
        k = 1 + bump * noise.noise(Vector((v.co.x / r * 1.3 + seed, v.co.y / r * 1.3, v.co.z / r * 1.3)))
        v.co = Vector((v.co.x * k * sq[0], v.co.y * k * sq[1], v.co.z * k * sq[2]))
    return _mesh_obj(name, bm, mat, coll)


def _wall_props(W, half, H, S, th, coll, adopt, moss_mat, seed=0, Wxy=None):
    """WALLPROPS: small physical clutter tucked along the wall bases in the moss strip (never on the squares):
    river stones, moss mounds, tiny mushroom clusters, a few fern fans and fallen twigs."""
    pr = random.Random(9001 + seed)
    gz = -th * 0.85  # soil level
    H0 = H
    H = H * float(os.environ.get("WALLPROPS_SCALE", "1.0"))  # prop sizes only; positions use S and the strip
    strip = W - half
    stone_m = _simple_mat("prop_stone", (0.10, 0.10, 0.09), (0.20, 0.19, 0.17), rough=0.85, scale=18)
    cap_m = _simple_mat("prop_cap", (0.42, 0.20, 0.09), (0.62, 0.36, 0.16), rough=0.6, scale=30, sss=0.15)
    stem_m = _simple_mat("prop_stem", (0.72, 0.66, 0.52), (0.85, 0.80, 0.66), rough=0.7, scale=50, sss=0.2)
    twig_m = _simple_mat("prop_twig", (0.10, 0.07, 0.045), (0.22, 0.16, 0.10), rough=0.9, scale=60)
    if os.environ.get("FERN_C"):  # deeper, desaturated olive: "dark r,g,b,light r,g,b" (linear)
        _fc = [float(x) for x in os.environ["FERN_C"].split(",")]
        fern_m = _simple_mat("prop_fern", tuple(_fc[:3]), tuple(_fc[3:6]), rough=0.75, scale=25,
                             sss=float(os.environ.get("FERN_SSS", 0.05)))
    else:
        fern_m = _simple_mat("prop_fern", (0.06, 0.13, 0.03), (0.16, 0.26, 0.06), rough=0.6, scale=25, sss=0.2)
    dens = float(os.environ.get("WALLPROPS", "1"))
    out = []
    walls = (("B", int(5 * dens)), ("L", int(4 * dens)), ("R", int(4 * dens)))
    Wx, Wy = Wxy or (W, W)  # a rectangle: W is its short-side square; longer walls get more groups
    if (Wx, Wy) != (W, W):
        walls = tuple((wl, int(round(ng * (Wx if wl == "B" else Wy) / W))) for wl, ng in walls)

    PIN = float(os.environ.get("WALLPROPS_IN", "0")) * S

    def place(wall, u, d, z):
        d = min(d + PIN, strip - 0.01 * S)
        dist = max(0.0, 1.0 - d / strip)  # sit on the perimeter moss bed (same height law as the bed)
        z = z - gz + (-th * 0.4 + (0.02 + 0.22 * dist ** 1.6) * H0) - 0.015 * H0
        if wall == "B":
            return Vector((u, Wy - d, z))
        if wall == "L":
            return Vector((-Wx + d, u, z))
        return Vector((Wx - d, u, z))

    k = 0
    for wall, ng in walls:
        U = Wx if wall == "B" else Wy  # this wall's half length
        lo = -U + (0.15 if wall == "B" else 0.55) * S
        for gi in range(ng):
            u0 = lo + (U - 0.15 * S - lo) * (gi + 0.5 + pr.uniform(-0.3, 0.3)) / ng
            kinds = pr.sample(("stone", "stone", "mound", "mush", "fern", "twig"), pr.choice((2, 3)))
            for kind in kinds:
                k += 1
                u = u0 + pr.uniform(-0.25, 0.25) * S
                if abs(u) > U - 0.08 * S:
                    continue
                if kind == "stone":
                    for s in range(pr.choice((1, 2, 3))):
                        r = pr.uniform(0.035, 0.075) * H
                        d = max(0.03 * S, min(strip - r * 0.8, pr.uniform(0.05, 0.16) * S))
                        o = _blob("PropStone_%d_%d" % (k, s), r, (1.0, pr.uniform(0.7, 0.95), pr.uniform(0.45, 0.6)), pr,
                                  stone_m, coll, sub=3, bump=0.22, seed=k + s * 3.1)
                        o.location = place(wall, u + pr.uniform(-0.08, 0.08) * S, d, gz + r * 0.25)
                        o.rotation_euler = (0, 0, pr.uniform(0, math.pi))
                        out.append(o)
                elif kind == "mound":
                    r = pr.uniform(0.07, 0.11) * H
                    d = max(0.03 * S, min(strip - r * 0.9, pr.uniform(0.06, 0.12) * S))
                    o = _blob("PropMound_%d" % k, r, (1.3, 1.0, 0.45), pr, moss_mat, coll, sub=3, bump=0.3, seed=k * 1.7)
                    o.location = place(wall, u, d, gz)
                    _add_fuzz(o, 2500, 0.012 * H, 0, 300 + k, radius=0.003 * H, tip=0.3)
                    out.append(o)
                elif kind == "mush":
                    for s in range(pr.choice((2, 3, 4))):
                        hgt = pr.uniform(0.05, 0.11) * H
                        rs = hgt * 0.13
                        d = pr.uniform(0.04 * S, max(0.05 * S, min(0.16 * S, strip - 0.05 * H)))
                        base = place(wall, u + pr.uniform(-0.06, 0.06) * S, d, gz)
                        lean = Vector((pr.uniform(-0.15, 0.15), pr.uniform(-0.15, 0.15), 1.0)).normalized()
                        pts = [base + lean * hgt * t for t in (0.0, 0.33, 0.66, 1.0)]
                        st = _limb("PropStem_%d_%d" % (k, s), pts, [rs * 1.25, rs, rs * 0.9, rs * 0.85], 8, stem_m, coll)
                        cr = hgt * pr.uniform(0.32, 0.45)
                        cp = _blob("PropCap_%d_%d" % (k, s), cr, (1.0, 1.0, 0.5), pr, cap_m, coll, sub=3, bump=0.08, seed=k + s)
                        cp.location = pts[-1] + Vector((0, 0, cr * 0.05))
                        out += [st, cp]
                elif kind == "fern":
                    d = min(strip - 0.03 * S, pr.uniform(0.04, 0.09) * S)
                    base = place(wall, u, d, gz)
                    inward = {"B": Vector((0, -1, 0)), "L": Vector((1, 0, 0)), "R": Vector((-1, 0, 0))}[wall]
                    along = Vector((1, 0, 0)) if wall == "B" else Vector((0, 1, 0))
                    for f in range(pr.choice((4, 5, 6))):
                        a = pr.uniform(-1.3, 1.3)
                        dr = (along * math.sin(a) + inward * 0.35 * math.cos(a)).normalized()
                        ln = pr.uniform(0.22, 0.34) * H
                        pts = []
                        for t in [i / 9 for i in range(10)]:
                            p = base + dr * ln * t * 0.9 + Vector((0, 0, ln * (0.9 * t - 0.75 * t * t)))
                            pts.append(p)
                        rad = [0.006 * H * (1 - 0.8 * t) for t in [i / 9 for i in range(10)]]
                        out.append(_limb("PropFrond_%d_%d" % (k, f), pts, rad, 5, fern_m, coll))
                        for i in range(2, 9):
                            t = i / 9
                            w = 0.045 * H * (1 - abs(t - 0.4) * 1.3)
                            if w <= 0.006 * H:
                                continue
                            side = dr.cross(Vector((0, 0, 1))).normalized()
                            for sg in (-1, 1):
                                lf = _blob("PropLeaf_%d_%d_%d_%d" % (k, f, i, sg), w * 0.5, (1.0, 0.32, 0.08), pr, fern_m, coll, sub=1, bump=0.0)
                                lf.location = pts[i] + side * sg * w * 0.45
                                lf.rotation_euler = Vector((0, 0, 1)).rotation_difference(Vector((0, 0, 1))).to_euler()
                                lf.rotation_euler[2] = math.atan2(side.y * sg, side.x * sg)
                                out.append(lf)
                else:  # twig
                    ln = pr.uniform(0.25, 0.45) * H
                    d = pr.uniform(0.05 * S, max(0.06 * S, strip - 0.08 * H))
                    a = pr.uniform(-0.35, 0.35)
                    along = Vector((1, 0, 0)) if wall == "B" else Vector((0, 1, 0))
                    inward = {"B": Vector((0, -1, 0)), "L": Vector((1, 0, 0)), "R": Vector((-1, 0, 0))}[wall]
                    dr = (along * math.cos(a) + inward * math.sin(a) * 0.3).normalized()
                    c = place(wall, u, d, gz + 0.012 * H)
                    pts = _bent_path(c - dr * ln / 2, dr, ln, 7, pr, up=0.04, wiggle=0.06, seed=k)
                    out.append(_limb("PropTwig_%d" % k, pts, [0.011 * H * (1 - 0.5 * i / 6) for i in range(7)], 6, twig_m, coll, lump=0.15, seed=k))
                    if pr.random() < 0.6:
                        b0 = pts[3]
                        bd = (dr + inward * 0.8 + Vector((0, 0, 0.15))).normalized()
                        pts2 = _bent_path(b0, bd, ln * 0.35, 4, pr, up=0.05, wiggle=0.05, seed=k + 9)
                        out.append(_limb("PropTwigB_%d" % k, pts2, [0.007 * H, 0.006 * H, 0.004 * H, 0.003 * H], 5, twig_m, coll))
    for o in out:
        adopt(o)
    return out


def _light_segments(W, Wx, Wy):
    """Where the short-side square's front lights go on a long board: a list of (dx, dy) offsets, one per
    short-side stretch, and the energy factor per copy. A square: [(0, 0)], 1.0.
    Wide (long in x): k = ceil(Wx/W) copies along the front, the first and last at the two ends (they overlap),
    sharing 0.8 * Wx/W times the square's light. Deep (long in y): the box is cut into k = ceil(Wy/W) strides of
    2*Wy/k front to back; the first stride's lights sit where the square's do (in front of the box), each
    further stride gets its own copy at full energy (build_stage aims the spots at their own stride and keeps the
    lantern single)."""
    if Wx == Wy:
        return [(0.0, 0.0)], 1.0
    if Wx > Wy:
        ratio = Wx / W
        k = max(2, int(math.ceil(ratio - 1e-6)))
        sp = Wx - W
        # 0.8: what spills past a square's side walls lands on the floor next door here (measured: x1.25 without)
        return [(-sp + 2 * sp * i / (k - 1), 0.0) for i in range(k)], 0.8 * ratio / k
    k = max(2, int(math.ceil(Wy / W - 1e-6)))
    stride = 2 * Wy / k
    return [(0.0, -(Wy - W) + i * stride) for i in range(k)], 1.0


def _stretch_line(ps, W, U):
    """Positions ps (ascending, on a wall of half length W) moved onto a wall of half length U >= W: the same
    margins at both ends and about the same spacing, so a longer wall gets more items, not wider gaps.
    Returns ps itself when U == W."""
    ps = list(ps)
    if U == W or not ps:
        return ps
    if len(ps) == 1:
        k = max(1, int(round(U / W)))
        return [-U + 2 * U * (i + 0.5) / k + ps[0] for i in range(k)]
    a, b = ps[0] - (U - W), ps[-1] + (U - W)
    gaps = len(ps) - 1
    n2 = max(gaps, int(round(gaps * (b - a) / (ps[-1] - ps[0]))))
    return [a + (b - a) * i / n2 for i in range(n2 + 1)]


def _tree_plan(W, strip, S, H, Wxy=None):
    """TREEPLAN: back-wall birches spaced irregularly (min gap >= 0.6x mean), side birches back/mid/forward,
    variants assigned so no two neighbours along the wall path share a model, each with its own yaw and
    height (+-10%). Runs a spacing / repeat check and raises if it fails."""
    pr = random.Random(int(os.environ.get("TREE_SEED", 31)))
    Wx, Wy = Wxy or (W, W)  # a rectangle: W is its short-side square, Wx/Wy the real half extents
    nb = int(os.environ.get("TREES_BACK", 5))
    ns = int(os.environ.get("TREES_SIDE", 3))
    nv = 1 + len([g for g in os.environ.get("BIRCH_GLBS", "").split(",") if g])
    span = float(os.environ.get("TREE_SPAN", 0.72)) * W
    if Wx != W:  # longer back wall: same corner margins, more trees at the same spacing
        nb = 1 + max(nb - 1, int(round((nb - 1) * (span + Wx - W) / span)))
        span += Wx - W
    gap = 2 * span / (nb - 1)
    for _ in range(500):
        jt = float(os.environ.get("TREE_JIT", 0.32))
        xs = sorted(-span + gap * i + pr.uniform(-jt, jt) * gap for i in range(nb))
        g = [b - a for a, b in zip(xs, xs[1:])]
        if min(g) >= float(os.environ.get("TREE_GMIN", 0.6)) * (sum(g) / len(g)) and (max(g) - min(g)) >= float(os.environ.get("TREE_UNEVEN", 0)) * (sum(g) / len(g)) and max(abs(x) for x in xs) <= span + 0.1 * gap:
            break
    back = [(x, Wy - (pr.uniform(0.25, 0.55) + float(os.environ.get("BIRCH_IN", 0))) * strip) for x in xs]
    fys = [0.45, -0.1, -0.62] if ns == 3 else [0.4 - 1.0 * i / max(1, ns - 1) for i in range(ns)]
    side = {}
    for sg in (-1, 1):
        if Wy == W:
            side[sg] = [(sg * (Wx - (pr.uniform(0.25, 0.5) + float(os.environ.get("BIRCH_IN", 0))) * strip),
                         (fy + pr.uniform(-0.08, 0.08)) * W) for fy in fys]
        else:  # longer side walls: same front/back margins, more trees at the same spacing (back to front)
            side[sg] = [(sg * (Wx - (pr.uniform(0.25, 0.5) + float(os.environ.get("BIRCH_IN", 0))) * strip),
                         y_ + pr.uniform(-0.08, 0.08) * W) for y_ in reversed(_stretch_line([fy * W for fy in reversed(fys)], W, Wy))]
    # wall path order: left side front->back, back left->right, right side back->front
    path = list(reversed(side[-1])) + back + side[1]
    path = [p for p in path]
    var, yaw = [], []
    for i in range(len(path)):
        choices = [v for v in range(nv) if not var or v != var[-1] or nv == 1]
        v = pr.choice(choices)
        var.append(v)
        while True:
            a = pr.uniform(0, 2 * math.pi)
            if not yaw or abs((a - yaw[-1][0] + math.pi) % (2 * math.pi) - math.pi) > math.radians(60):
                break
        yaw.append((a, pr.uniform(0.9, 1.1)))
    trunks = [(x, y, 0.14 * H * pr.uniform(0.85, 1.15)) for (x, y) in path]
    # ---- check ----
    mind = float(os.environ.get("TREE_MIND", 0.5)) * S
    dmin = min(math.hypot(a[0] - b[0], a[1] - b[1]) for i, a in enumerate(trunks) for b in trunks[i + 1:])
    rep_ = sum(1 for i in range(len(var) - 1) if var[i] == var[i + 1] and nv > 1)
    g = [b - a for a, b in zip(xs, xs[1:])]
    ok = dmin >= mind and rep_ == 0 and min(g) >= float(os.environ.get("TREE_GMIN", 0.6)) * sum(g) / len(g)
    print("CHECK trees n=%d variants=%d min_dist=%.2fS (limit %.2fS) back_gap_min/mean=%.2f adjacent_repeats=%d -> %s"
          % (len(trunks), nv, dmin / S, mind / S, min(g) / (sum(g) / len(g)), rep_, "OK" if ok else "FAIL"))
    print("CHECK trees order variants=%s yaw_deg=%s" % (var, [int(math.degrees(a)) % 360 for a, _ in yaw]))
    if not ok:
        raise RuntimeError("tree layout check failed")
    return trunks, var, yaw


def _hang_variants(W, S, H, top, hl, trunks, coll, adopt, Wxy=None):
    """HM_GLBS: several hanging-moss clump models placed by 1D Poisson-disk sampling along the top rail
    of each wall and over the trunk tops; never the same variant twice in a row; per instance scale +-35%,
    length 0.6-1.6x, yaw, mirror, hang height; random wider gaps where the dark hedge shows."""
    pr = random.Random(int(os.environ.get("HM_SEED", 77)))
    paths = [g for g in os.environ["HM_GLBS"].split(",") if g]
    meshes = [_import_glb_mesh(g, "hang", tint=_envf3("HM_TINT", (0.8, 0.9, 0.62)),
                               val=float(os.environ.get("HM_VAL", "0.7"))) for g in paths]
    # per-variant base length (fraction of HM_LEN) so wide/bushy models don't come out huge
    def blen(pth):
        for k, v in (("curtain", 0.42), ("bushy", 0.45), ("double", 0.75), ("wisp", 1.0), ("long", 1.0)):
            if k in pth:
                return v
        return 0.8
    bl = [blen(p_) for p_ in paths]
    gap = float(os.environ.get("HM_GAP", 0.55)) * S
    Wx, Wy = Wxy or (W, W)  # spacing-based: a longer wall simply gets more clumps
    front = -Wy + float(os.environ.get("HM_FRONT", 0.0)) * S
    spots = []  # (x, y, along-wall order key)
    for wall, (u0, u1) in (("L", (front, Wy - 0.2 * S)), ("B", (-Wx + 0.2 * S, Wx - 0.2 * S)), ("R", (Wy - 0.2 * S, front))):
        lo, hi = min(u0, u1), max(u0, u1)
        us, u = [], lo + pr.uniform(0, 0.5) * gap
        while u < hi:
            us.append(u)
            g_ = gap * (float(os.environ.get("HM_BACK_GAP", 1.0)) if wall == "B" else 1.0)
            u += g_ * pr.uniform(1.0, 1.7) * (2.2 if pr.random() < 0.18 else 1.0)  # Poisson-ish, some wide gaps
        if u0 > u1:
            us.reverse()
        for u in us:
            d_ = pr.uniform(0.08, 0.3) * S
            x, y = {"L": (-Wx + d_, u), "B": (u, Wy - d_), "R": (Wx - d_, u)}[wall]
            spots.append((x, y, float(os.environ.get("HM_BACK_LEN", 1.0)) if wall == "B" else float(os.environ.get("HM_SIDE", 1.0))))
    # trunk tops: insert each into the wall order next to its nearest spot
    for (tx, ty, _r) in trunks:
        j = min(range(len(spots)), key=lambda i: math.hypot(spots[i][0] - tx, spots[i][1] - ty))
        spots.insert(j + 1, (tx + pr.uniform(-0.05, 0.05) * S, ty, 1.0))
    var = []
    for i in range(len(spots)):
        avoid = set(var[-1:]) | (set(var[-2:-1]) if len(meshes) > 2 else set())
        var.append(pr.choice([v for v in range(len(meshes)) if v not in avoid] or [0]))
    out = []
    hw_ = float(os.environ.get("HM_W", 1.0))
    for k, ((x, y, lm_), v) in enumerate(zip(spots, var)):
        o = bpy.data.objects.new("HangVar%d_%d" % (v, k), meshes[v])
        s_ = pr.uniform(0.65, 1.35)
        zs = pr.uniform(0.6, 1.6)
        hz = hl * H * bl[v] * s_ * lm_
        mx = float(os.environ.get("HM_MAXL", 0.7)) * top  # never reaches the floor / squares
        if hz * zs > mx:
            zs = mx / hz * pr.uniform(0.72, 1.0)  # capped, but the capped ones still end at different heights
        drop = pr.uniform(0.0, 0.15) * H
        o.location = (x, y, top + 0.05 * H - hz * zs - drop)
        o.scale = (hz * hw_ * pr.choice((-1, 1)), hz * hw_ * pr.uniform(0.6, 1.0) * float(os.environ.get("HM_YD", 1.0)), hz * zs)
        o.rotation_euler = (0, 0, pr.uniform(-0.5, 0.5) if os.environ.get("HM_FACE") else pr.uniform(0, 6.283))
        coll.objects.link(o)
        adopt(o)
        out.append(o)
    reps = sum(1 for i in range(len(var) - 1) if var[i] == var[i + 1])
    print("CHECK hangmoss top=%.2fH lengths/H=%s" % (top / H, " ".join("%.1f" % (o.scale[2] / H) for o in out)))
    print("CHECK hangmoss n=%d variants=%d adjacent_repeats=%d -> %s" % (len(var), len(meshes), reps, "OK" if reps == 0 else "FAIL"))
    print("CHECK hangmoss order=%s" % "".join("ABCDEFGH"[v] for v in var))
    return out


def _olive(m, sat, val, hue=0.5):
    """In place: base colour through Hue/Saturation (sat < 1 desaturates, hue < 0.5 warms toward olive)."""
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return
    hs = nt.nodes.new("ShaderNodeHueSaturation")
    hs.inputs["Hue"].default_value = hue
    hs.inputs["Saturation"].default_value = sat
    hs.inputs["Value"].default_value = val
    bc = bsdf.inputs["Base Color"]
    if bc.links:
        nt.links.new(bc.links[0].from_socket, hs.inputs["Color"])
    else:
        hs.inputs["Color"].default_value = bc.default_value
    nt.links.new(hs.outputs["Color"], bc)
    for k in ("Subsurface Weight", "Subsurface"):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = min(bsdf.inputs[k].default_value, 0.05)


def _dark_copy(mat, f):
    """Copy of a material with its base colour multiplied by f (keeps textures and jitter)."""
    m = mat.copy()
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return m
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    mul.inputs[7].default_value = (f, f, f, 1.0)
    bc = bsdf.inputs["Base Color"]
    if bc.links:
        nt.links.new(bc.links[0].from_socket, mul.inputs[6])
    else:
        mul.inputs[6].default_value = bc.default_value
    nt.links.new(mul.outputs[2], bc)
    return m
