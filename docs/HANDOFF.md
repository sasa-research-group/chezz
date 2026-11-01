# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). You act,
  then the enemy acts; 4 energy per turn for moves (1/square), strikes
  (2; reach only the next square in the piece's shape, so sliders
  travel first) and defend (1); fixed damage; strikes land in place. The
  simultaneous engine (`exile.ts`) stays for the lab Duel.
- **Art:** rigs are misfit characters with Pizza Tower animations
  (`PieceRig.tsx`, `rig.css`), placeholder. Target style chosen Oct 31:
  "armour does the talking" (`docs/art-style.md`; reference art and recipe
  in `docs/art/`). Pawn pilot (`?art=new`): shape kit `inkKit.tsx`, judge
  loop `tools/art/shoot.mjs` + `docs/art/BRIEF.md`. Rebel pot reads hat-like.
  Regenerate concepts with `tools/art/gen.mjs` (`docs/art/GENERATING.md`).
- **Studio** (`art.html` → `src/art/`): all art live, mechanics from
  `turns.ts`, style guide. Add new art to `Catalog.tsx`.
- **Diorama shell** (`claude/diorama-shell`, UI plan steps 1–2): a 100dvh
  wooden table, no page scroll. Top bar (`TopBar.tsx`), board sized to the
  field on both axes at 8° tilt, HUD strip (rails in landscape) with
  swappable `table/Lantern`, `Bell`, `ShieldToken` (`table.css`). Rules,
  New run, fast turns, log, export, studio live in the ☰ `PauseMenu`
  (Escape, focus trap; pauses playback). Next: drag-to-defend, art.
- **Busier enemy** (#9): closes in, pawns race to promote; battles end
  with a celebration banner.
- **Promotion** (#10): pawns on the far row promote (you pick; enemy becomes
  a queen) with a morph animation; the barracks sells a 3-gold pawn.
- **Next-square strikes** (#11): sliders must travel next to a target to hit it.
- **Tap to strike** (#13): tap an enemy to walk up and strike it; pick the
  square when there's more than one.
- **Knight leap**: knight strikes cost 2; knights flip over and backflip
  home (animation only; `stage.lunge` in `App.tsx`).
- **Check** (`claude/check`): if the enemy's next turn could kill the king,
  End turn locks until he's safe (unless no escape exists); moves that would
  put him in check are blocked (red ✕). A fallen king
  gets a checkmate finale (zoom, crown flies off, CHECKMATE! banner).
- **Hideout hub** (#12): between battles the king walks a little
  village (`Hub.tsx`, `hub.css`): barracks (recruit, heal, several buys), next
  battle; training grounds, armory, merchant and Grandmaster's Guild are
  locked (🔒) placeholders.
- **No narrator text** (`claude/cut-llm-text`): on screen only numbers,
  nouns and icons; battles are numbered; Rules is a card. Board cues teach
  instead: strike-reach ticks, ✕ chip on unsafe strikes, move/act pips.
  Story unwritten (`Encounter.story` hook). Ask before adding prose.
- Difficulty needs tuning from Wesley's play.

## History (merged PRs)
- #2 foundation pass; #3 research + lab Duel; #4–#5 simultaneous-engine rule
  changes (reach-based return hits, pass-through, order pool); #6 turn-based
  rebuild; #7 art pass; #8 strike in place; #9 phone layout + busier enemy;
  #10 promotion; #11 next-square strikes; #12 hideout hub; #13 tap to strike.

## Open items
- `exile-preview.yml` is redundant now that `main` deploys. Delete it.
- The test player (`tests/turns-strategy.ts`) is a two-turn lookahead search, not a person.
- Enemy intent isn't shown before it acts.
- App debt: `App.tsx` is dense; intro/promotion/end modals lack Escape and
  a focus trap (`useDialogKeys` in `PauseMenu.tsx` is ready to reuse).
- Dead-end/loop audit (Oct 11), waiting on Wesley's play to pick fixes:
  0-damage strikes (pawn vs defender) only get your piece countered; the
  battle-3 knight parks beside its target and never strikes; no turn limit,
  so stalling is endless (battle 2 has frozen pawn pairs); a king already in
  check can strike himself to death on a counter. No insufficient-material
  draws; End turn is never impossible.
