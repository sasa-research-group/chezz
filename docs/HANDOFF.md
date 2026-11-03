# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). No
  energy: every piece on both sides moves once (sliding any distance) and
  strikes or defends once per turn. Balance now comes from levels and stats.
- **Levels:** data in `src/game/levels/levels.json` (`docs/levels.md`). The
  studio's Levels tab edits them, saves under `npm run dev`, and test-runs one
  level in the real game with a test army and no saves touched. Checks are
  errors (block Save/Play) or amber warnings (design rules, never block).
- **Art:** one painted sprite per piece and skin, moved whole
  (`SpriteRig.tsx`, `sprite.css`, `docs/art/PAINTED.md`); look in
  `docs/art-style.md`.
- **Skins** (`docs/art/SKINS.md`): winning a run unlocks the next rebel skin
  (`meta.ts`). No in-game picker now; skins will be unlocked on the map. A skin
  worn in an old save still draws.
- **Studio** (`art.html` → `src/art/`): Cast, Stage, Levels, Style guide,
  Mechanics.
- **Table UI:** a 100dvh wooden table: `TopBar.tsx` ("Battle n of N"), tilted
  board, HUD strip (`table/`: +1 shield, End turn pill; `table.css`). A turn
  where the enemy does nothing shows ENEMY WAITS. Next: drag-to-defend.
- **☰ menu** (`PauseMenu.tsx`): player items, then a Developer section (Art
  studio, Jump to battle N: tap twice; fresh saved run with the level's test
  army). A regular game: no playtest notes, export or feedback copy.
- **In the game:** promotion (you pick; enemy becomes a queen), tap to strike
  (walk up and strike), knight leaps, check (End turn locks while the king
  could die next turn; moves into check blocked), checkmate finale, hideout
  hub (`Hub.tsx`) with barracks and locked placeholders. A defender's counter
  plays as its own beat (swing, impact, damage) and logs its own line.
- **No narrator text:** on screen only numbers, nouns and icons. Story
  unwritten (`Encounter.story` hook). Ask before adding prose.
- **Balance** (first no-energy pass, Nov 2; `docs/levels.md`): real enemy
  pieces in battles 2–3, 2-HP pawns, rook damage 2, walls that slow sliders
  (enemy pieces path round them). Search player: the typical army wins but
  battle 3 costs both rooks; a lone king falls in battle 2.
  `tests/balance.test.ts` logs the numbers.

## Open items
- The test player (`tests/turns-strategy.ts`) is a two-turn search; balance
  numbers are a floor, so playtest the new levels.
- Enemy intent isn't shown before it acts.
- App debt: `App.tsx` is dense; intro/promotion/end modals lack Escape and
  a focus trap (`useDialogKeys` in `PauseMenu.tsx` is ready to reuse).
- Dead-end/loop audit (Oct 11), waiting on Wesley's play to pick fixes:
  0-damage strikes (pawn vs defender) only get your piece countered; no turn
  limit, so stalling is endless (a pawn walled in front can't move); a king already in
  check can strike himself to death on a counter. No insufficient-material
  draws; End turn is never impossible.
- Deletion candidates: the lab (`lab.html`, `src/lab/`), the old engine
  (`src/game/exile.ts`, `docs/exile-run.md`), the research in `reports/` and
  `research_notes/`.
