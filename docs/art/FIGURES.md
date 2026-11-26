# 3D figures: steps and lessons

How a painted character becomes an animated felt figure in the diorama, and the mistakes that cost a redo.
Read this before starting a new figure. Add to "Lessons" whenever a step has to be redone.

Work files live in `~/.dos/scratch/d84406ef/` (not in the repo): `gem.py` (Gemini drafts),
`paid/fal_run.py` (fal jobs), `paid/args/*.json`, `paid/out/<name>/`.

## Steps

Each step ends with one picture shown to Wesley and his OK. Paid steps (fal) need his OK first.

| Step | Tool | Cost | Check before moving on |
|---|---|---|---|
| 1 Felt look | Gemini, refs: painted card + approved felt king + guard | free | on-model; size next to the king |
| 2 Held pose draft | Gemini, refs: approved look + prop | free | Wesley picks the idle pose |
| 3 T-pose sheet | Gemini: front, then back and side from the front; prop alone | free | side by side with steps 1-2 (see below) |
| 4 3D model | `meshy/v7.1/multi-image-to-3d`, front + back only | ~$1.20 | render front/side/back/top next to the sheet |
| 5 Rig + clips | `meshy/rigging/multi-animation`, same 10 clip ids as the king | ~$0.80 | `paid/clip_sheet.py` contact sheet |
| 6 Prop | `meshy/v7.1/image-to-3d` from the prop picture | small | four views |
| 7 Idle pose | `tools/art/diorama/guard_pose.py` (sword/spear guard) or `rook_pose.py` (prop on the shoulder): IK, clay fists, prop | free | side by side with step 2; `strike_check.py` clean |
| 8 Felt bake | `bake_king_sprites.py` via `runguard.sh`, 8 headings | free | in game, game camera |
| 9 Moves | hand-made keys (`strike_pose.py`, `lunge_pose.py`, `death_pose.py`) | free | `strike_check.py` on every frame |

## Checks that would have saved a redo

**Before any paid step**
- The fal balance can run out mid-pipeline (403 "Exhausted balance"). Nothing is charged; ask Wesley to top up.
- Put the T-pose sheet next to the approved look and the approved pose draft, same height, and compare
  build, proportions, silhouette and colours. Fix the sheet first: a wrong sheet is a wrong $2 model.

**T-pose sheet prompt**
- Describe the build you see in the approved look, in plain words (broad chest, thick muscular arms, ...).
  Don't add style words that weren't approved. "Chibi" and "chunky" made the rook round and soft (2026-11-23),
  so the model had to be remade.
- Hands open, palms down, empty. Meshy rigs have no finger bones, so a hand can't close on anything later.
- Use front + back for Meshy. The side view's end-on arm confuses it.

