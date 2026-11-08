# Board props

Painted art for things on the board that aren't pieces: the spear trap's floor switch
(armed and pressed), its wall launcher and the spear in flight. Files in
`src/assets/props/`, drawn by CSS in `src/exile.css` (`.floor-switch`, `.spear-launcher`,
`.spear-volley`). Look rules: `docs/art-style.md`.

## Make or re-roll a prop

Same pipeline as the characters (`PAINTED.md`): Nano Banana Pro (`google/nano-banana-pro`)
with the style sheet `docs/art/sheet-armour-talks.webp` as the only reference, then the
BRIA cutout (`bria/remove-background`), then `prop.mjs`.

1. `node tools/art/gen.mjs docs/art/recipes/paint-prop-<name>.json` (output in
   `art-out/paint-prop-<name>/`). Look at the paint step at full size; re-roll if the
   outline is thin, the shading has gradients, or anything from the sheet leaks in.
2. `node tools/art/prop.mjs art-out/paint-prop-<name>/step-1-paint.png
   art-out/paint-prop-<name>/step-2-cutout.png <file> <flags>`, with `file` and `flags`
   from the recipe's `prop` block (for the pressed switch the colour is `step-2-pressed.png`
   and the cutout `step-3-cutout.png`). It trims, scales and thickens the outer outline in
   ink, as `sprite.mjs` does for characters.
3. If the size changes, update the `aspect-ratio` of `.spear-launcher` / `.spear-volley i`
   in `src/exile.css`.

| Recipe | File | Flags | Pick (Nov 8 2026) |
|---|---|---|---|
| `paint-prop-switch.json` | `switch.webp` | `--height 240 --outline 6` | Second of two rolls: carved side arrows meet the button ring, white highlight tick. |
| `paint-prop-switch-pressed.json` | `switch-sprung.webp` | `--height 240 --outline 6` | One edit of that pick (step 2 of the recipe); arrows glow after firing. |
| `paint-prop-launcher.json` | `launcher.webp` | `--height 160 --outline 5` | First of two rolls: three-quarter crate, spring coil on top, muzzle with spear tip. |
| `paint-prop-spear.json` | `spear.webp` | `--width 640 --outline 5` | Second of two 16:9 rolls; the first painted the sheet's panels under the spear. |

## Notes from the rolls

- Only the style sheet as reference. Adding a character sprite (transparent webp) as a
  second reference leaked its feet into the picture.
- The spear at 21:9 copied the reference sheet's panels; at 16:9 with "Using ONLY the art
  style of the attached character select sheet (do not copy its layout, characters,
  panels or text)" it came out clean.
- The pressed switch is an edit of the armed paint, so the slab and frame match.
- These rolls ran through the image-gen tool on Replicate (same models and prompts as the
  recipes), because no `REPLICATE_API_TOKEN` was set in that session; `gen.mjs` sends the
  same requests.

## Item icons (Nov 8 2026)

The bag's icons in `src/assets/items/`, drawn by `table/ItemSlots.tsx`. The decoy's icon is
also the straw pawn on the board (`decoyBox` in `SpriteRig.tsx`, drawn at a pawn's height).
Nano Banana Pro (through Replicate as `google/nano-banana-pro`) with
`docs/art/sheet-armour-talks.webp` as the only reference, BiRefNet ToonOut cutout
(`refine_fg: true`), then `tools/art/prop.mjs`.

| File | Size flags | Note |
|---|---|---|
| `bomb.webp` | `--height 160 --outline 5` | One roll, kept. |
| `decoy.webp` | `--height 240 --outline 6` | 3:4. Two rolls; the squat one on a wide base (reads as a pawn, no cast shadow) over the tall one on a stem. |

Both prompts end with this closing sentence: "A VERY thick black outer outline all the way
round. One object only, centred, filling most of the frame with a small margin, on a plain
flat light grey background (#d8d8d8), no ground, no cast shadow, no text, no labels, no
frame."

- **Bomb** (1:1): "Game item icon, painted as one single whole image, in the exact art style
  of the first image (a character select sheet): bold flash-era 2D brawler cartoon, very thick
  even black outlines, flat fills, one hard cel shadow, crisp white highlight ticks on metal.
  Subject: a classic round cartoon bomb. A heavy iron ball painted dark slate (#3b3f45) with a
  hard darker shadow on its lower right and one big crisp white highlight tick on its upper
  left, a short chunky iron cap on top with two round rivets, and a short curling rope fuse
  coming out of the cap, its tip lit with a bright yellow and orange spark (#ffd34d, #f08a2a)
  shaped like a small star burst. Slight three-quarter view, the fuse curling up and to the
  right. Simple chunky shapes, few interior lines, so it reads clearly at 32 pixels." + the
  closing sentence.
- **Decoy** (3:4): "Game character sprite, painted as one single whole image, in the exact art
  style of the first image (a character select sheet): bold flash-era 2D brawler cartoon, very
  thick even black outlines, flat fills, one hard cel shadow. Subject: a straw training dummy
  shaped like a chess pawn, standing upright, full body, facing the viewer at a slight
  three-quarter angle. A round head made of a stuffed burlap sack (#d9b26a) tied off at the neck
  with rough twine, two big black stitched cross marks for eyes and a stitched straight mouth,
  tufts of straw (#e8c860) poking out of the top of the head and from the neck tie. A short round
  stuffed burlap body with patched seams and straw sticking out at the sides like little arms,
  sitting on a flared round wooden base painted warm brown (#865637) like a pawn's foot, with a
  hard darker shadow. A faded red painted target circle (#cd2a25) on its chest. Squat chunky
  proportions like a chess pawn, simple shapes, few interior lines, so it reads clearly at 48
  pixels." + the closing sentence, with "One figure only" for "One object only".

Image models aren't deterministic and Nano Banana Pro takes no seed: the committed webp
files are the canonical art. The spear trap's prompts live in its recipes.
