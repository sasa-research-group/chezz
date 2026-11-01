# Skins

Unlockable oddball looks for the pieces, like Castle Crashers' bee and bear but
our own characters. Board item: `w-unlockable-wonky-skins-for-pieces`. Owner's
reference oddballs: `docs/art/odd-*.webp`. Style rules: `docs/art-style.md`
(sections 4–6 for oddballs and the chess crest).

## Rules (owner decisions, Oct 30–31 2026)

- A skin keeps its chess piece's headgear crest: pot, horse, mitre,
  battlements, flame, crown. The creature or object underneath changes.
- Finishing a run (the Victory screen) unlocks the next skin in `SKINS` order.
  Rebel side only for now.
- Unlocks and the equipped skin per piece live in `localStorage["chezz.meta.v1"]`
  (`src/game/meta.ts`), apart from the run autosave (`chezz.turns.v1`), which a
  new run overwrites. Clearing site data loses them.
- Skins are cosmetic. They never change stats or rules; `turns.ts` knows
  nothing about them.
- Skins are drawn on the shape kit (`src/components/inkKit.tsx`), so in battle
  they show only with `?art=new`, and the picker (☰ menu and Victory screen)
  appears only there too. Wins still unlock skins without it. The studio always
  shows them. The hideout's army portraits don't show skins yet.
- Two tabs open at once can overwrite each other's unlocks (each writes its whole
  copy). Fine for the prototype.

## How a skin plugs into the rig

A rig takes `skin="<id>"`. `PieceRig` builds the piece's shape-kit figure
(`NEW_FIGURES`, so the piece must already be redrawn on the kit), then:

| Slot | What the skin gives | Rule |
|---|---|---|
| Head | `head()`: face and headgear | Keep `.eyes > .pupil`, `.ko-eyes` and a `.mouth-yell` squint (wrapping them in `.face` is only for grouping), so blink, hit, death and yell still play. Keep the crest. |
| Body tones | `look`: `cloth`, `accent`, `patch`, `boot`, `hand` | Shapes, groups and pivots stay the build's. |
| Prop | `prop()`, optional | Drawn inside `.prop`; it swings around the build's `propOrigin`, so hold it in the front hand. |
| Idle quirk | `quirk`: a class on the `<svg>` | CSS in `rig.css` under "Skin quirks". Animate only `.quirk-bit`, `.head`, `.prop` or `.eyes`, in `act-idle`; it may also switch off the piece's own idle loop (the frog stops the pawn's jitter). Draw a `.quirk-bit` at its resting size. Reduced motion stops `.quirk-bit`. |

The skin only applies to a rebel of its own `kind`; anything else ignores it.

## Adding a skin

1. Draw it in `src/components/skins/<name>.tsx` with the kit only (`Part`,
   `Pole`, `Ink`, `Dot`, `Flat`, `TONES`). `tests/ink-kit.test.ts` lints it.
   Reuse the piece's shared headgear (for example `RebelPot` from
   `ArmourPawns.tsx`) so a restyle of the crest reaches every skin.
2. Add one entry to `SKINS` in `src/components/skins/index.ts`: `id`, `kind`,
   `name`, `ref` (the reference crop), `look`, `head`, `prop`, `quirk`.
   The order is the unlock order.
3. Add any new colours to `TONES` and any quirk CSS to `rig.css`.
4. Check it: `npm test` (`tests/skins.test.ts` checks every registered skin
   keeps the animated groups), then the studio (Art catalog → Skins, and the
   skin's rows in Cast × state appear by themselves) and the judge sheet:
   `node tools/art/shoot.mjs pawn.white,pawn.white.<id> out.png`.

## Planned skins

The owner's six reference oddballs, one per piece. Each needs its piece
redrawn on the kit first.

| Piece | Skin | Crest | Status |
|---|---|---|---|
| Pawn | Frog in the pot (`odd-pawn`) | Rebel pot | Placeholder in game: `frog-pot` |
| Knight | Empty suit of armour on a rocking horse (`odd-knight`) | Horse head | Planned. Reference is in patrol blue (drift); use rebel or neutral steel |
| Bishop | Goose in a mitre (`odd-bishop`) | Rebel mitre | Planned |
| Rook | Walking haystack with battlements (`odd-rook`) | Battlements | Planned |
| Queen | Melting candle with a crown of flame (`odd-queen`) | Flame points as a crown | Planned. Reference has one flame; add points |
| King | Sleepy cat in a too-big crown (`odd-king`) | Gold gem crown | Planned |

Ideas from the first plan, not yet shown to the owner: mushroom-cap pawn with
a snail, beehive rook, walrus bishop in a wizard hat, cow knight, snail-shell
queen, toad king in a birdbath crown.

## The frog placeholder

`src/components/skins/frogPawn.tsx`. Wide frog head, eye domes peeking
under the pot rim with heavy lids, a wide grumpy mouth line, the rebel
neckerchief, frog-green body tones, a cattail for a prop, and a slow
throat-sac croak in place of the rebel pawn's nervous jitter.

Waiting on the owner: whether the rebel pawn's pot becomes a saucepan. The frog
wears `RebelPot`, so it follows that change with no edit.

## Later

- Patrol skins: add a `side` field to `Skin` and drop the rebel-only check in
  `PieceRig`.
- Other unlock routes from the plan: battle feats, or the locked Merchant
  selling a skin for gold once the economy settles.
