# Pre-render the white king (Cycles king A, exactly as in the r17 hero) at 8 headings for the browser.
#
#   cd <stage dir> && source tools/base_r78.env && \
#   Blender -b --python tools/art/diorama/bake_king_sprites.py -- --out DIR [--res 3600 --samples 256 --only 0,1]
#
# The stage is built as for the set bake (same lights, felt fibres, KING_RIM backlight, crown glow), the king
# stands on the 5x5 centre square in the r17 pose (arms relaxed), and the locked play camera (35 deg, 50 mm)
# renders only him: every other object is hidden from the camera but still lights, bounces and shadows him.
# Film is transparent and cropped to one rectangle that holds him at every heading.
#
# Writes into --out, per heading k (k * 45 deg, 0 = toward the camera, 90 = his right turn toward +x):
#   king{k}.png        straight-alpha RGBA, Standard view + exposure, like set{N}.webp
#   king{k}-glow.png   what is brighter than 1.0 (the crown), sqrt((L - 1) / glowK), like set{N}-glow.png
#   king.json          crop, the camera-parallel quad the browser draws him on, anchors and timings
#
# --clip GLB --frames N bakes a loop instead (king_motion.py): the Meshy clip is resampled to N frames and reshaped
# for the chibi body (CHIBI_RUN), the cape and hem reweighted so they don't swing like boards, and the felt fibres
# (built in the r17 pose exactly as for the still king, then bound to their root triangles) re-seated on the
# posed body every frame. --gait walk|jog|run picks shape and clip from king_motion.GAITS. Writes {gait}{k}_{i}.png /
# -glow.png and {gait}.json (with `cycle`, the ground one loop covers with the feet planted); the crop holds every frame.
# --check check.json bakes the "in check" loop (check_pose.py) the same way, with nervous_face.py's worried face
# applied at rest first. Writes check{k}_{i}.png and check.json.
# --death death.json bakes the checkmate death (death_pose.py) the same way, played once: the face (nervous_face.py)
# is woe (worried brows, open frown) until he lands and dead (X eyes, tongue out) after; both sets are built at rest
# and each frame shows the one its solve asked for (knobs.nervous 3 = dead). Writes death{k}_{i}.png and death.json.
# PROP=path.glb puts a held prop (the sword, later) in his right hand for any bake (king_motion.attach_prop).
# GUARD=guard.json (with PROP=the sword) bakes the still king in the sword guard instead of arms relaxed: the pose
# and the sword's place in his hand come from sword/guard_pose.py (king_motion.load_guard / attach_held).
# --strike strike.json (with PROP=the sword) bakes the sword strike (strike_pose.py): one solved guard_pose per
# frame, the sword and both fists re-placed every frame from that frame's solve. Writes strike{k}_{i}.png and
# strike.json (with fps, the hit frame and the ground the leap covers, `travel`).
import bpy, sys, os, math, json, time, argparse
import numpy as np
from mathutils import Vector, Matrix, Quaternion
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import gpu_retry  # renders again in place after a Metal GPU reset
# CYCLES_KOPT=OFF|INTERSECT|FULL sets Cycles' Metal kernel optimization for this run (not saved). Unset: Blender's
# default. The "full" background compiles ran MTLCompilerService out of memory (2026-11-18, -20), but the GPU
# resets ("InnocentVictim") went on with OFF too, so it is not the fix.
# Set after read_factory_settings, which resets the preferences.
def light_kernels():
    try:
        if not os.environ.get("CYCLES_KOPT"):
            return
        _cp = bpy.context.preferences.addons["cycles"].preferences
        _cp.kernel_optimization_level = os.environ["CYCLES_KOPT"]
        print("CHECK cycles kernel optimization", _cp.kernel_optimization_level, flush=True)
    except Exception as _e:
        print("CHECK cycles kernel optimization not set:", _e, flush=True)

