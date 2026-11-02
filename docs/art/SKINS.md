# Skins

Unlockable oddball looks for the pieces, like Castle Crashers' bee and bear but
our own characters. Board item: `w-unlockable-wonky-skins-for-pieces`. Owner's
reference oddballs: `docs/art/odd-*.webp`. Style rules: `docs/art-style.md`
(sections 4–6 for oddballs and the chess crest).

## Rules (owner decisions, Oct 30 – Nov 2 2026)

- A skin keeps its chess piece's headgear crest: pot, horse, mitre,
  battlements, flame, crown. The creature or object underneath changes.
- Finishing a run (the Victory screen) unlocks the next skin in `SKINS` order.
  Rebel side only for now.
- Unlocks and the equipped skin per piece live in `localStorage["chezz.meta.v1"]`
  (`src/game/meta.ts`), apart from the run autosave (`chezz.turns.v1`), which a
  new run overwrites. Clearing site data loses them.
- Skins are cosmetic. They never change stats or rules; `turns.ts` knows
  nothing about them.
- Every skin is a painted sprite like the rest of the cast.
- No in-game picker for now: skins will be unlocked and worn from the map
  (the ☰ and Victory pickers were removed Nov 2). A skin already worn in an
  old save still draws. The studio shows the
  skins on the Cast sheet and in the Stage's Piece list. The hideout's army
  portraits and the top bar's king portrait don't show skins yet.
- Two tabs open at once can overwrite each other's unlocks (each writes its whole
  copy). Fine for now.

## How it works

- Registry: `src/components/skins/index.ts`, one entry per skin (`id`, `kind`,
  `name`, `ref`, the reference crop). The order is the unlock order.
- Sprite: recipe `docs/art/recipes/paint-skin-<id>.json`, run like the base
  sprites (`docs/art/PAINTED.md`); `sprite.mjs --install` writes
  `src/assets/sprites/skin-<id>.webp`.
- Draw: `<PieceRig skin="<id>">` draws the skin's sprite in place of the rebel's
  own, for a rebel of the skin's `kind`; anything else ignores it. The svg gets
  a `skin-<id>` class for quirks. `SKIN_HEIGHT` in `SpriteRig.tsx` can stand a
  skin shorter than its piece (the cat, which otherwise outweighs the cast).
- Tests: `tests/skins.test.ts` (every skin has a sprite and a reference, and
  applies only to its own rebel piece), `tests/figure-bounds.test.ts`.

## Painting a skin

Each pose prompt gets up to four images: the oddball reference, the style sheet,
a pose reference (`docs/art/paint/svg-skin-<id>.webp`, pose only) and the rebel piece's own painted sprite, so the crest
matches the base piece exactly. The empty knight skips the pose reference (its
old drawing split the horse head from the barrel; the text alone gave a cleaner
rocking horse). The candle skips the base sprite (the rebel queen's helm and pan
are no help). For a new skin with no pose reference, drop that image and its
sentence from the prompt.

1. Add the registry entry.
2. Copy a `paint-skin-*.json` recipe and change SUBJECT and EYES.
3. `node tools/art/gen.mjs <recipe>` (about $0.15), look at the pose at full
   size and at 48px, then `node tools/art/sprite.mjs <recipe> --install`.
4. Look at it beside its piece: `node tools/art/shoot.mjs pawn.white,pawn.white.<id> out.png`;
   on the board: `node tools/art/battle-shot.mjs pawn out.png --skins <id>`.

## The six

| Piece | Skin | Look | Crest |
|---|---|---|---|
| Pawn | `frog-pot`, Frog | grumpy green frog, heavy-lidded yellow eyes, red cord under the jaw, cattail in the fist | rebel copper saucepan, handle out the back |
| Rook | `haystack`, Haystack | golden bell of hay, two tall black eye holes, boots under the hem, straw mitten on a two-tined hayfork | rebel stone battlements |
| Knight | `empty-knight`, Empty knight | empty suit of rusty rebel iron, the bucket helm (black empty T, red rag) floating over a hollow collar, no face, on a wooden rocking horse | the rocking horse's carved head |
| Bishop | `goose-mitre`, Goose | white goose walking right, one dot eye under a smug brow, orange beak and feet | big parchment mitre with a small yellow patch |
| Queen | `candle-queen`, Candle queen | cream candle with fat drips, two dot eyes and a melted frown, purple ribbon, copper bowl | a crown of three flame points |
| King | `cat-king`, Cat king | orange tabby sitting up, closed-eye arcs and a smile | the rebel king's gem crown, far too big and crooked |

Declared departures from the references: rebel iron, not the reference's patrol
blue (empty knight); three flame points, not one (candle); the cat sits up rather
than curls up asleep, so it stands like a king; the frog's cattail and the
haystack's hayfork are additions; the goose has no crook.

## Quirks

Whole-sprite keyframes in `src/sprite.css` ("Skins"):
- Frog: the idle breathing becomes a slow wide croak puff every 2.6 s.
- Empty knight: the idle rocks ±3° on the rocker.
- Goose: the strike is a peck, a coil back then a 26° dip beak first.
- The cat's crown can't fly off a single image: checkmate uses the shared crown
  particle (`CrownFx`) like every king, and the painted crown stays on.

## Later

- Patrol skins: the registry is rebel-only; `PieceRig` ignores a skin on the patrol.
- Other unlock routes from the plan: battle feats, or the locked Merchant
  selling a skin for gold once the economy settles.
- Ideas from the first plan, not yet shown to the owner: mushroom-cap pawn with
  a snail, beehive rook, walrus bishop in a wizard hat, cow knight, snail-shell
  queen, toad king in a birdbath crown.
