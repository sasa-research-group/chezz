# Art decisions

What the owner picked or rejected, newest first, with their reasons. Read before
proposing a new look. Generation details for kept art are in `recipe.md`.

## 2026-11-01: knights on the shape kit
- Both knights redrawn behind `?art=new` (`src/components/ArmourKnights.tsx`), with the
  old knight's group names, so the flip hop, leap and leap-back play unchanged.
  About as tall as the rooks, medium build; the horse head is the crest, on the facing
  side and clear of the helm. The judge sheet now has leap and leap-back rows for knights.
- Rebel knight: rusty bucket helm (rust blotches, a crack) with a T-opening showing skin
  and two dot eyes, blue neckerchief, leather vest, cream sleeves with a green patch. The
  hobby horse is the prop: held by the neck at waist height, stick down between his legs
  to the ground behind, so the strike is a bonk with the horse head. Its head is wood
  brown with a dark mane and bridle drawn flat on top; a pale or narrow head read as a
  llama. Declared correction: the reference holds the horse higher, beside his shoulder,
  where it hid behind the bucket.
- Patrol knight: rides a grey horse (a steel chanfron and neck plates, blue saddle cloth
  with gold trim) instead of a hobby horse; closed steel visor, tall blue plume, gold
  plume holder and gorget. Declared correction: the lance stands upright in his back
  hand behind him, since every forward position crossed the horse head at rest; the
  strike swings it over the helm and across the horse.
