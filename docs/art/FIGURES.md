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
