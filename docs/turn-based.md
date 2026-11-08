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
- Cost: 2 for every piece. A piece may move and then strike in the same
  turn, paying for both.
- Fixed damage by piece: pawn 1, knight 2, bishop 2, king 2, rook 3, queen 3.
  HP no longer doubles as attack strength. A pawn's strike deals 0 to a
  defender.
- Tapping an enemy strikes it. If the selected piece isn't next to it yet but
  can walk up and strike this turn (`approaches`: move + strike within the
  pool), it does: automatically when only one square works, otherwise you
  pick the square. Strikeable enemies glow red and carry a ⚔ badge with
  the cheapest total cost.
- No return hit. Strikes land from where the striker stands: it never moves
  onto the target's square, even on a kill (unlike chess).

## Check
- Your king is in check when the enemy's next turn could kill him: within its
  pool, each enemy piece may step in (if it can afford to; a pawn reaching your
  back row becomes a queen first) and strike him once,
  and the hits add up to at least his HP (`kingThreat`, `inCheck`). Threats that
  would only hurt him are not check.
- You can't put your own king in check: a move or strike (through the counter
  it draws) that would take him from safe to in check is refused
  (`exposesKing`, `strikeExposesKing`), as is one that gets him killed
  outright. A tap-to-strike (walk up, then strike) is judged as one move
  (`walkAndStrike`): the walk may step into danger if the king is safe once the
  strike lands, say because it kills the attacker. Unsafe moves show a red ✕;
  unsafe strikes lose their ⚔ badge. Once he's already in check you
  may act freely; he just has to be safe by the end of the turn.
- In check you can't end your turn until he's safe: move him, block, defend
  (1 less damage per hit), or take out an attacker. If nothing you can still do
  this turn makes him safe (`canEscape`), you may end the turn anyway; the king
  only falls if the blow actually lands.
- The board tags the king CHECK and marks with "!" every piece that could take
  part in a killing blow. Check is the worst case the enemy could manage, not a
  prediction of what its AI will pick.
- When the king falls, it's checkmate: the camera pushes in on him, his
  attackers gloat, he staggers, his crown flies off, he spins and keels over
  flat, and a CHECKMATE! banner (with a joke) slams in before the defeat screen.
  Presentation only (`stage.mating`, the `mate` rig action).

## Variants
- Every piece belongs to one of three casts from the character-select sheet:
  rebels (your army by default), royals (the patrol) and misfits. A unit's
  `variant` names its cast; the art falls back to the side's default
  (`variantOf`: white → rebel, black → royal) when it is missing. Only a piece
  whose cast is named has an ability: unlabeled enemy spawns (the road's
  patrol, old saves) are plain pieces in royal costume, so the tuned road
  keeps its balance; new encounters and Guild puzzles name every spawn's cast.
- Each cast gives a kind its own ability: one file per ability under
  `src/game/abilities/`, registered in `abilities.ts`, full spec and puzzle
  hooks in `docs/variants.md`. Abilities are small pure hooks the rules call
  (move targets, reach, strike cost, damage dealt and taken, splash,
  bodyguard intercept, counters, defend permission, after-strike, death,
  turn start and end, any-move, alternative actions). Ability state lives in
  the unit's flat `mods` bag and run-level state in `run.walls`, `run.broken`
  and `run.flags`; `readRun` validates all of it.
- **Toppling a suit**: any piece beside a wall an ability raised (Nobody's
  empty armour) may knock it over for 2 instead of striking; the board's own
  walls only fall to Brick.
- **Alternative actions** (hex, honk, demolish, dub) replace the strike: they
  cost energy, mark the piece acted, may follow a move, and are refused like
  any move if they would leave your king in check. The sidebar offers them as
  buttons; targeted ones highlight their squares.
- **Statuses** (`src/game/status.ts`) expire by `<status>Until` turn numbers.
  Turn numbers tick when your pool refills, so the enemy's turn N follows your
  turn N; `nextTurn(g, side)` gives the right expiry for a status that should
  last through the target's next turn. *Dazed*: no moves (may still strike,
  defend or use an action). *Hexed*: deals 1 less (min 0). *Burning N*: takes 1
  at the start of its side's turn, ignoring defend, for N turns; a fire on
  your king counts toward check (he takes it before he can act).
