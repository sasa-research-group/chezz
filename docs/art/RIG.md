# Animation contract

What a piece must provide so every action plays. The game draws painted sprites
(`docs/art/PAINTED.md`): one whole image per piece, moved whole. Try any action
on the studio stage (`art.html#stage/<side>-<kind>`, e.g. `#stage/rebel-king`).

## Canvas
- `<svg class="rig art-sprite rig-<kind> rebel|patrol act-<action>" viewBox="0 0 100 120">`.
- Feet on y 108, centred on x 50, ink inside x 18–82 and below y 0
  (`tests/figure-bounds.test.ts`).
- Painted facing right; `.flip` mirrors by `--face` (the patrol faces left).

## Groups
```
svg.rig.art-sprite
├ ground: .rig-shadow (ellipse rebel, diamond patrol), .fx-dust, .fx-lines
├ .flip › .hop › .squash › image.sprite + .shield
├ .fx-side › .fx-burst, .fx-stars, .fx-crown (king)
└ .fx-pop, .fx-smoke
```
| Group | Pivot | Moves for |
|---|---|---|
| `svg.rig` | 50% 90% of its box | idle breathe |
| `.flip` | 50, 108 | facing mirror; death fade |
| `.hop` | 50, 108 (50, 64 on knight flips) | jump height, hit flash, knight flips |
| `.squash` | 50, 108 (50, 64 on death and mate) | squash, lean, lunge, knockback, fall, morph |
| `.shield` | beside the body, rides `.squash` | pops in while guarding |

Effects (`.fx-*`) are not bones; they pop in and out with the action.

## Actions and timing
- Class `act-<action>` on the svg; states `is-wounded`, `is-defending`.
- One-shot lengths at 1×: `RIG_MS` in `PieceRig.tsx`; keyframes in
  `src/sprite.css` use the same values.
- Every duration is `calc(<ms> * var(--spd,1))`. The game sets `--spd` on the
  board: 1, 0.3 fast, 0.1 reduced motion. The stage's slow modes set it to
  1, 2, 4 and 10.
- Sequences live in `App.tsx`: promotion is morph-out then morph-in; a knight
  strike is leap, attack at `RIG_MS.leap`, leap-back 380 ms later; checkmate
  plays `mate`.

## Shape kit (fallback)
The red patrol, unpainted skins and `?art=new` draw on the SVG shape kit
(`Armour*.tsx`, `src/components/skins/`), class `art-new`, animated by
`src/rig.css`. Their figures fill these groups inside `.squash`: back
(`.cape`), `.arm-back`, body, `.prop` (pivot `propOrigin`, the front hand),
`.arm-front`, `.head-tilt › .head › .face › .eyes › .pupil` plus `.ko-eyes`
and `.mouth-yell`, `.crown` (king), `.door` (rook), `.quirk-bit` (skin extra).
`tests/skins.test.ts` checks every skin keeps them.
