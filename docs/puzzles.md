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

## Board elements (Wesley's calls, Nov 13)
- **Eye** (`eyes`): a solid block watching its row and column. Walls, eyes,
  closed gates and pieces block the view; holes don't. When it sees any of your
  pieces at the end of a move (either side's), every **sleeping** enemy wakes.
- **Sleeping enemy** (5th piece field `"asleep"`): can't move, capture or give
  check; can be captured.
- **Toxic sludge** (`sludge`): a piece that stops in it dies (an enemy counts as
  captured). Sliders cross it safely. Kings can't step in. A side that must
  move must move, even into sludge (zugzwang).
- **Trapdoor** (`trapdoors`): floor until a piece standing on it moves off,
  then a hole for good.
- **Snare** (`snares`): a piece that stops on it never moves again, but still
  blocks and attacks (gives check).
- **Gate** (`gates`, optional `open`): a wall switches can flip. Can't close on a piece.
- **Switch** (`switches`: `kind` lever | plate, `effect`): fires when any piece
  stops on it (the dungeon uses them too). Lever: flips its gates each time.
  Plate: holds its gates flipped while pressed. Other effects: drop every
  trapdoor, wake the sleepers, flood listed squares with sludge (kills what's there).
- **Statue** (5th piece field `"statue"`, enemy rook/bishop/queen/knight/pawn):
  never moves; on its turn it strikes one of your pieces in its reach (as that
  piece) without leaving its square. Gives check.
- **Coward** (kind `coward`, enemy): steps like a king, never captures, never
  stops on a square you attack. Herd it into sludge, snares or a corner. Worth 3.
- Killing the enemy king any way (sludge) wins like mate.

## The dungeon plays perfectly (`src/puzzle/solve.ts`)
Exhaustive memoized search: `need(state)` = player moves still needed to force
the goal against best defence, or never. The dungeon's reply: the one that keeps
you furthest from the goal (out of reach if possible), then the most material,
then board order. Same engine powers the studio's checks.

## Studio: Puzzles tab (`art.html#puzzles/N`, `src/art/Puzzles.tsx`)
- Tools: Piece (yours/enemy + kind), Sleep, Wall, Hole, Eye, Sludge, Trapdoor,
  Snare, Gate (closed → open → off), Switch (lever → plate → off), Goal square,
  Erase. The Switches list sets each switch's kind and effect; Wire connects
  gates or flood squares by clicking the board. Name, size,
  move limit, goal, designer note. Undo/Redo, Save (dev endpoint
  `/__studio/puzzles` → `src/puzzle/puzzles.json`) or Download JSON.
- **Solver panel**, live on every edit: sound (exactly one winning first move)
  or cooked (lists them), fastest win, the main line, and **tries**: wrong first
  moves with exactly one refutation (the good traps).
- ▶ Play: you move, the dungeon answers. Retry, Take back.

## Starter puzzles
Most were found by a random search filtered through the solver (sound, the
element must matter: e.g. Night watch is unsolvable with the guards awake).
That search could become a "Generate" button in the editor.
