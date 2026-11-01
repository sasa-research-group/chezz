# Chezz art style

Target look for all character art. Chosen by the owner on Oct 31 2026 from five generated sheets.

- Reference: `docs/art/sheet-armour-talks.webp` (18 characters), one crop per character in `docs/art/`.
- Rebel rook: the stonemason (`docs/art/rebel-rook.webp`), redrawn in this style from the owner's pick on sheet 1. It replaces the sheet-2 rook (kept as `sheet2-rebel-rook.webp`); the full sheet image still shows the old one.
- Recipe for new concepts: `docs/art/recipe.md`.
- Motion, timing and accessibility: `docs/art-direction-exile.md` sections 2 and 3.4–3.6.
- Status: the in-game rigs (`PieceRig.tsx`) predate this guide and have not been redrawn. The reference is the target; the rigs are the current state.

## 1. Armour does the talking

- Headgear, armour and props carry the personality. The face carries little or none.
- Face budget for humans and armour, from least to most face:
  1. No face: a hood void, embers behind bars, a closed visor, spectacle lenses on a helm, or no head at all.
  2. Two dot eyes on a bare skin face, no mouth: under a pot, in a helm opening, between crown and beard, or in hay.
  3. A small face: dot eyes, one-stroke brows, a nose tick, a one-stroke mouth (rebel queen, patrol pawn).
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

Values are cluster means and small-patch medians from `2-armour-talks.png`.

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
| Frog green | `#7bad4f` |
| Frog light | `#a6d175` |
| Frog shadow | `#4b7c40` |
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
| `rebel-pawn` | Dented copper pot over the brow, two dot eyes, no mouth; red bandana; patched green shirt; pitchfork. In game the pot has straight sides, a rim band and two small loop handles low on its sides, just above the rim; handles higher up read as mouse ears. |
| `rebel-knight` | Rusty bucket helm with a T-shaped opening showing dot eyes; blue neckerchief; leather vest, patched sleeve; wooden hobby horse. |
| `rebel-bishop` | Tall parchment mitre over a black hood void with two glowing yellow eyes; grey ragged robe with a yellow patch; gnarled crook. |
| `sheet2-rebel-rook` | Sheet 2 original, superseded: stone tower helm with a riveted grille, glowing embers behind bars; orange scarf; faded blue tunic; mallet. |
| `rebel-rook` | Stonemason in a castle-tower great-helm with a T-slot showing only two dot eyes in a black void, bare muscular arms, patched brown-and-green tunic, red bandana (his accent), big stone mallet over his shoulder. Redrawn in this style from the owner's sheet-1 pick; source crop `sheet1-rebel-rook.webp`. |
| `rebel-queen` | Dented kettle helm with a small crown welded on; small stern face; rusty breastplate on straps over a cream apron; purple armband; grey gauntlet; frying pan. |
| `rebel-king` | Gold crown low on the brow; huge brown beard, two dot eyes; crimson robe with fur trim; chipped sword. |
| `patrol-pawn` | Crested plain-steel morion with rivets; dot eyes under heavy brows, nose, big moustache; blue pauldrons with gold edging; leather gloves; long pike. In game the morion becomes a compact steel kettle helm with a short downturned brim and a small comb: the morion's upswept brim points read as a sombrero at 48px. |
| `patrol-knight` | Full blue plate, closed visor, tall blue plume; rides a horse in steel barding; long blue lance; almost no gold. |
| `patrol-bishop` | Gilded mitre fused to a steel great-helm with round spectacle lenses, no face; blue vestment with gold embroidery; white glove; gold crozier. |
| `patrol-rook` | Great-helm shaped like a castle keep, gold cross over the eye slit; massive blue pauldrons; halberd. The bulkiest figure. |
| `patrol-queen` | Towering powdered wig wrapped in gold chains and blue jewels; small steel cap; dot eyes with lid strokes, brows, red lips (face limit); blue gown with gold; sceptre; no crown. |
| `patrol-king` | Gold crown on brown curly hair over a smug blue-grey sculpted mask with a painted moustache and goatee (face limit); gold cape over a blue robe; sword. |
| `odd-pawn` | Grumpy frog under the copper pot, heavy-lidded yellow eyes, red cord chin strap. |
| `odd-knight` | Empty plate suit, no head, on a carved wooden horse (no rockers visible). Rendered in patrol blue (drift); use rebel or neutral steel. |
| `odd-bishop` | White goose in a parchment mitre, one angry brow, orange beak. |
| `odd-rook` | Walking haystack with battlements, two black oval eyes. |
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
