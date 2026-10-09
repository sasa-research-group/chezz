# Chezz — working notes for Claude

## What's live
Escape from Exile: `src/main.tsx` → `src/App.tsx` → `src/game/exile.ts` (rules),
`src/components/PieceArt.tsx`, `src/exile.css`. Rules doc: `docs/exile-run.md`.
Lab: `lab.html` → `src/lab/` (pure `duel.ts` and solver). Plan:
`reports/Simultaneous chess tactics design.md`. Notes: `docs/lab.md`.
`engine.ts`, `content.ts`, `simultaneous.ts`, `src/render/`, `Art.tsx`,
`AttackPreview.tsx`, `sound.ts`, `style.css`, `tests/browser/game.spec.ts` and
`scripts/playtest.ts` are earlier-prototype leftovers the app doesn't import.
`tests/engine.test.ts`, `balance.test.ts` and `simultaneous.test.ts` still test
them under `npm test`. Don't edit them. Removing them is waiting on Mark.

## Rules-code invariants
- `exile.ts` is pure and deterministic: no DOM, no randomness, no mutating inputs.
- Every turn resolves from one HP snapshot. All hits use starting HP.
- Playback only presents a `Resolution`. Speed, skip and reduced motion must
  never change the outcome.
- Rule changes are test-first: write a failing test in `tests/exile.test.ts`,
  fix it, then update `docs/exile-run.md` in the same change.

## Checks (all must pass before a PR)
```sh
npm test            # vitest
npx tsc -b          # types (npm run build also runs it)
npm run build
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e
```
In cloud containers, use the preinstalled Chromium (check the build number under
`/opt/pw-browsers`). Never run `playwright install`.

## Workflow
- Work on a `claude/*` branch and open a PR to `main`. CI runs on the PR. Merging
  to `main` deploys to GitHub Pages.
- Split work into small tasks, each with a command that proves it's done.
- Before opening a PR, have a fresh-context reviewer subagent read the diff.
- Models: lead on Opus at medium effort; cheap read-only explorers for searches;
  the reviewer at high effort.
- Keep `docs/HANDOFF.md` current and under 4k chars.
- Ask Wesley one question at a time, with a recommended option. Keep replies short.