STAGE = os.environ.get("STAGE_DIR", os.path.expanduser("~/.dos/scratch/d84406ef/stage"))
sys.path.insert(0, STAGE)
import stage
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--res", type=int, default=3600)
ap.add_argument("--samples", type=int, default=256)
ap.add_argument("--only", default="")  # headings to (re)render, e.g. "3,4"; default all missing
ap.add_argument("--glow_k", type=float, default=16.0)
ap.add_argument("--clip", default="")  # a Meshy animation glb (same mesh and rig): bake its loop
ap.add_argument("--frames", type=int, default=14)
ap.add_argument("--strike", default="")  # strike_pose.py's strike.json: bake the sword strike
ap.add_argument("--check", default="")  # check_pose.py's check.json: bake the "in check" loop, with the worried face
ap.add_argument("--death", default="")  # death_pose.py's death.json: bake the checkmate death, woe then dead face
ap.add_argument("--gait", default="")  # run|walk|jog: shape (and clip, unless --clip) from king_motion.GAITS
a = ap.parse_args(argv)
EL, FOCAL, ZOOM5, LA, ASPECT = 35.0, 50.0, 0.255, 0.21, 4.0 / 3.0
# CHAR_GLB=path bakes another rigged Meshy figure (same 24-bone rig) in place of the king, e.g. the patrol guard
KING = os.path.expanduser(os.environ.get("CHAR_GLB") or "~/.dos/scratch/d84406ef/paid/out/rig/rigged_character_glb__rigged_character.glb")
T0 = time.time()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import king_motion as km
SHAPE = None
if a.gait:
    SHAPE, _g = km.GAITS[a.gait]
    a.clip = a.clip or os.path.join(os.path.dirname(KING), _g)
elif a.clip:
    SHAPE = km.CHIBI_RUN
NAME = "strike" if a.strike else "check" if a.check else "death" if a.death else (a.gait or "run") if a.clip else "king"
# the check loop is baked like the strike: one whole guard_pose solve per frame (it just never leaves the spot)
STRIKE = json.load(open(a.strike or a.check or a.death)) if (a.strike or a.check or a.death) else None
GAIT = None

# --- the king, posed and measured exactly as tools/render_v4.py does for the hero
bpy.ops.wm.read_factory_settings(use_empty=True)
light_kernels()
bpy.ops.import_scene.gltf(filepath=a.clip or KING)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.parent is None:
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
body = next(o for o in bpy.data.objects if o.type == "MESH" and o.parent is arm)
if a.check or a.death:
    import nervous_face
    nervous_face.use(os.environ.get("FACE", ""))  # FACE=guard: the patrol guard's face measurements
if a.check:  # at rest, before the felt is built on him: the warp and the repainted eyes go into the shells too
    FACE = nervous_face.apply(arm, body)
MOOD = {}  # the death's two faces, shown per frame
if a.death:
    MOOD["woe"] = nervous_face.apply(arm, body, "woe")
    MOOD["dead"] = nervous_face.pieces(arm, body, "dead")
poses = []
if a.clip:
    km.fix_skirt(arm, body)
    if not os.environ.get("NOCAPE"):  # the guard has no cape (its red-cloth test would catch his brown hair)
        km.fix_cape(arm, body)
    poses = km.loop_poses(arm, frames=a.frames, **SHAPE)
    if os.environ.get("GUARD"):  # carrying the sword: the gait's legs under the idle guard's upper body
        _gp, GUARD_LOOP = km.load_guard(os.environ["GUARD"])
        poses = km.hold_guard(arm, poses, _gp, steady=float(os.environ.get("STEADY", "0.5")))
    for pb in arm.pose.bones:  # back to rest, then the r17 pose: the stage, felt and lights are built in it
        pb.rotation_mode = "QUATERNION"
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
stage.relax_arms(arm)
GUARD = GUARD_LOOP if a.clip and os.environ.get("GUARD") else None
if STRIKE:  # every frame is a whole guard_pose solve: pose, sword in the forearm's frame, fists
    def _pose(g):
        return {n: (Vector(v[0]), Quaternion(v[1])) + ((Vector(v[2]),) if len(v) > 2 else ()) for n, v in g["pose"].items()}
    poses = [_pose(g) for g in STRIKE["frames"]]
    GUARD = STRIKE["frames"][0]
    km.apply_pose(arm, poses[0])
