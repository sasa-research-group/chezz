# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). You act,
  then the enemy acts; 4 energy per turn for moves (1/square), strikes
  (2; reach only the next square in the piece's shape, so sliders
  travel first) and defend (1); fixed damage; strikes land in place. The
  simultaneous engine (`exile.ts`) stays for the lab Duel.
- **Art:** painted sprites are the default (`docs/art/PAINTED.md`): one
  generated image per piece, moved whole (`SpriteRig.tsx`, `sprite.css`);
  style "armour does the talking" (`docs/art-style.md`). The only art: the
  SVG shape kit, `?art=new`, the red patrol hue and `PieceArt.tsx` were
  removed (git history). Tools: `shoot.mjs`, `battle-shot.mjs` (`--skins`),
  `gen.mjs`, `sprite.mjs`.
- **Skins** (`docs/art/SKINS.md`): winning a run unlocks the next rebel skin
  (`meta.ts`); wear it from ☰ or Victory. All six painted (`skin-<id>.webp`).
- **Studio** (`art.html` → `src/art/`): Cast (stills, landing), Stage (one
  piece, a button per action, 1×–0.1×), Levels, Style guide, Mechanics. Contract:
  `docs/art/RIG.md`.
- **Levels** (`docs/levels.md`): battles are data
  (`src/game/levels/levels.json`, checked by `levels.ts`). The studio's
  Levels tab edits them, saves to the repo under `npm run dev`, and playtests
  one level in the real game with a per-level test army (Typical/Minimum/
  custom) and no saves touched.
- **Diorama shell** (`claude/diorama-shell`, UI plan steps 1–2): a 100dvh
  wooden table: `TopBar.tsx`, tilted board, HUD strip (`table/`,
  `table.css`). Rules, New run, fast turns, skins, log, export, studio live
  in the ☰ `PauseMenu` (pauses playback). Next: drag-to-defend, art.
- **Promotion** (#10): pawns on the far row promote (you pick; enemy becomes
  a queen) with a morph animation; the barracks sells a 3-gold pawn.
- **Next-square strikes** (#11): sliders strike only from the next square.
- **Tap to strike** (#13): tap an enemy to walk up and strike it; pick the
  square when there's more than one.
- **Knight leap**: knight strikes cost 2; knights flip over and backflip
  home (animation only; `stage.lunge` in `App.tsx`).
- **Check** (`claude/check`): End turn locks while the enemy could kill the
  king next turn (unless no escape exists); moves into check are blocked
  (red ✕). A fallen king gets a checkmate finale.
- **Hideout hub** (#12): between battles the king walks a little
  village (`Hub.tsx`, `hub.css`): barracks (recruit, heal), next battle,
  and four locked (🔒) placeholders.
- **No narrator text** (`claude/cut-llm-text`): on screen only numbers,
  nouns and icons; battles are numbered; Rules is a card. Board cues teach
  instead: strike-reach ticks, ✕ chip on unsafe strikes, move/act pips.
  Story unwritten (`Encounter.story` hook). Ask before adding prose.
- Difficulty needs tuning from Wesley's play.

## History (merged PRs)
- #2 foundation; #3 research + lab Duel; #4–#5 simultaneous-engine rules;
  #6 turn-based rebuild; #7 art pass; #8 strike in place; #9 phone layout + busier enemy;
  #10 promotion; #11 next-square strikes; #12 hideout hub; #13 tap to strike.

## Open items
- Delete the redundant `exile-preview.yml`.
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
