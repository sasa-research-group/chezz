# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). You act,
  then the enemy acts; 4 energy per turn for moves (1/square), strikes
  (distance + 1) and defend (1); fixed damage; strikes land in place (no
  capture-move). The simultaneous engine (`exile.ts`) stays for the lab Duel.
- **Art:** a cast of misfit characters (rebels vs a blue royal patrol) with
  Pizza Tower-style animations (`PieceRig.tsx`, `rig.css`, style sheet
  `art.html`). Wesley calls it placeholder while mechanics settle.
- **Phone layout + busier enemy** (`claude/mobile-and-ai`): the game fits an
  iPhone screen (height-fitted board, bottom action bar); the enemy closes in
  on any of your pieces, pawns march toward targets (never onto the last
  rank), pieces brace only when it helps; a battle ends with a celebration
  banner before the menu.
- **Promotion** (`claude/promotion`, on top of #9): pawns on the far row
  promote (you pick; enemy becomes a queen) with a morph animation; camp
  sells a 3-gold pawn.
- Encounters are too easy (bot wins with the king near full HP). Tune enemies
  and energy from Wesley's play.
- Research report: `reports/Simultaneous chess tactics design.md`.

## History (merged PRs)
- #2 foundation pass; #3 research + lab Duel; #4–#5 simultaneous-engine rule
  changes (reach-based return hits, pass-through, order pool); #6 turn-based
  rebuild; #7 art pass; #8 strike in place.

## Open items
- Removing the dead prototype code is waiting on Mark. Its three vitest suites
  would go with it.
- `exile-preview.yml` is redundant now that `main` deploys. Delete it.
- `prototype/familiar-opening` is unmerged and still on the old engine.
- Phone landscape still gets the desktop layout (scrolls).
- The test bot's pathfinding ignores walls; it can stall where a person wouldn't.
- Enemy intent isn't shown before it acts.
- App debt: `App.tsx` is dense; modals lack Escape and a focus trap.
