# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`): you act,
  then the enemy; 4 energy per turn for moves (1/square), strikes (2, next
  square only, so sliders travel first) and defend (1); check and checkmate;
  tap-to-strike; hideout hub between battles (`Hub.tsx`). The simultaneous
  engine (`exile.ts`) stays for the lab Duel.
- **Casts and abilities** (`claude/variants`): every piece belongs to a cast
  (rebel / royal / misfit, Wesley's character-select sheet, sliced to
  `public/art/cast/*.png`, drawn by `PieceSprite.tsx`). One ability per
  cast and kind, 18 in all, one file each under `src/game/abilities/` with a
  test each under `tests/abilities/`; spec, downsides and puzzle hooks in
  `docs/variants.md`. Hooks are pure functions the rules call (reach, cost,
  damage, splash, bodyguards, counters, death, turn start/end, alt actions).
  Only a piece with a named cast has an ability: the road's old patrol stays
  plain. Statuses (dazed, hexed, burning) live in `unit.mods`
  (`src/game/status.ts`); a burning king counts toward check.
- **Alt actions** (hex, honk, demolish, dub) replace the strike; the sidebar
  offers them as buttons, targeted ones highlight squares.
- **Tiles** (`src/game/board.ts`, `settle()`): pits, crumbling bridges,
  burrows, ice, gates and levers; every move, shove and roll-on resolves
  through the same helper. Drawn in `App.tsx` / `exile.css`.
- **Guild puzzles** (`PUZZLES` in `src/game/encounters.ts`): fixed army,
  turn limit, win by felling the king or clearing the board; the hub's
  Grandmaster's Guild lists them; `tests/puzzles.test.ts` proves each with
  the solver (`src/game/solver.ts`, now exhaustive whenever tiles or
  abilities are in play and aware of alt actions).
- **Studio** (`art.html` → `src/art/`): art catalog, mechanics, style guide,
  tooling; add new art there.
- **Solver** (`docs/solver.md`): forced wins in N turns, distinct cores.
- Research: `reports/Simultaneous chess tactics design.md`,
  `docs/puzzle-design.md` (principles, taxonomy, 10 concepts).

## History (merged PRs)
#2 foundation; #3 research + lab; #4–#5 simultaneous rules; #6 turn-based;
#7 art; #8 strike in place; #9 phone layout; #10 promotion; #11 next-square
strikes; #12 hub; #13 tap to strike; #14 knight stunt; #15 strike markers;
#16 old prototype removed; #17 armory; #18 check/checkmate; #19 tap judged
as one move + defend chip; #20 handoff audit.

## Open items (Wesley's calls, see docs/variants.md "Open design questions")
- Stall clock shipped (tire after 3 quiet turns, retreat after 8). Grumble always crowns a knight; enemy royal pawns crown Her
  Wigness. Still open: Nobody's suit toppled vs timed;
  modelling an enemy Marmalade's wake-up nudge in check.
- The enemy AI takes no alt actions and has no per-ability scoring.
- Known gaps: a Sir Lance that moved then braced counters for 3; shoves
  resolve after counters (a braced piece hits back before it is shoved).
- Road encounters name no cast yet; the first battles could use royals once
  balance is replayed.
- App debt: `App.tsx` is dense; modals lack Escape and a focus trap; phone
  landscape scrolls; enemy intent isn't shown before it acts.
