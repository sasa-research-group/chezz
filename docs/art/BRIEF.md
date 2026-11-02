# Art builder brief

Checklist for painting or re-rolling a character sprite. Rules: `docs/art-style.md`.
Reference crops: `docs/art/<id>.webp`. Pipeline: `docs/art/PAINTED.md`. Judge rubric:
`JUDGE.md`. (The old SVG shape kit this brief once covered was removed in Nov 2026;
it is in git history before the commit "Remove the SVG shape kit".)

## Paint
- One recipe per character (`docs/art/recipes/paint-*.json`): the reference crop,
  the style sheet, an optional pose reference and, for a skin, the rebel piece's
  own sprite for its crest.
- Keep the SUBJECT text's owner decisions; add an `EYES:` (or `FACE:`) sentence and
  the shared `POSE`/`SILHOUETTE`/`STYLE` blocks.
- Facing right, feet visible, chunky, a very thick outer outline, one character on
  flat light grey.

## Canvas
- viewBox 100×120, feet at y 108, centreline x 50; `spriteBox` fits the sprite
  inside x 18–82 at most `HEIGHT[kind]` tall (`SpriteRig.tsx`).
  `tests/figure-bounds.test.ts` enforces it. Wide props make the whole figure smaller.
- Animations move the whole sprite (`docs/art/RIG.md`); nothing moves a part.

## Loop
1. `node tools/art/gen.mjs <recipe>`; look at `art-out/<id>/step-1-pose.png` at full
   size and at 48px. Re-roll wrong anatomy, a missing crest, or missing eyes.
2. `node tools/art/sprite.mjs <recipe> --install`.
3. `node tools/art/shoot.mjs <kind.side[.skin],…> <out.png>` and look at it yourself,
   plus `--scale 2 --crop 192` for close-ups. For a tall crest, also
   `node tools/art/battle-shot.mjs <kind> <out.png>` (patrol piece on the top
   row; `--battle 3` or `--width 844 --height 390` for other boards).
4. Hand the sheet, the reference crops and `JUDGE.md` to a fresh-context judge.
   It never sees code.
5. Fix the top gap first. Stop when every score is at least 7, or after the
   rounds you were given.
6. Record decisions in `docs/art/DECISIONS.md`; style lessons in `docs/art-style.md`.
7. Batch checks at the end: `npm test`, `npx tsc -b`, `npm run build`, `npm run test:e2e`.