if os.environ.get("GUARD") and not a.clip:  # the idle guard with the sword (sword/guard_pose.py)
    _gp, GUARD = km.load_guard(os.environ["GUARD"])
    km.apply_pose(arm, _gp)
if a.clip:
    for side in ("Left", "Right") if not os.environ.get("NOCAPE") else ():
        arm.pose.bones[side + "CapeArm"].rotation_quaternion = arm.pose.bones[side + "Arm"].rotation_quaternion.copy()
bpy.context.view_layer.update()
def under(o):
    while o is not None:
        if o is arm:
            return True
        o = o.parent
    return False
def king_points():
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in bpy.data.objects:
        if o.type == "MESH" and under(o):
            e = o.evaluated_get(dg)
            m = e.to_mesh()
            co = np.empty(len(m.vertices) * 3, np.float32); m.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)
            M = np.array(e.matrix_world)
            pts.append(co @ M[:3, :3].T + M[:3, 3])
            e.to_mesh_clear()
    return np.concatenate(pts)
P = king_points()
mn, mx = P.min(0), P.max(0)
H = float(mx[2] - mn[2])
print("FIG H", H, flush=True)
arm.location += Vector((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2]))
bpy.context.view_layer.update()
os.environ["STAGE_NOCOMP"] = "1"  # bloom, grade, vignette and grain run in the browser
sc = bpy.context.scene
t = time.time()
stage.build_stage(sc, H, center=(0, 0), board=5)
SKIN_MAT = None
if GUARD is not None and "hammer_in_forearm" in GUARD:  # the rook (idle via GUARD, or his strike's frame 0)
    SKIN_MAT = body.material_slots[0].material.copy()  # the hands' felt skin: the body's material, before clay_ify
stage.clay_ify(arm)
binder = None
if STRIKE and "hammer_in_forearm" not in GUARD:  # the king's tunic hem follows the thighs; in his crouch it swung
    km.fix_skirt(arm, body)  # through the floor (king_motion.fix_skirt). The rook wears trousers: no hem to fix
if a.clip or STRIKE:
    binder = km.FibreBinder(body, bpy.data.objects["felt_fibres"])  # bound in the pose they were grown in
    # stand the loop on the floor: the lowest point over the cycle touches it (the rest is airborne bounce)
    zlo = []
    for ps in poses:
        km.apply_pose(arm, ps)
        zlo.append(float(king_points()[:, 2].min()))
    arm.location.z -= zlo[0] if STRIKE else min(zlo)  # the strike stands on its first (standing) frame
    print("CHECK loop floor lift %.4f (H %.3f), airborne max %.4f" % (-min(zlo), H, max(zlo) - min(zlo)), flush=True)
    GAIT = km.gait_stats(arm, poses, H=H) if a.clip else None
    if GAIT:
        print("GAIT bounce %.1f%%H crown %.1f%%H lean %.1f..%.1f heel %.0f%%H cycle %.1f%%H" % (
            GAIT["bounce"], GAIT["crown"], *GAIT["lean"], GAIT["heel"], GAIT["cycle"]), flush=True)
