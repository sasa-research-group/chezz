# Painted sprites

The game's art: one generated image per piece and per skin, moved whole. No parts, no
bones: every animation moves the whole sprite and adds effects. Look rules:
`docs/art-style.md`. Skins: `SKINS.md`. Concept sheet and new-concept prompts: `recipe.md`.

## Setup

- Node 18+, ImageMagick (`magick` on PATH).
- A Replicate API token: `export REPLICATE_API_TOKEN=r8_...`. Never commit it.
- Cost: about $0.15 per character (one Nano Banana Pro call, one BRIA cutout).

## Make or re-roll a character

1. Copy a recipe in `docs/art/recipes/paint-*.json` and change the SUBJECT and `EYES:`
   text in the `pose` step. Keep the shared `POSE`/`SILHOUETTE`/`STYLE` blocks.
2. `node tools/art/gen.mjs <recipe>` (`--dry-run` prints the requests; `--from 2` redoes
   only the cutout). Output goes to `art-out/<id>/` (gitignored).
3. Look at `art-out/<id>/step-1-pose.png` at full size and at 48px. Re-roll wrong arms,
   anatomy, a missing crest or missing eyes.
4. `node tools/art/sprite.mjs <recipe> --install` writes `src/assets/sprites/<id>.webp`
   and its size in `sizes.json`.
5. Look at it in the studio (`art.html`: Cast, then the Stage at 0.25×). For a close
   look or a tall crest: `node tools/art/shoot.mjs <kind.side[.skin]> out.png`
   (`--scale 2 --crop 192` for close-ups) and `node tools/art/battle-shot.mjs <kind> out.png`.
6. Commit the recipe with the sprite. If the owner chose something, add a line to
   `DECISIONS.md`.

`npm test` checks every recipe parses, names files that exist, and every sprite stays
in the figure box.

## Recipes

JSON: `steps` (each with `prompt`, `images`, optional `model`, `aspect_ratio`, `input`),
optional `postprocess`, `output`, and for paint recipes a `sprite` block (`height` 480,
`outline` 12) read by `sprite.mjs`. In `images` the first entry is the source, the rest
references; `"$previous"` is the previous step's output. Paths are relative to the repo.

A paint recipe has two steps:
- `pose`: Nano Banana Pro paints one full-body, right-facing sprite from the reference
  crop (`docs/art/<id>.webp`), the style sheet, an optional pose reference
  (`docs/art/paint/svg-<id>.webp`, renders of the retired SVG art, pose only) and, for a
  skin, the rebel piece's own sprite so the crest matches.
- `cutout`: `bria/remove-background` (`"imageField": "image"`, no prompt).

`sprite.mjs` takes colour from the pose and alpha from the cutout, erodes a pixel of
fringe, drops specks, trims to the ink, scales to 480 px and thickens the outer outline
by 12 px (about 1.2 units in game).

Image models are not deterministic and Nano Banana Pro takes no seed: the committed
webp files are the canonical art; a re-run gives a similar character.

## Prompts that work

- Keep each recipe's SUBJECT text: it carries the owner's decisions.
- Add an `EYES:` sentence per character (dot eyes, glints in helm slits, dots behind
  lenses). "he is NOT blank-eyed: a solid black dot eye … in the middle of EACH lens"
  fixed the patrol bishop.
- Check every fist holds its prop: one patrol knight roll lost the lance grip.

## Drawing and animation

- `SpriteRig.tsx`: `spriteBox` fits the image into the figure box (x 18–82, feet on
  y 108, at most `HEIGHT[kind]` tall, `SKIN_HEIGHT` for a short skin). Wide props make
  the whole figure smaller.
- `PieceRig.tsx` draws `<svg class="rig rig-<kind> rebel|patrol [skin-<id>] act-<action>"
  viewBox="0 0 100 120">`:
  ```
  svg.rig
  ├ ground: .rig-shadow (ellipse rebel, diamond patrol), .fx-dust, .fx-lines
  ├ .flip › .hop › .squash › image.sprite + .shield
  ├ .fx-side › .fx-burst, .fx-stars, .fx-crown (king)
  └ .fx-pop, .fx-smoke
  ```
  `.flip` mirrors the patrol to face left; `.hop` carries jumps, the hit flash and knight
  flips; `.squash` carries squash, lean, lunge, knockback and fall.
- `src/rig.css`: pivots, shield, shared effects, knight flips, reduced motion.
  `src/sprite.css` (loaded after): whole-sprite keyframes per action and skin quirks.
- One-shot lengths at 1× are `RIG_MS` in `PieceRig.tsx`; every duration is
  `calc(<ms> * var(--spd,1))`. The game sets `--spd` to 1, 0.3 (fast) or 0.1 (reduced
  motion); the stage's slow modes use 2, 4 and 10.
- Sequences live in `App.tsx`: a knight strike is leap, attack, leap-back; checkmate
  plays `mate`.

| Action | Motion | Effects |
|---|---|---|
| idle | breathing squash with a small bob | — |
| wounded / guarding | reddish tint and tremble / braced lower | shield |
| move | crouch, hop arc, squash on landing | lines, dust |
| attack | lean back, lunge 26 units, snap back | burst, stars, lines |
| defend | brace squash | flash, shield |
| hit | white flash, knockback, settle | damage pop |
| death | flash, hop, tips over, lies flat, fades | smoke, dust, stars |
| cheer | two jumps | sparkles |
| leap / leap-back | front flip and backflip | lines / dust |
| mate | staggers, tumbles, lands flat | crown particle flies off |

## Limits

- One image, so nothing moves on its own: no blink, no prop swing; the mate crown is a
  separate particle.
- Patrol is royal blue only.
- At 48px painted interiors (chainmail, fur, rust speckle) soften.
