# Art builder brief

Checklist for drawing or redrawing a character rig. Rules: `docs/art-style.md`.
Reference crops: `docs/art/<id>.webp`. Judge rubric: `JUDGE.md`.

## Draw with the kit
- Draw only with `src/components/inkKit.tsx`: `Part` (a filled shape),
  `Pole` (shafts, tines, trim), `Ink` (brows, squints), `Dot` (eyes), `Flat`
  (an unlined cover). `circle`, `ellipse` and `rect` make path strings.
- Colours come from `TONES` (fill + shade pairs from `docs/art-style.md` §7).
  Add a tone there rather than writing a hex in the rig. (Exception for now:
  the patrol's alternate red hue reuses `PATROL.red` from `PieceRig.tsx`.)
- Don't draw shadows: `Part` derives one per part from the light (upper left on
  screen). Turn it off (`shade={false}`) for parts under about 12 units across,
  where the crescent would cover the whole part.
- Highlights: a short tick on the part's upper-left (`highlight="M… "`), on metal
  and glass only. The kit clips it and mirrors it when the rig faces left.
- `line="outer"` for parts that form the silhouette, `"inner"` for parts drawn
  over another part (bandana, patch, moustache, nose), `"none"` rarely.
- `tests/ink-kit.test.ts` fails on any raw SVG shape, stroke, hex, clip or
  opacity in a file that imports the kit.

## Canvas and build
- viewBox 100×120, feet at y 108, centreline x 50. Keep the whole figure,
  prop included, inside x 18–82 (the outline counts).
- Draw facing right: prop in the front hand on the right. The rig mirrors.
- Fill the `Figure` groups so `rig.css` animates it: `body`, `armBack`,
  `prop` (pivot `propOrigin` at the front hand), `armFront`, `head`
  (with `.face > .eyes > .pupil`, `.ko-eyes`, and a `.mouth-yell` squint).
- Minimum sizes at 48px (0.48px per unit): parts at least 6 units, dot eyes
  r 2.4+, face lines `WEIGHT.face`, gaps between parts at least 3 units.

## Loop
1. Draw. Add or update the studio entry (`src/art/Catalog.tsx`).
2. `node tools/art/shoot.mjs <kind.side,…> <out.png>` and look at it yourself,
   plus `--scale 3 --crop 192` for close-ups.
3. Hand the sheet, the reference crops and `JUDGE.md` to a fresh-context judge.
   It never sees code.
4. Fix the top gap first. Stop when every score is at least 7, or after 3 rounds.
5. Record decisions in `docs/art/DECISIONS.md`; style lessons in `docs/art-style.md`.
6. Batch checks at the end: `npm test`, `npx tsc -b`, `npm run build`, `npm run test:e2e`.
