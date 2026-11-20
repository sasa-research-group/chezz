# Motion for the pre-rendered king: a Meshy library clip turned into a short chibi loop, a held prop, and felt
# fibres that follow the deforming body. Used by bake_king_sprites.py (--clip) and preview_motion.py.
#
#   poses = loop_poses(arm, frames=14, **shape)   one dict per output frame: bone -> (location, quaternion)
#   apply_pose(arm, poses[i])                      set the pose directly (no action), then update the depsgraph
#   attach_prop(arm, glb, H)                       parent a mesh (the sword, later) to the right hand
#   FibreBinder(body, fibres)                      re-seat stage.py's felt_fibres curves on the posed body
#
# Shape knobs (all relative to the clip, so 1 / 0 = untouched). The library run is adult mocap: long strides,
# heels kicked to 30% of his height, a forward lean, feet close together. A small figure reads cute with short,
# quick steps, an upright body, a little bounce and feet apart.
#   leg, knee, arms  swing amplitude of thighs / shins+feet / arms about their mean over the cycle
#   tuck             fraction of the knee/ankle bend kept (lower heel kick; 1 = as the clip)
#   spread           extra degrees each leg turns out from the hip (feet apart; the foot turns back to stay flat)
#   upright          degrees the lower spine is tipped back
#   bounce           scale of the hips' up-down (and sway) about their mean
#   armout           degrees the upper arms are held out from the body (room for the belly and beard)
#   chin             degrees the head is tipped back (the run looks down at its feet)
import math
import numpy as np
import bpy
from mathutils import Quaternion, Matrix, Vector

LEGS = ("LeftUpLeg", "RightUpLeg")
SHINS = ("LeftLeg", "RightLeg", "LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")
ARMS = ("LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftShoulder", "RightShoulder")
CHIBI_RUN = dict(leg=0.62, knee=0.55, tuck=0.7, arms=0.55, spread=7.0, upright=6.0, bounce=1.7, armout=8.0)
# Round 2 (Wesley: "running a little too hard ... more like a deterministic speed walk/jog"): steady, upright,
# level, crown bob about 1-1.5% of his height, modest arms, low knees. Same cadence for both in the game.
GAITS = {
    "run": (CHIBI_RUN, "basic_animations_running_glb__running.glb"),
    # A: the library walk, sped up in the game; one foot always down
    "walk": (dict(leg=0.9, knee=0.8, tuck=0.85, arms=0.45, spread=7.0, upright=-2.6, bounce=0.4, armout=8.0),
             "basic_animations_walking_glb__walking.glb"),
    # B: the run toned down: half the chibi run's bounce and arm swing, lower knees, no lean
    "jog": (dict(leg=0.85, knee=0.3, tuck=0.3, arms=0.28, spread=7.0, upright=10.0, bounce=0.55, armout=8.0, chin=6.0),
            "basic_animations_running_glb__running.glb"),
}


def _local(arm, bone, R):
    """an armature-space rotation R (3x3) as a premultiplier for the bone's pose quaternion"""
    B = arm.data.bones[bone].matrix_local.to_3x3().normalized()
    return (B.inverted() @ R @ B).to_quaternion()


def _qmean(qs):
    a = np.array([list(q) for q in qs])
    a *= np.sign(a @ a[0])[:, None]  # same hemisphere as the first
    m = a.mean(0)
    return Quaternion(m / np.linalg.norm(m))


