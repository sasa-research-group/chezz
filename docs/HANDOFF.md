# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). One
  move per turn by default: each side acts with one piece (move, then strike
  or defend); the turn passes on its own once that piece strikes or defends. `"turn":
  "all"` brings back every piece acting. No promotion: pawns stop at the far
  row.
- **Strikes:** every struck piece that survives strikes back if it can reach
  the attacker (`counter` switch); Defend is only +N armour, and each side
  gets `defends` (3) per battle, shown as shields on the team bars. Strike range is
  per kind in `rules.json` (`range`: 1 or `"line"`); bishops are `"line"`:
  they hit any enemy down an open diagonal without moving, drawn as a
  streak. Sliders (rook, bishop, queen) move any distance in both turn
  modes, for you and the enemy.
- **Stats as data:** `src/game/rules.json` (HP, damage, strike range, defend
  +N, strikebacks on/off, turn mode, prices, heal, start gold), checked by `rules.ts`. The
  studio's Mechanics tab edits it in place, redraws its diagrams live, and
  saves under `npm run dev` (Download JSON on a static build). Level test
  runs play by the unsaved rules. A stats save never breaks the levels:
  spawn HP above a kind's max is clamped when the battle starts and shown as
  an amber warning (Levels and Mechanics tabs); no level error depends on the
  rules. Tests that pin numbers play by fixed copies in `tests/fixtures/`
  (`newRun(data)`, `startAt(..., data)`, `readRun(raw, data)`; the browser
  tests swap the JSON modules via `tests/browser/fixed.ts`), so retuning the
  shipped files can't break them; `tests/browser/shipped.spec.ts` and the
  levels test are the only checks on the shipped data, and pin no numbers.
- **Levels:** data in `src/game/levels/levels.json` (`docs/levels.md`). The
  studio's Levels tab edits them, saves under `npm run dev`, and test-runs one
  level in the real game with a test army and no saves touched. Checks are
  errors (block Save/Play) or amber warnings (design rules, never block).
  The Army tool sets starts and the exact test unit on each (or None); Undo /
  Redo per level (Ctrl/⌘ Z). No "wall ahead of start" warning any more.
- **Deploy phase:** every battle opens with your pieces on the start squares;
  drag (or tap, tap) to move or swap them, then Begin (`deploy`, `begin` in
  `turns.ts`).
- **Art:** one painted sprite per piece and skin, moved whole
  (`SpriteRig.tsx`, `sprite.css`, `docs/art/PAINTED.md`); look in
  `docs/art-style.md`.
- **Skins** (`docs/art/SKINS.md`): winning a run unlocks the next rebel skin
  (`meta.ts`). No in-game picker now; skins will be unlocked on the map. A skin
  worn in an old save still draws.
- **Studio** (`art.html` → `src/art/`): Cast, Stage, Levels, Style guide,
  Mechanics (with the stats editor on top).
- **Table UI:** a 100dvh wooden table: `TopBar.tsx` ("Battle n of N", gold,
  menu), tilted board with a team bar on each edge (`table/TeamBar.tsx`:
  enemy above, yours below with the king's hearts; one shield badge per
  defend, spent ones cracked; turn labels, playback caption and Check sit in
  the bars' middle), HUD strip (`table/`: +N shield, End turn pill;
  `table.css`). A turn where the enemy does nothing shows ENEMY WAITS. Next: drag-to-defend.
  ENEMY PHASE / YOUR PHASE banners sweep across the screen (`table/PhaseBanner.tsx`, ~1 s, shorter when fast).
- **☰ menu** (`PauseMenu.tsx`): player items, then a Developer section (Art
  studio, Jump to battle N: tap twice; fresh saved run with the level's test
  army). A regular game: no playtest notes, export or feedback copy.
- **In the game:** tap to strike
  (walk up and strike), knight leaps, check (End turn locks while the king
  could die next turn; moves into check blocked), checkmate finale, hideout
  hub (`Hub.tsx`) with barracks and locked placeholders. A strikeback plays as
  its own beat (swing, impact, damage) and logs its own line.
- **Previews and intent:** moves are previews until a strike, defend or End
  turn (Cancel / Escape takes them back; saved with the turn's start so a
  reload can cancel). Hover or tap an enemy for its card and its plan
  (`enemyPlan` in `turns.ts`, drawn by `IntentMarks` in `BoardArt.tsx`).
- **No narrator text:** on screen only numbers, nouns and icons. Story
  unwritten (`Encounter.story` hook). Ask before adding prose.
- **Balance**: the owner tunes `rules.json` and `levels.json` by hand in the studio.

## Open items
- The test player (`tests/turns-strategy.ts`) is a two-turn search; balance
  numbers are a floor, so playtest the new levels.
- Intent shows one enemy at a time (hover or tap); no always-on view of the
  whole enemy turn yet. A move with nothing left to do now waits for End turn.
- App debt: `App.tsx` is dense; intro/end modals lack Escape and
  a focus trap (`useDialogKeys` in `PauseMenu.tsx` is ready to reuse).
- Dead-end/loop audit (Oct 11), waiting on Wesley's play to pick fixes:
  0-damage strikes (pawn vs defender) only get your piece struck back; no turn
  limit, so stalling is endless (a pawn walled in front or on the far row can't move); a king already in
  check can strike himself to death on a counter. No insufficient-material
  draws; End turn is never impossible.
- Deletion candidates: the lab (`lab.html`, `src/lab/`), the old engine
  (`src/game/exile.ts`, `docs/exile-run.md`), the research in `reports/` and
  `research_notes/`.
