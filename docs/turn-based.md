# Escape from Exile: turn-based rules

The live game's rules (`src/game/turns.ts`). Balance will come from level
design and piece stats (HP, damage), not from an action budget.

## Turns
- You act, then the enemy acts. There is no energy: every piece on a side may
  act every turn.
- Each piece may **move** once in its chess shape, any distance: rooks,
  bishops and queens slide until a piece or wall stops them; kings step one
  square; pawns step one square forward; knights leap.
- Then it may **strike** or **defend** once, not both. It can't move after
  either. A piece may also strike or defend without moving.

## Strikes
- Reach: one square in the piece's capture shape. Kings and queens strike any
  adjacent square, rooks the four straight neighbours, bishops the four
  diagonal ones, pawns diagonally forward, knights a knight's jump away.
- Damage by piece: pawn 1, knight 2, bishop 2, king 2, rook 3, queen 3.
  A pawn's strike deals 0 to a defender.
- The striker stays on its own square, even on a kill.
- Tap-to-strike: tapping an enemy the piece can't reach yet walks it up to a
  square it can strike from and strikes (`approaches`, `walkAndStrike`),
  judged as one action.

## Defend
- Until that side's next turn the piece takes 1 less damage per hit and, if it
  survives, hits each attacker back with its own damage when it can reach the
  attacker's square.

## Check
- Your king is in check when the enemy's next turn could kill him: every enemy
  piece that could strike him this coming turn, in place or after its one move
  (a pawn reaching your back row becomes a queen first), hits him once, and
  the total is at least his HP (`kingThreat`, `inCheck`).
- You can't put your own king in check with a move or strike (its counter
  included). A walk-up strike may pass through danger if the king is safe once
  it lands. Once he's in check you may act freely, but you can't end the turn
  until he's safe, unless nothing you can still do helps (`canEscape`).
- The king dying ends the run.

## Promotion
- A pawn that moves onto the far row promotes at full health. Yours becomes the
  piece you pick (queen, rook, bishop or knight) and can still strike or defend
  that turn. An enemy pawn always becomes a queen.

## Enemy turn
- Deterministic and computed in full before it plays. Every enemy piece may
  move once, then strike or defend once. The best-scoring action across all
  pieces goes first, repeated until nothing scores above zero: strikes first
  (kills and the king most, minus any counter, never for 0 damage), then
  stepping onto a square to strike from, a pawn reaching the far row, closing
  in on your king or nearest piece, and bracing when only the block saves it
  or it could hit back.

## Run
- Battles are data in `src/game/levels/levels.json` (`docs/levels.md`), with
  the rebel hideout between them: recruit a pawn, bishop or rook, or heal the
  king. HP carries over and fallen allies stay gone.
- A designer playtest plays one level with a given army and never saves.
