# Escape from Exile: first playable slice

This slice tests the vision discussed in the September 15 Mark/Wesley meeting:
an exiled king recruiting an army to reclaim his kingdom, with familiar chess
movement, smaller varied boards, permanent casualties, and comic medieval art.
The notes and full transcript were both read. Combat was still an open design
question in that meeting, so this slice exposes both models explicitly.

## The three encounters

1. **The roadside patrol:** king (5 HP) against two pawns on a 4×4 board.
2. **The first follower:** 6×4 toll gate with blocking walls and three pawns.
3. **The narrow crossing:** 6×6 bridge with missing squares, two pawns, and a
   wounded knight (2 HP). Defeat the patrol to finish the prototype.

There is no enemy king in these encounters. Victory requires defeating every
enemy. Player king death takes priority and ends the run.

Both camps award 8 gold. Starting gold is 2. Choose a bishop (6 gold), a rook
(8 gold), 2 king healing (4 gold), or save the gold. One choice advances to the
next encounter. Every surviving piece retains its HP. Dead allies stay dead;
new recruits get new IDs and full HP. Nothing here is permanent metaprogression.

## The combat comparison

Choose at the start of a run; the model remains fixed until starting again.
The encounters and enemy policy are identical for both choices.

- **Always trade:** every attack exchanges current HP as damage. Defend absorbs
  1 incoming damage and still retaliates (if it could reach the attacker).
  This is a concrete first experiment
  for Mark's suggested simplification; the bonus was not specified in the meeting.
- **Free hits:** idle targets take current-HP damage without returning a hit.
  Defenders, reciprocal attacks, and contested destinations exchange HP
  (subject to the rule below).

**Only a piece that could strike back does.** In both modes, a return hit
(retaliation, a Defend counter, a held pawn's victim countering) happens only
if the target could legally attack the attacker's square:
- A pawn strikes only diagonally forward.
- A knight strikes only a knight's move away.
- A slider needs a clear line on the starting board.

So a rook attacking a knight two squares away, or a pawn straight ahead,
takes nothing back. In a contested square, a piece deals damage only if its
move could capture there; a pawn stepping forward can't.

Trades can kill either or both units. A surviving defender stays on its square.
A surviving attacker occupies its target only when the defender dies or vacates.
A target vacates only if it actually leaves. When its own move fails, attacks
on it land as normal and its own attack still lands: in Always trade a stuck
piece both deals its hit and returns one (if it could reach the attacker); in
Free hits it returns nothing.
Equal unprotected trades destroy both. Current HP doubles as attack strength;
watch whether lasting king damage makes runs feel hopeless too early.

## Planning and presentation

- **Order pool.** Each battle has a fixed pool of orders: 6, 10 and 18 for
  the three encounters. Every queued order, Defend included, spends one;
  cleanup strikes are free. If the pool runs out while enemies remain, the
  run ends. Clearing a battle turns each unused order into 1 gold. The pool
  sizes come from the test bot's needs plus generous slack (the bot sees
  enemy orders, so people need more); tune them from playtests.

- One order per piece, up to three. A lone king has one available order.
- Order a legal chess destination or defend in place. Queued orders can be
  replaced or removed before Resolve; friendly destinations cannot repeat.
- Pawns may hold an empty diagonal: they stay in place and strike an enemy
  that chooses that destination. With Always trade, the intercepted enemy
  retaliates if it could reach the pawn; with Free hits, it does not.
- Enemy orders are chosen from the starting board, without inspecting the
  player queue. AI is deterministic and intentionally basic.
- Resolution damage uses one starting snapshot. The resulting state is fixed
  before animation: show both plans, movement, impact/damage/deaths, then the
  final board. Fast, skip, and reduced-motion playback cannot affect rules.
- Optional player-only cleanup remains: if an ally dies and a survivor can
  legally attack its surviving killer, take one free strike or decline before
  planning resumes. This existing rule is retained in both combat models.
- Walls block sliding movement; knights can leap over them. Collision uses
  destinations, with one exception: sliders pass through enemies. If an enemy
  ends its move on a square a rook, bishop or queen passes through, the
  slider strikes it on the way and carries on to its chosen square. Crossings
  happen in path order. In Always trade, each such enemy hits back if it could
  reach the square the slider came from. If those return hits add up to the
  slider's HP, it falls there; nothing further along, including its target,
  is hit. A piece in a contested square, or one that never reaches its
  square, isn't passed. Two sliders that cross each other trade once, like a
  clash, if neither fell before reaching that point. The trade counts toward
  each slider's fall total, so either can fall there; survivors carry on. Knights leap, so they never meet anything on the
  way. No check, castling,
  en passant, promotion, specials, or move-then-special chain in this slice.

Original cartoon SVG characters and CSS perspective establish the art direction
without raster generation or a new art dependency. This is early presentation,
not a finished Castle Crashers-style animation pipeline.

## Play and compare

Start with Always trade, finish or lose, then use the end screen to try Free
hits on the same boards. Ask: can you explain each hit without the log? Did
recruitment change your plan? Did you feel attached to a piece? Did healing
compete meaningfully with recruiting? Which rule produced clearer decisions?

Export playtest JSON includes mode, choices, orders, results, and your feedback.
Browser-local saves use `chezz.exile.v1`, separate from the earlier prototypes.

Pushes to `main` deploy the game to GitHub Pages; PR #1 merged this slice on
September 15. The temporary `exile-preview.yml` workflow is no longer needed.

## Deferred ideas

Gambits, consumables, reserves/squad selection, recruitment variety, bosses,
griffins, terrain buffs, endless play, and the wider kingdom campaign.

Future specials: king's surrounding sword swing; bishop's diagonal sniper or
piercing strike; knight's **pogo/piggyback** chain after predicting an enemy
arrival. Specials would consume the piece's order and require prior positioning.

The knight chain should avoid repeat squares and end on a safe landing or death.
None of these specials is implemented yet.