def loop_poses(arm, frames=14, period=None, start=None, **shape):
    """Sample the armature's action at `frames` even steps over one period (default: the action's range, which
    for the Meshy run is one stride pair ending where it began) and reshape it. Clears the action."""
    s = dict(CHIBI_RUN); s.update(shape)
    act = arm.animation_data.action
    f0, f1 = act.frame_range
    # the library clips hold their first key (at 0.8) before it, so a loop is [f0, f1) exactly
    f0 = f0 if start is None else start
    period = (f1 - f0) if period is None else period
    sc = bpy.context.scene
    raw = []
    for i in range(frames):
        t = f0 + period * i / frames
        sc.frame_set(int(math.floor(t)), subframe=t - math.floor(t))
        raw.append({pb.name: (pb.location.copy(), pb.rotation_quaternion.copy()) for pb in arm.pose.bones
                    if "CapeArm" not in pb.name})
    arm.animation_data.action = None
    names = list(raw[0])
    mean = {n: _qmean([r[n][1] for r in raw]) for n in names}
    hips_mean = sum((r["Hips"][0] for r in raw), Vector()) / frames
    Ry = lambda d: Matrix.Rotation(math.radians(d), 3, "Y")
    Rx = lambda d: Matrix.Rotation(math.radians(d), 3, "X")
    pre = {}
    if s["spread"]:
        L = s["spread"]
        pre.update(RightUpLeg=_local(arm, "RightUpLeg", Ry(L)), LeftUpLeg=_local(arm, "LeftUpLeg", Ry(-L)),
                   RightFoot=_local(arm, "RightFoot", Ry(-L)), LeftFoot=_local(arm, "LeftFoot", Ry(L)))
    if s["armout"]:
        A = s["armout"]
        pre.update(RightArm=_local(arm, "RightArm", Ry(A)), LeftArm=_local(arm, "LeftArm", Ry(-A)))
    if s["upright"]:
        pre["Spine02"] = _local(arm, "Spine02", Rx(-s["upright"]))
    if s.get("chin"):
        pre["Head"] = _local(arm, "Head", Rx(-s["chin"]))
    out = []
    for r in raw:
        p = {}
        for n in names:
            loc, q = r[n]
            k = s["leg"] if n in LEGS else s["knee"] if n in SHINS else s["arms"] if n in ARMS else 1.0
            if k != 1.0:
                q = mean[n].slerp(q, k)
            if n in SHINS and s["tuck"] != 1.0:
                q = Quaternion().slerp(q, s["tuck"])
            if n in pre:
                q = pre[n] @ q
            if n == "Hips":
                loc = hips_mean + (loc - hips_mean) * s["bounce"]
            p[n] = (loc, q)
        for side in ("Left", "Right"):  # fix_cape's bones: the arm's mean pose (with armout), no swing
            if side + "CapeArm" in arm.pose.bones:
                n = side + "Arm"
                p[side + "CapeArm"] = (Vector(), pre[n] @ mean[n] if n in pre else mean[n])
        out.append(p)
    return out


def gait_stats(arm, poses, H=1.7):
    """Numbers for a loop, in % of his height H: hips bounce, crown (head) bob, lean range (deg, + forward),
    heel lift, the narrowest gap between the feet, the longest stride, and `cycle`: how far the planted foot
    slides back over one loop. An in-place clip played while moving at cycle (x H) per loop keeps the feet
    planted. Leaves the last pose applied."""
    W = lambda n: arm.matrix_world @ arm.pose.bones[n].head
    st = []
    for p in poses:
        apply_pose(arm, p)
        h, hd, lf, rf = W("Hips"), W("Head"), W("LeftFoot"), W("RightFoot")
        v = hd - h
        st.append((h.z, hd.z, math.degrees(math.atan2(-v.y, v.z)), lf, rf))
    n = len(st)
    cyc = 0.0
    for i in range(n):
        a, b = st[i], st[(i + 1) % n]
        k = 3 if a[3].z <= a[4].z else 4  # the lower foot is the planted one
        cyc += max(0.0, b[k].y - a[k].y)  # forward is -y: a planted foot slides back (+y) under him
    rng = lambda xs: max(xs) - min(xs)
    return dict(bounce=100 * rng([s[0] for s in st]) / H, crown=100 * rng([s[1] for s in st]) / H,
                lean=(min(s[2] for s in st), max(s[2] for s in st)),
                heel=100 * max(max(s[3].z, s[4].z) - min(s[3].z, s[4].z) for s in st) / H,
                gap=100 * min(abs(s[3].x - s[4].x) for s in st) / H, stride=100 * max(abs(s[3].y - s[4].y) for s in st) / H,
                cycle=100 * cyc / H)


def fix_skirt(arm, body):
    """The tunic's hem is weighted to the legs, so in a stride it splits and juts out behind like a board.
    paid/fixanim.py moves that weight to the hips (rest-pose weights only; call before posing or baking)."""
    import os, sys
    sys.path.insert(0, os.path.expanduser("~/.dos/scratch/d84406ef/paid"))
    import fixanim
    return fixanim.fix_skirt(arm, body)


