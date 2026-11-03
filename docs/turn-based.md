# Escape from Exile: turn-based rules

The live game's rules (`src/game/turns.ts`). Balance comes from level design
and the stats in `src/game/rules.json`, edited in the studio's Mechanics tab.

## Rules data
- `src/game/rules.json` holds the numbers and switches; `rules.ts` checks it
  (`parseRules`, which rejects unknown fields and out-of-range numbers) and
  formats it (`formatRules`, one field per line). `turns.ts` loads it as
  `RULES` and refuses to start on a broken file.
- Fields: `turn` (`"one"` or `"all"`), `hp` and `damage` per piece, `defend`
  (damage a defender blocks per hit), `counter` (defenders strike back),
  `cost` (hideout prices), `heal` (HP a heal gives back) and `gold` (a new
  run's gold).
- A studio test run can carry unsaved rules (`Run.rules`); saved runs never do.

## Turns
- You act, then the enemy acts.
- **`turn: "one"`** (the default): each side acts with one piece per turn,
  chess-style. That piece may move, then strike or defend; or strike or
  defend without moving. Once it has moved or acted, your other pieces are
  locked for the turn (`sidelined`) until the move is cancelled. The turn
  passes on its own once the piece has struck or defended. A move alone is a
  preview (below) and waits for End turn, which skips the strike or defend.
  (`turnSpent` still says when a moved piece has nothing safe left to do.)
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
- Reach: one square in the piece's capture shape. Kings and queens strike any
  adjacent square, rooks the four straight neighbours, bishops the four
  diagonal ones, pawns diagonally forward, knights a knight's jump away.
- Damage and full HP per piece come from `rules.json`. Today: damage pawn 1,
  knight 2, bishop 2, king 2, rook 2, queen 3; HP pawn 2, knight 3, bishop 3,
  king 5, rook 5, queen 9. A pawn's strike deals 0 to a defender.
- The striker stays on its own square, even on a kill.
- Tap-to-strike: tapping an enemy the piece can't reach yet walks it up to a
  square it can strike from and strikes (`approaches`, `walkAndStrike`),
  judged as one action.

## Defend
- Until that side's next turn the piece takes `defend` less damage per hit
  (today 1) and, if `counter` is on and it survives, hits each attacker back
  with its own damage when it can reach the attacker's square. The screen
  shows the block as +N everywhere (the shield token, the defended piece's
  chip, the Rules card).
- A counter plays as its own beat: the attacker's blow lands, then the
  defender swings back, then the attacker takes the hit (and falls if it
  dies). The log reads it as its own line, e.g. "Enemy rook counters −2".

## Check
- Your king is in check when the enemy's next turn could kill him
  (`kingThreat`, `inCheck`). Each enemy piece that could strike him this
  coming turn, in place or after its one move, hits him once. Under one move
  per turn the threat is the hardest single hit; under every piece acting the
  hits add up. Either way, check is a threat at least his HP.
- You can't put your own king in check with a move or strike (its counter
  included). A walk-up strike may pass through danger if the king is safe once
  it lands. Once he's in check you may act freely, but you can't end the turn
  until he's safe, unless nothing you can still do helps (`canEscape`).
- The king dying ends the run.

## Enemy turn
- Deterministic and computed in full before it plays. The best-scoring action
  across the pieces that may still act goes first, repeated until nothing
  scores above zero: strikes first (kills and the king most, minus any
  counter, never for 0 damage), then stepping onto a square to strike from,
  closing in on your king or nearest piece (counted in the piece's own moves
  around walls and pieces, so sliders go round walls), and bracing when only
  the block saves it or it could hit back.
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