HELD = {}  # the strike's sword and fists, re-placed per frame
def pose(i):
    if binder is not None:
        km.apply_pose(arm, poses[i])
        if HELD.get("hands") is not None:  # the rook's strike: the carried hammer and fingered fists, per frame
            g = STRIKE["frames"][i]
            hb = g.get("hammer_bone", "LeftForeArm")
            HELD["prop"].matrix_world = arm.matrix_world @ arm.pose.bones[hb].matrix @ Matrix(g["hammer_in_forearm"])
            for h_, f in zip(HELD["hands"], g["fists"]):
                h_.matrix_world = arm.matrix_world @ arm.pose.bones[hands_mod.fist_bone(f)].matrix @ Matrix(f["m"])
            bpy.context.view_layer.update()
        elif HELD:
            g = STRIKE["frames"][i]
            B = arm.matrix_world @ arm.pose.bones[g.get("bone", "RightForeArm")].matrix
            HELD["sword"].matrix_world = B @ Matrix(g["sword_in_hand"])
            for f in g["fists"]:
                HELD["fist_" + f["side"]].matrix_world = B @ Matrix(f["m"])
            bpy.context.view_layer.update()
        if MOOD:
            dead = STRIKE["frames"][i]["knobs"].get("nervous", 0) >= 3
            for n, obs in MOOD.items():
                for o in obs:
                    o.hide_render = o.hide_viewport = (n == "dead") != dead
            bpy.context.view_layer.update()
        binder.update()
if a.clip or STRIKE:
    pose(0)
if os.environ.get("PROP") and GUARD is not None and "hammer_in_forearm" in GUARD:  # rook_pose.py: a carried prop
    import hands  # and fingered fists, clay like the king's (after clay_ify, as the sword below)
    for md in body.modifiers:
        if md.type == "ARMATURE":  # the shoulder carry's tight elbow keeps its volume (FIGURES.md)
            md.use_deform_preserve_volume = bool(GUARD.get("knobs", {}).get("dqs", 0))
    pr, _hs = hands.attach_carried(arm, body, os.environ["PROP"], GUARD)
    for s_ in pr.material_slots:
        stage._clay_material(s_.material, stage._local_dims_world(pr), H, 1.0, 1.0)
    # the hands wear the body's own skin (same felt, tone and fibres as his arms). The body's height cuts (crown,
    # collar, jewels) would hit a small hand by its own height, and a second rim light would double the rim: off here
    _off = ("KCROWN_Z", "COLLAR_Z", "SKIN_HMAX", "CROWN_ALL", "FUR_CROWN_Z", "JEWEL_Z", "KING_RIM")
    _saved = {k: os.environ.pop(k) for k in _off if k in os.environ}
    os.environ["KCROWN_Z"] = os.environ["FUR_CROWN_Z"] = "9"
    _uv = hands.skin_uv(body)
    _hm = stage._clay_material(SKIN_MAT, stage._local_dims_world(body), H, 1.0, 1.0) or SKIN_MAT
    for h_ in _hs:
        hands.wear_body_skin(h_, SKIN_MAT, _uv)
        if os.environ.get("KING_FUR"):
            _before = set(bpy.data.objects)
            # as dense as on his body: the fibre counts are per figure, so scale them by the hand's share of the area
            def _area(o_):
                sc_ = o_.matrix_world.to_scale()
                return sum(p_.area for p_ in o_.data.polygons) * abs(sc_[0] * sc_[1])
            _frac = _area(h_) / max(1e-9, _area(body) * 0.72)  # ~72% of his surface is felt (cloth and skin)
            _n0 = {k: os.environ.get(k) for k in ("KING_FIBRES", "FLY_N", "FIB_L", "FLY_L", "SHELL_L")}
            for k, d_ in (("KING_FIBRES", 120000), ("FLY_N", 900)):
                os.environ[k] = str(max(1, int(float(_n0[k] or d_) * _frac)))
            # lengths are per figure height too: body-length fibres turn a small hand into a pom-pom (felt/close5),
            # so the hand's nap is HAND_FIB_K as long and it keeps only HAND_FLY of its share of stray hairs
            _hk = float(os.environ.get("HAND_FIB_K", 0.4))
            for k, d_ in (("FIB_L", 0.025), ("FLY_L", 0.07), ("SHELL_L", 0.008)):
                os.environ[k] = str(float(_n0[k] or d_) * _hk)
            os.environ["FLY_N"] = str(int(int(os.environ["FLY_N"]) * float(os.environ.get("HAND_FLY", 0.2))))
            print("CHECK hand %s felt share %.3f fibres %s fly %s" % (h_.name, _frac, os.environ["KING_FIBRES"], os.environ["FLY_N"]), flush=True)
            stage._felt_fur(h_, H)
            for k, v_ in _n0.items():
                if v_ is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v_
            _rc = bpy.data.collections.get("KingRimRecv")
            for o_ in set(bpy.data.objects) - _before:  # the hand's fibres and shells catch the body's rim light
                if _rc is not None and o_.name not in _rc.objects:
                    _rc.objects.link(o_)
                if o_.parent is None:  # the fibres are grown in world space: pin them to the hand, so they move with
                    o_.parent = h_  # it when the strike re-places the hand every frame
                    o_.matrix_parent_inverse = h_.matrix_world.inverted()
    for k in ("KCROWN_Z", "FUR_CROWN_Z"):
        os.environ.pop(k, None)
    os.environ.update(_saved)
    if STRIKE:  # re-placed every frame by pose(): the hammer and fists move with each frame's solve
        hands_mod = hands
        HELD.update(prop=pr, hands=_hs)
        pose(0)
    print("CHECK hands wear body skin at uv", tuple(round(x, 3) for x in _uv), flush=True)
    print("CHECK carried prop", pr.name, tuple(round(x, 3) for x in pr.matrix_world.translation), len(_hs), "hands", flush=True)
