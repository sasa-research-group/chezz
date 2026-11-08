# Board props

Painted art for things on the board that aren't pieces: the spear trap's floor switch
(armed and pressed), its wall launcher and the spear in flight. Files in
`src/assets/props/`, drawn by CSS in `src/exile.css` (`.floor-switch`, `.spear-launcher`,
`.strike-bolt.spear-bolt`). Look rules: `docs/art-style.md`.

## How they were made (Nov 8 2026)

1. Nano Banana Pro (`google/gemini-3-pro-image`), with `docs/art/sheet-armour-talks.webp`
   as the only reference image, on a flat `#d8d8d8` background. Two rolls each; the
   picks are below.
2. Pressed switch: an edit of the armed switch (same model), so the slab matches.
3. Cutout: BiRefNet ToonOut (`sprited/birefnet-toonout`, `refine_fg: true`).
4. `node tools/art/prop.mjs <painted.png> <cutout.png> <out.webp> ...`: trims, scales and
   thickens the outline in ink, as `sprite.mjs` does for characters.

| File | Size flags | Note |
|---|---|---|
| `switch.webp` | `--height 240 --outline 6` | Straight-on roll, earthy stone; the 3/4-tilted roll fought the square tile. |
| `switch-sprung.webp` | `--height 240 --outline 6` | Edit of `switch.webp`. |
| `launcher.webp` | `--height 160 --outline 5` | The roll with a coil spring across the top reads as "wound up". |
| `spear.webp` | `--width 640 --outline 5` | 21:9 (the model refuses 4:1); the roll with the bigger leaf head. |

Every prompt opens with this style block:

> Game prop sprite, painted as one single whole image, in the exact art style of the first
> image (a character select sheet): bold flash-era 2D brawler cartoon, very thick even
> black outlines, flat fills, one hard cel shadow, crisp white highlight ticks on metal.

Subjects (each ends with "A VERY thick black outer outline all the way round. One object
only, centred, filling most of the frame with a small margin, on a plain flat light grey
background (#d8d8d8), no ground, no cast shadow, no text, no labels, no frame."):

- **Switch** (1:1): a stone floor pressure plate trap switch for a medieval dungeon floor
  tile, seen from above at a slight three-quarter tilt. A square slab of rough grey stone
  with chunky bevelled edges, set in a dark iron frame with four big round rivets at the
  corners. In the middle a big raised round button painted bright red (#cd2a25) with an
  iron ring around it and one crisp white highlight tick, clearly sticking up, ready to be
  stepped on. One small chip in the stone corner as a sign of wear. Simple chunky shapes,
  few interior lines, so it reads clearly at 48 pixels. Earthy greys and iron, with the red
  button as the one bright accent.
- **Pressed switch** (edit of the switch): Change only the round red button in the
  middle: it has been pressed all the way down, so it now sits flush, sunk into its iron
  ring with no visible side wall, and its colour is a dull dark brick red (#7a2a24) with no
  white highlight. Keep everything else exactly the same.
- **Launcher** (1:1): a wall-mounted spear launcher trap, seen from the side, facing
  RIGHT. A chunky square box of dark wooden planks (#5f3f2c with lighter #865637 plank
  faces) bound with two thick iron bands with round rivets, with a coiled iron spring
  visible on top. On its right face a round dark hole, and the steel tip of a loaded spear
  pokes out of the hole to the right, pointing right. Squat and compact, about as tall as
  it is wide. Simple chunky shapes, so it reads clearly at 32 pixels. No wall behind it.
- **Spear** (21:9): one long medieval throwing spear lying perfectly horizontal, pointing
  to the RIGHT. A straight light-brown wooden shaft (#a57952) with a darker wood shadow
  stripe along its underside, a leather grip wrap near the back end, and at the right end
  a big leaf-shaped steel spearhead (#8a9094 with a hard darker shadow half and one white
  highlight tick) on a short iron socket. Chunky proportions: the spearhead is large and
  bold, the shaft thick enough to read at small size. No motion lines.

## Item icons (Nov 8 2026)

The bag's icons in `src/assets/items/`, drawn by `table/ItemSlots.tsx`. The decoy's icon is
also the straw pawn on the board (`decoyBox` in `SpriteRig.tsx`, drawn at a pawn's height).
Same method as above: Nano Banana Pro (here through Replicate as `google/nano-banana-pro`)
with `docs/art/sheet-armour-talks.webp` as the only reference, BiRefNet ToonOut cutout
(`refine_fg: true`), then `tools/art/prop.mjs`.

| File | Size flags | Note |
|---|---|---|
| `bomb.webp` | `--height 160 --outline 5` | One roll, kept. |
| `decoy.webp` | `--height 240 --outline 6` | 3:4. Two rolls; the squat one on a wide base (reads as a pawn, no cast shadow) over the tall one on a stem. |

- **Bomb** (1:1): "Game item icon, painted as one single whole image, in the exact art style
  of the first image (a character select sheet): bold flash-era 2D brawler cartoon, very thick
  even black outlines, flat fills, one hard cel shadow, crisp white highlight ticks on metal.
  Subject: a classic round cartoon bomb. A heavy iron ball painted dark slate (#3b3f45) with a
  hard darker shadow on its lower right and one big crisp white highlight tick on its upper
  left, a short chunky iron cap on top with two round rivets, and a short curling rope fuse
  coming out of the cap, its tip lit with a bright yellow and orange spark (#ffd34d, #f08a2a)
  shaped like a small star burst. Slight three-quarter view, the fuse curling up and to the
  right. Simple chunky shapes, few interior lines, so it reads clearly at 32 pixels." + the
  closing sentence above.
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
  pixels." + the closing sentence above, with "One figure only" for "One object only".

Image models aren't deterministic: the committed webp files are the canonical art.
