# Escape from Exile: turn-based rules

The live game's rules (`src/game/turns.ts`). Balance comes from level design
and the stats in `src/game/rules.json`, edited in the studio's Mechanics tab.

## Rules data
- `src/game/rules.json` holds the numbers and switches; `rules.ts` checks it
  (`parseRules`, which rejects unknown fields and out-of-range numbers, but
  reads past the retired `defend` and `defends` of older files and drops them) and
  formats it (`formatRules`, one field per line). `turns.ts` loads it as
  `RULES` and refuses to start on a broken file.
- Fields: `turn` (pieces per side per turn: `1`–`9` or `"all"`; older
  files' `"one"` reads as `1`), `movement` (`"chess"` or `"tactics"`, below),
  `hp` and `damage` per piece, `range` per piece (`1` or `"line"`, below;
  chess movement only), `tactics` (`move` and `reach` per piece; tactics
  movement only), `counter` (strikebacks on or off),
  `cost` (hideout prices), `heal` (HP a heal gives back), `gold` (a new
  run's gold), `slots` (how many items the bag holds) and `items` (each
  item's numbers: `bomb` `damage` and `area`, `decoy` `hp`). A file without
  `slots`, `items`, `movement` or `tactics` loads with the defaults (chess
  movement).
- The studio's Mechanics tab opens with a **Developer** group: the movement
  toggle, the tactics numbers per piece (while tactics is on) and moves per
  turn (1, 2, 3, Unlimited). They save with the stats.
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
- **Moves per turn** (`turn`): how many pieces each side acts with per turn,
  the enemy included. **`1`** (the default) is chess-style: one piece may
  move, then strike; or strike without moving. Once it has moved or struck,
  your other pieces are locked for the turn (`sidelined`) until the move is
  cancelled. **`2`, `3`, ...**: the same, with that many pieces; the rest lock
  once the count is used. **`"all"`**: every piece on a side may act every
  turn.
- Under a count, the turn passes on its own once the count is used (or every
  piece has acted) and each piece that acted has struck, or has moved with
  nothing safe left to strike (`turnSpent`). A move alone is a preview
  (below) and waits for End turn, which skips the strike. Under `"all"` it
  never passes on its own.
- A piece that dies to a strikeback still counts toward its side's count
  (`Run.fell`, `Run.fallen`); under `1` that ends the side's turn.
- Each piece may **move** once, then **strike** once. It can't move after
  striking. How it moves and strikes depends on `movement`.

## Movement
- **`movement: "chess"`** (the default): each piece moves once in its chess
  shape, any distance: rooks, bishops and queens slide until a piece or wall
  stops them; kings step one square; pawns step one square forward and stop
  at the far row (no promotion); knights leap. It strikes along its capture
  shape (Strikes, below).
- **`movement: "tactics"`**: each kind has a walk and a reach
  (`rules.json` `tactics.move` and `tactics.reach`). Starting numbers (walk /
  reach): king 2/1, queen 4/1, rook 3/1, bishop 3/3, knight 3/1, pawn 2/1.
  - Walk: up to `move` straight (orthogonal) steps, turning freely, through
    empty squares only. Pieces (either side) and walls block; switches can be
    walked over and fire only if the walk ends on one. Knights walk too, and
    pawns walk any way.
  - Strike: any enemy within `reach` squares counting diagonals (Chebyshev
    distance: reach 1 is the eight neighbours), over pieces and walls. The
    `range` field doesn't apply.
  - Ranged means further than one square: such a strike never draws a
    strikeback, and a piece only strikes back at an attacker next to it.
  - Everything else (check, previews, enemy intent, tap-to-strike, items,
    switches, the enemy's planning) runs through the same `moveTargets` and
    `reaches`, so it follows the mode on both sides.

## Previews and enemy intent
- A move is a preview until a strike or End turn commits it. The
  piece stands on the new square and everything (check, the ! threat marks,
  enemy intent) reads from there. Cancel (next to End turn), Escape, or
  tapping the start square puts it back; tapping another empty square moves it
  again from its start. Under one move per turn, cancel to try another piece.
- Enter ends the turn (Begin during deploy), the same as the End turn button.
  A move alone never passes the turn on its own; End turn commits it.
- The run saves the previewed board plus the turn's start
  (`chezz.turns.v1.start`), so a reload can still cancel.
- Hover (mouse) or tap an enemy to see its card (HP, damage) and its intent:
  what it would do if you ended the turn now (`enemyPlan`, `intentOf`): an
  arrow to the square it would move to, a ring and −N on the piece it would
  strike, or "waits".
  Under one move per turn only the enemy that acts shows a plan (under a
  count, only the pieces that act). Tapping an
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
  coming turn, in place or after its one move, hits him once. The threat is
  the hardest hits added up, as many as the moves per turn: under `1` the
  hardest single hit, under `2` the two hardest, under `"all"` every hit.
  Either way, check is a threat at least his HP.
- You can't put your own king in check with a move or strike (its
  strikeback included). A walk-up strike may pass through danger if the king is safe once
  it lands. Once he's in check you may act freely, but you can't end the turn
  until he's safe, unless nothing you can still do helps (`canEscape`).
- The king dying ends the run.

## Items
- Your team carries a bag of one-use items (`Run.items`), shown as slots at
  the right end of your team bar (`rules.json` `slots`, 3 today). The team
  holds them, not a piece. Enemies don't use items.
- Using one is free (it doesn't use up your piece's move or strike) but only
  one item a turn (`Run.itemUsed`, cleared by End turn). Use it before or
  after your piece acts; while an item could still be used, the turn doesn't
  pass on its own after a strike (`turnSpent`), so End turn ends it.
- It can't be taken back: like a strike, it commits the turn so far (a
  previewed move included).
- Tap a slot: the squares it can go on light up (`itemTargets`); Cancel,
  Escape or tapping the slot again puts it back. A greyed slot says why
  (`itemReason`: one per turn, no target).
- Check applies: an item can't leave your king open to a kill, and when he's
  in check an item that makes him safe counts as a way out (`canEscape`).
- **Bomb**: `items.bomb.damage` to every enemy in an `area` × `area` square
  (2×2 today); your own pieces are never hit. Lit squares are where a blast
  could reach; tap one to aim (the square of blasts holding the most enemies
  that contains it, outlined, with −N on each enemy), tap inside the aim to
  throw it, anywhere else to re-aim. Logged as "Bomb −1 × 3 · 1 killed".
- **Decoy**: a straw pawn (`items.decoy.hp` HP) on an empty square next to one
  of your pieces (not an armed switch). It never moves, strikes or strikes
  back, and enemies treat it as one of your pieces: they strike it and it
  blocks their lines, but it never counts as your king. It stays behind when
  the battle is won.
- The bag carries between roguelike battles; a level's `handout` replaces it
  (`docs/levels.md`), and in the tutorial every level replaces it. Old saves
  load with an empty bag.

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
- Under a count of moves per turn the first actions pick the pieces; once
  the count is used, only those pieces may follow up with a strike.
- Under tactics movement, closing in counts walk steps (a move covers up to
  the kind's walk), and pawns close in like everyone else instead of
  marching forward.
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
- Every tutorial level replaces the item bag: with its `handout` items
  (battle 3 hands out a Bomb, battle 4 a Decoy), or with nothing.
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
