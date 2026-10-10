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
- Reach: one square in the piece's capture shape. Kings and queens strike any
  adjacent square, rooks the four straight neighbours, bishops the four
  diagonal ones, pawns diagonally forward, knights a knight's jump away. A rook
  across the board has to travel next to its target first.
- Cost: 2 (a knight's strike 3). A piece may move and then strike in the same
  turn, paying for both.
- Fixed damage by piece: pawn 1, knight 2, bishop 2, king 2, rook 3, queen 3.
  HP no longer doubles as attack strength. A pawn's strike deals 0 to a
  defender.
- No return hit. Strikes land from where the striker stands: it never moves
  onto the target's square, even on a kill (unlike chess).

## Promotion
- A pawn that moves onto the far row promotes at full health of its new
  piece. Yours pauses play for a picker (queen, rook, bishop or knight) and
  can still strike or defend that turn; nothing else can happen until you
  choose. An enemy pawn always becomes a queen, and the enemy races for the
  far row when it can; a fresh queen may still strike that turn if the enemy
  has energy left. A two-part animation shows the pawn transforming.

## Defend
- Costs 1. Until that side's next turn, the piece takes 1 less damage per hit
  and, if it survives, hits each attacker back with its own damage when it
  could reach the attacker's square.

## Enemy turn
- Deterministic and basic: it takes the best-scoring affordable action until
  nothing is worth doing or its pool is spent. Strikes score highest (kills
  and the king most), minus any counter it would actually take (heavily if the
  counter would kill it); it never strikes for 0 damage. Next, a piece steps
  onto a square it can strike from, if the pool covers the move and the
  strike. Otherwise pieces close in on your king or your nearest piece. Pawns
  keep marching toward pieces still ahead of them when they can't close in
  yet, and race for the far row to promote. When no move is worth making, a
  piece braces (defends, 1 energy) if one of your pieces could strike it next
  turn (stepping in first if its pool allows) and only the brace would let it
  survive the hit, or it could hit back. Otherwise it simply waits.

## End of a battle
- The final blow plays out in full, then a short celebration ("Road
  cleared!" or "Victory!" while your pieces cheer, or "The crown falls…")
  before the camp or end menu. Tapping the banner skips ahead. Presentation
  only.

## Run
- Three encounters, camp between them: recruit a pawn (3 gold), bishop (6) or rook (8),
  heal the king 2 (4), or save. HP carries over; fallen allies stay gone; king
  death ends the run. The order pool, combat modes, pawn ambushes and cleanup
  strikes from the simultaneous slice are gone.

## Known gaps
- Encounters are the old ones and are too easy under these rules: the test
  bot wins every run with the king near full HP. Next: tougher enemies and
  energy tuning from playtests.
- Enemy intent isn't shown; you see the enemy act after your turn.
