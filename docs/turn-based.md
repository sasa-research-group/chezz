# Escape from Exile: turn-based rules

The live game's rules (`src/game/turns.ts`). Balance comes from level design
and the stats in `src/game/rules.json`, edited in the studio's Mechanics tab.

## Rules data
- `src/game/rules.json` holds the numbers and switches; `rules.ts` checks it
  (`parseRules`, which rejects unknown fields and out-of-range numbers, but
  reads past the retired `defend` and `defends` of older files and drops them) and
  formats it (`formatRules`, one field per line). `turns.ts` loads it as
  `RULES` and refuses to start on a broken file.
- Fields: `turn` (`"one"` or `"all"`), `hp` and `damage` per piece, `range`
  per piece (`1` or `"line"`, below), `counter` (strikebacks on or off),
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
- **Deploy kit** (prototype, Nov 8): a level's `kit` hands the player floor
  tiles to lay before Begin, after seeing the enemy's setup and terrain. Pick
  one in the kit tray beside Begin, then tap a highlighted square (`lay`); tap a
  laid tile (ringed gold) to pick it back up (`unlay`). A tile can go on any
  empty floor square that has no tile, switch or start on it and isn't on or
  next to an enemy piece (`canLay`), so no sniping the enemy's back line.
  Laid tiles (`Run.placed`) play exactly like the level's own and clear when
  the next battle is dealt.
- Enemies can be inspected (card and intent) as they'd act if the battle
  began as placed, laid tiles included. Begin (`begin`) starts turn 1. The
  phase saves and reloads.

## Floor tiles: ice and sludge (prototype)
- A level may lay its own tiles (`tiles`), usually on the enemy's side, and
  the deploy kit adds the player's. They change where moves end, never a
  piece's shape, and work the same for both sides (enemy intent shows it).
- **Ice:** nobody stops on ice. A move that ends on ice slides on in the
  same direction, square by square, to the first square past the ice; if
  that square is a wall, a piece or off the board, the move isn't allowed. A
  pawn stepping onto ice slides past its one step; a rook can cross ice but
  only stops beyond it. A knight's leap has no one direction, so a knight
  can't land on ice (the Ice Chess precedent; see `docs/terrain-research.md`).
