# Chezz — working notes for agents

## Stage: early prototype
We are in the early prototype stage. Be willing to make major changes to game
mechanics. Build them quickly so the developers can playtest and give feedback.
Rapid iteration is the name of the game.

## What's live
Escape from Exile, turn-based: `src/main.tsx` → `src/App.tsx` → `src/game/turns.ts`
(rules, written up in `docs/turn-based.md`). Battles are data in
`src/game/levels/levels.json` (`docs/levels.md`). Pieces and skins are painted
sprites, one image each (`src/components/SpriteRig.tsx`, `src/sprite.css`,
`docs/art/PAINTED.md`), drawn by `src/components/PieceRig.tsx`. Studio at
`art.html` → `src/art/`: Cast, Stage, Levels, style guide, mechanics.

## Rules code
- `turns.ts` is pure and deterministic: no DOM, no randomness, no mutating inputs.
- The enemy turn is computed in full before playback; playback only shows it.
- When a rule changes, update `docs/turn-based.md` in the same change so the
  written rules match the game.

## Checks
```sh
npm test            # vitest
npm run build       # tsc -b + production build
npm run test:e2e    # Playwright
```
Run `npm test` and the build before merging into local `main`. Run the e2e suite
before a push, or when a change touches screens or input flow. Never run
`playwright install`; with a preinstalled Chromium, set `PLAYWRIGHT_CHROMIUM_PATH`.

## The art harness lives in this repo
Someone else must be able to clone this repo and generate the same art, so what
the art depends on is committed here, not in agent memory or a scratch folder:
- Style: `docs/art-style.md`, reference images in `docs/art/`.
- How to generate: `docs/art/PAINTED.md`, `docs/art/recipe.md`, recipes in
  `docs/art/recipes/`, scripts in `tools/art/`.
- Owner decisions on the look: `docs/art/DECISIONS.md`.
- A prompt or rule that produced art the owner kept goes into these files in the
  same change.

## Workflow
- No PRs. Agents commit on a local `claude/*` branch; the lead merges into local
  `main` and pushes `main` after each playable change, which deploys to GitHub
  Pages so the developers can playtest.
- Keep `docs/HANDOFF.md` current and short.
- Batch independent questions for the owner, each with a recommended default. Keep replies short.

## Project board
The lead session runs the board (workboard) and reads its rules from
`~/.local/share/workboard/BOARD.md`. Other agents don't need them.
