# Levels and the level designer

## Data
- The battles live in `src/game/levels/levels.json` (`{ version: 1, levels: [...] }`).
  `turns.ts` reads them as `ENCOUNTERS`; each has the `Encounter` shape:
  `width`, `height` (2–8), `walls`, `spawns` (`[kind, x, y, hp]`, or `[kind, x, y]` for full HP), `starts`
  (a real run's army fills them in order, king first; then the player
  rearranges it in the deploy phase), `reward`, optional `switches`
  (`[{ type, x, y, rows: [y, ...], damage }]`: a floor switch, what it does
  (`type`; only `"spears"` so far, listed in `SWITCH_TYPES` in `levels.ts`)
  and the rows its spears sweep; see `docs/turn-based.md`), and an
  optional `story` the designer keeps but doesn't show.
- Designer-only fields, ignored by the game: `name` (list label) and
  `testArmy` (see below).
- `src/game/levels.ts` checks a level (`levelIssues`), a whole file
  (`parseLevels`, which also rejects unknown fields and wrong types) and
  writes the file (`formatLevels`: one field per line, short lists inline).
  `tests/levels.test.ts` checks the shipped file loads, every battle starts,
  and the file round-trips byte for byte; it doesn't pin the battles' contents.
  It also loads the shipped levels under extreme legal stats (every HP 1 and 99,
  damage 0 and 99), so a rules save can never make the levels file unloadable.
  Tests that pin numbers play by fixed copies in `tests/fixtures/`.
- **Errors** (would crash or corrupt; block Save and Play, and `parseLevels`
  refuses them): board 2–8 a side; nothing off the board; no enemy or start on
  a wall; no two things on one square; enemy HP a whole number 1–99; at least
  one enemy and one start; reward 0–99; a test army has exactly one king,
  every piece on a start square and no two on one. Empty starts are fine.
  No error depends on `rules.json`, so retuning stats never breaks a level.
- **Warnings** (design rules; shown in amber, never block): an enemy
  the king can't reach from his start (king steps around walls); a level with
  fewer starts than the one before (survivors carry over; the game drops
  whoever doesn't fit); an enemy's HP above its kind's max ("pawn HP 2 >
  max 1 → 1": the game clamps it when the battle starts, and the Mechanics tab
  lists the same clamps under the stats). Issues carry `warning: true`; `isError` tells them
  apart. Shrinking the board in the editor drops what falls outside it.

## Studio: Levels tab (`art.html#levels/N`)
- Left: the list. Select, Add, Duplicate, ↑/↓, Delete. A red count marks a
  level with errors; an amber count, one with only warnings.
- Board: drawn with the game's board classes and the painted stills. Tools:
  Wall, Enemy (pick the piece), Army, Switch, Erase. One thing per square: painting
  replaces what was there; clicking the same thing again removes it. With
  Army, clicking a square makes it a start; clicking a start opens its unit
  picker (king, queen, rook, bishop, knight, pawn or None, plus Remove start).
  Picking the king for a square moves him there. With Switch, clicking a
  square places a spear switch (spears on the rank just above the middle, 2
  damage); clicking it again removes it. The Switches list on the right sets
  each one's type, damage and the ranks its spears sweep; the board stripes
  those ranks and shows a launcher at their left edge. Switches error when
  off the board, on a wall, enemy or start, with no rank or a rank off the
  board, or with damage outside 1–99. The test army stands on the
  board as sprites. Numbers on the starts are the order a real army fills them. Errors
  (red) and warnings (amber) list under the board and ring their square in
  the same colour.
- Right: name, width, height, reward, each enemy's HP (empty: full HP; new
  enemies start empty, so they follow stat changes), and the Army list:
  each start in order with its test unit (or none) and a remove button.
- Undo / Redo (buttons, Ctrl/⌘ Z and Shift Ctrl/⌘ Z, or Ctrl Y) step through
  every edit to the selected level. Each level keeps its own history, in
  memory until Save or a reload.
- Save writes every level through a dev-only Vite endpoint
  (`vite.levels.ts`, `POST /__studio/levels`, `apply: "serve"`). The
  Mechanics tab saves `src/game/rules.json` the same way
  (`POST /__studio/rules`, checked with `parseRules`). It needs the
  `x-chezz-studio: save` header, JSON and a same-origin request, re-checks with `parseLevels`, and
  writes atomically; an unchanged file isn't touched. On a static build the
  button is "Download JSON". Save is off while any level has an error; warnings save.

