# Escape from Exile: turn-based rules

The live game (`src/game/turns.ts`). It replaced the simultaneous-orders slice
on Oct 10 at Wesley's request. That slice's rules are kept in
`docs/exile-run.md` and `src/game/exile.ts`; the lab's Duel still uses them.

## Turns and energy
- You act, then the enemy acts. Each side spends its own energy pool, which
  refills every turn: you get 4; each encounter sets the enemy's (2, 3, 3).
- Each piece may first **move** once in its chess shape: 1 energy per square
  for king, pawn, rook, bishop and queen, or 2 for a knight's jump. Slides stop
  at pieces and walls; knights leap. Pawns step forward only.
- Then it may **strike** or **defend**, not both. It can't move after either.

## Strikes
- Cost: the squares from the piece to its target, + 1. A rook 3 squares away
  costs 4. Adjacent strikes, pawn diagonals and king strikes cost 2; a knight
  strike costs 3. Targets follow chess capture shapes (pawns diagonally
  forward; sliders need a clear line).
- Fixed damage by piece: pawn 1, knight 2, bishop 2, king 2, rook 3, queen 3.
  HP no longer doubles as attack strength. A pawn's strike deals 0 to a
  defender.
- No return hit. Strikes land from where the striker stands: it never moves
  onto the target's square, even on a kill (unlike chess). Rooks, bishops and
  queens strike the first piece along a clear line at any distance, paying
  distance + 1.

## Defend
- Costs 1. Until that side's next turn, the piece takes 1 less damage per hit
  and, if it survives, hits each attacker back with its own damage when it
  could reach the attacker's square.

## Enemy turn
- Deterministic and basic: it takes the best-scoring affordable action until
  nothing is worth doing or its pool is spent. Strikes score highest (kills
  and the king most), minus any counter it would actually take (heavily if
  the counter would kill it); it never strikes for 0 damage. Otherwise pieces
  step toward your king.

## Run
- Three encounters, camp between them: recruit a bishop (6 gold) or rook (8),
  heal the king 2 (4), or save. HP carries over; fallen allies stay gone; king
  death ends the run. The order pool, combat modes, pawn ambushes and cleanup
  strikes from the simultaneous slice are gone.

## Known gaps
- Encounters are the old ones and are too easy under these rules: the test
  bot wins every run with the king near full HP. Next: tougher enemies and
  energy tuning from playtests.
- Enemy intent isn't shown; you see the enemy act after your turn.