elif os.environ.get("PROP") and GUARD is not None:  # after clay_ify: the sword is clay, not felt
    pr = km.attach_held(arm, os.environ["PROP"], GUARD)
    for o_ in [pr] + [o for o in bpy.data.objects if o.name.startswith("fist_")]:
        for s_ in o_.material_slots:
            stage._clay_material(s_.material, stage._local_dims_world(o_), H, 1.0, 1.0)
    if STRIKE:
        HELD.update({"sword": pr}, **{o.name: o for o in bpy.data.objects if o.name.startswith("fist_")})
        pose(0)
    print("CHECK held prop", pr.name, tuple(round(x, 3) for x in pr.matrix_world.translation), flush=True)
elif os.environ.get("PROP"):
    pr = km.attach_prop(arm, os.environ["PROP"], H)
    print("CHECK prop", pr.name, flush=True)
print("BUILD_SECONDS %.1f" % (time.time() - t), flush=True)
cam = stage.build_camera(sc, H, aspect=ASPECT, zoom=ZOOM5, elevation=EL, look_ahead=LA, focal=FOCAL)
cam.data.dof.use_dof = False  # as the set bake

# --- king objects: the armature and its meshes/shells, plus the fibre curves (world-space, unparented)
king = [o for o in bpy.data.objects if under(o) or o.name.startswith("felt_fibres")]
roots = [o for o in king if o is arm or (o.parent is None)]
base = {o.name: o.matrix_world.copy() for o in roots}
print("CHECK king objects", sorted(o.name for o in king), flush=True)
for o in bpy.data.objects:
    if o in king or o.type in ("LIGHT", "CAMERA"):
        continue
    o.visible_camera = False  # still lights, bounces and shadows him
def heading(k):
    R = Matrix.Rotation(math.radians(45 * k), 4, "Z")
    for o in roots:
        o.matrix_world = R @ base[o.name]
    bpy.context.view_layer.update()

