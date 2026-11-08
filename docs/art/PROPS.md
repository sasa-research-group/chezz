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

Image models aren't deterministic: the committed webp files are the canonical art.
