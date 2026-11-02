# Animation contract

What a piece must provide so every action plays. The game draws painted sprites
(`docs/art/PAINTED.md`): one whole image per piece, moved whole. Try any action
on the studio stage (`art.html#stage/<side>-<kind>`, e.g. `#stage/rebel-king`, or `#stage/skin-<id>`).

## Canvas
- `<svg class="rig rig-<kind> rebel|patrol [skin-<id>] act-<action>" viewBox="0 0 100 120">`.
- Feet on y 108, centred on x 50, ink inside x 18–82 and below y 0
  (`tests/figure-bounds.test.ts`).
- Painted facing right; `.flip` mirrors by `--face` (the patrol faces left).

## Groups
```
svg.rig
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
  `src/rig.css` and `src/sprite.css` use the same values.
- Every duration is `calc(<ms> * var(--spd,1))`. The game sets `--spd` on the
  board: 1, 0.3 fast, 0.1 reduced motion. The stage's slow modes set it to
  1, 2, 4 and 10.
- Sequences live in `App.tsx`: promotion is morph-out then morph-in; a knight
  strike is leap, attack at `RIG_MS.leap`, leap-back 380 ms later; checkmate
  plays `mate`.

## Stylesheets
- `src/rig.css`: the groups' pivots, the shield, the effects every action shares
  (dust, lines, stars, smoke, hit flash, death fade), the knight's leap and
  leap-back flips, and reduced motion.
- `src/sprite.css`, loaded after it: the whole-sprite keyframes per action and
  the skins' quirks (`.skin-<id>`).

The painted sprites are the only art. The SVG shape kit (`Armour*.tsx`,
`inkKit.tsx`, the kit skins) and `?art=new` were removed in Nov 2026; they are in
git history before the commit "Remove the SVG shape kit".
