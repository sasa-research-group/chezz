# Art judge

You score one character rig from pictures only. You get:
- the judge sheet: a PNG from `tools/art/shoot.mjs` (each rig at 48px, 84px and
  192px, a black silhouette at 48px, greyscale, idle/wounded/guarding, six
  frozen frames of each action, and the rigs beside the rest of the cast);
- the reference crop for each character (`docs/art/<id>.webp`);
- this file, and a list of declared corrections (deliberate departures from the
  reference), and nothing else. Don't read code or the builder's notes.

The art is a chess piece in a 2D brawler-cartoon style. The sheet's other cast
members are older placeholder art; judge fit against them by scale, outline
weight and silhouette size, not by matching their faces or colours.

## Style in brief
- Headgear, armour and props carry the character; faces are two dot eyes at most
  (the patrol pawn may have brows, a nose and a moustache).
- Very thick, even, near-black outline; thinner black lines inside.
- Flat fills, one hard cel shadow per part, white highlight ticks on metal. Light
  comes from the upper left on every rig, so shadows sit on the lower right.
- Shading never crosses a part's outline or spills onto another part.
- Rebels: earthy, patched, one bright accent. Patrol: royal blue, gold trim, steel.
- Chunky: head plus headgear about half the figure. One oversized prop.
- At 48px nothing turns to mush; no detail smaller than a pixel or two.

## Score each 0–10

| Criterion | 10 | 7 | 4 |
|---|---|---|---|
| Readability at 48px | names the piece and side instantly; silhouette alone says "pawn" | one part muddy or ambiguous | a blob, or reads as a different thing |
| Style | matches the style above in every part | one rule bent (a shade spill, an odd line weight) | looks like another game |
| Likeness | headgear, prop, palette and build clearly the reference's | one feature off or swapped | a different design |
| Motion | every action has anticipation, squash and settle; parts stay attached | one action mushy or a part detaches | stiff, broken or noisy |
| Consistency | rigs on the sheet share ink, weights, light side, shadow depth, scale and baseline; sit well beside the cast | one mismatch | look like different artists |

Pass: every score is at least 7.

## Reply format (nothing else)

```
<rig name>: readability=<n> style=<n> likeness=<n> motion=<n> consistency=<n>
(one line per rig)
GAP1: <rig> | <part> | what is off | a concrete fix (shape, size in % of the figure, colour)
GAP2: …
GAP3: …
```
Gaps are the three changes that would raise the lowest scores most, worst first.

## Running a judge (for the lead)
Render the sheet with `node tools/art/shoot.mjs <kind.side,…> <sheet.png>`, then
spawn a fresh-context subagent with this prompt, filling the paths:

> You are an image-only art judge. Read only: `docs/art/JUDGE.md`; the sheet
> `<sheet.png>` (crop it with `magick` if it is downscaled); and the reference
> crops `docs/art/<id>.webp` for each rig. No code. Score per JUDGE.md and reply
> in its format, nothing else. Be strict and specific.
> Declared corrections (don't mark likeness down for them): <list from
> `DECISIONS.md`, e.g. the patrol pawn's kettle helm in place of the morion>.
