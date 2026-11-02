# Levels and the level designer

## Data
- The battles live in `src/game/levels/levels.json` (`{ version: 1, levels: [...] }`).
  `turns.ts` reads them as `ENCOUNTERS`; each has the `Encounter` shape:
  `width`, `height` (2–8), `walls`, `spawns` (`[kind, x, y, hp]`), `starts`
  (your army fills them in order, king first), `reward`, `enemyEnergy`, and an
  optional `story` the designer keeps but doesn't show.
- Designer-only fields, ignored by the game: `name` (list label) and
  `testArmy` (see below).
- `src/game/levels.ts` checks a level (`levelIssues`), a whole file
  (`parseLevels`, which also rejects unknown fields and wrong types) and
  writes the file (`formatLevels`: one field per line, short lists inline).
  `tests/levels.test.ts` pins the shipped file: it must parse cleanly and
  round-trip byte for byte.
- Rules a level must meet: board 2–8 a side; nothing off the board; no enemy or
  start on a wall; no two things on one square; enemy HP 1–max for its kind; at
  least one enemy and one start; no wall ahead of a start (a recruited pawn
  must be able to march up and promote); reward 0–99; enemy energy 0–12; a test
  army has one king, first, and no more pieces than starts; every enemy reachable
  from the king start (king steps around walls); and no level with fewer starts
  than the one before (survivors carry over). Shrinking the board in the editor
  drops what falls outside it.

## Studio: Levels tab (`art.html#levels/N`)
- Left: the list. Select, Add, Duplicate, ↑/↓, Delete. A red count marks a
  level with problems.
- Board: drawn with the game's board classes and the painted stills. Tools:
  Wall, Enemy (pick the piece), Start, Erase. One thing per square: painting
  replaces what was there; clicking the same thing again removes it. Problems
  show under the board and ring their square in red.
- Right: name, width, height, reward, enemy energy, each enemy's HP, the start
  order, and the test army.
- Save writes every level through a dev-only Vite endpoint
  (`vite.levels.ts`, `POST /__studio/levels`, `apply: "serve"`). It needs the
  `x-chezz-studio: save` header, JSON and a same-origin request, re-checks with `parseLevels`, and
  writes atomically; an unchanged file isn't touched. On a static build the
  button is "Download JSON". Save is off while any level has problems.

## Playtests and the army question
- ▶ Play opens the real game (`App` with a `playtest` prop) full screen over
  the studio with this level and its test army. It reads and writes no saves:
  not the run (`chezz.turns.v1`), not the meta (`chezz.meta.v1`), so no skin
  unlocks. Restart deals the level again; Stop returns to the editor.
- In a real run the army at a level depends on what the player recruited, so
  a playtest uses a stand-in. `testArmy` is that stand-in, per level:
  - **Typical** (default, no `testArmy` saved): `typicalArmy` replays the run's
    economy: 2 starting gold plus each earlier level's reward, buying the
    strongest recruit it can afford (rook 8, bishop 6, pawn 3) at each hideout,
    one per stop, while the next level has a start for it. Today: battle 1
    king; battle 2 king + rook; battle 3 king + rook + rook. It follows the
    rewards and start counts as you edit them.
  - **Minimum**: the king alone.
  - Custom: add, remove or change pieces; it is saved as `testArmy`.
- The real game ignores `testArmy` and uses the player's actual army.
