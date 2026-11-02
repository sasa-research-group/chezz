# Chezz art style

Target look for all character art. Chosen by the owner on Oct 31 2026 from five generated sheets.

- Reference: `docs/art/sheet-armour-talks.webp` (18 characters), one crop per character in `docs/art/`.
- Rebel rook: the stonemason (`docs/art/rebel-rook.webp`), redrawn in this style from the owner's pick on sheet 1. It replaces the sheet-2 rook (kept as `sheet2-rebel-rook.webp`); the full sheet image still shows the old one.
- Recipe for new concepts: `docs/art/recipe.md`. In-game sprites: `docs/art/PAINTED.md`.

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
- The sheet shows head and shoulders only. Full-body sprites fit the figure box (section 9).

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
- Oddballs never use patrol blue.
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
| `rebel-rook` | Stonemason in a castle-tower great-helm with a T-slot showing only two dot eyes in a black void, bare muscular arms, patched brown-and-green tunic, red bandana (his accent), big stone mallet over his shoulder. Redrawn in this style from the owner's sheet-1 pick; source crop `sheet1-rebel-rook.webp`. In game: a stone tower helm with an overhanging battlement band (wider than the tower), the eyes glow cream in a T opening, the sledge stands on his front shoulder with its head above the right merlon (not across the back of his neck: it hid behind the helm). |
| `rebel-queen` | Dented kettle helm with a small crown welded on; small stern face; rusty breastplate on straps over a cream apron; purple armband; grey gauntlet; frying pan. In game: a kettle helm whose brim droops at both ends, a squat three-point gold crown tilted on top, a big near-black pan held up beside the helm, and the purple armband on a back arm that hangs out past the body so it shows. |
| `rebel-king` | Gold crown low on the brow; huge brown beard, two dot eyes; crimson robe with fur trim; chipped sword. In game: a three-point crown (five points close up at 48px) with a red centre gem, a beard lighter than the sheet's, narrowing below the chin so the fur collar shows at the shoulders; a red cloak over a faded blue tunic; a chipped blade with a gold guard above the fist. |
| `patrol-pawn` | Crested plain-steel morion with rivets; dot eyes under heavy brows, nose, big moustache; blue pauldrons with gold edging; leather gloves; long pike. In game the morion becomes a compact steel kettle helm with a short downturned brim and a small comb: the morion's upswept brim points read as a sombrero at 48px. In game he has no moustache or nose (owner's correction, Nov 1: "too knightly"): a plain common guard's face, dot eyes and brows; the patrol king keeps the only moustache. |
| `patrol-knight` | Full blue plate, closed visor, tall blue plume; rides a horse in steel barding; long blue lance; almost no gold. In game: a grey horse head with a steel chanfron on a plain steel-barded barrel with two chunky legs; pale steel helm, compact blue plume, gold plume holder and gorget; the lance stands upright in his back hand at the horse's flank. |
| `patrol-bishop` | Gilded mitre fused to a steel great-helm with round spectacle lenses, no face; blue vestment with gold embroidery; white glove; gold crozier. In game: the mitre is wider than the helm, lenses are pale glass in gold rims, a blue cape with a thick gold edge, a crozier curl ending in a gold ball on a steel shaft. |
| `patrol-rook` | Great-helm shaped like a castle keep, gold cross over the eye slit; massive blue pauldrons; halberd. The bulkiest figure. In game: a straight-sided steel keep with battlements cut into its top (no overhang, unlike the rebel tower), a gold cross visor with two dark slits, gold-rimmed pauldrons, belt and breastplate ridge; a solid halberd blade. |
| `patrol-queen` | Towering powdered wig wrapped in gold chains and blue jewels; small steel cap; dot eyes with lid strokes, brows, red lips (face limit); blue gown with gold; sceptre; no crown. In game (declared correction): a small gold crown sits on the wig so the queen crest reads at 48px. The wig is scalloped and wider at the top than her head; one draped gold chain with a blue jewel; a steel cap with a central point; a high gold-rimmed collar and puffed sleeves; the sceptre leans out so its orb clears the wig. |
| `patrol-king` | Gold crown on brown curly hair over a smug blue-grey sculpted mask with a painted moustache and goatee (face limit); gold cape over a blue robe; sword. In game: three ball-tipped crown points and one blue centre gem; a steel-blue mask with two closed-eye squint arcs (gold eye paint and brows smeared at 48px); a short scalloped gold mantle over the blue robe, gold orphrey and hem; a sword with a curled gold guard. |
| `odd-pawn` | Grumpy frog under the copper pot, heavy-lidded yellow eyes, red cord chin strap. In game: the painted skin `frog-pot` (`docs/art/SKINS.md`). |
| `odd-knight` | Empty plate suit, no head, on a carved wooden horse (no rockers visible). Rendered in patrol blue (drift); use rebel or neutral steel. In game: the painted skin `empty-knight` (`docs/art/SKINS.md`). |
| `odd-bishop` | White goose in a parchment mitre, one angry brow, orange beak. In game: the painted skin `goose-mitre` (`docs/art/SKINS.md`). |
| `odd-rook` | Walking haystack with battlements, two black oval eyes. In game: the painted skin `haystack` (`docs/art/SKINS.md`). |
| `odd-queen` | Melting candle in a holder, one flame, no face. Prompt asked for a crown of flame; add flame points. In game: the painted skin `candle-queen` (`docs/art/SKINS.md`). |
| `odd-king` | Sleepy orange tabby curled under a too-big jewelled crown with red velvet. In game: the painted skin `cat-king` (`docs/art/SKINS.md`). |