def fix_cape(arm, body, keep=0.15):
    """The cape is weighted to the arms (it was modelled under the T-pose arms), so it swings out behind like a
    board whenever an arm pumps back. Each side gets a CapeArm bone, a copy of the upper arm that loop_poses
    holds at the arm's mean pose over the cycle, and cape cloth (the dark red under the base-colour texture, on
    his back half) moves all but `keep` of its arm, forearm and hand weight onto it: the cape hangs where the
    arms hang but no longer pumps with them. Rest-pose weights; call before loop_poses."""
    import colorsys
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for side in ("Left", "Right"):
        src = arm.data.edit_bones[side + "Arm"]
        cb = arm.data.edit_bones.new(side + "CapeArm")
        cb.head, cb.tail, cb.roll = src.head.copy(), src.tail.copy(), src.roll
        cb.parent = src.parent
    bpy.ops.object.mode_set(mode="OBJECT")
    mat = body.material_slots[0].material
    base = next(n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image
                and n.image.colorspace_settings.name == "sRGB")
    w_, h_ = base.size
    tex = np.array(base.pixels[:], dtype=np.float32).reshape(h_, w_, 4)
    me = body.data
    uvl = me.uv_layers.active.data
    red = np.zeros(len(me.vertices)); cnt = np.zeros(len(me.vertices))
    for li, lp in enumerate(me.loops):
        u, v = uvl[li].uv
        r, g, b = tex[min(h_ - 1, int((v % 1) * h_)), min(w_ - 1, int((u % 1) * w_)), :3]
        hh, ss, vv = colorsys.rgb_to_hsv(r, g, b)
        red[lp.vertex_index] += (hh < 0.03 or hh > 0.95) and ss > 0.45 and vv < 0.6
        cnt[lp.vertex_index] += 1
    red = red / np.maximum(cnt, 1)
    mw = body.matrix_world
    gi = {g.name: g.index for g in body.vertex_groups}
    n = 0
    for side in ("Left", "Right"):
        src = {gi[b] for b in (side + "Arm", side + "ForeArm", side + "Hand") if b in gi}
        dst = body.vertex_groups.new(name=side + "CapeArm")
        for v in me.vertices:
            if red[v.index] < 0.5 or (mw @ v.co).y < 0.0:  # forward is -y: the back half only
                continue
            moved = 0.0
            for g in v.groups:
                if g.group in src and g.weight > 0:
                    d = g.weight * (1 - keep); g.weight -= d; moved += d
            if moved > 0:
                dst.add([v.index], moved, "ADD"); n += 1
    print("CAPE verts moved to the CapeArm bones: %d" % n, flush=True)
    return n


def apply_pose(arm, pose):
    for n, v in pose.items():
        pb = arm.pose.bones[n]
        pb.rotation_mode = "QUATERNION"
        pb.location = v[0]
        pb.rotation_quaternion = v[1]
        if len(v) > 2:
            pb.scale = v[2]
    bpy.context.view_layer.update()


def attach_prop(arm, path, H, bone="RightHand", length=0.75, grip=0.86, palm=0.05):
    """Hook for the held prop (the sword, once designed): import a glb whose long axis is X (blade toward -X,
    pommel +X, as paid/out/sword), scale it to `length` x H, put the point `grip` along it in the palm and
    parent it to the hand bone, so every clip and heading carries it. Returns the object."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    pr = next(o for o in new if o.type == "MESH")
    pr.parent = None
    me = pr.data
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    lo, hi = co.min(0), co.max(0)
    L = hi[0] - lo[0]
    g = Vector((lo[0] + grip * L, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
    me.transform(Matrix.Rotation(math.radians(90), 4, "Z") @ Matrix.Scale(length * H / L, 4) @ Matrix.Translation(-g))
    b = arm.data.bones[bone]
    head = arm.matrix_world @ b.head_local
    elbow = arm.matrix_world @ b.parent.head_local
    hand = head + (head - elbow).normalized() * H * palm
    pr.parent = arm; pr.parent_type = "BONE"; pr.parent_bone = bone
    bpy.context.view_layer.update()
    pr.matrix_world = Matrix.Translation(hand)
    for o in new:
        if o is not pr:
            bpy.data.objects.remove(o)
    return pr


def load_guard(path):
    """sword/guard_pose.py's output: the idle guard pose ({bone: (loc, quat)}) and how the sword sits in the hand"""
    import json
    g = json.load(open(path))
    pose = {n: (Vector(v[0]), Quaternion(v[1])) + ((Vector(v[2]),) if len(v) > 2 else ()) for n, v in g["pose"].items()}
    return pose, g