- **Sludge:** a slide ends on sludge (a rook's line or an ice slide). A rook,
  bishop or queen that starts its turn in sludge moves one square. Kings,
  pawns and knights leave it normally.
- Tiles don't block strikes; a ranged strike flies over them.

## Turns
- You act, then the enemy acts.
- **`turn: "one"`** (the default): each side acts with one piece per turn,
  chess-style. That piece may move, then strike; or strike without moving.
  Once it has moved or struck, your other pieces are locked for the turn
  (`sidelined`) until the move is cancelled. The turn passes on its own once
  the piece has struck. A move alone is a preview (below) and waits for End
  turn, which skips the strike.
  (`turnSpent` still says when a moved piece has nothing safe left to do.)
  If the acting piece dies to a strikeback, that side's turn is over
  (`Run.fell`).
- **`turn: "all"`**: every piece on a side may act every turn.
- Each piece may **move** once in its chess shape, any distance: rooks,
  bishops and queens slide until a piece or wall stops them; kings step one
  square; pawns step one square forward and stop at the far row (no
  promotion); knights leap.
- Then it may **strike** once. It can't move after striking.

## Previews and enemy intent
- A move is a preview until a strike or End turn commits it. The
  piece stands on the new square and everything (check, the ! threat marks,
  enemy intent) reads from there. Cancel (next to End turn), Escape, or
  tapping the start square puts it back; tapping another empty square moves it
  again from its start. Under one move per turn, cancel to try another piece.
  A move alone never passes the turn on its own; End turn commits it.
- The run saves the previewed board plus the turn's start
  (`chezz.turns.v1.start`), so a reload can still cancel.
- Hover (mouse) or tap an enemy to see its card (HP, damage) and its intent:
  what it would do if you ended the turn now (`enemyPlan`, `intentOf`): an
  arrow to the square it would move to, a ring and −N on the piece it would
  strike, or "waits".
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
  in the studio, so they aren't copied here). A strike deals the striker's
  full damage.
- An enemy starts a battle with its level's HP, clamped to its kind's full HP;
  a spawn that leaves HP out starts at full. A saved run whose piece is above
  its kind's full HP (stats lowered since) loads it at full.
- The striker stays on its own square, even on a kill.
- Strikeback: if `counter` is on, a struck piece that survives hits the
  attacker back with its own damage when it can reach the attacker's square.
  Ranged strikes are the exception: a strike
  from more than one step away never draws a strikeback, and a ranged piece
  never strikes back from afar (`strikesBack`).
- A strikeback plays as its own beat: the attacker's blow lands, then the
  target swings back, then the attacker takes the hit (and falls if it dies).
  The log reads it as its own line, e.g. "Enemy rook counters −2". A ranged
  hit flies as a streak from striker to target.
- Tap-to-strike: tapping an enemy the piece can't reach yet walks it up to a
  square it can strike from and strikes (`approaches`, `walkAndStrike`),
  judged as one action.

## No defending
- There is no defend action, for either side. Saves from when there was
  still load: their `defending` and `defended` fields are ignored.

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

## Switches and spear traps
- A level may place switches on the floor (`switches` in `levels.json`), each
  with a `type`. The only type so far is `"spears"`: a spear trap with a list
  of rows and a damage. While it's armed, those
  rows are striped and a launcher sits on the board's left edge.
- When one of your pieces ends a move on an armed switch, the spears fire:
  every piece on those rows takes the damage, yours included. Pressing the
  switch is that piece's action, so it can't strike after, and under one
  move per turn the turn passes. It commits at
  once (no preview to cancel).
- Each switch fires once per battle (`Run.sprung`); after that it's an ordinary
  square. Enemy pieces can stand on it but never press it.
- The press is refused if the spears would kill your own king. A walk-up
  strike never ends on an armed switch.

## Enemy phase
- Deterministic and computed in full before it plays. The best-scoring action
  across the pieces that may still act goes first, repeated until nothing
  scores above zero: strikes first (kills and the king most, minus any
  strikeback, never for 0 damage), then stepping onto a square to strike from,
  closing in on your king or nearest piece (counted in the piece's own moves
  around walls and pieces, so sliders go round walls).
- Under one move per turn the first action picks the piece; after a move,
  only that piece may follow up with a strike.
- If no enemy piece acts, the log reads "Enemy waits" and the screen shows an
  ENEMY WAITS ribbon.

## Tutorial
- A player's first game is the tutorial (`tutorialRun`, `Run.tutorial`): the
  levels with a `tutorial` block, in order (`docs/levels.md`). Each battle
  deals that level's preset army exactly as placed, at full HP; nothing
  carries over. There is no gold, hideout or recruiting: a won battle shows a
  "Battle n of N ✓" card with the next army, then deals the next battle
  (`leaveCamp`; `buy` refuses, "No camp in the tutorial").
- Losing a tutorial battle offers Retry: the same battle, dealt fresh (`retry`).
- Winning its last battle shows Victory, marks the tutorial done in the meta
  save (`meta.ts` `tutorialDone`; no skin unlock) and offers the roguelike.
  From then on Start begins the roguelike, and the start screen offers the
  tutorial again as a second button.
- A level's optional `handout` (`{ items }`) is the hook for what the
  tutorial hands out there; the game doesn't act on it yet.
- Developer menu: Skip tutorial / Reset tutorial flips the meta flag.
- A save from before the tutorial existed loads as a roguelike run.

## Run (roguelike)
- Battles are data in `src/game/levels/levels.json` (`docs/levels.md`): the
  levels outside the tutorial, or all of them while there are none
  (`roguelikeCourse`), with the rebel hideout between them: recruit a pawn, bishop or rook, or heal the
  king (prices and heal from `rules.json`). HP carries over and fallen allies
  stay gone. If a battle has fewer starts than the army, the pieces past the
  last start are lost.
- A studio test run plays one level with a given army and never saves.
- Jump to battle (☰ menu, Developer) starts a fresh, saved run at battle N
  with that level's test army and the typical run's leftover gold (`startAt`);
  on a tutorial level it starts the tutorial there (`tutorialRun`).
