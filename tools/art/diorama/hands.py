"""Fingered fists for figures whose Meshy hands are open mitts (no finger bones).

king_motion.attach_fists makes one fused clay block with shallow grooves. Up close (the rook, 2026-11-23) Wesley
read it as "one big blob ... a nub" next to the mockup's clearly separate fingers. This builds a hand the way it
actually wraps a handle: a palm pad on the wrist side of the grip, four fingers (three segments each, knuckle bumps,
small gaps between them, middle finger longest, pinky thinnest) curling round the far side with the tips tucked back
toward the palm, and a thumb crossing over the index and middle fingers. The pieces are fused only at a small voxel
size so the gaps between fingers survive. Colour is sampled from the figure's own arm texture, with a felt bump.

Same fist dict as king_motion.attach_fists: m (frame relative to `bone`; x along the grip toward the tip end),
r, len (along the grip), gr (grip radius), wrist (forearm end in the fist frame), side. Extra keys: index ("+x" or
"-x": which end the index finger sits at, default +x), skin (RGB, else sampled).
"""
import bpy, math
import numpy as np
from mathutils import Vector, Matrix


def arm_skin(body, groups=("LeftArm", "RightArm", "LeftForeArm", "RightForeArm")):
    """median colour of the body's base texture under the bare-arm vertices (linear RGB)"""
    try:
        mat = body.data.materials[0]
        img = next(n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
        W, H = img.size
        px = np.array(img.pixels[:]).reshape(H, W, -1)[:, :, :3]
        gi = {g.index for g in body.vertex_groups if g.name in groups}
        uv = body.data.uv_layers.active.data
        cols = []
        for poly in body.data.polygons:
            for li in poly.loop_indices:
                vi = body.data.loops[li].vertex_index
                if any(ge.group in gi and ge.weight > 0.8 for ge in body.data.vertices[vi].groups):
                    u, v = uv[li].uv
                    cols.append(px[min(H - 1, int(v * H)) % H, min(W - 1, int(u * W)) % W])
        cs = np.array(cols)
        # skin only: pinkish samples (red above green above blue), not the leather cuffs or highlights
        pink = cs[(cs[:, 0] > cs[:, 1] + 0.05) & (cs[:, 1] > cs[:, 2]) & (cs[:, 0] > 0.45)]
        c = np.median(pink if len(pink) > 20 else cs, 0)
        if img.colorspace_settings.name.lower().startswith("srgb"):  # stored sRGB -> linear for the shader
            c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
        print("arm_skin %d samples, %d pink -> %s" % (len(cs), len(pink), np.round(c, 3)), flush=True)
        return tuple(float(x) for x in c)
    except Exception as e:  # no texture: the clay skin
        print("arm_skin fallback", e)
        return (0.88, 0.56, 0.42)


def skin_material(rgb):
    m = bpy.data.materials.new("felt_hand")
    m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = 0.85
    if "Sheen Weight" in b.inputs:
        b.inputs["Sheen Weight"].default_value = 0.25
    # felt: a fine noisy bump and a faint colour mottle
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 900.0; nz.inputs["Detail"].default_value = 8.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.35; bp.inputs["Distance"].default_value = 0.002
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.inputs["Factor"].default_value = 0.12
    mix.inputs["A"].default_value = (*rgb, 1); mix.inputs["B"].default_value = (rgb[0] * 0.8, rgb[1] * 0.75, rgb[2] * 0.75, 1)
    nz2 = nt.nodes.new("ShaderNodeTexNoise"); nz2.inputs["Scale"].default_value = 60.0
    nt.links.new(tc.outputs["Object"], nz2.inputs["Vector"])
    nt.links.new(nz2.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    return m


def _tube(bm, pts, rads, seg=14, ax=None, sx=1.0):
    """a tube through pts; with ax given, the cross-section is an oval sx times wider along ax"""
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = (ax - t * ax.dot(t)).normalized() if ax is not None else t.orthogonal().normalized(); c = t.cross(a)
        rings.append([bm.verts.new(p + rads[i] * (a * sx * math.cos(k * 2 * math.pi / seg) + c * math.sin(k * 2 * math.pi / seg)))
                      for k in range(seg)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    import bmesh
    for p, r in ((pts[0], rads[0]), (pts[-1], rads[-1])):
        s = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=10, radius=r)
        for v in s["verts"]:
            if ax is not None:  # oval end caps to match
                v.co += ax * v.co.dot(ax) * (sx - 1.0)
            v.co += p


def _blob(bm, centre, axes, radii, seg=24):
    """an ellipsoid: axes = three unit Vectors, radii = three floats"""
    import bmesh
    s = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=16, radius=1.0)
    for v in s["verts"]:
        q = v.co.copy()
        v.co = centre + axes[0] * q.x * radii[0] + axes[1] * q.y * radii[1] + axes[2] * q.z * radii[2]


def attach_fingered_fists(arm, body, fists, bone, K=None):
    import bmesh
    K = K or {}
    rgb = K.get("skin") or arm_skin(body)
    mat = skin_material(rgb)
    out = []
    for f in fists:
        L = f["len"]
        gr = f["gr"]
        ft = L / 4.0                         # one finger's share of the grip length
        fr = ft * K.get("fw", 0.43)          # finger radius (leaves a small gap between fingers)
        R = gr + fr * 1.02                   # finger centreline radius round the grip axis
        xs = 1.0 if f.get("index", "+x") == "+x" else -1.0
        wr = Vector(f.get("wrist", (0.0, 0.0, -2.0 * f["r"])))
        w = Vector((0.0, wr.y, wr.z)); w = w.normalized() if w.length > 1e-6 else Vector((0, 0, -1))
        thw = math.atan2(w.z, w.y)           # wrist side of the grip
        sg = K.get("curl", 1.0)              # which way the fingers wrap round
        def at(x, th, rad):
            return Vector((x, rad * math.cos(th), rad * math.sin(th)))
        bm = bmesh.new()
        # palm pad: on the wrist side of the grip, the length of the four fingers, flattened against the grip
        pc = at(0.0, thw, gr + fr * 1.15)
        nrm = Vector((0, math.cos(thw), math.sin(thw))); tang = Vector((0, -math.sin(thw), math.cos(thw)))
        _blob(bm, pc, (Vector((1, 0, 0)), nrm, tang), (L * 0.56, fr * 1.25, fr * 2.3))
        # fingers: start at the knuckle on one edge of the palm, curl round the far side, tips back by the palm
        names = ("index", "middle", "ring", "pinky")
        lens = (1.0, 1.08, 1.0, 0.82)
        thick = (1.0, 1.02, 0.97, 0.86)
        for k in range(4):
            x = xs * (L / 2 - ft * (k + 0.5))
            a0 = thw + sg * math.radians(K.get("k0", 75))            # knuckle (MCP) at the palm's edge
            span = math.radians(K.get("span", 250)) * lens[k]          # how far the finger wraps
            seg_n = 18
            pts, rads = [], []
            for j in range(seg_n + 1):
                u = j / seg_n
                th = a0 + sg * span * u
                # knuckles stand a little proud at the joints (u ~ 0, 0.42, 0.75); tip tapers
                bump = sum(K.get("kb", 0.0) * math.exp(-((u - c) / 0.06) ** 2) for c in (0.0, 0.42, 0.75))
                rr = fr * thick[k] * (1.0 + bump - 0.18 * max(0.0, u - 0.8) / 0.2)
                rad_c = R + (fr * K.get("kp", 0.0) if u < 0.12 else 0.0) * (1 - u / 0.12)  # the first knuckle sits proud of the grip
                pts.append(at(x, th, rad_c + rr - fr)); rads.append(rr)
            _tube(bm, pts, rads, ax=Vector((1, 0, 0)), sx=K.get("fsx", 1.0))
        # thumb: from the index end of the palm, over the index and middle fingers' middle segments
        tx0 = xs * (L / 2 + fr * 0.2)
        th0 = thw - sg * math.radians(K.get("t0", 30))
        th1 = thw + sg * math.radians(250 * 0.52 + K.get("k0", 75) - 360) if False else thw + sg * math.radians(K.get("t1", -95))
        pts, rads = [], []
        n = 14
        for j in range(n + 1):
            u = j / n
            th = th0 + (th1 - th0) * u
            x = tx0 - xs * ft * 1.5 * u
            pts.append(at(x, th, R + fr * (0.9 + 0.6 * math.sin(math.pi * u)))); rads.append(fr * 1.05 * (1.0 - 0.15 * u + K.get("kb", 0.0) * 0.8 * math.exp(-((u - 0.5) / 0.08) ** 2)))
        _tube(bm, pts, rads)
        # wrist: from inside the palm pad to the forearm's end
        p0 = pc - nrm * fr * 0.3; p1 = wr
        n = max(3, int((p1 - p0).length / (ft * 0.5)))
        _tube(bm, [p0.lerp(p1, k / n) for k in range(n + 1)], [ft * (1.1 + 0.15 * k / n) for k in range(n + 1)])
        me = bpy.data.meshes.new("hand_" + f["side"]); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new("hand_" + f["side"], me)
        bpy.context.scene.collection.objects.link(o)
        rm = o.modifiers.new("fuse", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = fr * K.get("vox", 0.09); rm.adaptivity = 0
        sm = o.modifiers.new("soft", "SMOOTH"); sm.factor = 0.5; sm.iterations = int(K.get("smooth", 3))
        dg = bpy.context.evaluated_depsgraph_get()
        me2 = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear(); o.data = me2
        for p in me2.polygons:
            p.use_smooth = True
        me2.materials.append(mat)
        mw = arm.matrix_world @ arm.pose.bones[bone].matrix @ Matrix(f["m"])
        o.parent = arm; o.parent_type = "BONE"; o.parent_bone = bone
        o.matrix_world = mw
        out.append(o)
    bpy.context.view_layer.update()
    return out