def attach_held(arm, path, g, bone=None):
    """Put the sword (a glb, long axis X, blade toward -X) where guard_pose.py placed it: scaled to
    g["sword_world_length"], its grip point (g["grip"] along it) at the origin, then g["sword_in_hand"] relative to
    the hand bone, parented to that bone. Call with the guard pose applied. Returns the object."""
    bone = bone or g.get("bone", "RightHand")  # the forearm when the hands are shrunk into fists
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    pr = next(o for o in new if o.type == "MESH")
    pr.parent = None
    me = pr.data
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    lo, hi = co.min(0), co.max(0)
    L = hi[0] - lo[0]
    grip = Vector((lo[0] + g["grip"] * L, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
    me.transform(Matrix.Scale(g["sword_world_length"] / L, 4) @ Matrix.Translation(-grip))
    for o in new:
        if o is not pr:
            bpy.data.objects.remove(o)
    bpy.context.view_layer.update()
    mw = arm.matrix_world @ arm.pose.bones[bone].matrix @ Matrix(g["sword_in_hand"])
    pr.parent = arm; pr.parent_type = "BONE"; pr.parent_bone = bone
    pr.matrix_world = mw
    bpy.context.view_layer.update()
    attach_fists(arm, g, bone)
    return pr


SKIN = (0.88, 0.56, 0.42)  # linear; his clay hands and face


def attach_fists(arm, g, bone="RightHand"):
    """The rig's hands are open mitts that can't close on a grip, so guard_pose.py shrinks them into the wrist
    and stores a fist per hand (g["fists"]: frame relative to `bone`, x along the grip toward the tip, radius r,
    optional grip radius "gr", fist length "len" along the grip and "wrist" point in the fist frame).
    Each fist is modelled like a clay hand closed on a handle: a back-of-hand pad on the wrist side, four
    finger rolls curled round the grip (index by the guard), a thumb wrapped over the index finger, and a
    short wrist that runs to the forearm so the fist never floats. The parts are voxel-fused into one smooth
    clay piece. Returns the objects."""
    import bmesh
    m = bpy.data.materials.get("clay_fist") or bpy.data.materials.new("clay_fist")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*SKIN, 1); b.inputs["Roughness"].default_value = 0.6
    out = []

    def tube(bm, pts, rad, seg=12):
        """a round tube through pts (Vectors) with radius rad (float or list), capped with half-spheres"""
        rads = rad if isinstance(rad, list) else [rad] * len(pts)
        rings = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            a = t.orthogonal().normalized(); c = t.cross(a)
            rings.append([bm.verts.new(p + rads[i] * (a * math.cos(k * 2 * math.pi / seg) + c * math.sin(k * 2 * math.pi / seg)))
                          for k in range(seg)])
        for r0, r1 in zip(rings, rings[1:]):
            for k in range(seg):
                bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
        for p, r in ((pts[0], rads[0]), (pts[-1], rads[-1])):
            s = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=8, radius=r)
            for v in s["verts"]:
                v.co += p

    for f in g.get("fists", []):
        r = f["r"]
        L = f.get("len", 2.1 * r) * 0.95          # along the grip
        gr = f.get("gr", 0.35 * r)         # grip radius
        ft = L / 4.0                       # one finger's width
        wr = Vector(f.get("wrist", (0.0, 0.0, -2.0 * r)))
        w = Vector((0.0, wr.y, wr.z))
        w = w.normalized() if w.length > 1e-6 else Vector((0, 0, -1))
        phw = math.atan2(w.z, w.y)        # angle of the wrist side round the grip (in the y-z plane)
        # the back of the hand faces out, toward the viewer (+z), turned a little toward the wrist, like a
        # sword guard: knuckles forward, fingers curled round the far side of the grip
        pv = Vector((0, 0.45 * w.y, 1.0)).normalized()
        php = math.atan2(pv.z, pv.y)
        tg = Vector((0, -math.sin(php), math.cos(php)))
        sg = -1.0 if tg.dot(w) > 0 else 1.0  # sweep away from the wrist first
        def ring(x, ang, rad):
            return Vector((x, rad * math.cos(ang), rad * math.sin(ang)))
        bm = bmesh.new()
        # the fist: one rounded, slightly boxy clay block round the grip (no separate finger pieces, which
        # read as beads), shifted toward the back of the hand, with three shallow grooves between the fingers
        # on the side where the fingers curl round
        n, t = Vector((0, math.cos(php), math.sin(php))), Vector((0, -math.sin(php), math.cos(php)))
        R0 = gr + ft * 1.15
        c = n * (R0 * 0.6)  # inside the back of the hand: where the wrist starts
        blk = bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=1.0)
        for v in blk["verts"]:
            q = v.co.copy()
            sx = math.copysign(abs(q.x) ** 0.55, q.x)
            sy = math.copysign(abs(q.y) ** 0.8, q.y)
            sz = math.copysign(abs(q.z) ** 0.8, q.z)
            x = sx * L * 0.5
            p_ = n * (sy * R0 * 1.0 + ft * 0.35) + t * (sz * R0 * 1.05)
            ang = math.atan2(p_.dot(t), p_.dot(n)) * sg  # 0 at the back of the hand, + toward the curl side
            # grooves between fingers, only where the fingers wrap (not on the back of the hand)
            wrap = max(0.0, min(1.0, (math.degrees(ang) - 25) / 30)) if ang > 0 else max(0.0, min(1.0, (-math.degrees(ang) - 120) / 30))
            gdep = 0.0
            for k in (1, 2, 3):
                gdep += math.exp(-((x - (L / 2 - ft * k)) / (ft * 0.13)) ** 2)
            rad = p_.length * (1 - 0.06 * wrap * gdep)
            v.co = Vector((x, 0, 0)) + p_.normalized() * rad
        # thumb: along the guard edge, from behind the pad on the wrist side, over the index finger to the front
        a0, a1 = php - sg * math.radians(40), php + sg * math.radians(55)
        pts = [ring(L / 2 - ft * 0.55, a0 + (a1 - a0) * k / 10, R0 * (0.75 + 0.35 * min(1.0, k / 4)) + ft * 0.1) for k in range(11)]
        tube(bm, pts, [ft * (0.55 - 0.08 * k / 10) for k in range(11)])
        # wrist: from the pad to the forearm's end
        p0 = c + Vector((0, 0, 0)); p1 = wr
        n = max(3, int((p1 - p0).length / (ft * 0.5)))
        tube(bm, [p0.lerp(p1, k / n) for k in range(n + 1)], [ft * (1.05 + 0.15 * k / n) for k in range(n + 1)])
        me = bpy.data.meshes.new("fist_" + f["side"]); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new("fist_" + f["side"], me)
        bpy.context.scene.collection.objects.link(o)
        # fuse the parts into one clay piece, then smooth it
        rm = o.modifiers.new("fuse", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = ft * 0.10; rm.adaptivity = 0
        sm = o.modifiers.new("soft", "SMOOTH"); sm.factor = 0.6; sm.iterations = 5
        dg = bpy.context.evaluated_depsgraph_get()
        me2 = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear(); o.data = me2
        for p in me2.polygons:
            p.use_smooth = True
        me2.materials.append(m)
        mw = arm.matrix_world @ arm.pose.bones[bone].matrix @ Matrix(f["m"])
        o.parent = arm; o.parent_type = "BONE"; o.parent_bone = bone
        o.matrix_world = mw
        out.append(o)
    bpy.context.view_layer.update()
    return out


class FibreBinder:
    """stage._felt_fibres builds its hair curves once, in world space, from the body as posed then. This ties
    every curve point to the root's triangle: its offset in that triangle's frame (edge, normal) is kept, and
    update() rebuilds the points on the body as currently posed, so the fuzz rides on the moving cloth."""

    def __init__(self, body, fibres):
        import stage
        self.body, self.ob = body, fibres
        b = stage.FIBRE_ROOTS[fibres.data.name]
        self.tri, self.bary, self.npts = b["tri"], b["bary"], b["npts"]
        hc = fibres.data
        pos = np.empty(len(hc.points) * 3); hc.attributes["position"].data.foreach_get("vector", pos)
        W = np.array(fibres.matrix_world)
        pos = pos.reshape(-1, 3) @ W[:3, :3].T + W[:3, 3]
        root, F = self._frames()
        rep = np.repeat(np.arange(len(self.tri)), self.npts)  # curve of each point (matted 5, flyaways 6)
        self.off = np.einsum("nij,nj->ni", F[rep], pos - root[rep])  # world -> (edge, side, normal)
        self.rep = rep

    def _frames(self):
        dg = bpy.context.evaluated_depsgraph_get()
        ev = self.body.evaluated_get(dg)
        me = ev.to_mesh()
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        ev.to_mesh_clear()
        M = np.array(ev.matrix_world)
        co = co @ M[:3, :3].T + M[:3, 3]
        a, b, c = co[self.tri[:, 0]], co[self.tri[:, 1]], co[self.tri[:, 2]]
        root = a * self.bary[:, :1] + b * self.bary[:, 1:2] + c * self.bary[:, 2:3]
        e = b - a; e /= np.linalg.norm(e, axis=1)[:, None]
        n = np.cross(b - a, c - a); n /= np.maximum(np.linalg.norm(n, axis=1)[:, None], 1e-12)
        s = np.cross(n, e)
        return root, np.stack([e, s, n], 1)  # rows: the frame's axes

    def update(self):
        root, F = self._frames()
        pos = root[self.rep] + np.einsum("nji,nj->ni", F[self.rep], self.off)
        W = np.array(self.ob.matrix_world.inverted())
        pos = pos @ W[:3, :3].T + W[:3, 3]
        self.ob.data.attributes["position"].data.foreach_set("vector", pos.astype(np.float32).ravel())
        self.ob.data.update_tag()
        bpy.context.view_layer.update()