# --- the backlight, placed for this camera. stage.py puts KING_RIM (light-linked to the king alone) behind and a
# little above him for an eye-level close-up; from the 35 deg play camera that disc sits above the view ray and
# washes his front instead of rimming him. RIM_PLAY puts it where the close-up has it relative to its camera:
# straight behind him along the view ray, raised RIM_EL degrees above it, RIM_D x H from his middle.
rim = bpy.data.objects.get("king_rim")
if rim is not None and os.environ.get("RIM_PLAY"):
    Pk = king_points()
    ctr = Vector(((Pk.min(0) + Pk.max(0)) / 2).tolist())
    M3 = cam.matrix_world.to_3x3()
    f_ = -(M3 @ Vector((0, 0, 1)))
    r_ = M3 @ Vector((1, 0, 0))
    d_ = Matrix.Rotation(math.radians(float(os.environ.get("RIM_EL", 8.5))), 3, r_) @ f_
    rim.location = ctr + d_ * float(os.environ.get("RIM_D", 1.0)) * H
    rim.rotation_euler = (ctr - rim.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
# CROWN_RIM: with KING_RIM_FIBONLY the rim lights only the felt (fibres and shells), so hands and face stay out
# of it but so does the crown. This puts a narrow spot, linked to the body mesh alone, behind and above the crown
# (CROWN_EL degrees above the view ray, CROWN_D x H away), its cone just wide enough for the crown.
if os.environ.get("CROWN_RIM"):
    Pk = king_points()
    lo, hi = Pk.min(0), Pk.max(0)
    crown = Vector((float(lo[0] + hi[0]) / 2, float(lo[1] + hi[1]) / 2, float(hi[2]) - 0.1 * H))
    M3 = cam.matrix_world.to_3x3()
    f_, r_ = -(M3 @ Vector((0, 0, 1))), M3 @ Vector((1, 0, 0))
    d_ = Matrix.Rotation(math.radians(float(os.environ.get("CROWN_EL", 30))), 3, r_) @ f_
    dist = float(os.environ.get("CROWN_D", 1.0)) * H
    cl = bpy.data.lights.new("crown_rim", "SPOT")
    cl.energy = float(os.environ["CROWN_RIM"]) * H * H
    cl.color = (1.0, 0.72, 0.42)
    cl.spot_size = 2 * math.atan(float(os.environ.get("CROWN_R", 0.22)) * H / dist)
    cl.spot_blend = 0.5
    cl.shadow_soft_size = 0.1 * H
    try:
        cl.cycles.cast_shadow = False
    except Exception:
        pass
    co_ = bpy.data.objects.new("crown_rim", cl)
    bpy.context.scene.collection.objects.link(co_)
    co_.location = crown + d_ * dist
    co_.rotation_euler = (crown - co_.location).to_track_quat("-Z", "Y").to_euler()
    rc_ = bpy.data.collections.new("CrownRimRecv")
    for o_ in king:
        if o_.type == "MESH" and not o_.name.startswith("felt_fibres") and "_shell" not in o_.name:
            rc_.objects.link(o_)
    co_.light_linking.receiver_collection = rc_
    bpy.context.view_layer.update()
    print("CHECK crown_rim", tuple(round(x, 3) for x in co_.location), "energy", round(cl.energy, 1),
          "cone", round(math.degrees(cl.spot_size), 1), [o.name for o in rc_.objects], flush=True)
if rim is not None:
    print("CHECK rim", tuple(round(x, 3) for x in rim.location), "energy", round(rim.data.energy, 1), "size", round(rim.data.size, 3), flush=True)

# --- one crop for all headings (and loop frames): a cylinder round his axis (fibres and halo stick out a little)
P = []
for i in range(max(1, len(poses))):
    pose(i)
    P.append(king_points())
P = np.concatenate(P)
pose(0)
r = float(np.sqrt(P[:, 0] ** 2 + P[:, 1] ** 2).max()) * 1.12
top = float(P[:, 2].max()) + 0.04 * H
stage.setup_render(sc, res=a.res, samples=a.samples, aspect=ASPECT)
rx, ry = sc.render.resolution_x, sc.render.resolution_y
us, vs, ds = [], [], []
M = cam.matrix_world
cpos = M.translation.copy()
fwd = -(M.to_3x3() @ Vector((0, 0, 1)))
right = M.to_3x3() @ Vector((1, 0, 0))
up = M.to_3x3() @ Vector((0, 1, 0))
for i in range(32):
    th = 2 * math.pi * i / 32
    for z in (-0.02 * H, top):
        p = Vector((r * math.cos(th), r * math.sin(th), z))
        c = world_to_camera_view(sc, cam, p)
        us.append(c.x); vs.append(c.y)
        ds.append((p - cpos).dot(fwd))
u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
# snap to whole pixels
u0, u1 = math.floor(u0 * rx) / rx, math.ceil(u1 * rx) / rx
v0, v1 = math.floor(v0 * ry) / ry, math.ceil(v1 * ry) / ry
sc.render.use_border = True
sc.render.use_crop_to_border = True
sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = u0, u1, v0, v1
sc.render.film_transparent = True
# The haze stays (hidden from the camera like the rest): it dims and warms the light that reaches him, as in
# the hero. Hiding it outright lit him brighter and paler than r17. Its veil in front of him is in the set bake.
print("CROP", u0, u1, v0, v1, "px", round((u1 - u0) * rx), round((v1 - v0) * ry), flush=True)

# The quad the browser draws him on: parallel to the image plane, a little in front of his nearest point,
# so the set's depth (moss, walls) still sorts against him the way it would against the real figure.
d0 = (Vector((0, 0, 0)) - cpos).dot(fwd)  # depth of his feet (the anchor)
near = []  # his nearest point over all headings (meshes; fibres add a hair)
for k in range(8):
    heading(k)
    for i in range(0, max(1, len(poses)), 2):
        pose(i)
        near.append(float(((king_points() - np.array(cpos)) @ np.array(fwd)).min()))
heading(0)
pose(0)
dq = min(near) - 0.03 * H
tanX = 18.0 / FOCAL
tanY = tanX / ASPECT
def at_plane(u, v):
    d = fwd + (2 * u - 1) * tanX * right + (2 * v - 1) * tanY * up
    return cpos + d * dq
P0 = cpos + (Vector((0, 0, 0)) - cpos) * (dq / d0)  # where the ray to his feet meets the quad
corners = [at_plane(u, v) - P0 for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
quad = {"x0": corners[0].dot(right), "x1": corners[1].dot(right), "y0": corners[0].dot(up), "y1": corners[2].dot(up)}

vl = sc.view_layers[0]
sc.render.image_settings.media_type = "MULTI_LAYER_IMAGE"
sc.render.image_settings.file_format = "OPEN_EXR_MULTILAYER"
sc.render.image_settings.color_depth = "32"
sc.render.image_settings.color_mode = "RGBA"
os.makedirs(a.out, exist_ok=True)
import OpenImageIO as oiio
def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(x, 1 / 2.4) - 0.055)
expo = 2.0 ** float(os.environ.get("EXPO", 0))
only = [int(k) for k in a.only.split(",") if k != ""] or list(range(8))
times = {}
jobs = [(k, i) for k in only for i in range(len(poses))] if a.clip or STRIKE else [(k, None) for k in only]
if os.environ.get("SAVE_BLEND"):  # the built scene at the first heading, for close-ups (felt_closeup.py)
    heading(only[0])
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.environ["SAVE_BLEND"]))
    print("CHECK saved", os.environ["SAVE_BLEND"], flush=True)
