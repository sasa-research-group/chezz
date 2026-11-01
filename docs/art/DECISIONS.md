# Art decisions

What the owner picked or rejected, newest first, with their reasons. Read before
proposing a new look. Generation details for kept art are in `recipe.md`.

## 2026-11-01: the goose bishop skin
- `goose-mitre` (`src/components/skins/gooseBishop.tsx`), third in the unlock order
  after the frog and the haystack: the empty knight was not on main yet, and it goes
  before the goose once it lands. A white goose wearing the rebel bishop's own
  `RebelMitre` at 0.82 scale (the new `scale` shrinks the geometry, not the ink),
  peak under y 15 for the top row's board frame. The full-size mitre had to sit so
  low that it swallowed the head and brow (round 2).
- Smugness: the head and mitre tipped back 9°, a raised beak and one low brow over a
  single round dot eye; no half-lidded eye (the bishops' lesson: it blurs to a dash).
- No prop. A crook's hook would collide with the beak inside x 82, and an oddball's
  crest is enough. Instead the attack is a head peck (`quirk-peck` in `rig.css`): the
  head coils back, lunges beak first and settles while the mitre tips back. This
  extends the quirk rule (idle only) to an attack move for a skin with no prop.
- The neck lives in the body and runs up under the head, so the death pop no longer
  shows a gap between head and body (round 1 read it as a decapitation).
- Judge rounds (readability/style/likeness/motion/consistency): 7/7/5/5/7 →
  7/8/6/6/7 → 7/7/6/6/7, not a pass. After round 3, unjudged: the neck's square top
  is rounded and sits lower, and the peck pivots at the head's base with a smaller
  lunge, so the lunging head no longer leaves the neck's top bare (a notch showed
  behind the hit burst). Still open: judges read the
  mitre as a ribbed helmet or bell at 48px, wider than the reference's tall
  back-tilted mitre; the head shows only under the brim; the body reads squat and
  duck-like because the top-row limit leaves little height for the neck; the peck is
  buried under the shared squash stretch and hit burst; the wing's cel shadow reads as
  a jagged band.
## 2026-11-01: a deep far rim, so tall crests can't leave the board
- Problem: on the top row the patrol bishop's mitre, the patrol rook's halberd and the
  patrol pawn's pike rose past the board's 12px frame onto the table (up to 11 CSS px on a
  390×844 phone). Measured in the browser with `battle-shot.mjs` on every board (4×4,
  6×4, 6×6) at 390×844, 844×390 and 1440×900: the square's top sits at y 25–30 in rig units
  (the tilt adds 3–8 to the flat y 22), and the old frame's outer edge at y 8–13, so the
  earlier "y 15" and "y 21" caps were one-screen guesses that a bigger screen broke.
