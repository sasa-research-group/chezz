# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). No
  energy: every piece on both sides moves once (sliding any distance) and
  strikes or defends once per turn. Balance now comes from levels and stats.
- **Levels:** data in `src/game/levels/levels.json` (`docs/levels.md`). The
  studio's Levels tab edits them, saves under `npm run dev`, and playtests one
  level in the real game with a test army and no saves touched.
- **Art:** one painted sprite per piece and skin, moved whole
  (`SpriteRig.tsx`, `sprite.css`, `docs/art/PAINTED.md`); look in
  `docs/art-style.md`.
- **Skins** (`docs/art/SKINS.md`): winning a run unlocks the next rebel skin
  (`meta.ts`); wear it from ☰ or Victory.
- **Studio** (`art.html` → `src/art/`): Cast, Stage, Levels, Style guide,
  Mechanics.
- **Table UI:** a 100dvh wooden table: `TopBar.tsx`, tilted board, HUD strip
  (`table/`, `table.css`); menus in the ☰ `PauseMenu`. Next: drag-to-defend.
- **In the game:** promotion (you pick; enemy becomes a queen), tap to strike
  (walk up and strike), knight leaps, check (End turn locks while the king
  could die next turn; moves into check blocked), checkmate finale, hideout
  hub (`Hub.tsx`) with barracks and locked placeholders.
- **No narrator text:** on screen only numbers, nouns and icons. Story
  unwritten (`Encounter.story` hook). Ask before adding prose.
- Difficulty needs retuning since energy went (Nov 2): every enemy acts each
  turn, and your sliders cross the board.

## Open items
- The test player (`tests/turns-strategy.ts`) is a two-turn search.
- Enemy intent isn't shown before it acts.
- App debt: `App.tsx` is dense; intro/promotion/end modals lack Escape and
  a focus trap (`useDialogKeys` in `PauseMenu.tsx` is ready to reuse).
- Dead-end/loop audit (Oct 11), waiting on Wesley's play to pick fixes:
  0-damage strikes (pawn vs defender) only get your piece countered; the
  battle-3 knight parks beside its target and never strikes; no turn limit,
  so stalling is endless (battle 2 has frozen pawn pairs); a king already in
  check can strike himself to death on a counter. No insufficient-material
  draws; End turn is never impossible.
- Deletion candidates: the lab (`lab.html`, `src/lab/`), the old engine
  (`src/game/exile.ts`, `docs/exile-run.md`), the research in `reports/` and
  `research_notes/`.