**Holding a prop**
- Never push a prop through an open Meshy hand. It reads as a stick through the palm, with the palm turned
  the wrong way (the rook's first pose, 2026-11-23). Use `guard_pose.py`: it shrinks the mitt into the wrist
  and builds a clay fist round the grip (`king_motion.attach_fists`), knuckles out, palm toward the body.
- Aim the arms with its IK, not by hand-set bone directions. Hand-aimed arms (`rook/shoulder_pose.py`, a dead
  end) bent oddly and sank the fists into the body.
- Run `strike_check.py` before showing a pose. It fails on a prop or fist inside the body.
- Check his body against itself too, not only the prop. The rook's second pose passed the prop check but his
  feet crossed and his hanging arm sank into his side (Wesley caught both). `rook_pose.py` prints `SELF`
  crossing faces for feet, each elbow and each arm vs the torso. Feet and arm-vs-torso must be near 0.
- An arm holding something at the shoulder folds tight, elbow pointing DOWN, forearm pressed against the
  bicep: that squash is natural and the elbow's SELF count will be high; accept it. Opening the elbow to
  clear the bicep pushed it out sideways into a stiff "flexing" arm that Wesley rejected (2026-11-23).
  Set the elbow pole down and a little forward (`px=0.3 py=-0.3`) and turn on Preserve Volume skinning
  (`dqs=1`, also in the bake) so the fold squashes instead of caving in. Judge the elbow by eye against the draft.
- Hands need real fingers. `king_motion.attach_fists` (one clay block with grooves) read as "a big blob ... a
  nub" up close on the rook (2026-11-23). Use `hands.attach_fingered_fists` (`rook_pose.py hands=1`): palm pad,
  four curled fingers with knuckles and small gaps, a thumb over them, coloured from the figure's own arm
  texture (sampled, sRGB to linear). A hanging empty fist's knuckle line runs front to back, not along the arm.
- But no visible joints: knuckle bumps and segment ridges read as "skeletal" next to the mockup's soft felt
  fingers. Each finger is one smooth plump roll, separated from its neighbours only by a soft crease, and wrapped
  only partway (span ~185) so the curled tips don't show as a second row. Too much smoothing melts the fingers
  back into a blob; the defaults (fw 0.58, vox 0.13, smooth 10, kb 0) sit between the two.
- Round finger tubes leave a deep V notch between neighbours that reads as a dark gash. Felt fingers press flat
  against each other: give each finger an oval cross-section wider along the grip (`fsx` 1.3) so only a shallow
  crease remains. 1.5 merges them into a mitten.
- Render close-ups of feet, elbows, both hands and a hanging arm next to the same crop of the mockup before showing.
- Judge close-ups in the final felt look, not the stand-in EEVEE shader: a quick one-heading bake with
  `SAVE_BLEND=scene.blend` (e.g. `runrook.sh pose.json out 2400 128 0`), then
  `Blender -b --python felt_closeup.py -- scene.blend outdir` renders the hands (or `objs=...`) with the bake's own
  lights and materials (~2 min on the GPU). The felt test caught an empty fist with a hole through it that the
  EEVEE views hid: an empty fist needs `solid` (hands.py fills the grip's hole).
- Separate hand meshes wear the body's own skin material (hands.skin_uv + wear_body_skin), so they match the arms.
  Felt settings are per figure: fibre counts and lengths scale with the whole body. On a small separate mesh, scale
  the count by its share of the area and shorten the nap (HAND_FIB_K 0.4, HAND_FLY 0.2), or the hand turns into a
  fuzzy pom-pom with stray hairs (rook felt/close5). Body height cuts (crown, collar, jewels) misfire on a hand: off.
- Pink felt skin (the rook, 2026-11-23): SKIN_FELT=1 in stage.py (scratch) puts fibres and the felt surface on skin.
- Match the approved pose draft from the same camera, side by side, before showing it.
- A prop across the shoulders must pass behind the helm, not through it: big helms reach far back. `rook_pose.py`
  prints CLIP per part with the body part it hits; tune until CLIP_MAX is near 0 (the rook needed the handle
  0.34 x height behind the right shoulder). The clip test needs two votes (nearest-face normal and a ray), or
  it reports false clips.

**Motion**
- Library mocap is for walking only. Attacks, hits and deaths are hand-made keys.
- Import clips at 30 fps (set the scene fps before import), or they play too slow.
- Judge the felt in real renders, not in the .glb viewer: a live viewer can only fake felt with a few speckled
  layers (flaky shingles, raw skin tone). For a 3D look-around, `felt_closeup.py ... objs=char1 spin=1
  turns=0,30,...` spins the figure in the bake's own lights (the camera can't circle: the lights are front-set and the
  stage walls block the back).
- Every animation starts with a reference pass: real clips of the move, a timing table, and the key poses drawn
  next to the matching reference frames. The rook's slam took four rejected drafts that a closer look at the
  references would have caught.
- Turn the body. A swing with the hips and shoulders square looks like the arms are doing the work alone
  (`rook_pose.py` yaw turns the hips and feet, twist the shoulders, look counter-turns the head).
- Check the reach before choosing a grip. The rook's arms are about half what a two-handed sledge swing needs:
  with both hands on the handle his fists bunch at the belly and the big arms crush or clip whatever the pose. One
  hand, swung on its own side, fixed it.
- A one-handed heavy swing keeps the wrist in line: the handle carries on from the forearm like one long lever.
  Aiming the hammer freely (th/psi) bent the wrist sideways off the arm and Wesley spotted it at once. `lock=1`
  holds the fist at a fixed angle `wa` to the forearm (35 in the swing; the shoulder carry's square grip is 92) and
  only uses th/psi to choose which way round the arm it points. `WRIST left` prints the angle.
- Interpolate angles the short way round: a key at th -170 after the carry's 161 swept the hammer through the
  front (the wrist lock then jerked 90-100 degrees a frame). Write it as 190. test_rook_strike.py checks this.
- A strike that re-places separate meshes every frame (the rook's hammer and hands) must take their felt fibres
  with them: fibres are grown in world space, so bake_king_sprites.py parents each hand's fibres to the hand. A
  one-heading test bake at 900 px / 24 samples (~3 min) showed the stray fuzz ball left at his shoulder.

## Rook walk: a free arm (2026-11-23)

- A figure with no walk sheet slides its still frame across the board. Every figure that moves needs a walk.
- The walk is the library walk under the carry pose (`--gait walk` with GUARD set), like the king and guard.
- The rook carries with one hand, so his empty right arm must swing or the walk reads stiff. `FREE_ARM=Right`
  frees RightArm and RightForeArm: each keeps the carry's hang, turned by the gait's swing about its loop mean
  (`SWING` scales it). Taking the gait's own arm rotation instead splays the arm out sideways, because the gait's
  arm assumes the gait's shoulder. Never free the Hand: the carry shrinks it inside the fingered fist, and freeing
  it shows the open hand. test_hold_guard.py checks this.
- runrook.sh takes the walk as extra args: `FREE_ARM=Right runrook.sh felt/pose/rook_pose.json OUT 3600 256 0,...,7 --gait walk --frames 16`.

## Rook death: a face for a closed helm, a dropped prop (2026-11-23)

- A figure with no face (the rook's closed great helm) still needs the woe and X eyes: `nervous_face.py` FIGURE
  rook puts white clay eyes (pupils up for woe) or white X marks in the visor's dark slit, with no mouth and no
  paint-out (VISOR=True, PAINT=False). Measure the slit on an orthographic front render with a known pixel to
  metre map (scratch rook/death/facemeasure.py). test_rook_face.py checks the pieces sit in the slit.
- A prop dropped on the blow must clear the body: falling straight down from his shoulders, the snapping helm
  hit the hammer (draft full1). It rides in his opening hand for 2 frames, then leaves with an upward toss
  (`pop` 0.30H) and slides off sideways (`sdx`, `sdy`, `slay`), landing on frame 10. CLIP stays ~0.03H on frames 2-3.
- Keep the left fist rigid on the forearm in its carry grip (copy the idle's `fists[0].m` into every frame): the
  bake builds each fist once, round the handle, so a fist that moves on its own shows the seam.
- A thick body lying flat holds straight legs up off the floor: the end pose bends the hips past flat (kick -15).
- One pose for every heading (Wesley, 2026-11-23): falling toward the camera hides the X eyes behind the helm
  top, but it reads as a man knocked flat toward you. The king and guard work the same way.
- `rook_death.py OUT` solves the 29 frames (`--keys`/`--only` for drafts), `runrookdeath.sh` bakes them,
  `king_loop_atlas.py ... name=death figure=rook rows=4` packs them. test_rook_death.py checks keys and solves.

## The eye square: a Meshy plinth, lids in code, baked in Cycles (2026-11-24)

- Look: Wesley picked a glass eyeball in iron claws on a stone pedestal, with riveted iron lids. From the high,
  square-on camera only a block's front and top show, so eyes carved on the sides or back would be wasted.
- First try, all in code and drawn live by three.js: Wesley called it "GameCube" next to the felt and clay set.
  Plain shapes under realtime light read as a video game prop, not a real object in a diorama. Any prop that
  stands next to the baked figures has to be baked in Cycles too, with real materials.
- What worked: Meshy for the plinth and claws (it models worn stone and rust well), the moving parts built in code
  in Blender (`build_eye_cycles.py`: eyeball, iris, cornea, hammered iron lids with rivets) so they come out as
  separate parts to pose, then the same sprite bake as the figures (`runeye.sh PED OUT RES SAMPLES` with
  `EYE_ARGS=--bake`, packed by `king_atlas.py` and `king_loop_atlas.py`).
- Meshy puts a grey stand-in ball where the eye goes: fit a sphere to it and cut those faces. Sit the real ball and
  lids a little inside the claws (0.84 of the stand-in) or the lids clip the claws when they open.
- Looking level, the eye showed the camera only the top of its lids. It tips its gaze up toward the camera (40°
  dozing, 22° staring). Turned full side on, its iris faced away: it turns only 65% of the way.
- Dozing keeps a slit open with a dim glow: the eye always watches, so it must never look safe to walk past.
- A red iris read as a target. Gold to amber with a lighter ring around the pupil reads as an eye.
- It sees only along its row and column, so wakes are baked for 4 headings; the 8 still headings give the turns
  their in-betweens. Nodding off is the wake played backwards, slowly (6 fps against 24).
- Timing (keyed by hand in `WAKE`, no clip reference pass yet): the lids snap open in about 3 frames at 24 fps
  and overshoot a touch, the glow flares and settles, the head turns after the lids and lands around frame 6;
  dozing, the lids drift over about 6 seconds.

## The sludge square: Meshy stone, code ooze, a judge, a clip pass (2026-11-24)

- Code-built props (stones from noise, a slab with a boolean hole) read as computer graphics next to the baked
  figures, whatever the material. What worked: Meshy for anything stone (the broken rim tile `paid/out/sludgerim`,
  a kit of 7 loose shards `paid/out/stonekit`), code only for placing them and for the ooze itself.
- Joined sludge squares are one pond, not tiles side by side: `sludge_pond.py` groups touching squares, builds one
  distance field (rounded outside corners, filleted inside corners, ragged by noise), and lays the kit shards
  along its outline. A 2x2 block reads as a pond, three in a row as a channel, one alone keeps the Meshy rim.
- Every look gets 2-3 blind Gemini judge rounds against the concept (`king3d/judge2.py`) before Wesley sees it.
  The judge always caught the render (24/24); its confidence is the useful number (90 -> 82 for the stone kit).
- Reference pass for the bubbling (two Wikimedia Commons clips: "Mudpot Yellowstone" and "Mudpot at Lassen
  Volcanic National Park in August 2019"; Gemini timed both, and a 15 fps strip of Lassen checked it by eye):

  | | Small plip | Medium | Large |
  |---|---|---|---|
  | Size (share of pool width) | 3-6% | 10-18% | 20-35% |
  | Swell before it bursts | 0.1-0.4 s | 0.5-0.7 s | 0.8-0.9 s |
  | Burst (tear, slump) | under 0.15 s | 0.3-0.4 s | 0.6 s |
  | Settle (crater fills, a slow ring) | 0.2 s | 0.4-0.7 s | 0.7-0.9 s |

  - About 1-1.6 bubbles a second per pool, in surges with quiet gaps of 1-2 s, not a steady beat.
  - They come from a few fixed vents, one main one; never at the edges.
  - Roughly 1 in 5 swells sinks back without bursting.
  - A rising bubble is a lumpy skin-covered blister, not a smooth dome; a big one stretches and tears open, folding
    in on itself, rather than popping. The surface between is never still: a slow heave, no fine ripples.
  - The strip showed what Gemini's table missed: the main vent churns almost constantly (a surge every 0.6-0.9 s),
    and the whole surface is dotted with tiny still lumps of old splatter.
- Animating it (`sludge_bubbles.py`, pure Python with tests; `build_sludge_cycles.py --frames 96 --loop_s 8`
  rebuilds the ooze sheet per frame). What cost a round each:
  - Bubbles blended in with a smooth max (`smax`) drew a crisp ring at the edge of every bubble's reach: a smooth
    max adds a ridge wherever one side is tiny but not zero. Add the heights instead; a test walks lines across
    the pool and fails on any step.
  - Added heights are lower than the smooth max made them, so bubbles vanished on camera: `--dome 1.2` now.
  - Bubbles stacked on the main vent (a small one rising on a big one, almost half the time) and read as pointed
    cones. The schedule now keeps a spot free while a bubble there swells or bursts.
  - A video judge (`refclips/motion_judge.py`, gemini-2.5-pro, the anim next to an 8 s crop of the Lassen clip,
    3 rounds) scored motion 3, 2.3 and 2.7 of 10, always for the same thing: bubbles rise and sink like solid
    lumps and never visibly burst. A 4 s loop also read as repetitive; 8 s did not.
  - Wesley picked a small splash over a big messy one or none: the skin tears into a dark hole (a `tear` vertex
    attribute darkens the ooze), the lip folds back in a few flaps, and a bigger bubble flings 2-4 blobs on low
    arcs (no higher than the bubble) that land, sink in and melt flat. Blobs that would land on stone are dropped.

## Live sludge proof: bubbling drawn in the browser over one Cycles bake (2026-11-24)

Why: player-built levels can put sludge anywhere, so a 30-minute Cycles loop per level is out. The proof keeps one
Cycles bake per level (about 3 minutes at 1600 px on the M4 Max) and draws the swell, bubbles, tears and blobs live.

How (`build_sludge_cycles.py --live 1` calls `live_plate.py`; the page is `live-sludge.html`, `src/proof/liveSludge.ts`):
- Plate: the board with the ooze lying still. Mask: the ooze's coverage, everything else held out.
- Basis: the ooze region re-rendered 33 times with its normal tilted (0, then 15/30/45/60 degrees x 8 turns) by a
  Vector Rotate node, clear coat off. A second set with the skin torn open everywhere (`tear_NN.png`). Each pixel
  blends the four nearest tilts for its live normal, in linear light; tear and crease shading blend between the sets.
- Coat: drawn live. Five 256 px half-float EXR faces of the room per sheet, looked up with box projection to the
  room's bounds, averaged over 9 directions spread by the pixel's normal change (specular antialiasing). The ping
  lights are too close for a probe: their disc is drawn exactly from position, size and power.
- Bubbling: `sludgeBubbles.ts` is an exact port of `sludge_bubbles.py` (fixture test to 1e-9). The swell is improved
  Perlin scaled to Blender's noise spread and slope (measured: sd 0.279, mean |slope| 0.55).

Blind pair judge (`pair_judge.py`, Gemini 2.5 Pro, 6 trials, random order; it must guess which clip is realtime):

| Round | Change | Caught | Live / Cycles quality |
|---|---|---|---|
| 1 | basis only | 5/6 | 8.2 / 9.3 |
| 2 | torn basis, creases, coat probe, exact pings | 5/6 | 8.5 / 9.8 |
| 3 | Perlin swell, specular antialiasing | 5/6 | 8.5 / 10 |

Lessons:
- Blend display-space PNGs in linear light; subtracting them in display space turned the ooze milky.
- A uniform named `step` hides GLSL's `step()`; the program silently fails ("program not valid").
- When the live normal equals the rest normal exactly, atan(0, 0) gives NaN: the ooze went black. Guard it.
- A pre-rendered normal basis can't hold a sharp highlight: crossfading tilts gives soft ghost spots. Draw sharp
  reflections live (probe plus exact near lights) and keep the basis for diffuse light and broad shine.
- A ping outside the room box is behind a wall; Cycles never shows it in the coat. The room's own lamps are another
  matter: the lantern and fills hang in front of the open box, and dome fronts mirror them.
- Still open: near-field reflections (the stone rim in the ooze), the shading inside torn holes and under domes,
  and speed (40 ms a frame on the M4 Max, all in the JS height evaluation; phones need it in a vertex shader).

### Round 4: what Cycles' coat really shows (2026-11-25)

- Measure before modelling. Cycles' true coat is `dec(plate) - dec(basis_00)` (coat on minus coat off). Fitted against
  a flat-mirror render of the room, its best scale was 0.2-0.5% (physics says 2.7% at this view) with correlation
  0.15-0.4: the coat barely shows the room. What it shows is the lamps: warm fairy bulbs, the lantern.
- So the live coat draws no room (`room=0`) and does not dim the ooze below (`dim` off): both measured worse.
- The lamps are exported from the scene (`live_plate.py lights()`): point, spot and area lights with Blender's Kelvin
  colour applied (`use_temperature`; they came out white without it), plus small glowing meshes (the bulbs' glass,
  whose colour comes through a Mix node fed by a Blackbody node). Light linking is honoured.
- The flat-mirror bake (`mirror_K.exr`, `mpos_K.exr`) stays for one job: a lamp is hidden where the mirror image shows
  something nearer than the lamp along the way.
- A still frame can't judge highlights: they only come alive on moving ripples. `fit_loop.py` scores 12 moments of
  the loop against the Cycles loop, including the share of bright pixels (Cycles 0.69%, live 0.08%).
- Blender, Metal: set the Cycles preference `kernel_optimization_level = "OFF"` or kernel compiles corrupt memory.
  Toggling `hide_render` between renders with persistent data on crashes in BlenderSync: move one object instead.
- Test a bake change on a 320 px, 2-sample bake first (about 1 minute): a field-name slip at the end of a full bake
  costs 10 minutes.
- **Lamp colours come from Blender's own Blackbody curve, measured, not a formula.** A textbook Kelvin fit (Tanner
  Helland, scaled to luminance 1) gave 2850 K as (1.93, 0.80, 0.24); Blender renders it (1.70, 0.94, 0.44), and its
  curve is not scaled to luminance 1. `lamp_colour.py` holds the measured rows every 500 K from 1000 to 12000 K
  (rendered with a Blackbody node as the world colour, Standard view) and interpolates between them.
- **A Blender lamp's temperature is a different curve from the Blackbody node.** A lamp is about white at 6500 K and
  2850 K multiplies it by (1.34, 0.81, 0.37); the node gives (1.70, 0.94, 0.44). Glowing materials use the node,
  lamps use `lamp_colour.lamp_kelvin`. A bulb material's Kelvin colour pulled toward white by a Mix node is read with
  the mix's own factor, not an average. With the right colours the loop fit improved (12.81 to 12.32).
- **Drawing the base layer's shine live did not pay.** Baking the tilts without it (LIVE_SPEC=1) and drawing it in the
  shader scored worse on stills (9.4 against 5.2) and on the loop (13.5 against 12.3), and did not raise the share of
  bright pixels. Cycles' base shine on the ooze is warm with almost no blue, which a live lamp reflection can't match
  without a fitted tint. LIVE_SPEC now defaults to 0; the shader path stays for experiments (bgain, broom, bhalo,
  bwide, btint).
- **The loop fit's frames are not the same moments as Cycles'.** The live bubbles don't line up with the Cycles a6
  loop, so per-frame scores carry bubble noise. Shifting the time offset barely changes the score, so compare
  versions against each other, not as an absolute.
- **Judge round 5 (2026-11-25), two rounds each:** the colour-fixed clip was caught 8 of 12 (quality 8.7 live, 9.5
  Cycles), the same as round 4's clip re-judged (8 of 12, 8.8 against 9.3). Their repeat tells: torn holes look
  like flat decals with no self-shadowing, highlights are simpler, and the ooze's green light on the stones doesn't
  move with the bubbles.

### Live sludge, rounds 6–7: the capture bug, and the holes' ink outlines (2026-11-25)

- **Loop captures were scrambled until now.** Without `?still` the page runs its own requestAnimationFrame clock and
  redraws at wall-clock time between `renderAt(t)` calls, so saved frames came from random moments. Judge rounds 4–5
  (pools-live9, pools-live11) and the earlier fit_loop numbers came from such clips: ignore them. `capture_live.mjs`
  now adds `still` itself (`tools/art/diorama/stillUrl.mjs`, tested). In step, live sits at phase offset 0 against Cycles.
- **In-step baseline (L9 basis, corrected lamps):** fit_loop all 11.18; judges caught it 7/12.
- **The holes' "flat decal" look was black ink outlines**, not missing crater depth. A debug view (`?view=1` tilt,
  `2` tear, `3` crease shade, `4` facing) showed the lines sit exactly where a dome's far side turns edge-on: the
  smoothed normal leans away from the camera and the tilt table returns the dark of a sheet seen from behind.
  Turning crease shading down did nothing; letting the room reflection rise at grazing (`?rim=`) barely helped and
  tinted the ooze blue. The fix is a facing floor: the shading normal is bent towards the camera until n·v ≥ 0.4
  (`src/diorama/sludgeFacing.ts`, `?face=`, default 0.4).
- **Result:** fit_loop 11.14 (rims are few pixels); judges caught it 8/18 over three rounds (chance is 9/18), quality
  about even with Cycles. Remaining tells: highlights simpler and sharper than Cycles', bubbles' self-shadowing, the
  ooze not mirroring the stone edges. Holes were named once in 18.

### Live sludge, round 8: highlights (2026-11-25)

- **The glint list overflowed silently.** Each of 3 sheets listed all 21 room lamps, so 66 entries met a 32-slot shader array and the bulbs fell off the end. Now a lamp every sheet lists is kept once (sheet -1), and any drop logs a warning (`sludgeGlints.ts`, tests in `sludge-glints.test.ts`).
- **Not every room light shows in Cycles' coat.** With all lamps in, the fit got worse (11.1 to 17.6) and the ooze went blue: the moon, the pool light and the warm fill are broad, cool or white discs that the coat doesn't show in the plates. Default skip list: `moon,pool,warmfill`. The lantern stays: it is what puts the sparkles where Cycles has them.
- **The bulbs' soft ring (halo) made a blue-white haze.** Default `halo=0`. Glints are a quarter pixel of antialiasing wide (`aa=0.25`). `?soft=` widens glints past the coat's roughness; wider only spread haze, so it stays 1.
- **The stage grade** (stage.py `_setup_compositor`): CDL slope (1.04, 1, 0.95), offset (0, 0.003, 0.009), power (0.97, 0.98, 1.02), then saturation 1.4, plus bloom (threshold 1, strength 0.9) the live page doesn't have yet. The live page now undoes the grade on the baked colour, adds the coat, and grades again (`stageGrade.ts`, `?grade=0` to compare). It barely moved the fit; kept because it is how Cycles composes them. FAIRY_K 3600 is why the fairy lamps read 3600 K.
- Result: fit 11.12, sparkle amount 0.10% vs Cycles 0.10%, blue bias 25 to 1.5. Blind judges caught live 6 times in 18 (chance 9), quality 9.3 live vs 8.8 Cycles, and split on which clip had the sharper highlights, so highlights are no longer a reliable tell. Frame time is about 42 ms on an M4 Max: too slow for phones (next).

### Live sludge, round 9: phone speed (2026-11-25)

- **Profile first** (`tools/art/diorama/profile_live.mjs`, page's `window.liveProfile`): the frame was 41 ms of CPU and about 5 ms of GPU on an M4 Max. The CPU was re-shaping all 41k ooze vertices against all 70 bubbles each frame; with Chrome's CPU slowed 6x (a mid phone) that was 724 ms.
- **Fix: time on the CPU, space on the GPU.** `sludgePack.ts` works out each live bubble's moment once a frame (only the ones alive: bubbles, tears, blob lumps, splatters) into a 4 x 256 float texture; the sheet's vertex shader shapes the ooze from it, with the swell's Perlin ported over `PERM`. Normals come from six taps one mesh edge out, the crease from the CPU's two-ring average as 13 taps (weights 7, 4, 3 / 49, outer ring at 1.83 edges). CPU per frame: 0.3 ms at 6x slowdown. `?cpu` keeps the old path to compare.
- **Two GPU traps blanked whole domes:** `sqrt(sin(pi))` is NaN in float (sin(pi) is a hair below 0), and `atan(0, 0)` is undefined. Guarded; the TS twin can't catch these, so compare GPU frames against `?cpu` pixel for pixel (mean 0.03 of 255 after the fix; fit 11.11 vs 11.12).
- Still unknown: the phone's GPU. The Mac's readback timing is too noisy below ~4 ms to predict it; it needs a real phone.

Phone check (iPhone 13 Pro Max, Chrome on iOS, `?bench` via `tools/art/diorama/phone_bench.mjs --wifi`): 48 fps
average, median frame 17 ms, slowest 5% 21 ms; CPU 2 ms, GPU 15 ms at 1600x1200. The CPU fix holds on a real phone;
the GPU now sits at the 60 fps budget on its own, so the sludge's GPU cost has to come down before figures join it.

### Live sludge, round 10: GPU cost

- Time the GPU with its own clock (EXT_disjoint_timer_query_webgl2; the profiler launches Chrome with
  `--enable-privileged-webgl-extensions`, and the answers only come back after the page yields a frame). The
  readPixels timer hid the real cost: it said the old shaping shader cost ~1 ms, the GPU clock said ~15 ms.
- Don't time on a Mac that is running a game: Slay the Spire 2 on the same GPU made every number wobble by ±0.6 ms.
- The cost was the vertex shader working the rise out 13 times a vertex (six slope taps, six crease taps) over every
  live bubble. Now three passes over one texel a vertex (src/diorama/sludgeFields.ts) work it once: rise and tear,
  then the neighbour mean and a least-squares slope through the real mesh neighbours, then the crease exactly as
  creases() does. The vertex shader reads two texels by gl_VertexID. GPU clock: draw 15 ms → passes 1.3 + draw
  2.3 ms on the M4 Max. Pixels vs `?cpu`: mean 0.002/255 (the tap shader was 0.032). Fit 11.12. `?shape=taps` keeps
  the old shader.
- preserveDrawingBuffer only with `?still` (captures): a phone pays for that copy every frame.
- Phone test: `node tools/art/diorama/phone_bench.mjs OUT.json 45 --wifi --results=N "--next=a|b"`, then type
  `http://<Mac Wi-Fi address>:5199/b` on the phone. The Mac's own Tailscale is the work tailnet; the phone isn't on it.
- Phone (iPhone 13 Pro Max, Chrome on iOS, one visit, four versions in a row; the screen caps it at 60 fps):

  | version | fps | GPU (readback) |
  |---|---|---|
  | new (per-vertex passes) | 51 | 10 ms |
  | old tap shader | 56 | 15 ms |
  | new, no MSAA | 60 | 10 ms |
  | new, no sparkles or mirror check | 60 | 10 ms |

  The new shaping took 5 ms off the phone's GPU. The 10 ms left doesn't move with MSAA or sparkles, so it's likely
  the readback timer's own floor or the plate and textures, not the ooze's effects. The first version's 51 fps is
  likely a first-load stall: the fps column is noise at this level. Next check: the bare plate (`bare`) on the phone.
- Second phone run (2026-11-25): backdrop alone (`bare`) 6 ms, new sludge 10 and 11 ms, all 60 fps. So the ooze itself
  costs ~4-5 ms of phone GPU now (the old tap shader ~9 ms over the same backdrop). The backdrop's 6 ms is the floor
  the readback timer sees with no ooze at all. (A phone tab left open from the run before re-posted once: check
  each result's `path` before reading it.)

### Stone glow that moves with the bubbles: not in Cycles (2026-11-25)

Measured before building: over the 96 frames of the Cycles loop (sludge/a6), the stones 4-40 px around the ooze
change by 0.15/255 on average (95th percentile 0.45): invisible. Their green glow comes from one still point light
a square (`sludge_glow_*` in build_sludge_cycles.py), and the ooze's emission is off (`--glow 0`). So the live
version's still stones already match. A glow that pulses with the bubbles would be a new effect, to be judged
against the concept, not the Cycles loop. (Script: measure the temporal std of a ring of pixels around the mask.)

### Live sludge, round 11: the bubbles' "self-shadowing" was a missing glow (2026-11-25)

- **Shadows first, and they were wrong.** A height grid a frame plus horizon occlusion (8 directions, reach 0.3)
  darkened dome feet and pits, and every strength moved further from Cycles (fit 11.12 → 12.4 at the lightest). Where
  that occlusion would be strongest, live was already *darker* than Cycles (by 7/255). Turning the crease shading
  down barely moved the fit (11.12 → 10.99 with none). The attempt is saved as a patch, not in the code.
- **What Cycles actually does: the steeper the ooze, the brighter.** Binned by tilt from rest, Cycles' green rises
  from 173 (flat) to 193 at 40-60°, as light passes through the thick jelly of a dome. The live basis was baked from
  a thin flat sheet tilted, which has nothing to glow through, so live steep sides sat 23/255 too dark.
- **Fix: the skin's own light times 1 + k·(tilt/60°)²** (`src/diorama/sludgeGlow.ts`, `?glow=`, default 0.4). Steep
  bins now match Cycles as well as the flat pool does (within 2 in green; red runs 4 over at the steepest, so a
  greener tint could come later). Fit 11.12 → 10.91. No extra GPU passes; a few instructions a pixel.
- **Judges can't tell the two apart:** three rounds each on fresh 96-frame clips, live caught 8/18 with the glow and
  7/18 without (chance 9), quality about even with Cycles either way. "Self-shadowing" still comes up as a tell,
  pointing both ways (once that the live crevices were too *bright*), so treat it as judge noise now. Their steady
  tell is highlights: sharper and shimmering against Cycles' softer ones.

### Live sludge, round 12: softer highlights (2026-11-25)

- **Measured against Cycles' a6 loop first** (`live/hlmetric.py`: share of the ooze above 200, mean gradient at
  highlight edges, frame-to-frame change where either frame is bright). Live's highlights had edges about twice as
  sharp (34 vs 18), flickered more (49 vs 34), covered a quarter more of the ooze (0.88% vs 0.71%) and clipped to white.
- **Softening alone made them bigger and bluer**: the glint keeps its total light, so a wider one lights more pixels
  (aa 1.2: 1.04% bright, blue bias 4.6). Cycles' are softer *and* dimmer.
- **Fix: glints spread over a whole pixel's turn of the mirror direction (aa 1, was 0.25) at 0.6 of the lamps'
  strength** (`glintKnobs()` in sludgeGlints.ts; `?aa=`, `?lights=`). Edges 22, flicker 30, bright 0.68%, top 0.1%
  at 235 (Cycles 249). Fit 10.92 → 11.13: a hair worse overall (the plain-colour fit punishes any spread), detail
  slightly better. `?soft=` (spreading by the coat's roughness) did the same job with more haze.
- **Judges: live caught 11 of 18** (two runs cut short by network errors; chance 9; the round before was 8 of 18),
  quality 8.7 live vs 9.3 Cycles. Within the noise of 18 trials, but no better. They still call live's highlights
  "hard-edged dots" now and then, and the new lead tell is the torn holes: "uniformly black voids" where Cycles'
  show a little light inside. Kept for the measured match; holes are the next thing to look at.

### Live sludge, round 13: light inside the torn holes (2026-11-25)

- **The judges' "uniformly black voids" were close but flat.** On fully torn pixels (the `?view=2` tear map over 235,
  24 frames against Cycles' a6) live's green was 27% short in light terms and carried a blue haze throughout (median
  blue 21 against 7), while Cycles' holes are a purer green with a cool, bright streak where the room shows in the
  dip's wet sides (blue 90th/97th percentile 71/84 against live's 49/66).
- **Cause: the torn set is a flat sheet.** `tear_NN.png` holds only broad, warm-grey reflections; the dip's curved
  sides that catch the cool light in Cycles aren't in it.
- **Fix (src/diorama/sludgeHoles.ts):** `hole` lifts the torn set's light per channel (1.15, 1.37, 0.6) and
  `holecoat` scales the coat's light over a hole (2, 3.2, 4.5), both blended by the tear so whole skin is unchanged.
  Hole green percentiles now 52/60/72/84/98/123 against Cycles' 51/61/71/85/99/123. Whole-frame fit 11.11 to 11.08.
  Scaling the coat alone did nothing visible (it is faint over face-on holes) until it was 2-4x and cooler.
- **Judges (pools-live17.mp4, 3 rounds of 6):** caught live 9 of 18 (3, 2, 4), exactly chance; round 12 was 11.
  Quality live 8.9 against Cycles 9.1. Holes came up once ("very dark and lack detail"); the lead tells are again
  hard, flickering highlights and missing "self-shadowing".
- **Still open:** live's pale ring around some slumped bubbles is a lantern glint on the rim (it goes with `lights=0`;
  Cycles shows only a small glint there). Cycles' torn edge also has a thin bright yellow lip that live lacks.

### Live sludge, round 14: the pale ring was every fairy bulb glinted twice (2026-11-25)

- **The ring is glints, not shape.** It goes with `lights=0`, comes back sharper (not gone) with less softening
  (`aa=0.25`), and the bump under it is the same in the bake script and live (sludgeBubbles.ts and sludge_bubbles.py
  share the settle ring, 0.07 H; live tilt there 2-5 degrees). Dropping lamp groups one at a time, only `FairyBulb`
  faded it much.
- **Cause: the room's lamp list has each fairy lamp twice.** `fairy2_N` (the light, radiance 471) and `FairyBulb2_N`
  (its glass bulb, same spot) were both mirrored, so 16 discs lit the gentle settle rings all the way round. Flat ooze
  had 1.8% glint pixels against Cycles' 1.0% (median filter 9, +20 over local); without the bulbs, 1.0%.
- **Fix:** `FairyBulb` joins the default skip list; with the copies out the lamps go back up from 0.6 to 1.2.
  Fit 11.08 to 10.55 (bulbs out at 0.6: 10.05, but only 0.17% bright against Cycles' 0.71%; at 1.8 bright matched,
  0.73%, fit 10.95). Share of live sparkles that sit where Cycles has one: 0.20 to 0.27.
- **Judges, 3 rounds of 6 each:** lights 1.2 caught 8 of 18, quality 9.2 against Cycles' 9.2 (first tie); lights 1.8
  caught 12 of 18, 8.5 against 9.1. Default 1.2.
- **Still open:** the ring is faint, not gone. Judges' new lead tells: no distorted reflections of the broken stone
  rim in the ooze (near-field reflections, open since round 5), and highlights that shimmer. Most of Cycles' bright
  spots (about 80%) have no live sparkle near them.

### Live sludge, round 15: there are no stone reflections to add (2026-11-25)

- **The judges' "distorted reflections of the stone edges" isn't in Cycles' frames.** By distance from the stone
  edge (L9 mask, 0-3 up to 25+ px), Cycles and live have the same colour within 4 levels and the same fine detail
  (|L - box5| 4.3 / 4.4 at the edge, 2.1-2.8 further in). Round 4 had already measured Cycles' coat mirroring the
  room at 0.2-0.5%. Nothing to build; the tell names the wrong cause.
- **What is different is motion.** Per-pixel change over the loop is 15-25% lower in live at every distance from the
  edge (time std 13.0 against 15.3 in open ooze). Its 90th percentile is 14 against Cycles' 21, while the 99.9th
  matches (106 against 104): the sharp glints move enough, the broad soft glows don't. With lamps off, live's 90th
  falls to 11, so most broad motion comes from the basis's tilt blend, which crossfades 15-degree rings and mutes them.
- **Next, if taken:** stronger broad glows on ripples (the base layer's soft lamp lobes, or a finer tilt basis).
  Picture: live/round15-glows.png.

### Live sludge, round 16: drawing the base shine live, again, loses to the baked one (2026-11-25)

- **Cycles' base-layer shine lands in only 6 of the 33 tilt renders.** L9 minus L10 (the same set baked without the
  base shine, LIVE_SPEC=1) is the shine itself: narrow warm hits at tilt 0, 15/0, 15/180, 15/270, 45/270 and 60/270,
  colour about 1 : 0.56 : 0.26, and nothing in the other 27. The crossfade between tilts 15° apart throws most of it
  away, which is round 15's missing motion. (`/tmp/bs/specdiff.py`.)
- **Drawn live it matches Cycles' motion and colour, but the judges like it less.** On L10 with `broom=0` (the base
  layer mirrors no room), `bhalo=0`, `bgain=2`, `btint=1.2,0.8,0.3`: per-pixel frame change at the 50th/90th/99.9th
  percentile 2/19/123, exactly Cycles' (L9 1/18/126), colour bias within 2.5 levels. Loop fit 11.85 (L9 10.55).
  Blind judges caught it 11 of 18 (L9 8 of 18), quality 8.8 vs 9.1, and named its highlights flickery.
  With the soft halo on (`bhalo=0.7`) fit 11.17 but caught 17 of 18, quality 7.9 vs 9.8, "shimmer" and "aliasing"
  in most answers.
- **Without a tint the live shine is too blue** (red -10, blue +8 levels): the lantern is drawn near-white, Cycles'
  base shine has almost no blue. Letting the warm fill into the glint list (skip without warmfill) made it worse:
  it lights the coat too.
- **Kept: round 14's L9 defaults.** No code changed. A finer tilt set is cheap to render (about 3 s a tilt, 33 tilts
  in 96 s) but doubles the GPU memory for 7.5° steps, and the shine is only about 3° wide, so it would still be
  sampled. At 8 of 18 caught (chance is 9) and a quality tie, the sludge is at parity with Cycles for the judges.

### Trapdoor, round 1 (2026-11-25): code-built oak planks that swing down

Wesley picked draft A (weathered oak planks, two iron straps, a ring pull) and asked that the door open DOWN into the
pit, so a falling figure never clips through it. Built free in Cycles, no Meshy: `trapdoor_geom.py` (plain-Python
layout, tested by `test_trapdoor_geom.py`), `build_trapdoor_cycles.py` (Blender), `runtrap.sh OUT RES SAMPLES STATES`.
- The hinge sits 1.2 plank-thicknesses in from the back wall, or the hung door's back face cuts into the wall.
- The set has a Ground plate, the box's FrameBase and the HazeVolume 0.08 of a square under the slabs. A hole cut
  only through the slab is 0.08 squares deep and reads as a grey recess. Cut all of them (the ray probe CHECK lines).
- A pit lit like the floor reads shallow. A lid under the hinge, invisible to the camera, letting 30% of the light
  through (`--dim`), shades the hung door and walls the way a real hole is shaded.
- The set's oak (`stage._wood_mat`) under the warm lights reads red. WOOD_TINT only multiplies; a Hue/Saturation node
  (0.65 sat, 1.15 value) after it gave the weathered grey-brown of the draft.
- Smooth icosphere moss tufts read as lily pads; 40 tiny bumps per tuft read as flock.
- Blind judges (3 rounds, 4 trials each) caught the render every time against the Gemini draft; their remaining
  notes are refinements (more, narrower planks; ring off-centre; narrower gap round the door).

### Trapdoor drop (2026-11-25): timed by real clips and gravity
- Reference: two model gallows trapdoors (a cardboard miniature and an O-scale one) drop in about 2 frames at 24 fps.
  A board hinged at one edge falling under gravity (th'' = 3g/2L cos th) predicts 2-3 frames for a 3-5 cm door,
  so the same physics times ours at full size: a 1.9 m door takes 16 frames to swing down. A third, "full-size"
  gallows clip had no drop in it; a search title is no promise, look at an overview tile sheet before cutting.
- The tip of a falling hinged board accelerates at 1.5 g, faster than a falling figure, so the door drops away from
  whoever stands on it: no clipping by construction.
- The pit's back wall stops the door just past plumb (`trapdoor_geom.wall_deg`, about 90.8 deg). It bangs there and
  rocks back 14 deg then 4 deg (a cheat: real rocks that size take a second), then rests at FALLEN_DEG. 35 frames.
- In the game camera the motion reads in the first 12 frames; once past about 60 deg the door hides under the pit's
  front lip and the rocks show only as a small shift.
- Renders: `runtrap.sh OUT RES SAMPLES d0,d1,...` (drop frames, or plain degrees). 5 s a frame at 1200 px, 96 samples.

### Trapdoor sprite bake (2026-11-25)
- Each frame renders the whole set (haze too) and crops to the slab; alpha comes from one mask pass (everything else held out, haze hidden, door shut). The door never leaves its hole, so one mask fits all 35 frames.
- The mask pass punches pinholes where rays slip through plank gaps or under a neighbour's moss tuft. The colour is right there anyway, so fill every hole not connected to the border (`trapdoor_geom.enclosed_holes`, threshold 0.98 so half-clear rims fill too).
- Check holes on a magenta backdrop, enlarged with NEAREST. On grey they look like "white slivers" and send you hunting for lighting bugs.
- Seam checks must apply the set's exposure (set5 is −0.35, sprites 0) before pasting.
- Area lights used only to light the pit (trap_glow) need `visible_camera = False`, or they show as a speck.
- `TRAP_PROBE="x,y ..."` prints every object a camera ray through those full-frame pixels hits.
- In the game (src/diorama/TrapdoorSprite.tsx): one sheet per square, 25 squares at 5.1 MB. Each sprite gets its own `<Suspense>` with the flat stand-in as fallback; a missing sheet once blacked out the whole scene.
- Floor sprites draw only the main material, not the onCards copy, so a door never covers a figure card.
- build_trapdoor_cycles.py reused `j` in the moss loop and wrote a wrong square into drop.json; pack_trapdoor.py takes the square from the folder name.
- Blind judges (3 rounds: 4, 4, 7) claimed identical pits and doors clipping the stone on edge columns; enlarged crops showed neither. Check judge claims on crops before acting on them.

### Any-level bake (2026-11-26)
Wesley wants levels of any shape (long, multi-story, areas joined by travel), so the set is no longer one fixed box.
- The builder lives in the repo: `tools/art/diorama/stage.py`, every look setting in `look.env` (the set bake, the
  trapdoor bake and any later square bake all source it). The old trapdoor runner used TILE_VAL 0.5 and JOINT_MOSS
  1.8 while the set used 0.66 and 2.4; one file stops that drift.
- `stage.build_stage(board=(nx, ny))`: a rectangle is the short side's square stretched at the same density (trees,
  moss, bulbs per wall length; lights repeated along the long side, wide boards at 0.8 of the energy or the floor
  reads 1.25x brighter; one lantern only on deep boards, copies doubled their stretch). Squares are unchanged
  (3/5/8 within 0.01 mean of the old bakes).
- `level_camera.set_camera`: squares keep the locked play camera; rectangles are fitted to the whole box (35 deg,
  50 mm, 92% of the frame). The trapdoor bake uses the same function, so its sprites line up with the level's set.
  The game sees a rectangle from the bake's own camera (`set.ts viewFor`). Panning stops for long boards: next.
- A bake is named by its layout key (FNV-1a of size + drawn squares, `levelBake.ts` and its twin `level_layout.py`,
  both pinned to tests/level-key.txt). `bake_level.py PUZZLE` bakes set + every trapdoor into
  `public/diorama/levels/{key}/` and lists it in `levels/index.json`; no bake = the cut 3/5/8 set as a preview.
- Run it with `uv run --no-project --with numpy --with pillow` (Homebrew python has no Pillow).

## Long levels: a camera that pans between baked stops (2026-11-26)

- A board bigger than one view (past 8 across or 6 deep, `level_layout.WINDOW`) is baked from several stops: one
  camera slid along the board, never turned, each stop framing an 8x6 window. Stops sit at most 3 squares apart
  (`STEP`) and reach both ends. A 5x12 hall gets 3 stops.
- All stops render in one Blender run (`bake.sh` with `STOPS=1`), so fairy bulbs are cleared against every stop
  camera and the lights match from stop to stop. Each stop writes `set-s{k}.*`; each trapdoor is baked from every
  stop whose window holds it (`trap-{x}-{y}-s{k}`); `levels/index.json` lists the stops and which see which door.
- In the game (`src/diorama/pan.ts`): the camera rests on the stop nearest the picked piece, else your king, with
  0.75 squares of slack so it doesn't flick on a line. A 40 px swipe moves one stop over; the board follows the
  finger. The slide takes 650 ms and dithers the old stop's picture out over the new one, only once the new one
  has loaded. A door with no sheet from this stop borrows the nearest stop's.
- Seen in the smoke bake: at 35 degrees even the front stop sees far down the hall, so panning mostly brings the far
  rows closer rather than revealing them.
- A square board past 8 now bakes `set12`, not `set12x12` (the name bake_set writes).
