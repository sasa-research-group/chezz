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
| Body tones | `look`: `cloth`, `accent`, `patch`, `boot`, `hand` | Recolours the build's own shapes. |
| Body, arms | `body()`, `armBack()`, `armFront()`, optional | For a creature with its own shape. Feet stay on y 108; draw sleeves with `Sleeve` (the cheer animates its classes) and keep the hands where the build has them (`PAWN_ARMS`), so the prop pivot and shield line up. |
| Prop | `prop()`, optional | Drawn inside `.prop`; it swings around the build's `propOrigin`, so hold it in the front hand. |
| Idle quirk | `quirk`: a class on the `<svg>` | CSS in `rig.css` under "Skin quirks". Animate only `.quirk-bit`, `.head`, `.prop` or `.eyes`, in `act-idle`; it may also switch off the piece's own idle loop (the frog stops the pawn's jitter). A skin with no prop may also move its `.head` and `.quirk-bit` in `act-attack` (the goose pecks). Draw a `.quirk-bit` at its resting size. Reduced motion stops `.quirk-bit`. |

The skin only applies to a rebel of its own `kind`; anything else ignores it.

## Adding a skin

1. Draw it in `src/components/skins/<name>.tsx` with the kit only (`Part`,
   `Pole`, `Ink`, `Dot`, `Flat`, `TONES`). `tests/ink-kit.test.ts` lints it.
   Reuse the piece's shared headgear (for example `RebelPot` from
   `ArmourPawns.tsx`) so a restyle of the crest reaches every skin.
2. Add one entry to `SKINS` in `src/components/skins/index.ts`: `id`, `kind`,
   `name`, `ref` (the reference crop), `look`, `head`, and optionally `body`,
   `armBack`, `armFront`, `prop`, `quirk`.
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
| Pawn | Frog in the saucepan (`odd-pawn`) | Rebel saucepan | Drawn: `frog-pot` |
| Knight | Empty suit of armour on a rocking horse (`odd-knight`) | Horse head | Planned. Reference is in patrol blue (drift); use rebel or neutral steel |
| Bishop | Goose in a mitre (`odd-bishop`) | Rebel mitre | Drawn: `goose-mitre`. Third in the unlock order for now; fourth once the empty knight lands |
| Rook | Walking haystack with battlements (`odd-rook`) | Rebel stone battlements | Drawn: `haystack` |
| Queen | Melting candle with a crown of flame (`odd-queen`) | Flame points as a crown | Planned. Reference has one flame; add points |
| King | Sleepy cat in a too-big crown (`odd-king`) | Gold gem crown | Planned |

Ideas from the first plan, not yet shown to the owner: mushroom-cap pawn with
a snail, beehive rook, walrus bishop in a wizard hat, cow knight, snail-shell
queen, toad king in a birdbath crown.

## The frog

`src/components/skins/frogPawn.tsx`. A wide flat frog head, wider than the
rebel saucepan, with two eye domes tucked under its rim (it lifts the shared
`RebelPot` 4 units onto them), heavy-lidded yellow eyes, a short frowning mouth
over a pale throat; a squat body on two plain leg ovals with a pale belly, round
mitts, a red cord knotted under the jaw, a cattail on a wood stalk, and a slow
throat-sac croak in place of the rebel pawn's nervous jitter. Kept sparse on
purpose: inner lines turn to stripes at 48px. Colours are sampled from
`odd-pawn.webp` (`frog`, `frogLight`, `frogSpot`, `frogEye` in `TONES`).

## The haystack

`src/components/skins/haystackRook.tsx`, second in the unlock order. One bell of
hay from under the rebel rook's stone battlements (`RebelBattlements`, shared with
`ArmourRooks.tsx`) to a tufted hem, as wide as the crest where they meet, with
tufts poking out of its sides and two dark boots under the hem. The hay is in the
body slot, so no seam crosses it; the head slot holds only the two tall oval eyes,
the crest and the rook's plank `.door`, which still drops on defend. Hay strands
are a few short inner strokes under the crest, mid-body and over the hem, on top
of the kit's shading. A straw mitten holds a two-tined hayfork; the back arm would
hide behind the mound, so the skin draws none. Tones: `hay` (sampled from
`odd-rook.webp`) and `straw` for the mitten.

## The goose

`src/components/skins/gooseBishop.tsx`. A white goose wearing the rebel
bishop's own parchment mitre (`RebelMitre`, shared with `ArmourBishops.tsx`)
at 0.82 scale (its `scale` shrinks the geometry, not the ink), lowered so its
peak stays under y 15 and the top row fits inside the board frame. At full size
it swallowed the head. Even so there is little height for the goose: the skull
shows just under the brim, a thick S-curved neck runs into a low, round body with a
short tail, a folded wing with two scallops, and orange webbed feet. One dot eye
in profile; the smugness is the head and mitre tipped back 9°, the beak raised,
and one low brow. The neck lives in the body and runs up under the head, so the
death pop keeps head and neck joined. No prop: a crook's hook would collide with
the beak inside x 82, and the crest is enough for an oddball. Its quirk
`quirk-peck` turns the attack into a head peck (coil back, lunge beak first,
settle) in place of the prop swing; the mitre is its `.quirk-bit` and tips back
as the head lunges. Tones: `goose` and `beak`, sampled from
`odd-bishop.webp`.

## Later

- Patrol skins: add a `side` field to `Skin` and drop the rebel-only check in
  `PieceRig`.
- Other unlock routes from the plan: battle feats, or the locked Merchant
  selling a skin for gold once the economy settles.