- The barracks sells rebels and misfits by kind; recruits are `{ kind, variant }`.

- A pawn whose ability fixes its crown (Grumble, the misfit pawn: always a
  knight, so Nobody) promotes into that piece on either side; your picker
  offers only it. Promotion keeps the cast: an enemy royal pawn crowns Her
  Wigness, while the road's plain pawns (no cast) crown a plain queen.

## Stall clock
- `run.quiet` counts full turns in a row in which no piece lost HP to a blow,
  a burn or a fall (`run.mark` holds each piece's HP when the count was last
  taken). After 3 (`TIRE_AFTER`) every piece but the kings tires: 1 HP at the
  start of its side's turn, ignoring defend and abilities. Tiring never resets
  the clock; any real damage does. After 8 (`RETREAT_AFTER`) both sides fall
  back: on the road the army slips on to the hideout without the reward (on
  the last road the patrol holds the bridge and the run ends); a Guild puzzle
  is lost. The arena's top line shows QUIET n/8, amber once pieces tire.

## Boards and tiles
- Encounters may add tiles (`src/game/board.ts` reads them; `settle()` applies
  them to every move, shove and roll-on so they behave alike):
  **pits** (holes, and crumbling tiles that have fallen): nothing stands
  there, sliders stop before them, leapers pass over, anything shoved onto
  one is lost (no death hook; a shove that would drop your own king in is
  refused); **crumbling** tiles fall when a piece leaves them, every tile a
  slide crossed included; **burrows** come in pairs: moving into one mouth
  lands on the other (a slide carries on from there; a leap or step too), the
  tunnel is blocked while a piece stands on the far mouth, and a piece can
  stand on a mouth it came out of; **ice**: a piece entering it keeps gliding
  in the same direction for free until the first dry empty square, stopping
  on the last ice square before anything else (leapers don't glide, units
  standing on ice act normally); **gates** are walls while shut and floor
  while open, and a piece ending a move on a **lever** toggles every gate in
  its group (a gate with a piece in it cannot shut; Brick's Demolish turns a
  gate into floor for good).
- `moveTargets` returns destinations (the burrow's exit, the end of a glide),
  so what the board offers is where the piece ends up. Check reads tile state
  but never multi-piece set-ups: a lever pull that opens a file for another
  piece is not check.

## Guild puzzles
- `PUZZLES` (`src/game/encounters.ts`) are boards with a fixed `army`, a
  `turns` limit and a `goal`; `startPuzzle(i)` plays one without touching the
  campaign run (the hub's Grandmaster's Guild lists them). The win is the
  board's `win`: clear every enemy (default) or fell the enemy king. Running
  past the turn limit is a defeat. `tests/puzzles.test.ts` proves each puzzle
  has a forced win within its limit with the solver (`docs/solver.md`), which
  searches exhaustively whenever tiles or abilities are in play.

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
- On the board a defending piece (either side) wears a blue "🛡 −1" chip,
  stands on a blue-ringed tile and glows; its label says "defending".

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
  before the hideout or end menu. Tapping the banner skips ahead. Presentation
  only.

## Run
- Three encounters with the rebel hideout between them (`buy`, `leaveCamp`).
  The king walks between buildings (`src/components/Hub.tsx`):
  - Barracks: recruit a pawn (3 gold), bishop (6) or rook (8), or heal the king
    2 (4). Buy as often as gold allows; recruits wait in the barracks
    (`run.recruits`) and are refused once the army would outnumber the next
    map's start squares.
  - Training grounds (upgrades), the armory (gear), the merchant
    (consumables) and the Grandmaster's Guild: placeholders with no actions
    yet.
  - Road out: march into the next battle.
- HP carries over; fallen allies stay gone; king death ends the run. The order pool, combat modes, pawn ambushes and cleanup
  strikes from the simultaneous slice are gone.

## Known gaps
- Encounters are the old ones and need tuning from playtests. With
  next-square strikes, encounter 2 is a real puzzle: a greedy player loses it
  to a pawn that promotes, so the test player looks two turns ahead.
- Enemy intent isn't shown; you see the enemy act after your turn.