- Chosen: both. (1) Layout: the board plane's top border is a third of a square deep
  (`--rim` in `src/exile.css`; the table's height fit in `table.css` counts it), so ink
  down to y 0 on the top row lands on the frame on every board and screen measured (frame
  edge at y −4 to −8). It scales with the square, so it holds on any board size. (2)
  Contract: at rest, every redrawn figure's ink stays at y 0 or below and inside x 18–82,
  outline included; `tests/figure-bounds.test.ts` computes it from each rendered rig
  (both sides, both patrol hues, every skin).
- Why not a lower cap alone: crests are the chess read, and a cap near y 15–21 would shrink
  the bishop, rook, pawn and knight. Why not the rim alone: nothing would stop a figure from
  drawing past its viewBox. Together, a figure that passes the test can't cross the frame.
- Changed: the patrol pawn's pike tip came down 2 units (it reached y −1.3). Every other
  redrawn piece and every skin were already inside. The old art also pokes less; only the
  old patrol queen's crown (y −6) still grazes the rim on a desktop 6×6 board.
- Cost: the far rim is about 29px on a phone 4×4 board instead of 12px, so the board is a
  little shorter when the height limits it (landscape phones).

## 2026-11-01: kings on the shape kit
- Both kings redrawn behind `?art=new` (`src/components/ArmourKings.tsx`) in the old
  king's groups; the crown is its own `.crown` group inside the head, so the checkmate
  finale still throws it off. The kings are the widest pieces, not the tallest: on a
  phone's 4×4 board ink above about y 15 pokes out of the board frame from the top row,
  so both crowns stop there (checked with `battle-shot.mjs king`).
- Rebel king: a three-point gold crown pulled low, a red centre gem and two blue ones on
  its band; only two dot eyes between it and a huge wild beard (lighter than the sheet's
  brown, which merged with the outline at 48px), narrowing below the chin so the fur
  collar shows; red cloak over a faded blue tunic; a chipped sword whose gold guard sits
  above the sleeve (under it, it was all ink). Declared corrections: three crown points,
  not five; the lighter beard.
- Patrol king: three ball-tipped points on one solid gold crown with a blue centre gem;
  brown curls; a steel-blue mask with two closed-eye squint arcs, a painted moustache and
  goatee; a short scalloped gold mantle over a blue robe; a sword with a curled gold
  guard. Tried and dropped: five ball points (their gaps filled with ink, a dark comb at
  48px), red side gems (read as glowing red eyes over the mask), gold eye paint and brows
  on the mask (a grey-yellow smear at 48px). A neck block under the head keeps the death
  pop from showing a gap. Declared corrections: three points; the short mantle.
- Judge rounds (readability/style/likeness/motion/consistency): rebel 7/8/7/8/8 →
  7/8/7/8/8 → 8/8/7/7/8, a pass throughout; patrol 6/7/7/5/7 → 7/7/6/8/8 → 7/8/7/7/8, a
  pass in round 3. Still open: the fist sits a hand's height under the crossguard with
  the sleeve between (the sword can look like it floats); the rebel sword is slimmer
  than the reference's and the fur collar shows mostly on the back shoulder; the patrol
  mask reads as a visor at 48px and his dark curls merge with the outline.

## 2026-11-01: bishops on the shape kit
- Both bishops redrawn behind `?art=new` (`src/components/ArmourBishops.tsx`) in the
  old bishop's groups; the shield still shows on defend. Tall and slim like the old
  rig: mitre peak near y 4, a cowl or cape about 40 wide over the shoulders, robe
  flaring to a 40-wide hem. The crook rises beside the mitre inside x 18–82.
- Rebel bishop: wide parchment mitre with straight sides, tan bands and a small back
  horn peeking out at the upper left (the cleft); a grey-brown hood with a black void
  and two round glowing dots; a mid-grey ragged cowl over a light-grey robe with a
  zigzag hem and a yellow patch; a wavy wooden crook with a twig. The hood is much
  lighter than the reference's near-black, and the robe lighter too: at 48px the
  sheet's colours merged into one dark mass (round 1). Half-lidded "smug" eyes read
  as sleepy and merged into a dash at 48px (round 2), so the eyes are round and the
  smugness is only a slight backward head tilt. Declared corrections.
- Patrol bishop: gilded mitre wider than the helm, deep-gold bands; a steel bucket
  helm with gold-rimmed spectacle lenses (pale glass, so they part from the steel)
  and a gold nose strip; blue cape with a thick gold edge and clasp; blue robe with a
  gold hem and orphrey; white gloves, a gold cuff on the front one; a gold crozier whose curl ends
  in a ball, on a steel shaft with a gold knop. Breathing holes, filigree and crozier
  studs are dropped (sub-pixel at 48px). His front hand sits lower than the rebel's
  (y 89, not 80): at y 80 the sleeve lay along the cape's gold edge and read as a
  gold bar.
- Judge rounds (readability/style/likeness/motion/consistency): rebel 6/7/6/7/8 →
  7/8/6/8/8 → 8/8/7/8/8, a pass; patrol 8/8/6/7/8 → 8/7/7/7/8 → 7/7/6/8/8, not a pass.
  After round 3, unjudged: the patrol shaft went from dark mail to steel (it merged
  with the outline) and his hem widened. Still open: the patrol body reads as a
  trooper's tunic, not a cope (the judge wants a broad flared cope with a heavy gold
  collar), the cape's gold edge still reads as a bar across the chest, and the
  crozier hugs the body so the 48px silhouette is one slab, and its curl tucks behind
  the mitre's shoulder; the judge never saw the rebel's back horn as a second point,
  and the rebel hook's opening is only 2–3 units (about a pixel at 48px).