for k, i in jobs:
    tag = "%d" % k if i is None else "%d_%02d" % (k, i)
    png = os.path.join(a.out, "%s%s.png" % (NAME, tag))
    if os.path.exists(png) and (not a.only or a.clip or STRIKE):  # a loop resumes after a Metal crash
        continue
    heading(k)
    pose(i) if i is not None else None
    exr = os.path.join(a.out, "%s%s.exr" % (NAME, tag))
    sc.render.filepath = exr
    t = time.time()
    gpu_retry.render()
    times[tag] = time.time() - t
    print("RENDER_SECONDS %s %.1f" % (tag, times[tag]), flush=True)
    img = oiio.ImageInput.open(exr)
    chans, j = {}, 0
    while img.seek_subimage(j, 0):
        spec = img.spec()
        px = np.asarray(img.read_image(j, 0, 0, spec.nchannels, "float")).reshape(spec.height, spec.width, spec.nchannels)
        for c, nm in enumerate(spec.channelnames):
            chans[nm] = px[:, :, c]
        j += 1
    img.close()
    ch = lambda s: next(v for nm, v in chans.items() if nm.endswith(s) and "Noisy" not in nm)
    lin = np.stack([ch("Combined.R"), ch("Combined.G"), ch("Combined.B")], -1)
    al = np.clip(ch("Combined.A"), 0, 1)[..., None]
    straight = np.where(al > 1e-4, lin / np.maximum(al, 1e-4), 0.0)
    ldr = np.concatenate([srgb(straight * expo), al], -1)
    h_, w_ = al.shape[:2]
    sp = oiio.ImageSpec(w_, h_, 4, "uint8")
    # already straight: without this OIIO takes the pixels as premultiplied and divides by alpha again on
    # writing the PNG, which blew his see-through fibre edge up into a white outline
    sp.attribute("oiio:UnassociatedAlpha", 1)
    ob = oiio.ImageBuf(sp)
    ob.set_pixels(oiio.ROI(), (ldr * 255 + 0.5).astype(np.uint8))
    ob.write(png)
    glow = np.clip((straight - 1.0) / a.glow_k, 0, 1) * (al > 0.02)
    gb = oiio.ImageBuf(oiio.ImageSpec(w_, h_, 3, "uint8"))
    gb.set_pixels(oiio.ROI(), (np.sqrt(glow) * 255 + 0.5).astype(np.uint8))
    gb.write(os.path.join(a.out, "%s%s-glow.png" % (NAME, tag)))
    if not os.environ.get("KEEP_EXR"):
        os.remove(exr)

