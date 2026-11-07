# The battle solver

`src/game/solver.ts` proves things about a battle position by playing it out
with the real rules (`turns.ts`). Pure, like the rules. Tests use it to check
that a puzzle encounter does what its designer meant.

## What it proves
- `playerOutcomes(run)`: every distinct position you can reach this turn
  (deduped by board key: units' id, kind, square, hp, flags, ability state;
  pool; pending promotion), with the actions that reach it. Includes
  doing nothing, every promotion choice, and taps (walk-and-strike) where the
  walk alone would expose the king.
- `solve(run, { maxTurns, nodeBudget })`: the shortest line that wins (phase
  `camp` or `victory`) within `maxTurns` of your turns, checked after your
  actions and again after the enemy's reply (a counter can finish the last
  enemy). It also counts the distinct first-turn outcomes that force a win at
  that depth (`winningFirstMoves`) and whether that is exactly one (`unique`).
  Immediate wins count as one: how the last blow lands is not a second
  solution.
- `lineToText(run, line)`: one readable string per turn, e.g.
  `T2: rook d4→d5, strikes knight d6 (kill) | enemy: waits`. `replay` plays a
  line back through the rules.

## How it searches
Iterative deepening on your turn count, so the first line found is the
shortest; depth-first within a depth, remembering positions proven not to win
within the turns left. Candidates are ordered kills, damage, then closing in.
At the winning depth every first-turn outcome is tried.

A lower bound on what clearing the board still costs prunes hopeless
positions, mid-turn as well as between turns: each enemy needs its hits (at
your strongest piece's damage, two energy each) plus the cheapest approach by
any of your pieces (ignoring blockers; enemies come as close as their pool
allows; stuck pawns stay put), or, if a braced piece could counter it, one
shared defend. Turns are bounded too (one move per piece per turn, two
strikes per turn). Off the root, a defend on a piece no enemy can reach is
skipped as a duplicate; never the king's, since bracing first can legalise a
move. `solve(run, { exhaustive: true })` turns all of this off; the tests
compare the two on small positions.

## Limits
- The enemy is deterministic, so "forced" means "wins against this AI". A
  smarter enemy or a changed scoring rule can unsolve a puzzle.
- The bound leans on three facts: no move covers more than one square per
  energy, a piece moves once a turn, and the enemy never strikes for 0 (so a
  pawn never hits a braced piece). An ability that breaks one needs the bound
  revisited; `exhaustive` mode is the safety net.
- Branching: a three-piece army has about 400 outcomes a turn, roughly 100
  distinct replies. Without the bound a four-turn proof takes hours; with it
  the bridge (encounter 2, full army) takes about 470 nodes (turn-start
  positions expanded) and 1.5 s. Past `nodeBudget` (default 200000) the
  result is `{ won: false, reason: "budget" }`, which proves nothing.
- `winningFirstMoves` counts boards, so a spare energy point spent on a
  harmless defend is a separate "solution": few positions are `unique` by
  this measure.

## Puzzle encounters in tests
A puzzle test builds the encounter's starting run, calls `solve` with the
intended turn count, and asserts `won`, `turns` (not shorter than intended),
`unique` where the design wants one key idea, and replays the line to the
winning phase. A tempting wrong line can be asserted `no-win-within`. Keep
`maxTurns` at the design's length plus one and log `nodes`, so a rules change
that blows up the search is noticed.
