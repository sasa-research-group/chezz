# Chezz — Escape from Exile

A browser tactics game with chess pieces. An exiled king
fights through small boards, recruits followers at the rebel hideout between
battles, and keeps every wound and loss. You act, then the enemy acts. Rules:
[docs/turn-based.md](docs/turn-based.md).

Play at **[sasa-research-group.github.io/chezz](https://sasa-research-group.github.io/chezz/)**
(deployed from `main`).

## Commands

Use Node **24**.

```sh
npm ci
npm run dev        # game at http://127.0.0.1:5173, studio at /art.html
npm test           # vitest
npm run build      # tsc -b + production build
npm run test:e2e   # Playwright (PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome to reuse a browser)
```

## Where things are

- **src/App.tsx**: screens, turn controls, enemy-turn playback, autosave.
- **src/game/turns.ts**: the rules, pure and deterministic.
- **src/game/levels/levels.json**: the battles, as data ([docs/levels.md](docs/levels.md)).
- **src/components/PieceRig.tsx**, **SpriteRig.tsx**, **src/sprite.css**: the
  cast, one painted sprite per piece and skin, animated whole
  ([docs/art/PAINTED.md](docs/art/PAINTED.md), [docs/art-style.md](docs/art-style.md)).
- **art.html → src/art/**: the studio: Cast, Stage, Levels (edit and test-run
  battles), Style guide, Mechanics.
- **lab.html → src/lab/**: an old rule experiment from the dropped
  simultaneous-orders design ([docs/lab.md](docs/lab.md)).

Working notes: [CLAUDE.md](CLAUDE.md), [docs/HANDOFF.md](docs/HANDOFF.md).
