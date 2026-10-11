# Chezz — Escape from Exile

A browser tactics game with chess pieces. An exiled king fights through three
small boards, recruits followers at the rebel hideout, and keeps every wound and loss.
You act, then the enemy acts; each turn you spend 4 energy to move pieces in
their chess shapes and to strike or defend.

Play at **[sasa-research-group.github.io/chezz](https://sasa-research-group.github.io/chezz/)**.
Every push to `main` deploys there after CI passes. The repository moved from
`mracette/chezz`, and GitHub does not redirect Pages sites after a transfer.

## Commands

Use Node **24**.

```sh
npm ci
npm run dev        # local game at http://127.0.0.1:5173
npm test           # rules tests (vitest)
npm run build      # tsc -b + production build
npm run test:e2e   # Playwright browser suite (tests/browser/exile.spec.ts)
```

If Chromium is already installed (for example in a cloud container), point
Playwright at it instead of downloading a browser:

```sh
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e
```

## Live code

- **src/main.tsx → src/App.tsx**: screens, turn controls, enemy-turn playback and autosave.
- **src/game/turns.ts**: pure, deterministic turn-based rules (energy, moves,
  strikes, defend, enemy turn, camp, save validation).
- **src/game/exile.ts**: the previous simultaneous-orders engine, still used
  by the lab Duel.
- **src/components/PieceRig.tsx** and **src/rig.css**: the cast (one character
  per piece and side) with idle, move, attack, defend, hit and death
  animations. Style sheet: `art.html`.
- **src/exile.css**: the CSS-tilted parchment board and screens.
- **tests/turns.test.ts**: rules tests; **tests/browser/exile.spec.ts**: e2e.

Rules are in [docs/turn-based.md](docs/turn-based.md); the earlier simultaneous slice is in [docs/exile-run.md](docs/exile-run.md).
Rule experiments live on the lab page (`lab.html`, [docs/lab.md](docs/lab.md)).
Working notes are in [CLAUDE.md](CLAUDE.md) and [docs/HANDOFF.md](docs/HANDOFF.md).

The earlier "Between Worlds" prototype (Three.js board, shops, gambits) was
removed in October 2026; it lives on in git history.
