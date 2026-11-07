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
  enemy). It also counts the distinct first-turn keys that force a win in
  that many turns (`winningFirstMoves`) and whether there is exactly one
  (`unique`). A finished run (any phase but `player`) is `no-win-within` at
  once, `nodes: 0`.
- `lineToText(run, line)`: one readable string per turn, e.g.
  `T2: rook d4→d5, strikes knight d6 (kill) | enemy: waits`. `replay` plays a
  line back through the rules.

### What counts as one first move
First turns are compared by their *core* (the term `docs/puzzle-design.md`
uses): the turn's actions with the idle ones dropped, as a set. An action is
idle when the turn still forces the win, in as many turns, without it; they
are dropped one at a time, last first, and the shorter plan is played with
the real rules, so dropping a walk that the strike after it needed makes the
plan illegal and the walk stays. The same rule covers wins in one and longer
wins:
- A brace on a piece nothing can reach, or a sidestep with the leftover
  energy, is dropped: not a second solution.
- Walking up to deliver a blow that lands from where the piece stands is
  dropped: a win in one is `unique` however the blow lands.
- Two squares the rook could set up on, or a bishop that must step out of the
  rook's way and has several squares to choose from, are as many cores (a
  cook, in puzzle terms). The bridge has 13; the first encounter 4 (a step to
  one of three squares and a blow on one of two pawns).

## How it searches
Iterative deepening on your turn count, so the first line found is the
shortest; depth-first within a depth, remembering positions proven not to win
within the turns left. Candidates are ordered kills, damage, then closing in.
At the winning depth every first-turn outcome is tried, and only lines as
short as the shortest are counted.

A lower bound on what clearing the board still costs prunes hopeless
positions, mid-turn as well as between turns: each enemy needs its hits (at
your strongest piece's damage, two energy each), or, if a braced piece could
counter it, one shared defend; and the walking is charged once, as the
cheapest approach to the farthest enemy by any of your pieces (ignoring
blockers; enemies come as close as their pool allows; stuck pawns stay put).
Once, not once per enemy: a piece that kills one enemy and walks on to the
next pays the way between them, not a second approach from where it stands
now, and summing approaches measured from the start square is not a lower
bound (it pruned a two-turn rook sweep on an open 8x8 board). The travel
metrics obey the triangle inequality, so whoever kills the farthest enemy
walked at least that far. Turns are bounded too (one move per piece per turn,
two strikes per turn). Off the root, a defend on a piece no enemy can reach is
skipped as a duplicate; never the king's, since bracing first can legalise a
move. `solve(run, { exhaustive: true })` turns all of this off; the tests
compare the two on small positions, including the 8x8 sweep and the last two
turns of the bridge, and walk winning lines found exhaustively (and one by
hand) through the bound.

## Limits
- The enemy is deterministic, so "forced" means "wins against this AI". A
  smarter enemy or a changed scoring rule can unsolve a puzzle.
- The bound leans on three facts: no move covers more than one square per
  energy, a piece moves once a turn, and the enemy never strikes for 0 (so a
  pawn never hits a braced piece). An ability that breaks one needs the bound
  revisited; `exhaustive` mode is the safety net.
- Branching: a three-piece army has about 400 outcomes a turn, roughly 100
  distinct replies. Without the bound a four-turn proof takes hours; with it
  the bridge (encounter 2, full army) takes about 1000 nodes (turn-start
  positions expanded) and 3 s, of which the proof is the first 70 nodes and
  the count of first moves the rest. Past `nodeBudget` (default 200000) the
  result is `{ won: false, reason: "budget" }`, which proves nothing, unless
  a line was already proven: then it is returned with `countComplete: false`,
  `winningFirstMoves` the keys counted so far (at least one) and `unique`
  false, meaning unproven.
- `winningFirstMoves` counts ideas, not boards, but a setup with several
  equally good squares is several ideas: `unique` is for puzzles with one
  forced first turn.

## Puzzle encounters in tests
A puzzle test builds the encounter's starting run, calls `solve` with the
intended turn count, and asserts `won`, `turns` (not shorter than intended),
`countComplete`, `unique` where the design wants one key idea, and replays the
line to the winning phase. A tempting wrong line can be asserted
`no-win-within`. Keep `maxTurns` at the design's length plus one and log
`nodes`, so a rules change that blows up the search is noticed. A test board
that is not a shipped encounter goes on the roster for the test's duration
only (`onBoard` in `tests/solver.test.ts`), so the bridge stays the last road.
