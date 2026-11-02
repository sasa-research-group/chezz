# Painted sprites

The game's art: one image-generated sprite per piece, eyes painted in. No parts and no
rig: every animation moves the whole sprite and adds effects. All twelve pieces and the six
skins are painted (Nov 2026; skins in `SKINS.md`, "Painted skins"); the red patrol falls back
to the SVG shape kit, and `?art=new` shows the whole game in the kit. Decision record:
`DECISIONS.md`, "painted sprites become whole images" (the owner's verdict on the cut-out rigs),
"studio rebuilt around the painted sprites" (they become the default)
and the earlier per-pair entries, whose looks still hold.

## How it works

1. **Recipe** (`docs/art/recipes/paint-<side>-<kind>.json`, run by `tools/art/gen.mjs`): two
   Replicate calls.
   - `pose`: Nano Banana Pro paints one full-body, right-facing game sprite from the reference
     crop, the style sheet and a render of the SVG rig (`paint/svg-<id>.webp`, for pose and
     proportions only).
   - `cutout`: `bria/remove-background` makes it transparent (it returns 1024 px; the next step
     only uses its alpha).
2. **Trim** (`node tools/art/sprite.mjs <recipe> --install`): takes the colour from the pose and
   the alpha from the cutout, erodes a pixel of grey fringe, drops specks, trims to the ink,
   scales to `sprite.height` (480 px), thickens the outer outline by `sprite.outline` (12 px) in
   ink and writes `src/assets/sprites/<side>-<kind>.webp` plus its size in `sizes.json`. A skin's
   recipe is `paint-skin-<id>.json` and installs `skin-<id>.webp`.
3. **Draw** (`src/components/SpriteRig.tsx`): `spriteBox` fits the image into the figure box
   (x 18–82, feet on y 108, at most `HEIGHT[kind]` tall) and `PieceRig` draws it inside
   `.flip › .hop › .squash`. The patrol faces left by the `.flip` mirror. The side markers
   (rebel ground ellipse, patrol diamond), shield, HP badges and board cues are unchanged.
4. **Animate** (`src/sprite.css`, loaded after `rig.css`): whole-figure keyframes on `.hop` and
   `.squash`, plus effects (`.fx-lines`, `.fx-burst`, `.fx-stars`, `.fx-dust`, `.fx-smoke`, and
   two sprite-only ones: `.fx-pop`, the hit and promotion sparkle, and `.fx-crown`, the king's
   crown particle). Durations match `RIG_MS` and scale with `--spd`.

## In the studio (`art.html`)

- **Cast** (landing): every sprite as a still image (`SpriteStill` in `src/art/kit.tsx`, the
  game's placement with no animation), grouped Friendly, Enemy and Skins (a skin with no
  sprite shows its reference as "Not painted yet").
- **Stage** (`#stage/<side>-<kind>`, `#stage/skin-<id>` for a skin): one live `PieceRig`, a button per action below, wounded
  and guarding toggles, facing, board or large size, and 1×, 0.5×, 0.25×, 0.1× speeds that set
  the game's `--spd` (1, 2, 4, 10) and stretch the take's timers to match.

## Actions

| Action | Whole-sprite motion | Effects |
|---|---|---|
| idle | breathing squash and stretch with a 1-unit bob | — |
| wounded / guarding | reddish tint and a tremble / braced a little lower | shield |
| move | crouch, hop arc with stretch, squash on landing (knights hop higher) | motion lines, dust |
| attack | lean back, fast stretched lunge 26 units forward, snap back | burst and stars at the front edge, speed lines |
| defend | brace squash | flash, shield pops in (rooks too) |
| hit | white flash, knocked back and shaken, settles | damage pop |
| death | flash, hop, tips over about the body's middle, lies flat at 0.6 inside the square, fades | smoke, dust, stars |
| cheer | two jumps | sparkles twice |
| morph-out / in | trembles, squashes to nothing / pops back from nothing | sparkle / smoke |
| leap / leap-back | the shared front flip and backflip (`rig.css`) | lines / dust |
| mate | staggers, hops, tumbles and lands flat | a gold crown particle flies off and lands beside him |

Reduced motion: `rig.css` switches the moves off (the hit flash and the death fade stay);
checkmate still jumps to its final frame (king flat, crown on the ground), so skip and reduced
motion end the same way.

## Prompts that work

- Keep the SUBJECT text of each recipe: it carries the owner's decisions (saucepan pawn,
  moustache-free patrol pawn, stonemason with the sledge in his fist and the bandana showing,
  kettle-helm patrol guard, hobby-horse knight, patrol knight on a dark horse with a domed armet
  and a lance, hooded glowing-eyed bishop, spectacled patrol bishop, rebel queen with one
  armband, gold crown and frying pan, beehive patrol queen with a white fan collar and blue
  skirt, bearded rebel king, masked patrol king with a gold cape).
- Every pose prompt adds an `EYES:` sentence for that character (dot eyes in the face, glints in
  helm slits, dots behind the patrol bishop's lenses) and a shared `POSE`/`SILHOUETTE` block:
  natural arms, nothing backwards, the weapon gripped in the fist, a clean chunky silhouette and
  an outer outline twice the inner lines.
- The patrol bishop's first roll left the lenses blank; "he is NOT blank-eyed: a solid black dot
  eye … in the middle of EACH lens" fixed it.
- A patrol knight roll that asked for "two white dot eyes in the slit" lost the fist on the
  lance (both fists on the saddle, lance floating upside down). Check every fist holds its prop.

## Add or re-roll a character

1. Render its SVG rig facing right: `node tools/art/shoot.mjs <kind>.<side> out.png --crop 192 --scale 2`,
   flop it for the patrol, crop the caption, save as `docs/art/paint/svg-<id>.webp`.
2. Copy a paint recipe and change the SUBJECT and EYES text in `pose`.
3. `node tools/art/gen.mjs <recipe>` (about $0.15: one Nano Banana Pro call, one BRIA call).
4. Look at `art-out/<id>/step-1-pose.png` at full size; re-roll anything with wrong arms,
   anatomy or eyes.
5. `node tools/art/sprite.mjs <recipe> --install`, then check `npx vitest run
   tests/figure-bounds.test.ts tests/sprites.test.ts`, the studio (Cast, then every button on the
   Stage at 0.25×) and `node tools/art/shoot.mjs <kind>.<side>.paint out.png`.

## Limits

- Not deterministic: a re-run gives a similar character, sometimes with a new flaw.
- The sprite is one piece, so nothing moves on its own: no blink, no prop swing, no crown that
  leaves the head (the mate crown is a separate particle; the painted crown stays on).
- Patrol only in royal blue; the red hue falls back to the SVG kit.
- At 48px painted interiors (chainmail, fur, scrollwork) soften where the kit's flat shapes stay crisp.