## 2026-11-01: patrol knight simplified
- Horse: one plain steel-barded barrel (`helmSteel`) on two chunky legs (each pair drawn as
  one), no rider's leg, no tail. The head leans forward with a chanfron, a dot eye and two
  ears that stay below the helm, so the plume is the tallest point. A brown rein across
  the head read as the rebel's hobby-horse stick and was dropped.
- Helm and visor in pale `barding` steel; a darker steel helm read as a black lump at 48px.
  One compact royal-blue plume curl, swept back; at rest the lance tip sits about 11
  units below and behind the plume tail.
- Lance: a `Pole` shaft in a new lighter `lance` blue (a `Part` shaft was mostly outline),
  steel tip with a gold ring, big steel vamplate by the hand, shorter (tip at y 35). The
  hand moved down to the horse's flank (26.5, 90).
- Strike: the shared `rig-swing` passed the lance behind the pauldron and helm, so it
  vanished mid-swing and its wind-up left the sheet cell. The patrol knight gets its own
  `rig-lance` (rig.css): a short lift, then couched forward and up (about 30° above level)
  across his waist from 33% to 58%, back upright by 90%. It can't reach past the muzzle without leaving the frame.
- In a 390-wide battle he now sits lower than the patrol rook; the plume still reaches
  about 11 CSS px above his square into the board frame. The lance tip stays inside.
- Judge rounds (readability/style/likeness/motion/consistency): 5/6/5/6/6 → 6/7/6/6/6 →
  6/7/5/6/6. Not passed. Still open, per the last judge: at 48px the helm and plume are
  ink-heavy; the horse head reads as a grey wedge, not a barded warhorse; on the strike
  the lance crosses the torso but its tip hides behind the horse head and the impact star
  lands on the helm. The judges also suggest a lower-tilt hop than the full flip for the
  move, which is shared knight motion.
## 2026-11-01: queens on the shape kit
- Both queens redrawn behind `?art=new` (`src/components/ArmourQueens.tsx`) with the old
  queen's groups and front-hand prop pivot, so every action plays, including the promotion
  morph-in (the judge sheet now has a morph-in row for queens). The front hand grips the
  prop, so neither queen has an `arm-front`: the old rig's queen slap has no free arm to
  move, and her strike is the prop swing. The free back arm carries `arm-back`; the shared
  cheer swings it in behind the gown, as on every back arm, hiding the armband for a moment.
