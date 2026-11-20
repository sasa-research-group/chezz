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
import math
import numpy as np
import bpy
from mathutils import Quaternion, Matrix, Vector

LEGS = ("LeftUpLeg", "RightUpLeg")
SHINS = ("LeftLeg", "RightLeg", "LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")
ARMS = ("LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftShoulder", "RightShoulder")
CHIBI_RUN = dict(leg=0.62, knee=0.55, tuck=0.7, arms=0.55, spread=7.0, upright=6.0, bounce=1.7, armout=8.0)


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
    f0 = math.floor(f0) if start is None else start
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
    for n, (loc, q) in pose.items():
        pb = arm.pose.bones[n]
        pb.rotation_mode = "QUATERNION"
        pb.location = loc
        pb.rotation_quaternion = q
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
