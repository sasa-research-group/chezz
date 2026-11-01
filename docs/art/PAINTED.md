# Painted sprites

Image-generated parts hung on the same rig as the drawn art. Behind `?art=paint`;
pieces without painted parts fall back to the SVG kit (`?art=new`). All twelve pieces are
painted (Nov 2026); skins and the red patrol fall back to the kit. Decision record:
`DECISIONS.md`, "painted sprite pilot" and one entry per pair. `cut-parts.mjs` takes an
optional recipe `fuzz` (background-fill tolerance, default 14) for parts with gappy outlines.

## How it works

1. **Recipe** (`docs/art/recipes/paint-<side>-<kind>.json`, run by `tools/art/gen.mjs`):
   three Replicate calls.
   - `pose`: Nano Banana Pro paints a full-body, right-facing game pose from the
     reference crop, the style sheet and a render of the SVG rig (for pose and proportions).
   - `parts`: the same model cuts that pose into a paper-doll sheet: head (blank face, no
     eyes), body (neck stump, no arms), back arm, front arm, prop, and a door for rooks, in a
     fixed layout on flat grey. Give it only the pose: with the style sheet as a second
     image it copied the sheet's oddball row into 2 of 4 sheets.
   - `cutout`: `bria/remove-background` makes the sheet transparent (it returns 1024 px; the
     cut step only uses its alpha).
2. **Cut** (`node tools/art/cut-parts.mjs <recipe> --install`): strips the background and the
   white die-cut border the model draws, finds each blob and gives it to the nearest centre
   in the recipe's `parts`, scales by `partScale`, turns any part in `rotate`, thickens the
   outer outline by `outline` px in ink, and writes trimmed webp plus `sizes.json` into
   `src/assets/paint/<side>-<kind>/`. If a part is missing it prints the blob centres: move
   that part's centre in the recipe.
3. **Place** (`src/components/paint/specs.ts`): one entry per character. Each part pins a
   pixel of its image (`anchor`) to a rig point (`at`), and that point is its pivot: arms at
   the shoulder, the prop's grip at the front fist (`hand`, derived), the door at its top
   edge. `unit` is rig units per pixel for the whole character; `zoom` scales the figure
   about the feet; `scale` per part. Read anchors off the cut images (a 25 px grid helps).
4. **Rig** (`src/components/PaintedRig.tsx`): one generic builder. Groups and classes follow
   `RIG.md`, so `rig.css` drives everything. Eyes, KO crosses and the effort squint stay
   vector over the painted head (`face`), so blink, hit and death still read.

## Rig differences from the SVG kit

- The prop sits inside `.arm-front`, so the cheer lifts the fist and prop together; painted
  rigs pump the arm (`rig-pump`) instead of the shared 35° raise, which laid the prop back.
- Painted rigs carry both `art-paint` and `art-new`, so kit rules keyed on `art-new` (the
  pawns' idle sweat, the stonemason's `rig-slam`) apply to them too.
- Arms carry their own inline `transform-origin` at the shoulder, not the shared 60,70 / 40,70.
- `armBackOver` draws the back arm over the body where the torso was painted with an
  empty armhole (patrol pieces, the stonemason).
- `armFrontOverHead` draws the front arm and its prop after the head, for a prop tip the
  headgear would otherwise cover; without it the head draws over the arm (patrol knight).
- Lost: the pupil dart and blink on the patrol rook (his slits are painted); the toon
  yell and ouch mouths (none of the new art has them either). Everything else plays.

## Limits that shape a character

- Figure box x 18–82, y ≥ 0 (`tests/figure-bounds.test.ts` checks the image boxes). Painted
  props are wide (fork tines, hammer and axe heads), so the fist must sit near x 70 and props
  are held off the ground when they need height. Turn arms in the cut (`rotate`), not in
  `specs.ts`: a rotated image's box overshoots its ink and fails the bounds test.
- At 48 px the generated outline is a third of the kit's; the cut's `outline: 12` brings
  it close. Rooks need their helm at about 1.3× to keep the battlements in silhouette.
- Patrol only in royal blue; the red hue falls back to the SVG kit.
- Not deterministic: a re-run gives a similar character with new anchors to read.

## Add a character

1. Render its SVG rig facing right: `node tools/art/shoot.mjs <kind>.<side> out.png --crop 192 --scale 2`,
   flop it for the patrol, crop the caption, save as `docs/art/paint/svg-<id>.webp`.
2. Copy a paint recipe, change the SUBJECT text in `pose` and the part names in `parts`.
3. `node tools/art/gen.mjs <recipe>` (about $0.29: two Nano Banana Pro calls and one
   BRIA call). Re-roll one step with `--from 2`.
4. `node tools/art/cut-parts.mjs <recipe> --install`; fix `parts` centres if it complains.
5. Add its entry to `specs.ts`; check `npx vitest run tests/figure-bounds.test.ts`, the
   studio (Catalog → Painted, and Rig → Painted) and
   `node tools/art/shoot.mjs <kind>.<side>.paint out.png`.

## Kings

