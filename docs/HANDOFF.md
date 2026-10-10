# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). You act,
  then the enemy acts; 4 energy per turn for moves (1/square), strikes
  (2; reach only the next square in the piece's shape, so sliders
  travel first) and defend (1); fixed damage; strikes land in place. The
  simultaneous engine (`exile.ts`) stays for the lab Duel.
- **Art:** a cast of misfit characters (rebels vs a blue royal patrol) with
  Pizza Tower-style animations (`PieceRig.tsx`, `rig.css`, style sheet
  `art.html`). Wesley calls it placeholder while mechanics settle.
- **Phone layout + busier enemy** (#9): the game fits an
  iPhone screen (height-fitted board, bottom action bar); the enemy closes in
  on any of your pieces, pawns march toward targets and race to promote, pieces brace only when it helps; a battle ends with a celebration
  banner before the menu.
- **Promotion** (#10): pawns on the far row promote (you pick; enemy becomes
  a queen) with a morph animation; the barracks sells a 3-gold pawn.
- **Next-square strikes** (#11): sliders must travel next to a target to hit it.
- **Tap to strike** (#13): tap an enemy to walk up and strike it; pick the
  square when there's more than one.
- **Knight leap** (`claude/knight-leap`): knight strikes cost 2 like the rest
  (jump + strike = a whole turn); knights flip over to strike and backflip
  home (animation only; `stage.lunge` in `App.tsx`).
- **Hideout hub** (#12): between battles the king walks a little
  village (`Hub.tsx`, `hub.css`): barracks (recruit, heal, several buys), road
  out; training grounds, merchant and Grandmaster's Guild are placeholders
  to build out.
- Difficulty needs tuning from Wesley's play; encounter 2 now punishes
  letting a pawn promote.
- Research report: `reports/Simultaneous chess tactics design.md`.

## History (merged PRs)
- #2 foundation pass; #3 research + lab Duel; #4–#5 simultaneous-engine rule
  changes (reach-based return hits, pass-through, order pool); #6 turn-based
  rebuild; #7 art pass; #8 strike in place; #9 phone layout + busier enemy;
  #10 promotion; #11 next-square strikes; #12 hideout hub; #13 tap to strike.

## Open items
- Removing the dead prototype code is waiting on Mark. Its three vitest suites
  would go with it.
- `exile-preview.yml` is redundant now that `main` deploys. Delete it.
- `prototype/familiar-opening` is unmerged and still on the old engine.
- Phone landscape still gets the desktop layout (scrolls).
- The test player (`tests/turns-strategy.ts`) is a two-turn lookahead search, not a person.
- Enemy intent isn't shown before it acts.
- App debt: `App.tsx` is dense; modals lack Escape and a focus trap.
