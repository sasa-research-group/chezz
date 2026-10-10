# Chezz — working notes for Claude

## What's live
Escape from Exile, turn-based: `src/main.tsx` → `src/App.tsx` → `src/game/turns.ts`
(rules), `src/components/PieceRig.tsx` + `src/rig.css` (cast and animations;
style sheet at `art.html`), `src/exile.css`. `PieceArt.tsx` is the old art, still
used by the lab. Rules doc:
`docs/turn-based.md`. Lab: `lab.html` → `src/lab/` (Duel, pure solver).
`src/game/exile.ts` is the previous simultaneous engine (`docs/exile-run.md`);
the lab Duel and `tests/exile.test.ts` still use it. Plan:
`reports/Simultaneous chess tactics design.md`.
`engine.ts`, `content.ts`, `simultaneous.ts`, `src/render/`, `Art.tsx`,
`AttackPreview.tsx`, `sound.ts`, `style.css`, `tests/browser/game.spec.ts` and
`scripts/playtest.ts` are older leftovers the app doesn't import; some old
tests still cover them. Don't edit them. Removing them is waiting on Mark.

## Rules-code invariants
- `turns.ts` is pure and deterministic: no DOM, no randomness, no mutating inputs.
- The enemy turn is computed in full before playback; playback only shows it.
- Rule changes are test-first: write a failing test in `tests/turns.test.ts`,
  fix it, then update `docs/turn-based.md` in the same change.

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
