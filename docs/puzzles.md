# Dungeon puzzles (exploration branch `puzzle/dungeon`)

An experiment: Chezz as a chess-puzzle dungeon instead of a battle roguelike.
Lives beside the battle game; nothing in `src/game/` changes.

## Rules (`src/puzzle/engine.ts`)
- Chess moves and captures; every piece has one life. You (white, bottom) move first.
- Board 2–8 a side. **Holes** aren't board: nothing stands on or slides across them.
  **Walls** block standing and sliding; knights leap both.
- **Peasant** (yours only): steps one square any way, never captures. Losing one fails.
- Goals: checkmate · capture N pieces · win N material (P1 N3 B3 R5 Q9) · escort
  every peasant to an exit (arriving leaves the board) · reach a square (any piece or a kind) · survive.
  All within the puzzle's move limit. Mating the enemy king always wins.
- You lose if your king or a peasant is captured, you're mated or stalemated,
  you stalemate the enemy king, or you run out of moves.
- Check is real chess check. Pawns step one, promote to queen. No castling,
  double step or en passant. A side with no king and no move passes.

## The dungeon plays perfectly (`src/puzzle/solve.ts`)
Exhaustive memoized search: `need(state)` = player moves still needed to force
the goal against best defence, or never. The dungeon's reply: the one that keeps
you furthest from the goal (out of reach if possible), then the most material,
then board order. Same engine powers the studio's checks.

## Studio: Puzzles tab (`art.html#puzzles/N`, `src/art/Puzzles.tsx`)
- Tools: Piece (yours/enemy + kind), Wall, Hole, Goal square, Erase. Name, size,
  move limit, goal, designer note. Undo/Redo, Save (dev endpoint
  `/__studio/puzzles` → `src/puzzle/puzzles.json`) or Download JSON.
- **Solver panel**, live on every edit: sound (exactly one winning first move)
  or cooked (lists them), fastest win, the main line, and **tries**: wrong first
  moves with exactly one refutation (the good traps).
- ▶ Play: you move, the dungeon answers. Retry, Take back.