## Test runs and the army question
- ▶ Play opens the real game (`App` with a `test` prop, `src/art/TestRun.tsx`) full screen over
  the studio with this level and its test army, played by the Mechanics tab's
  rules (unsaved edits included). It reads and writes no saves:
  not the run (`chezz.turns.v1`), not the meta (`chezz.meta.v1`), so no skin
  unlocks. Restart deals the level again; Stop returns to the editor.
- In a real run the army at a level depends on what the player recruited, so
  a test run uses a stand-in. `testArmy` is that stand-in, per level, piece by
  square: `[{ "kind": "king", "x": 1, "y": 3 }, ...]`. ▶ Play deals it exactly
  as placed (empty starts stay empty, spare squares to deploy onto), then the
  deploy phase lets you rearrange it before Begin:
  - **Typical** (default, no `testArmy` saved): filled into the starts in
    order (`placeInOrder`). `typicalArmy` replays the run's
    economy: the starting gold plus each earlier level's reward, buying the
    strongest recruit it can afford at each hideout (gold and prices from
    `rules.json`; today 2 gold, rook 8, bishop 6, pawn 3),
    one per stop, while the next level has a start for it. Today: battle 1
    king; battle 2 king + rook; battle 3 king + rook + rook. It follows the
    rewards and start counts as you edit them, and the Mechanics tab's
    unsaved prices.
  - **Minimum**: the king alone, on start 1.
  - Custom: pick a unit per start square (from a preset or from scratch); it
    is saved as `testArmy`.
- The real game ignores `testArmy` and uses the player's actual army,
  except the ☰ menu's Developer → Jump to battle, which fields it as placed.

## Balance (no energy, Nov 2)
Rosters (squares in chess notation, your side at the bottom):
- **Battle 1**, 4×4, no walls: pawns a3, c3 (2 HP). King b1. Reward 8.
- **Battle 2**, 6×5, walls c3 d3: rook e5, pawns a3 b3 f3 (2 HP). Starts b1
  (king), a1, f1. Reward 12, so the hideout affords a rook and a heal.
- **Battle 3**, 6×6, walls a4 b4 e4 f4 a3 f3: rook b6, queen d6 (6 of 9 HP),
  knight e6, pawns c4 d4 (2 HP). Starts c1 (king), d1, d2. Reward 0.

Every battle's first enemy turn can strike something if you stand still.
Stats that changed with it: rook damage 3 → 2, pawn HP 1 → 2.

`tests/balance.test.ts` plays the battles with the search player
(`tests/turns-strategy.ts`, a two-turn search) and logs the results rather
than asserting them; it's a floor for a person, not a target.

| Run | Before | After |
|---|---|---|
| Typical army, battle by battle (full HP) | won all three, nothing lost (king 5/5) | won all three; battle 3 costs both rooks (king 2/5) |
| Lone king, battle by battle | won all three (king 4/5 at the end) | wins battle 1 (4/5), loses battles 2 and 3 |
| Whole run, rook then heal at each hideout | victory, king 5/5 + 2 rooks | victory in 8 turns of battle 3, king 2/5, both rooks lost |
| Whole run, lone king | victory | defeat in battle 2, turn 4 |

## Balance under one move per turn (no promotion, Nov 2)
Same levels and stats; only the turn rule changed (`turn: "one"`) and
promotion is gone. `tests/balance.test.ts`:

| Run | One move per turn (default) | Every piece acts, no promotion |
|---|---|---|
| Typical army, battle by battle (full HP) | wins all three; battle 2 costs the rook (king 4/5), battle 3 both rooks (king 1/5, 12 turns) | wins all three; battle 3 costs both rooks (king 2/5) |
| Lone king, battle by battle | wins battles 1 (4/5) and 2 (2/5, 8 turns), loses battle 3 | wins battles 1 and 2 (3/5), loses battle 3 |
| Whole run, rook then heal at each hideout | defeat in battle 3, turn 10 | victory in 8 turns of battle 3, king 2/5 |
| Whole run, lone king | defeat in battle 3, turn 11 | defeat in battle 3, turn 6 |
