# Chezz art style

Target look for all character art. Chosen by the owner on Oct 31 2026 from five generated sheets.

- Reference: `docs/art/sheet-armour-talks.webp` (18 characters), one crop per character in `docs/art/`.
- Rebel rook: the stonemason (`docs/art/rebel-rook.webp`), redrawn in this style from the owner's pick on sheet 1. It replaces the sheet-2 rook (kept as `sheet2-rebel-rook.webp`); the full sheet image still shows the old one.
- Recipe for new concepts: `docs/art/recipe.md`.
- Motion, timing and accessibility: `docs/art-direction-exile.md` sections 2 and 3.4–3.6.
- Status: the in-game rigs (`PieceRig.tsx`) predate this guide; every piece is redrawn behind `?art=new`. The reference is the target; the rigs are the current state.

## 1. Armour does the talking

- Headgear, armour and props carry the personality. The face carries little or none.
- Face budget for humans and armour, from least to most face:
  1. No face: a hood void, embers behind bars, a closed visor, spectacle lenses on a helm, or no head at all.
  2. Two dot eyes on a bare skin face, no mouth: under a pot, in a helm opening, between crown and beard, or in hay.
  3. A small face: dot eyes, one-stroke brows, a nose tick, a one-stroke mouth (rebel queen). The patrol pawn in game has dot eyes and brows only.
  4. Limit: patrol queen (dot eyes with lid strokes, brows, red lips) and the patrol king's sculpted mask (squinting slits, brows, painted moustache). Never more than these.
- Humans: no irises. Glowing dots or embers are allowed in a dark void (rebel bishop, rebel rook).
- Creatures keep a simple cartoon creature face: the frog (yellow eyes, pupils, heavy lids) and the cat (closed-eye arcs, nose, whiskers) are the limit.
- Every human or armour character holds a prop or rides a mount that is part of the joke: pitchfork, hobby horse, crook, mallet, frying pan, chipped sword, pike, lance, crozier, halberd, sceptre. Oddballs rely on their headgear crest and need no prop.
- Wear and story go on the kit: dents, rust, patches, stitches, chipped blades, frayed hems.

## 2. Outline and fill

| Element | Rule |
|---|---|
| Outer outline | Near-black, very thick, even width, round joins. On the sheet 6–9px on a ~400px tile (about 2% of tile width). |
| Interior lines | Black, about half the outer width. Used for plate seams, bricks, folds, drips. |
| Fills | Flat. No gradients. |
| Shadow | One hard-edged cel shadow per form, a darker flat tone of the same hue. |
| Highlights | Crisp white or near-white shapes on metal and glass: a tick on helms, a lens glint. |
| Texture | Sheet only: rust blotches, cracks, hay strands, brick lines. Drop at game size (section 9). |
| Flames | Flame shapes may skip the outline (odd queen). |

## 3. Proportions

