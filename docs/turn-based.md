# Escape from Exile: turn-based rules

The live game's rules (`src/game/turns.ts`). Balance comes from level design
and the stats in `src/game/rules.json`, edited in the studio's Mechanics tab.

## Rules data
- `src/game/rules.json` holds the numbers and switches; `rules.ts` checks it
  (`parseRules`, which rejects unknown fields and out-of-range numbers) and
  formats it (`formatRules`, one field per line). `turns.ts` loads it as
  `RULES` and refuses to start on a broken file.
- Fields: `turn` (`"one"` or `"all"`), `hp` and `damage` per piece, `range`
  per piece (`1` or `"line"`, below), `defend` (damage a defender blocks per
  hit), `defends` (defends each side gets per battle), `counter` (strikebacks
  on or off),
  `cost` (hideout prices), `heal` (HP a heal gives back) and `gold` (a new
  run's gold).
- A studio test run can carry unsaved rules (`Run.rules`); saved runs never do.

## Deploy
- Every battle opens in the deploy phase (`phase: "deploy"`): a new run, the
  next battle after the hideout, Jump to battle and a studio test run. Your
  army stands on the level's start squares (filled in order, king first; a
  test army as the designer placed it). The start squares are highlighted.
- Drag one of your pieces onto another start square (or tap it, then tap the
  square): it moves there, and a piece already there swaps to where it came
  from (`deploy(run, id, to)`; the swap glides, instantly under reduced
  motion). Dropped anywhere else, it snaps back.
- Enemies can be inspected (card and intent) as they'd act if the battle
  began as placed. Begin (`begin`) starts turn 1. The phase saves and reloads.

## Turns
- You act, then the enemy acts.
- **`turn: "one"`** (the default): each side acts with one piece per turn,
  chess-style. That piece may move, then strike or defend; or strike or
  defend without moving. Once it has moved or acted, your other pieces are
  locked for the turn (`sidelined`) until the move is cancelled. The turn
  passes on its own once the piece has struck or defended. A move alone is a
  preview (below) and waits for End turn, which skips the strike or defend.
  (`turnSpent` still says when a moved piece has nothing safe left to do.)
  If the acting piece dies to a strikeback, that side's turn is over
  (`Run.fell`).
- **`turn: "all"`**: every piece on a side may act every turn.
- Each piece may **move** once in its chess shape, any distance: rooks,
  bishops and queens slide until a piece or wall stops them; kings step one
  square; pawns step one square forward and stop at the far row (no
  promotion); knights leap.
- Then it may **strike** or **defend** once, not both. It can't move after
  either.

## Previews and enemy intent
- A move is a preview until a strike, a defend or End turn commits it. The
  piece stands on the new square and everything (check, the ! threat marks,
  enemy intent) reads from there. Cancel (next to End turn), Escape, or
  tapping the start square puts it back; tapping another empty square moves it
  again from its start. Under one move per turn, cancel to try another piece.
  A move alone never passes the turn on its own; End turn commits it.
- The run saves the previewed board plus the turn's start
  (`chezz.turns.v1.start`), so a reload can still cancel.
- Hover (mouse) or tap an enemy to see its card (HP, damage, +N if braced) and
  its intent: what it would do if you ended the turn now (`enemyPlan`,
  `intentOf`): an arrow to the square it would move to, a ring and −N on the
  piece it would strike, a ghost +N shield if it would brace, or "waits".
  Under one move per turn only the enemy that acts shows a plan. Tapping an
  enemy your selected piece can strike still strikes.

## Strikes
- Reach: along the piece's capture shape. Kings and queens strike the eight
  directions, rooks the four straight ones, bishops the four diagonals, pawns
  diagonally forward, knights a knight's jump away.
- Range (`rules.json` `range`, per kind): `1` strikes the next square only;
  `"line"` strikes any distance along those directions, from where the piece
  stands, as long as the line is open: the first piece or wall it meets stops
  it (it can strike that piece if it's an enemy). Bishops are `"line"` today.
- Damage and full HP per piece come from `rules.json` (the owner retunes them
  in the studio, so they aren't copied here). A strike deals damage minus the
  defend bonus to a defender, never below 0.
- An enemy starts a battle with its level's HP, clamped to its kind's full HP;
  a spawn that leaves HP out starts at full. A saved run whose piece is above
  its kind's full HP (stats lowered since) loads it at full.
- The striker stays on its own square, even on a kill.
- Strikeback: if `counter` is on, a struck piece that survives hits the
  attacker back with its own damage when it can reach the attacker's square,
  whether or not it was defending. Ranged strikes are the exception: a strike
  from more than one step away never draws a strikeback, and a ranged piece
  never strikes back from afar (`strikesBack`).
- A strikeback plays as its own beat: the attacker's blow lands, then the
  target swings back, then the attacker takes the hit (and falls if it dies).
  The log reads it as its own line, e.g. "Enemy rook counters −2". A ranged
  hit flies as a streak from striker to target.
- Tap-to-strike: tapping an enemy the piece can't reach yet walks it up to a
  square it can strike from and strikes (`approaches`, `walkAndStrike`),
  judged as one action.

## Defend
- Until that side's next turn the piece takes `defend` less damage per hit
  (today 1): armour, nothing more (every survivor strikes back anyway). The
  screen shows the block as +N everywhere (the shield token, the defended
  piece's chip, the Rules card).
- Each side gets `defends` defends per battle (today 3), the enemy too; every
  defend spends one (`Run.defended` counts them, `defendsLeft`). With none
  left, that side's pieces can't defend (`canDefend`) and the enemy stops
  bracing. The count resets when a battle is dealt; a save without it has a
  full pool. Each side's team bar shows one shield per defend, and a spent one
  stays, hollow and cracked: the enemy's above the board, yours below.

## Check
- Your king is in check when the enemy's next turn could kill him
  (`kingThreat`, `inCheck`). Each enemy piece that could strike him this
  coming turn, in place or after its one move, hits him once. Under one move
  per turn the threat is the hardest single hit; under every piece acting the
  hits add up. Either way, check is a threat at least his HP.
- You can't put your own king in check with a move or strike (its
  strikeback included). A walk-up strike may pass through danger if the king is safe once
  it lands. Once he's in check you may act freely, but you can't end the turn
  until he's safe, unless nothing you can still do helps (`canEscape`).
- The king dying ends the run.

## Enemy turn
- Deterministic and computed in full before it plays. The best-scoring action
  across the pieces that may still act goes first, repeated until nothing
  scores above zero: strikes first (kills and the king most, minus any
  strikeback, never for 0 damage), then stepping onto a square to strike from,
  closing in on your king or nearest piece (counted in the piece's own moves
  around walls and pieces, so sliders go round walls), and bracing when only
  the block saves it.
- Under one move per turn the first action picks the piece; after a move,
  only that piece may follow up with a strike or brace.
- If no enemy piece acts, the log reads "Enemy waits" and the screen shows an
  ENEMY WAITS ribbon.

## Run
- Battles are data in `src/game/levels/levels.json` (`docs/levels.md`), with
  the rebel hideout between them: recruit a pawn, bishop or rook, or heal the
  king (prices and heal from `rules.json`). HP carries over and fallen allies
  stay gone. If a battle has fewer starts than the army, the pieces past the
  last start are lost.
- A studio test run plays one level with a given army and never saves.
- Jump to battle (☰ menu, Developer) starts a fresh, saved run at battle N
  with that level's test army and the typical run's leftover gold (`startAt`).
