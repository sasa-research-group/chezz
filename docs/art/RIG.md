# Rig contract

What any art style (old cartoon, SVG kit, painted sprites) must provide so every
animation in `src/rig.css` plays. See it live: studio → **Rig** (`art.html#rig`):
bones, cut-out parts, keyframes per group, all read from the DOM and CSS.

## Canvas
- `<svg class="rig …" viewBox="0 0 100 120">`, feet at **50, 108**, centreline x 50.
- Draw facing right; `.flip` mirrors for the patrol.
- Pivots are viewBox units (`transform-origin: 50px 108px`) unless the group
  uses `transform-box: fill-box`, where the pivot is relative to its own box.

## Nesting
```
svg.rig
└ .flip › .hop › .squash
    ├ back (.cape)        ├ .arm-back     ├ body (no class)
    ├ .prop               ├ .arm-front
    ├ .head-tilt › .head › .face › .eyes › .pupil ×2
    │                       ├ .ko-eyes  .mouth-yell  .mouth-ouch  .sweat
    │                       ├ .crown (king)  .door (rook)  .quirk-bit (skins)
    └ .shield
```
FX layers (`.fx-*`, `.sweat`, mouths, `.rig-shadow`) pop in and out with the
action; they are not bones and the Rig tab lists them apart. Most sit outside
`.flip`; `.fx-smear` rides inside `.squash`.

## Groups
| Group | Pivot | Moves for |
|---|---|---|
| `svg.rig` | 50% 90% of its box (idle) | idle breathe |
| `.flip` | 50, 108 | facing mirror; death fade |
| `.hop` | 50, 108 (50, 64 on knight flips) | jump height; flash on hit; knight flips |
| `.squash` | 50, 108 | the body: squash, lean, lunge, knockback, flop, morph |
| `.arm-back` | 40, 70 (cheer) | arms up on cheer |
| `.arm-front` | 60, 70 (cheer); 57, 50 (queen slap) | arms up on cheer; queen's slap |
| `.prop` | `propOrigin`: the front hand, per piece | weapon swing (sledge, lance per piece) |
| `.head-tilt` | 50, 74 | head pops on death |
| `.head` | 50, 74 (goose peck 55, 76) | skin quirks: hover, peck |
| `.eyes` | fill-box centre | blink, bulge, hide on mate |
| `.pupil` | fill-box centre | dart, shrink |
| `.crown` | fill-box centre | flies off on checkmate |
| `.door` | 50, 22 | rook's guard door drops in |
| `.shield` | `shield` point, per piece | pops in while guarding |
| `.quirk-bit` | fill-box 50% 0 | skin extra: croak sac, mitre |

The body itself has no class: it is whatever `.squash` holds that isn't
another group. Group names are classes; the studio and CSS find them by name.

## Painted sprites
- Sprites have no parts: one image (`.sprite`) inside `.flip › .hop › .squash`,
  plus `.shield`. The groups below `.squash` (arms, prop, head, eyes, crown,
  door) don't exist, so only the root groups move (`src/sprite.css`).
- They carry `art-sprite` instead of `art-new`, so kit and part rules never
  apply. Built: `SpriteRig.tsx` (`docs/art/PAINTED.md`).
- In the Rig tab (Art → Sprite) the bones are the root pivots; the shield joint
  rides in `.squash`, so it shows the body's lean, lunge and fall.

## Gaps the Rig tab shows today (SVG kit)
- No `.arm-front`: rebel rook, rebel knight, both queens, both kings. Their
  arms don't rise on cheer and the queen's slap has nothing to move.
- No `.arm-back`: rebel rook, patrol knight.