- The crown is its own part (`crown` in the recipe and `specs.ts`). The parts step paints the
  head without it (hair on top where the crown sat) and the crown alone in the bottom-middle
  cell. `PaintedRig.tsx` hangs it in a `.crown` group inside the head, so the checkmate
  finale throws it off and leaves the bare head.
- The sword's grip sits so the crossguard shows just above the fist and the pommel just below
  it; anchoring the grip at the blade's middle hides the guard inside the big painted fist.
- The patrol king's first parts sheet painted both arms into the body. The recipe now says
  "NO arms, NO sleeves and NO hands at all"; check the body for stray fists before cutting.
- The patrol cape hangs behind the robe, so his back arm stays behind the body (no
  `armBackOver`) and the cape shows on his back side.
- The studio sheet (`shoot.mjs`) shows a `mate` row for kings, so a judge sees the crown fly.

## Bishops

- Recipes `paint-rebel-bishop.json` and `paint-patrol-bishop.json`, pose references
  `paint/svg-<side>-bishop.webp`. Both front fists grip the shaft in the pose prompt; the
  crook and crozier ask for a curl "about as wide as a fist" so the prop fits x 18–82.
- The patrol's first parts sheet painted both sleeves and gloves onto the cope as well as
  the separate arms. The body line now says "NO sleeves, NO gloves, NO hands on the body";
  the re-roll (`--from 2`) came out clean.
- Rebel: glow eyes (vector) in the painted hood void, so blink and KO play. Patrol: lenses
  are painted glass (`eyes: false`), like the patrol rook, so he loses the blink and pupil dart
  too; the KO crosses land on the lenses.
- Both bishop bodies pin the boot-sole centre to the feet (50, 108) rather than the neck, so
  the long robe stands on the baseline whatever its height.
- Patrol placement: body and head sit left of centre (x 46–47) so the crozier stands clear
  of the cope with a gap and its curl clears the mitre, all inside x 82.

## Queens (Nov 2026)

- Recipes `paint-rebel-queen.json` and `paint-patrol-queen.json`, pose renders
  `paint/svg-*-queen.webp`. The pose prompt asks for the fist "clearly wrapped round" the handle
  or rod and a narrow prop (pan no wider than the brim, orb no wider than the face).
- No door, so the parts layout has an empty bottom-middle cell. The patrol queen's first parts
  sheet came back in a different layout; read the blob centres off the sheet before cutting.
- The queen's old `rig-slap` turns `.arm-front` up 70° while the shared swing turns the prop down
  65°. On a painted rig the prop rides in that arm, so the two cancel and the pan just rises.
  `rig.css` skips the slap on `art-paint` queens, and the rebel queen's pan has its own strike
  (`propClass: "pan"`, `rig-pan`). Under the shared -55° wind-up the pan hid behind her wide
  brim, so `rig-pan` cocks it back only 14° and lifts it.
- The patrol wig: asked for "about 1.3 times as tall as wide" with ridged rolls. The head part
  (wig, crown, cap and face) comes out about 1.55:1, so it reads tall at 48px. The collar stays
  tan lace from the pose: asking the parts step for a white collar didn't change it, because
  the parts copy the pose.

## Knights (Nov 2026)

- **Rebel knight** (`paint-rebel-knight.json`): the hobby horse is cut whole at the angle he
  holds it ("at exactly the same angle as in the first image"), so `specs.ts` needs no
  prop rotation; its grip is the top of the stick under the head, and its stick reaches the
  ground behind him. The head is pinned high (helm rim at y 58) so the blue neckerchief
  shows; the arms are scaled down (0.8–0.85) so the vest shows between them.
- **Cream parts need `fuzz`.** The flood fill that removes the background and die-cut
  border uses a 14% colour fuzz by default; it ate the knight's cream sleeves through gaps
  in their outline. The recipe's `"fuzz": 5` keeps them.
- **Patrol knight** (`paint-patrol-knight.json`): the horse is part of `body`, with the
  rider's torso, saddle and near leg. The parts step mirrored the horse once; the prompt now
  says "facing RIGHT ... do not mirror it". The lance stands in the front fist on the
  horse's rump side, as in the SVG rig, so `rig-lance` couches it forward over the horse.
  The front arm is turned 50° in the cut so it reaches out to the lance and crosses it only
  at the fist; a straighter arm hid the lance behind the sleeve.
- **Patrol knight repaint.** The pose asks for a dark charcoal horse whose head
  stretches forward with a gap before the rider, a big armet (domed, pointed visor, one eye
  slit, two breath slits, not a T-slot bucket that rhymed with the rebel's) and a low grip on
  the lance. The plume still sweeps back over the lance side whatever the prompt says, so the
  spec sets `armFrontOverHead`: the front arm and lance draw over the head, and the helm can
  be 1.25× with the tip still showing. The grip anchor sits near the butt (prop pixel y 640
  of 749), so `rig-lance` couches the long end forward past the horse's nose; gripped
  mid-shaft, the butt trailed backward and the strike read as pointing away from its hit.