- Chunky and big-headed. Head plus headgear is about half the visible figure in the portraits.
- Headgear is often as tall as the head or taller (mitres, tower helms, the patrol queen's wig).
- Hands are big chunky fists with finger creases, gauntlets or gloves, gripping the prop (mitts at game size, section 9). Shoulders and torsos are blocky.
- The sheet shows head and shoulders only. Full-body proportions are set in the game rig (viewBox 100×120, feet at y=108).

## 4. Every character is a distinct design

- No palette swaps. Rebel and patrol versions of a piece differ in headgear shape, material, prop and body type.
- Oddballs may reuse the rebel or patrol crest (the frog wears the rebel pot, the goose the rebel mitre); the creature or body must differ.
- Kings all wear similar gold gem crowns; the face, body and costume carry the difference.
- Shared crest, different build: all three rooks carry battlements; a stone tower helm, a great-helm keep and a haystack.
- Within a faction, every piece has its own headgear silhouette.

## 5. Factions

| Faction | Look | Materials | Colour rule |
|---|---|---|---|
| Rebels | Scrappy exiles in patched, mismatched, found kit | Copper pots, rusty buckets, rough stone, leather, burlap, parchment | Earthy browns, greys and drab greens, plus one dominant accent each (red bandana, blue neckerchief, yellow patch, orange scarf, purple armband, crimson robe); small patches may add a second colour |
| Patrol | Polished royal armour | Plate steel enamelled royal blue, gold trim, clean steel | Royal blue body, gold trim on most pieces, steel greys; warm notes only from skin, hair, moustache, wooden shafts and leather |
| Oddballs | Animals and objects playing the piece | Frog, empty plate suit, goose, haystack, candle, cat | Whatever the creature is, plus the piece's headgear crest |

- Rebel wear: patches with visible stitches, frayed hems, rust, dents.
- Patrol finish: smooth plates, gold edging, white highlight ticks, no damage.
- Oddballs keep the piece's crest: pot, horse, mitre, battlements, flame, crown.
- Known drift: the odd knight came out in patrol-blue plate. Oddballs should not use patrol blue; regenerate or recolour it.
- Weak faction reads: the patrol knight has almost no gold (blue plate, blue lance, grey horse) and the patrol rook's only gold is the visor cross. Add gold edging when drawing them. The two blue-plate knights are the easiest pair to confuse.

## 6. The chess-crest rule

Every piece must read as its chess piece by silhouette at board size (48px).

| Piece | Crest on the sheet | Must keep |
|---|---|---|
| Pawn | Pot or morion on a small round head (in game: a kettle helm with a comb, see `patrol-pawn`) | Smallest and roundest; short prop |
| Knight | A horse: wooden hobby horse, a ridden horse in steel barding, a carved wooden horse | A horse head in profile |
| Bishop | Tall pointed mitre (parchment, gilded, on a goose) | The mitre's point and centre cleft |
| Rook | Battlements on top: tower helm, keep-shaped great-helm, haystack | Square top with crenels |
| Queen | Small crown on a kettle helm; towering wig with jewels and gold chains; candle flame | A crown or tall crest, taller than the king's head |
| King | Large gold crown with gems | Widest, highest-pointed crown |

Weak reads on the sheet, to fix before drawing: the patrol queen has no crown at all, only the wig and a small jewelled steel cap (add a crown or tiara), and the odd queen has a single flame instead of a crown of flame.

## 7. Palette (sampled from the sheet)

Values are cluster means and small-patch medians from `2-armour-talks.png`; the frog rows are sampled from `docs/art/odd-pawn.webp`.

**Shared**

| Name | Hex |
|---|---|
| Ink (outline) | `#000000`–`#141414` |
| Skin | `#f0be9a` |
| Tile ground | `#c6b393` |
| Backdrop teal | `#75c7d4` |
| Backdrop slate | `#526383` |

**Rebels**

| Name | Hex |
|---|---|
| Pot copper | `#9f7853` |
| Pot shadow | `#896749` |
| Beard brown | `#665136` |
| Leather | `#865637` |
| Light leather / wood | `#a57952` |
| Dark leather | `#5f3f2c` |
| Hood cloth | `#8d7e66` |
| Robe grey | `#918b83` |
| Parchment | `#e7d5ac` |
| Rusty steel | `#8a9094` |
| Stone | `#a2a4a4` |
| Drab green | `#869043` |
| Faded tunic blue | `#507b92` |
| Accent: bandana red | `#cd2a25` |
| Accent: neckerchief blue | `#3275a9` |
| Accent: patch yellow | `#eecd02` |
| Accent: scarf orange | `#d86929` |
| Accent: robe crimson (rebel king) | `#a62f42` |
| Crown gold | `#f7c65d` |

**Patrol**

| Name | Hex |
|---|---|
| Royal blue | `#4b76cf` |
| Royal blue mid | `#577aba` |
| Royal blue shadow | `#314e8f` |
| Royal blue deep | `#2c3b77` |
| Blue highlight | `#aac7e6` |
| Steel | `#95b1c9` |
| Steel shadow | `#617085` |
| Gold | `#f0bf44` |
| Gold shadow | `#cb8e24` |
| Moustache brown | `#744924` |
| Wig white | `#d5e5f9` |

**Oddballs**

| Name | Hex |
|---|---|
| Frog green | `#7cb04c` |
| Frog light (throat, belly) | `#a7d274` |
| Frog shadow | `#52883b` |
| Frog spot | `#659b49` |
| Frog eye | `#fdf9b0` |
| Goose white | `#edf1f9` |
| Goose shadow | `#b0b7cd` |
| Beak orange | `#fe8a34` |
| Hay | `#ebbe52` |
| Hay shadow | `#b2833d` |
| Candle wax | `#f7e4b5` |
| Wax shadow | `#e0c290` |
| Flame | `#f9aa1f` |
| Cat orange | `#f19d43` |
| Cat shadow | `#b7631e` |
| Velvet | `#9d2143` |
| Crown gold | `#fbc635` |

## 8. Per character

| Id | Notes |
|---|---|
| `rebel-pawn` | Dented copper pot over the brow, two dot eyes, no mouth; red bandana; patched green shirt; pitchfork. In game the pot is an upturned copper saucepan (owner's correction, Nov 1): a shallow pan, slightly flared toward a thin lip, pushed a little toward the front, and a thick handle with a hanging hole sticking out the back nearly level. Angled steeply up, a thin handle read as a feather in a hat. The handle is what makes it a pan rather than a top hat. |
| `rebel-knight` | Rusty bucket helm with a T-shaped opening showing dot eyes; blue neckerchief; leather vest, patched sleeve; wooden hobby horse. In game the hobby horse is the prop, held by the neck at waist height with the stick down between his legs; he bonks with it. |
| `rebel-bishop` | Tall parchment mitre over a black hood void with two glowing yellow eyes; grey ragged robe with a yellow patch; gnarled crook. In game: a wide straight-sided mitre with a small back horn, a hood and robe much lighter than the sheet (or hood, void and robe merge at 48px), round glowing dot eyes, a mid-grey ragged cowl. |
| `sheet2-rebel-rook` | Sheet 2 original, superseded: stone tower helm with a riveted grille, glowing embers behind bars; orange scarf; faded blue tunic; mallet. |
| `rebel-rook` | Stonemason in a castle-tower great-helm with a T-slot showing only two dot eyes in a black void, bare muscular arms, patched brown-and-green tunic, red bandana (his accent), big stone mallet over his shoulder. Redrawn in this style from the owner's sheet-1 pick; source crop `sheet1-rebel-rook.webp`. In game: a stone tower helm with an overhanging battlement band (wider than the tower), the eyes glow cream in a dark slot, the mallet leans on his front shoulder beside the helm (not across the back of his neck: it hid behind the helm), and he defends by dropping a plank door over his face. |
| `rebel-queen` | Dented kettle helm with a small crown welded on; small stern face; rusty breastplate on straps over a cream apron; purple armband; grey gauntlet; frying pan. In game: a kettle helm whose brim droops at both ends, a squat three-point gold crown tilted on top, a big near-black pan held up beside the helm, and the purple armband on a back arm that hangs out past the body so it shows. |
| `rebel-king` | Gold crown low on the brow; huge brown beard, two dot eyes; crimson robe with fur trim; chipped sword. In game: a three-point crown (five points close up at 48px) with a red centre gem, a beard lighter than the sheet's, narrowing below the chin so the fur collar shows at the shoulders; a red cloak over a faded blue tunic; a chipped blade with a gold guard above the fist. |
| `patrol-pawn` | Crested plain-steel morion with rivets; dot eyes under heavy brows, nose, big moustache; blue pauldrons with gold edging; leather gloves; long pike. In game the morion becomes a compact steel kettle helm with a short downturned brim and a small comb: the morion's upswept brim points read as a sombrero at 48px. In game he has no moustache or nose (owner's correction, Nov 1: "too knightly"): a plain common guard's face, dot eyes and brows; the patrol king keeps the only moustache. |
| `patrol-knight` | Full blue plate, closed visor, tall blue plume; rides a horse in steel barding; long blue lance; almost no gold. In game: a grey horse head with a steel chanfron on a plain steel-barded barrel with two chunky legs; pale steel helm, compact blue plume, gold plume holder and gorget; the lance stands upright in his back hand at the horse's flank and couches across his waist on the strike. |
| `patrol-bishop` | Gilded mitre fused to a steel great-helm with round spectacle lenses, no face; blue vestment with gold embroidery; white glove; gold crozier. In game: the mitre is wider than the helm, lenses are pale glass in gold rims, a blue cape with a thick gold edge, a crozier curl ending in a gold ball on a steel shaft. |
| `patrol-rook` | Great-helm shaped like a castle keep, gold cross over the eye slit; massive blue pauldrons; halberd. The bulkiest figure. In game: a straight-sided steel keep with battlements cut into its top (no overhang, unlike the rebel tower), a gold cross visor with two dark slits, gold-rimmed pauldrons, belt and breastplate ridge; a solid halberd blade; defends with a portcullis. |
| `patrol-queen` | Towering powdered wig wrapped in gold chains and blue jewels; small steel cap; dot eyes with lid strokes, brows, red lips (face limit); blue gown with gold; sceptre; no crown. In game (declared correction): a small gold crown sits on the wig so the queen crest reads at 48px. The wig is scalloped and wider at the top than her head but kept low enough for the square (top near y 25); one draped gold chain with a blue jewel; a steel cap with a central point; a high gold-rimmed collar and puffed sleeves; the sceptre leans out so its orb clears the wig. |
| `patrol-king` | Gold crown on brown curly hair over a smug blue-grey sculpted mask with a painted moustache and goatee (face limit); gold cape over a blue robe; sword. In game: three ball-tipped crown points and one blue centre gem; a steel-blue mask with two closed-eye squint arcs (gold eye paint and brows smeared at 48px); a short scalloped gold mantle over the blue robe, gold orphrey and hem; a sword with a curled gold guard. |
| `odd-pawn` | Grumpy frog under the copper pot, heavy-lidded yellow eyes, red cord chin strap. In game (skin `frog-pot`): a wide flat head, wider than the rebel saucepan, with two eye domes tucked under its rim; a short frowning mouth over a pale throat; squat body on two plain leg ovals with a pale belly, round mitts; a red cord knotted under the jaw; a cattail on a wood stalk. |
| `odd-knight` | Empty plate suit, no head, on a carved wooden horse (no rockers visible). Rendered in patrol blue (drift); use rebel or neutral steel. |
| `odd-bishop` | White goose in a parchment mitre, one angry brow, orange beak. In game (skin `goose-mitre`): the rebel bishop's mitre, dropped so its peak stays under y 15, on a head tipped back 9° with a raised orange beak, one dot eye and one low brow; an S-curved neck into a low round body with a scalloped wing and orange webbed feet; no prop, it pecks. |
| `odd-rook` | Walking haystack with battlements, two black oval eyes. In game (skin `haystack`): one hay mound with bulging shoulders and tufted sides under the rebel rook's stone battlements, two tall oval eyes, dark boots under the hem, a two-tined hayfork in a straw mitten. |
| `odd-queen` | Melting candle in a holder, one flame, no face. Prompt asked for a crown of flame; add flame points. |
| `odd-king` | Sleepy orange tabby curled under a too-big jewelled crown with red velvet. |

## 9. Moving to the game

The game draws characters as SVG rigs in a 100×120 viewBox, shown at about 48–90px. The sheet is a 400px portrait.

**Keep at game size**

- The headgear silhouette and the chess crest (section 6). It is the main read.
- Faces at the sheet's budget: no face or two dot eyes for most characters.
- Hands become simple mitts; finger creases drop.
- One prop per character, oversized so it reads.
- Thick ink outline: `WEIGHT.outer` (4.5 units) from the shape kit, `inner` 2.8 for parts over parts, `face` 2.6 for brows and squints. Relative to the figure it is heavier than on the sheet, on purpose.
- Flat fill plus one hard shadow shape per part, and one white highlight tick on metal.
- Faction colour: rebels earthy with one dominant accent; patrol royal blue with gold edging; oddballs in their own creature colours.
- One rebel signature mark: a single patch, or a dent in the helm.

**Drop or simplify**

- Rivets, brick lines, hay strands, rust blotches, embroidery, chain links, fur texture.
- Secondary straps, belts and buckles.
- Interior lines shorter than about 6 units.
- The portrait tile, ground and labels.

**Changes from the current rigs**

- Current rigs use big white toon eyes and mouths. Under this guide most faces go: replace with visors, slots, hoods and dot eyes.
- Current rebel colours (teal, gold, brown) become earthy materials with one accent per character.
- Patrol royal blue and gold already match; keep the scheme, adjust hexes to section 7.
- Ink: redrawn art uses `#1f1a19` (`INK` in `src/components/inkKit.tsx`), near the sheet's black; old rigs keep `#382f2e` until redrawn.

**Learned from the pawn pilot** (drawn with `src/components/inkKit.tsx`, checklist `docs/art/BRIEF.md`)

- Light comes from the upper left on screen for every rig. The kit derives each part's cel shadow (a crescent on the lower right, shifted 5.5 × 4 units) and mirrors it with the rig's facing, so hand-drawn shadow shapes are gone. About 2.2 units of the shift hides under the outline.
- Shadows and highlights are clipped to their part and the outline is painted on top, so shading can't spill into a border.
- Parts under about 12 units across (mitts, boots, patches, nose) go unshaded: the crescent would swallow them.
- At the head scale (head r 14) dot eyes need r 2.4–2.7 and face strokes 2.6; thinner vanishes at 48px.
- Keep the figure inside x 18–82, prop and outline included; wider figures crowd the square.
- Pauldrons need their own outer outline, highlight and a gold edge, and must sit below the head (y 74+), or they read only as gold lines.
- A shape that narrows toward the top (crown) plus any brim reads as a hat. Pots need straight or widening sides.
- Even a straight pot with a lip reads as a top hat. A long side handle with a round end and a hanging hole is what sells a saucepan; inside x 18–82 it has to start inside the pan and run nearly level out the back; thick, not thin.
- A creature wearing the pawn's pan: lift the pan onto the creature's own features (the frog's eye domes) so they bulge out under it; a pan sitting on a flat head hides them.
- Inner lines (`WEIGHT.inner` 2.8) come out about 1.3px at 48px and blur away; a seam, dent or crack that matters to the read must be a shape or a colour change, not only an inner line. Inner lines are for 84px and up.
- Every gap counts the outline: the outer stroke eats 2.25 units from each side, so a gap between two outlined shapes needs at least 7.5 units of geometry to show 3 units of daylight. Parts under about 6 units turn into ink.
- Prop tines and prongs merge at 48px: a pole is its width plus 4.8 units of ink, so the pitchfork's three tines read as one grey block. Draw a multi-prong head as one solid shape, or space the poles by at least their inked width plus 3.
- The ground shadow differs by faction on purpose (`PieceRig.tsx`): an ellipse under rebels and a diamond under the patrol. It is the game's side marker, drawn by the rig, not the figure; tell the judge.

**Learned from the rooks** (`src/components/ArmourRooks.tsx`)

- Rooks are the big pieces, like the old rig: helm top at y 12, body about 44 wide (pawns 32), still inside x 18–82.
- Battlements: three merlons with two crenels 8 wide and 8 deep across a 36-wide top (merlons about 6.7). Narrower crenels close up under the outline at 48px.
- A dark eye slot needs stone around it: keep at least 5 units between the slot and the helm's edge, or the outline and the slot's line swallow the helm.
- Glowing dot eyes in a void use a light tone (`parchment`), with light KO crosses and squint chevrons; ink on the void vanishes.
- A wide helm leaves no room for a prop on the back shoulder: the head hides behind the helm at rest, and the shared attack swing (+65° about the front hand) lifts a back-pointing prop straight up behind the helm. The stonemason's mallet therefore leans on his front shoulder, upright beside the helm, so it shows at rest and swings down in front on the strike.
- Give a prop's head its own tone, darker than the helm beside it (`darkStone` against `stone`), or the two merge in greyscale and silhouette.

**Learned from the knights** (`src/components/ArmourKnights.tsx`)

- Knights stand about as tall as the rooks (helm or plume top near y 6–20) with a medium build (body about 30 wide).
- The horse head is the crest: keep it clear of the helm, on the facing side, with a long head, a round jaw and a notch at the throat, an ear standing up, and a neck narrower than the head. A thin wedge pointing up reads as a leaf or a hand.
- A part under about 14 units wide in a mid or dark tone loses half its width to the cel shadow and reads as a dark sliver. Widen it (the hobby horse head is about 22 wide) rather than lightening it: judges read a pale horse head as a llama.
- A mane or crest that sits behind another part is hidden by it. Draw it on top of the part it belongs to as a `Flat` with no ink; a jagged inner-lined strip reads as a crack.
- A `Pole` is its width plus 4.8 units of ink, so a thin strap (bridle, reins) drawn with it lands as a thick black bar. Draw a strap that matters as a `Flat` band about 3 units wide on top of the part.
- A rider on a full horse: put the rider's lance in the back hand, upright behind him, so at rest it stays clear of the horse head. The shared strike swing (+65° about the hand) passes it behind the pauldron and helm, where it vanishes; the patrol knight uses its own `rig-lance` that couches it low across his waist.
- Only give the `arm-front` class (the cheer raises it) to an arm whose hand holds nothing; a hand gripping the prop would lift off it.

**Learned from the bishops** (`src/components/ArmourBishops.tsx`)

- A mitre carries the bishop only when it is at least as wide as the head under it, with straight sides that taper in the top third. A narrow pointed mitre reads as a candle flame or a cowl's point at 48px.
- A dark hood around a black void needs a mid tone (about `#7a7068`), and the robe below it lighter still; the sheet's near-black hood merged hood, void and robe into one mass.
- Glowing eyes in a void stay round dots (r 2.8). Half-lidded half-moons read as sleepy and merge into one dash at 48px; put attitude in the pose instead.
- Lenses on a helm: one gold ring per lens as a `Pole` circle (both in one path, so they fuse at the bridge), pale glass inside. The glass must be paler than the steel around it.
- A hand that sits at the height of a gold trim line makes the sleeve read as part of the trim; move the hand clear of it.
- A shepherd's crook beside a tall mitre: the hook must clear the mitre's shoulder by the outline on both sides, so the shaft runs near x 78 and the curl turns back toward the head. That leaves the hook's opening only 2–3 units inside x 82. (The patrol crozier's curl still tucks behind his wider mitre; open.)

**Learned from the kings** (`src/components/ArmourKings.tsx`)

- On a phone's 4×4 board a piece on the top row may stand only about 15 units above the board's frame (topmost ink no higher than y 15, outline included); the old king's cross, the patrol bishop's mitre and the patrol knight's plume all poke out. The kings' crowns stop there, so the king is the widest piece, not the tallest. Check with `node tools/art/battle-shot.mjs king out.png`, which puts the patrol king on the top row.
- Crown points need open gaps: five ball-tipped points on a 40-wide crown fill their gaps with ink at 48px and read as a dark comb. Three bold points (rebel) or three ball-tipped points (patrol) keep daylight between them.
- Red gems on a crown band sit right over the face and read as glowing red eyes; keep red to one centre gem and use blue for the rest.
- A beard that fills the chest hides any collar under it. Narrow the beard's lower half so the fur collar shows at the shoulders.
- A crossguard under about 7 units tall is all ink, and a sleeve drawn over the prop hides it: put the guard above the sleeve's ink, a hand's height over the fist, with an inner line.
- The head pops loose in the shared death animation. A figure without a beard over the chest needs a neck block in the body under the head, so no background shows between head and shoulders.
- The crown must be its own `.crown` group inside the head: the checkmate finale throws it off.
**Learned from the queens** (`src/components/ArmourQueens.tsx`)

- In battle a piece is 0.92 of a square wide and anchored at 64% of its height, so the square's top edge sits at about y 21 in the rig. A crest above y 21 pokes onto the board frame from the top row. Tall pieces get their height from headgear that is wide and stacked, not from a crest that rises past y 21; the queens' crown tips sit near y 18–20.
- Narrow crown points fill with ink at 48px: the outer stroke and the cel crescent swallow anything under about 8 units wide. Draw a small crown with three fat points, unshaded and traced with the `inner` line.
- A pan seen face-on reads as a magnifying glass or a lollipop when its inside is lighter than its rim. Draw it near-black, with a darker flat inside, and big (about 25 units across).
- A wig reads as a wig through a scalloped outline (curl lobes down both sides), wider at the top than the head. Straight gold bands across it read as a turban or a layered cake; drape the chains in arcs.
- An accent on a back arm is hidden by the body unless that arm swings out past the body's edge; the rebel queen's armband arm hangs out to x 21.

## 10. Judge checks

A concept or a rig passes only if all of these hold.

| # | Check | How to test |
|---|---|---|
| 1 | Chess read | Fill the figure solid black at 48px; a viewer names the piece. |
| 2 | Face budget | Humans: no face, dot eyes, or a small dot-eye face; never more than the patrol queen or patrol king. Creatures: no more than the frog or cat. |
| 3 | Distinct design | Rebel vs patrol versions of a piece differ in headgear, prop and build, not just colour. Oddballs may share a crest; the creature must differ. |
| 4 | Faction read | Greyscale: rebels show patches or wear; patrol shows smooth plate with light trim; oddballs are a creature or object. In colour: patrol is royal blue with gold edging; rebels have one dominant accent. |
| 5 | Outline | Thick, even, near-black outer outline on the whole silhouette. |
| 6 | Fill | Flat fills, one hard shadow per form, white highlights; no gradients, no soft shading. |
| 7 | Proportions | Head plus headgear about half the figure; chunky build; big hands. |
| 8 | Prop | Humans and armour: one readable prop or mount that fits the character. Oddballs: the crest is enough. |
| 9 | Palette | Main fills within the section 7 families for the faction. |
| 10 | Game size | At 48px nothing turns to mush: no detail smaller than about 6 viewBox units. |
| 11 | No text | No labels, captions or titles inside the art. |