- Height: tall pieces, but kept inside the battle square, whose top edge sits at about
  y 21–22 in the rig. Crown tips sit near y 20 (rebel) and y 18 (patrol) counting the line,
  so both crowns are squat and the patrol wig can't tower like the reference. A declared
  correction. In battle the patrol crown's tip still pokes a few units over a top-row square
  (the patrol pawns' pikes poke more).
- Rebel queen: a steel kettle helm with its brim drooping at both ends and a dent, a squat
  gold crown with a red gem welded on crooked, a stern small face (dot eyes, brows, a
  one-stroke mouth), a rusty breastplate on straps over a cream apron with a frayed hem,
  and a mauve-brown shirt. The purple armband sits on a back arm that hangs out past the
  body; tucked behind the body, it didn't show. The frying pan is held up beside the helm,
  big and near-black: a smaller, lighter pan read as a magnifying glass.
- Patrol queen: a scalloped powdered wig, wider at the top than her head, with one draped
  gold chain and a blue jewel; a steel cap with a central point; a face with dot eyes, lid
  strokes and red lips (the guide's face limit); a gold-rimmed collar fanning up behind the
  face; puffed sleeves with a gold stripe; a gold stomacher and hem; and a sceptre leaning
  out so its orb clears the wig. Declared correction: a small gold crown on the wig, so the
  queen crest reads at 48px (the reference has none). Collar tips that stuck out past the
  wig read as a stray tab, so the wig's sides were shortened and the collar fans behind
  the face instead.
- Judge rounds (readability/style/likeness/motion/consistency): rebel 7/6/6/7/6 →
  7/8/7/8/7 → 7/8/7/7/8, a pass from round 2; patrol 5/6/5/7/6 → 6/7/6/8/7 →
  6/8/6/7/8, not a pass. Still open: at 48px the patrol wig and collar make a box, so she
  reads as a bucket. The last judge wants three stacked rolls, each bulging past the one
  below, pearl swags and a cone-shaped top within the height cap. The pan still reads as a
  mace or lollipop to some judges, who want a tilted ellipse with a lighter rim. In the
  20% attack frame both props swing behind the head and vanish (the shared wind-up). The
  round-1 judge wanted dot-eye-only faces; the guide allows both queens' faces, so later
  judges were told the guide's budget.

## 2026-11-01: the empty knight skin
- Third skin in the unlock order (`src/components/skins/emptyKnight.tsx`). Declared
  corrections against `odd-knight.webp`: rebel colours (rusty iron, wood, red rag and
  rein as the one accent) instead of the reference's patrol blue, which was drift;
  the rebel bucket helm, empty, instead of no head; rockers under the horse; no prop.
- The emptiness: a void T with no eyes, a helm floating clear of the collar (it bobs
  in idle), a dark neck hole, and a gap between vambrace and gauntlet.
- What failed at 48px: the outline is 4.5 units, so any part under about 10 units
  thick is all ink. A 5-unit rocker, a thin gorget ring and small pauldrons all came out
  black. A narrow torso under wide pauldrons read as mushrooms; a narrow cuirass read
  as a bucket or a can. The rider's leg and a second vambrace turned the middle into
  "a stack of grey boxes", so both were dropped.
- Judge rounds (readability/style/likeness/motion/consistency): 5/7/4/7/7 → 5/6/5/7/6
  → 5/7/5/8/7. It did not pass. Still open: at 48px it reads as three stacked blocks
  (helm, round cuirass, rocker), with no knight notch, because the horse head is behind
  the torso; the round cuirass reads as a pot or kettle; the neck hole is mostly hidden
  by the pauldrons' outlines; the red band reads as a lid stripe, not a tied rag. The
  judges disagreed on the leg: round 2 wanted the leg plates gone, round 3 wanted one
  greave back. A next pass should put the horse head in front of the torso's right edge,
  with the ear above the helm line, and make the cuirass taper to the waist.

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

## 2026-11-01: the haystack rook skin
- Second skin in the unlock order, after the frog (`src/components/skins/haystackRook.tsx`).
  It wears the rebel rook's stone battlements (`RebelBattlements`), not the reference's
  hay-coloured ones: a skin keeps its piece's crest. A declared correction against
  `odd-rook.webp`.
- The hay is one mound in the body slot. Splitting it into a head dome and a body skirt
  drew an outline across the middle that judges read as a "ghost in a layered dress". The
  head slot keeps only the eyes, the crest and the plank `.door`, so the eyes peek out of
  the hay as the head bobs.
- A smooth tapering bell with two oval eyes read as a ghost or a bedsheet. Bulging
  shoulders and tufts poking out of both sides made it a haystack.
- Prop: a two-tined hayfork in place of the mallet. The fork is the haystack's own joke;
  a stone mallet belongs to the stonemason. Two tines, not three, so the gap stays open at
  48px (the brief's tine rule). The front arm is only a straw mitten on the shaft, and the
  skin draws no back arm: an arm behind the mound showed only as a black smear of outline.
- Judge rounds (readability/style/likeness/motion/consistency): 7/7/6/8/8 → 7/6/6/7/7
  → 8/7/7/7/7, a pass. Last judge's open notes: the right side's tufts hide behind the
  fork, so that edge looks smooth; the kit's cel crescent barely shows on such a large
  part; the strands look like stitches; the crest lifts off the hay at death 20% (the
  shared head pop); and the mitten has no thumb and gets lost at 48px.

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
