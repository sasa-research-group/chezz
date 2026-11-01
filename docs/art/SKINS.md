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
| Back | `back()`, optional | Replaces what the build draws behind everything, such as the king's cape; `() => null` drops it. |
| Prop | `prop()`, optional | Drawn inside `.prop`; it swings around the build's `propOrigin`, so hold it in the front hand. |
| Idle quirk | `quirk`: a class on the `<svg>` | CSS in `rig.css` under "Skin quirks". Animate only `.quirk-bit`, `.head`, `.prop` or `.eyes`, in `act-idle`; it may also switch off the piece's own idle loop (the frog stops the pawn's jitter). A skin with no prop may also move its `.head` and `.quirk-bit` in `act-attack` (the goose pecks). Draw a `.quirk-bit` at its resting size. Reduced motion stops `.quirk-bit`. |

The skin only applies to a rebel of its own `kind`; anything else ignores it.

## Adding a skin

1. Draw it in `src/components/skins/<name>.tsx` with the kit only (`Part`,
   `Pole`, `Ink`, `Dot`, `Flat`, `TONES`). `tests/ink-kit.test.ts` lints it.
   Reuse the piece's shared headgear (for example `RebelPot` from
   `ArmourPawns.tsx`) so a restyle of the crest reaches every skin.
2. Add one entry to `SKINS` in `src/components/skins/index.ts`: `id`, `kind`,
   `name`, `ref` (the reference crop), `look`, `head`, and optionally `body`, `back`,
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
| Knight | Empty suit of armour on a rocking horse (`odd-knight`) | Rebel carved horse head | Drawn: `empty-knight`, third unlock; redrawn Nov 1, still not a pass (readability 5). Rebel iron, not the reference's patrol blue |
| Bishop | Goose in a mitre (`odd-bishop`) | Rebel mitre | Drawn: `goose-mitre`, fourth unlock |
| Rook | Walking haystack with battlements (`odd-rook`) | Rebel stone battlements | Drawn: `haystack` |
| Queen | Melting candle with a crown of flame (`odd-queen`) | Flame points as a crown | Drawn: `candle-queen`, fifth unlock; not a pass yet (likeness 6). Three flame points, not the reference's one |
| King | Sleepy cat in a too-big crown (`odd-king`) | Gold gem crown | Drawn: `cat-king`, sixth unlock; not a pass yet (readability 6). Sits up rather than curled |

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

## The empty knight

`src/components/skins/emptyKnight.tsx`, third in the unlock order. An empty suit
of iron (`armourIron`, a step lighter than the rebel's `rustySteel`) on a rocking
horse. The horse is the rebel knight's carved head (`RebelHorseHead`, shared with
`ArmourKnights.tsx`) at its own size, raised 10 units on a longer wooden neck so it
stands in front of the cuirass's right edge with its ear above the helm: the
silhouette has the knight's notch between helm and ear. Scaled up, its lines came
out thicker than the cast's and its mane read as a dark plank. Under it, a wooden
barrel, a tail tuft and a 10-unit rocker. The head slot is the rebel bucket helm,
tilted, floating a clear gap above the collar, with a plain void T (no eyes) and a
red rag round its foot, knotted at the back with one end flying. The pupils are
void on the void, so blink, hit and death keep their groups. Death shows a dust
puff in the T, and the yell shows rattle ticks beside the helm. The cuirass tapers
to the waist over a short fauld; the collar is a pale steel ring round a black
hole; one big pauldron at the back, and a front pauldron and forearm whose
vambrace is open at the wrist, the gauntlet a gap away on the red rein. It has no
prop and no back arm, so the attack is the body's lunge. Idle quirk `quirk-hover`:
the helm bobs over the collar.

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

## The candle

`src/components/skins/candleQueen.tsx`, fifth in the unlock order. A melting
candle in a copper bowl. The reference has one flame; the queen's crest is a
crown, so the flame burns as three points, the middle one tallest (tip near y 17.5),
on a short dark wick. The wax is one column in the body slot, its top a
lighter cap with fat drips, two of them bulging past the corners, and its foot
slumping into a puddle inside the bowl. A purple ribbon (the rebel queen's
`armband`) is tied round it with a knot and two tails out the right side: the
rebel accent. The flame is in the body too, so it stays on the wick when the head
pops in death; the head slot holds only the face, two dot eyes and a melted
frown. No arms and no prop: the strike is the body's lunge. Tones: `wax` (shade
darker than the sheet's), `waxLight`, `flame` (redder than the sheet's, which
merged with the wax) and `flameCore`.

## The cat

`src/components/skins/catKing.tsx`, sixth in the unlock order. A sleepy orange
tabby sitting up, under a gold crown far too big for it: three bold points over a
red velvet cap, the rebel king's gems, tilted 15° so it slides down the left side
of the head and squashes the right ear out sideways. The crown is the `.crown`
group, so the checkmate finale throws it off (`tests/skins.test.ts` checks a king
skin keeps it). The crown's tips stay under y 15 and inside x 18–82, which is why
it can't be bigger. Face: closed-eye arcs, a pink nose and four
whiskers. The body is a round sitting cat with a pale chest, a few chunky stripes
(more on the shadow side), two front paws and the tail wrapped round the front, its
tip curling up past the body. The body's top rises well behind the head, so the
death pop shows outlined shoulders, not a gap. No arms, no prop and no cape (the
skin's `back()` drops the rebel king's cape): the strike is the body's lunge.
Tones: `cat`, `catStripe`, `catPale`, `velvet`.

## Later

- Patrol skins: add a `side` field to `Skin` and drop the rebel-only check in
  `PieceRig`.
- Other unlock routes from the plan: battle feats, or the locked Merchant
  selling a skin for gold once the economy settles.