info = {
    "H": H, "S": 1.2 * H, "res": [rx, ry], "crop": [u0, v0, u1, v1], "px": [round((u1 - u0) * rx), round((v1 - v0) * ry)],
    "right": list(right), "up": list(up), "fwd": list(fwd), "camera": list(cpos), "d0": d0, "dq": dq,
    "anchor": list(P0), "quad": quad, "exposure": float(os.environ.get("EXPO", 0)), "glowK": a.glow_k,
    "headings": 8, "samples": a.samples,
    "frames": len(poses) or None, "clip": os.path.basename(a.clip) or None, "shape": SHAPE, "gait": a.gait or None,
    # cycle: ground covered per loop with the feet planted, in stage units (and in squares, S = 1.2 H)
    "cycle": GAIT and GAIT["cycle"] * H / 100, "cycleSquares": GAIT and GAIT["cycle"] / 120, "stats": GAIT,
    "fps": STRIKE and STRIKE["fps"], "hit": STRIKE and STRIKE.get("hit"), "cycle_loop": bool(STRIKE and STRIKE.get("cycle")),
    # the leap carries him forward: stage units and squares (S = 1.2 H) he ends ahead of where he started
    "travel": STRIKE and STRIKE.get("travel", 0), "travelSquares": STRIKE and STRIKE.get("travel", 0) / (1.2 * H),
    "prop": os.path.basename(os.environ["PROP"]) if os.environ.get("PROP") else None,
    "rim": {k: os.environ.get(k) for k in ("KING_RIM", "KING_RIM_S", "KING_RIM_FIBONLY", "RIM_PLAY", "RIM_EL", "RIM_D", "CROWN_RIM", "CROWN_EL", "CROWN_D", "CROWN_R")},
}
json.dump(info, open(os.path.join(a.out, NAME + ".json"), "w"), indent=1)
print("RENDER_TOTAL %.1f" % sum(times.values()), "WALL %.1f" % (time.time() - T0), json.dumps(times), flush=True)
print("DONE", flush=True)
