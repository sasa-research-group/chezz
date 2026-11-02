# Chezz — working notes for Claude

## What's live
Escape from Exile, turn-based: `src/main.tsx` → `src/App.tsx` → `src/game/turns.ts`
(rules). Pieces are painted sprites (one image each, `src/components/SpriteRig.tsx`,
`src/sprite.css`, `docs/art/PAINTED.md`) drawn by `src/components/PieceRig.tsx`, skins
included (`docs/art/SKINS.md`); they are the only art (the SVG shape kit was removed in
Nov 2026). Studio at `art.html` → `src/art/`: Cast, Stage, style guide, mechanics.
`src/exile.css`. Rules doc:
`docs/turn-based.md`. Lab: `lab.html` → `src/lab/` (Duel, pure solver).
`src/game/exile.ts` is the previous simultaneous engine (`docs/exile-run.md`);
the lab Duel and `tests/exile.test.ts` still use it. Plan:
`reports/Simultaneous chess tactics design.md`. The older Between Worlds
prototype (Three.js board, shops, gambits) was removed in Oct 2026; it is in
git history before that commit.

## Rules-code invariants
- `turns.ts` is pure and deterministic: no DOM, no randomness, no mutating inputs.
- The enemy turn is computed in full before playback; playback only shows it.
- Rule changes are test-first: write a failing test in `tests/turns.test.ts`,
  fix it, then update `docs/turn-based.md` in the same change.

## Checks (all must pass before merging into local main)
```sh
npm test            # vitest
npx tsc -b          # types (npm run build also runs it)
npm run build
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e
```
In cloud containers, use the preinstalled Chromium (check the build number under
`/opt/pw-browsers`). Never run `playwright install`.

## The art harness lives in this repo
Someone else must be able to clone this repo and generate the same art. So
everything the art depends on is committed here, never only in an agent's
memory, a scratch folder or a personal tool:
- Style: `docs/art-style.md` (rules), `docs/art/` (reference images, one crop
  per character), `docs/art/recipe.md` (exact model + prompts that made them).
- Decisions and rejected directions: `docs/art/DECISIONS.md`. Add to it when
  the owner picks or rejects a look, with their reason.
- Pipeline (concept → style guide → builder → judge): `docs/art/PIPELINE.md`,
  `docs/art/BRIEF.md`, `docs/art/JUDGE.md`, scripts in `tools/art/`.
- A prompt, script, palette or rule that produced something the owner kept
  goes into these files in the same change. Don't save project knowledge to
  agent memory.
- Concept images are scratch until picked; the picked one is committed (webp,
  under ~800KB) with its prompt.

## Workflow
- Local development only: no PRs and no pushes unless the owner asks. Agents
  commit on a local `claude/*` branch; the lead merges it into local `main`.
  Pushing `main` deploys to GitHub Pages, so it waits for the owner.
- Split work into small tasks, each with a command that proves it's done.
- Before merging into local `main`, have a fresh-context reviewer subagent read the diff.
- Models: lead on Opus at medium effort; cheap read-only explorers for searches;
  the reviewer at high effort.
- Keep `docs/HANDOFF.md` current and under 4k chars.
- Ask Wesley one question at a time, with a recommended option. Keep replies short.

# The project board: item model, CLI and lead rules
@~/.local/share/workboard/BOARD.md
