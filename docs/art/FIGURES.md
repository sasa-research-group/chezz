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
| 7 Idle pose | `tools/art/diorama/guard_pose.py` (IK, clay fists, prop) | free | side by side with step 2; `strike_check.py` clean |
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
- Match the approved pose draft from the same camera, side by side, before showing it.

**Motion**
- Library mocap is for walking only. Attacks, hits and deaths are hand-made keys.
- Import clips at 30 fps (set the scene fps before import), or they play too slow.
