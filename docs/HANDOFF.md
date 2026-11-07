# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). You act,
  then the enemy acts; 4 energy per turn for moves (1/square), strikes
  (2; reach only the next square in the piece's shape, so sliders
  travel first) and defend (1); fixed damage; strikes land in place. The
  simultaneous engine (`exile.ts`) stays for the lab Duel.
- **Art:** a cast of misfit characters (rebels vs a blue royal patrol) with
  Pizza Tower-style animations (`PieceRig.tsx`, `rig.css`). Wesley calls it
  placeholder while mechanics settle.
- **Variants + sprite cast** (`claude/variants`, on the studio branch): every
  unit has a `variant` (rebel/royal/misfit); abilities are pure hooks in
  `src/game/abilities.ts` (Haystack = Consume). The board, hub and pickers
  render Wesley's character-select sheet sliced to `public/art/cast/*.png`
  via `PieceSprite.tsx` + `sprite.css` (same action names as the rig). Sheet
  slicer: `scripts/slice-cast.py` (Pillow + numpy); the studio's Art catalog
  opens with the 18 portraits and a sprite × state matrix.
- **Studio** (`art.html` → `src/art/`, `claude/art-studio`): every piece of
  art rendered live, the implemented mechanics computed from `turns.ts`, a
  style guide (swatches checked against the source) and tooling notes. Seed
  of the art pipeline: add new art to `Catalog.tsx`.
- **Phone layout + busier enemy** (#9): the game fits an
  iPhone screen (height-fitted board, bottom action bar); the enemy closes in
  on your pieces, pawns race to promote; a celebration banner ends a battle.
- **Promotion** (#10): pawns on the far row promote (you pick; enemy becomes
  a queen) with a morph animation; the barracks sells a 3-gold pawn.
- **Next-square strikes** (#11): sliders must travel next to a target to hit it.
- **Tap to strike** (#13): tap an enemy to walk up and strike it; pick the
  square when there's more than one.
- **Knight leap** (`claude/knight-leap`): knight strikes cost 2 like the rest
  (jump + strike = a whole turn); knights flip over to strike and backflip
  home (animation only; `stage.lunge` in `App.tsx`).
- **Check** (`claude/check`): if the enemy's next turn could kill the king,
  End turn locks until he's safe (unless no escape exists); moves that would
  put him in check are blocked (red ✕). A fallen king
  gets a checkmate finale (zoom, crown flies off, CHECKMATE! banner).
- **Hideout hub** (#12): between battles the king walks a little
  village (`Hub.tsx`, `hub.css`): barracks (recruit, heal, several buys), road
  out; training grounds, armory, merchant and Grandmaster's Guild are
  placeholders to build out.
- Difficulty needs tuning from Wesley's play; encounter 2 now punishes
  letting a pawn promote.
- **Solver** (`src/game/solver.ts`, `docs/solver.md`): proves a position wins
  in N turns vs the patrol and counts distinct winning first-turn cores.
- Research: `reports/Simultaneous chess tactics design.md`; puzzle design
  (principles, taxonomy, 10 concepts, verification): `docs/puzzle-design.md`.

## History (merged PRs)
- #2 foundation pass; #3 research + lab Duel; #4–#5 simultaneous-engine rule
  changes (reach-based return hits, pass-through, order pool); #6 turn-based
  rebuild; #7 art pass; #8 strike in place; #9 phone layout + busier enemy;
  #10 promotion; #11 next-square strikes; #12 hideout hub; #13 tap to strike.

## Open items
- `exile-preview.yml` is redundant (`main` deploys). `prototype/familiar-opening`
  is unmerged, old engine.
- Phone landscape still gets the desktop layout (scrolls).
- The test player (`tests/turns-strategy.ts`) is a two-turn lookahead search, not a person.
- Enemy intent isn't shown before it acts.
- App debt: `App.tsx` is dense; modals lack Escape and a focus trap.
- Dead-end audit (Oct 11), fixes await Wesley's play: 0-damage pawn strikes,
  the battle-3 knight never striking, no turn limit (battle 2 has frozen pawn
  pairs), a king in check striking himself to death. No material draws.