## 9. Moving to the game

The game draws each character as one painted sprite (`docs/art/PAINTED.md`) in a
100×120 viewBox, shown at about 48–90px. The sheet is a 400px portrait.

**The figure box**

- At rest every sprite keeps its ink, outline included, inside x 18–82 and at y 0 or
  below, feet on y 108. `tests/figure-bounds.test.ts` checks every piece and skin.
- Height is free up to y 0: the board's far rim (`--rim` in `src/exile.css`) catches a
  tall crest on the top row. Tall crests are the chess read; use the height.
- Check a top row with `node tools/art/battle-shot.mjs bishop,rook out.png [--battle 3]
  [--width 844 --height 390]`.

**Keep at game size**

- The headgear silhouette and the chess crest (section 6).
- Faces at the budget: no face or two dot eyes for most characters.
- Simple mitts; one oversized prop.
- A thick outer outline (`tools/art/sprite.mjs` adds 12 px at 480 px tall, in
  `#1f1a19`). `#382f2e` (`INK` in `PieceRig.tsx`) is for shadows, effects and UI.
- Flat fill, one hard shadow, a white highlight tick on metal.
- Faction colour and one rebel signature mark (a patch or a dent).

**Drop**: rivets, brick lines, hay strands, rust blotches, embroidery, chain links,
fur texture, secondary straps and buckles, the portrait tile and labels.

**Shape lessons that still hold** (learned drawing the retired SVG art; they apply to
what a prompt asks for)

- A saucepan reads as a pan only with a long, thick, nearly level handle out the back;
  a straight pot with a lip reads as a top hat.
- Prop tines merge at 48px: ask for one solid head or widely spaced prongs.
- A horse head reads through its jaw, throat notch and a dark mane; a chanfron covering
  it turns it into a grey wedge. Narrow pale heads read as llamas.
- A mitre carries the bishop only when it is at least as wide as the head, with straight
  sides tapering in the top third; a narrow one reads as a flame or a cowl.
- A dark hood around a black void needs a mid tone, and the robe lighter still.
- Crown points need daylight between them: three bold points beat five thin ones. Keep
  red to one centre gem; red gems over the face read as eyes.
- A wig reads through a scalloped outline wider at the top than the head; straight bands
  read as a turban.
- A pan seen face-on reads as a lollipop if its inside is lighter than its rim: keep it
  near-black.
- A narrowing shape with a brim reads as a hat; pots need straight or widening sides.
- An accent on a back arm hides behind the body unless the arm swings out.

## 10. Motion

- Animation only presents what the rules decided. Every duration scales with `--spd`;
  skip and reduced motion reach the same final frame.
- Keep any single beat at 1 s or less at 1×, and the board readable during it.
- Strong poses held briefly beat subtle in-betweens at this size.
- No flashing faster than 3 Hz. Defeat is slapstick (flop, pop, puff), never gore.
- Never let colour carry the side alone: the ground marker (ellipse under rebels,
  diamond under the patrol) and the faction materials carry it too.

## 11. What to look for

Not a gate; what to check by eye on a new sprite.

1. Chess read: filled black at 48px, the piece is nameable.
2. Face budget (section 1).
3. Rebel and patrol versions differ in headgear, prop and build, not just colour.
4. Faction read in greyscale: wear and patches vs smooth plate and trim.
5. Thick even outline; flat fills; one hard shadow; no gradients.
6. Chunky: head plus headgear about half the figure.
7. Palette within section 7; no text in the art.