- Judge rounds (readability/style/likeness/motion/consistency): rebel 7/8/6/6/8 →
  7/7/7/7/8 → 7/7/7/8/8 (passed from round 2); patrol 7/7/6/6/7 → 6/7/6/6/7 →
  5/6/5/6/6. The patrol knight did not pass. Still open: at 48px the horse's lower half
  (legs, hooves, rider's leg, mitts) is a busy dark cluster and the horse has little
  visible barrel; the lance is mostly ink at 84px and blinks out mid-swing at 35% of the
  attack; the plume lobes sit close to the lance tip. A next pass should give the horse
  a bigger visible body and fewer, larger leg shapes, or show only the horse's front half.
  Judges also want the rebel's belt and pouch, and the stick behind the near leg.

## 2026-11-01: rooks on the shape kit
- Both rooks redrawn behind `?art=new` (`src/components/ArmourRooks.tsx`), in the old
  rook's groups and pivots, including the `.door` that drops over the face on defend
  (rebel: a plank door; patrol: a portcullis). Bigger than the pawns, like the old rig:
  helm top at y 12, body about 44 wide, still inside x 18–82.
- Rebel rook: stone tower helm with an overhanging battlement band, cream dot eyes in
  a dark slot, red bandana, green tunic with two patches, bare arms. The mallet leans
  on his front shoulder, upright beside the helm. On the back shoulder (the reference
  pose) the head hid behind the helm at rest and the shared swing lifted it straight up
  behind the helm on the strike, so two judge rounds saw no weapon. A declared
  correction against `rebel-rook.webp`; the owner may want the back-shoulder pose back,
  which would need a rook-specific swing.
- Patrol rook: straight-sided steel keep (blue-grey `helmSteel`, so it reads as metal,
  not cloth) with battlements cut into its top, gold cross visor with dark slits,
  gold-rimmed pauldrons, belt and ridge, halberd with the blade raised above the helm.
- Judge rounds (readability/style/likeness/motion/consistency): rebel 7/8/5/6/7 →
  6/8/6/6/7 → 8/8/6/6/8; patrol 8/8/7/8/7 → 8/7/7/7/8 → 8/8/7/7/8. The patrol rook passed in
  round 3; the rebel rook did not (likeness 6, motion 6). Still open: the rebel attack's wind-up hides the mallet behind his body and
  helm (20–35%), the mallet head is small next to the reference's sledge, and the
  judge wants the reference's split faceplate around a bigger T-opening; the patrol
  halberd head is a dark blob at 48px (after the last round it moved down and in, to
  stay inside the cell and x 82).

## 2026-11-01: the frog passes the judge
- Frog skin redrawn for 48px: a head wider than the pan (rx 23.5) with the pan
  dropped onto the eye domes so the lids tuck under its rim; legs merged into two
  plain ovals (no toes, no belly line, no finger pads); round mitts; a shorter
  frowning mouth; the red cord shrunk to a band tight under the jaw with a knot
  right of centre (a long cheek cord was the loudest part); a fatter cattail with a
  wood stalk and leather head, so it parts from the frog's green and from the pan.
- Judge rounds (readability/style/likeness/motion/consistency): 6/7/6/8/8 →
  7/7/6/8/8 → 7/7/7/8/8, a pass. Last judge's open notes: the 48px silhouette is
  a box with a stick (the domes no longer rise above the head), the lid lines meet
  in a bar like glasses, the cattail head is thin for a cattail, and the cord can
  still read as a belt.

## 2026-11-01: saucepan, plain patrol face, a real frog
- Rebel pawn: the pot becomes an upturned copper saucepan with a long handle out the
  back. The straight pot kept reading as a top hat. Kept: copper, the dent, dot eyes
  under the rim. The handle is thick, has a hanging hole and runs nearly level out the back, inside
  x 18–82; the pan sits a little forward so the handle can be longer. A declared
  correction against `rebel-pawn.webp`.
- Patrol pawn: no moustache or nose ("too knightly"). A plain guard's face: dot eyes
  and brows under the kettle helm. The patrol king keeps the sculpted moustache. A
  declared correction against `patrol-pawn.webp`.
- Frog skin: a real frog instead of a green person in a hat. Eye domes bulge out
  under the pan (the frog lifts it 9 units), wide mouth, pale throat, squat body on
  haunches, webbed hands and feet. Colours sampled from `odd-pawn.webp`. Prop: kept
  the cattail; a pitchfork would make it a recoloured rebel pawn. Skins may now
  replace the body and arms (`SKINS.md`).
- Judge rounds (readability/style/likeness/motion/consistency): rebel 7/8/7/8/8 →
  7/8/6/8/8 → 7/8/7/8/8; patrol 8/8/8/8/6 (the diamond side marker, not the art) →
  8/8/7/8/8 → 8/8/8/8/8; frog 7/7/7/8/8 → 6/7/6/8/7 → 6/6/7/8/7. The frog did not
  pass: at 48px its legs and belly lines go muddy, and the red chin cord is the
  loudest part. Judges still sometimes read the pan as a bowler with a feather.
  They disagreed on the handle: round 2 wanted it thicker, round 3 thinner and longer.

## 2026-10-31: skins are plumbing first, art later
- Skin system built (`SKINS.md`): a run's victory unlocks the next rebel skin, saved
  in `chezz.meta.v1`; skins are drawn on the shape kit and show in battle only with
  `?art=new`. The frog pawn is a placeholder that wears the shared `RebelPot`,
  because whether the pot becomes a saucepan is still the owner's call.

## 2026-10-31: pawn redraw on the shape kit
- Patrol pawn helmet: the guide's morion (tall comb, upswept pointed brim) read as a
  sombrero or cowboy hat at 48px in two judge rounds. Replaced in game by a compact
  steel kettle helm with a short downturned brim and a small comb. The reference
  crop is unchanged; this is a declared correction.
- Rebel pawn pot: a deep straight-sided pot with a rim band and two small loops just
  above the rim. Tried and dropped: a tapering pot (reads as a felt hat), round
  handles up the sides (mouse ears), flat handles at mid-height (a hat brim). The
  judge still reads the pot as hat-like at times; still open.
- Judge rounds: rebel 6/7/4/7/7 → 7/7/6/8/8 → 6/7/5/6/7, patrol 8/8/7/6/7 → 8/8/7/8/8
  → 8/8/7/8/8 (readability/style/likeness/motion/consistency). The kept build is
  round 2's pot plus a darker copper shade and an elbow patch.
- Both pawns fit inside x 18–82 and share one build (head r 14, body x 34–66).
- Light from the upper left on screen for every rig, derived by the kit.

## 2026-10-31: in-game art stays hand-written SVG
- Pawn pilot (SVG rigs behind `?art=new`): "looks really good", but shading
  spilled past parts into the outline, and there were general inconsistencies.
- Rejected for now: generating painted raster parts and hanging them on the rig.
- Follow-up: a shape kit where shading is clipped to its part and the outline is
  painted last, shared stroke and colour tokens, one light direction, a judge
  sheet (`tools/art/shoot.mjs`).

## 2026-10-31: the rebel rook is the stonemason
- Owner liked the sheet-1 rook (stonemason, tower great-helm, mallet on the
  shoulder). It was redrawn in the sheet-2 style with two dot eyes in the slot:
  `rebel-rook.webp`. The sheet-2 ember-eyed rook is kept as `sheet2-rebel-rook.webp`.
- Picked art must be in the house style, not copied from another sheet as is.

## 2026-10-31: the style is "armour does the talking" (sheet 2)
- "Two is definitely the style we want. It's perfect." Recipe: `recipe.md`.
- Five sheets were compared, each with 3 rows (rebels, patrol, oddballs) × 6 pieces:
  1. Bold cartoon: full human faces. Only its rook was kept.
  2. Armour talks: picked.
  3. Chibi anime: not picked.
  4. Candlelit puppets: not picked.
  5. Ink comic: not picked.
- What the owner likes in the Castle Crashers references: armour and headgear
  carry the character; faces are hidden or tiny; every character is a complete,
  distinct design that looks like it belongs in its own story, not a recolour.
  Not every character should look related.

## 2026-10-30: face experiments, all rejected
Done on an early "chunky" lineup (big heads, flat colour, thick outline).
- The chunky lineup was "better than the others" but not final; it read like
  Fallout cartoon characters.
- Toy figures with googly eyes: the bulging eyes are hard to look at.
- Bean heads: read like Lego, unappealing.
- Helmet faces on every piece: gimmicky, doesn't suit every character. (Partly
  hidden faces are fine.)
- Shape critters (geometric heads): unappealing.
- Blush and ":3" faces on the chunky lineup: the owner does want a ":3" vibe,
  but these weren't it.
- Keep: the humour and wonkiness, such as the knight on a hobby horse.

## 2026-10-30: oddball skins
- The owner wants wonky unlockable variants, like Castle Crashers' bee and bear.
- They must be our own characters, never copies.
- Each one keeps its chess piece's headgear crest.
- Plan: finishing a run unlocks a skin; rebel side first; the first skin is the
  frog pawn.

## 2026-10-30: no narrator text
- The owner hates textbook LLM prose and cute story lines in the game.
- The game and studio use labels, numbers and icons.
- The story ("Escape from Exile", hideout, patrol) stays and is unwritten.
