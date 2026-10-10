# Handoff

## State
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Turn-based rebuild** (`claude/turn-based`): you act, then the enemy acts,
  with 4 energy per turn for moves (1/square), strikes (distance + 1) and
  defend (1); fixed damage; see `docs/turn-based.md`. Replaces the
  simultaneous engine in the app; `exile.ts` stays for the lab Duel.
- Encounters are too easy under the new rules (bot wins with the king near
  full HP). Next: enemy and energy tuning from Wesley's play.
- Research report: `reports/Simultaneous chess tactics design.md`. Lab: Duel.

## Earlier: pass-through and order pool (PR #5, simultaneous engine)
- Sliders pass through enemies stepping into their path, striking each in
  order, and fall where return hits kill them (replaces stop-at-the-piece).
- Each battle has an order pool (6/10/18). Running out with enemies left
  ends the run; unused orders become gold. Old saves get a full pool.

## Threat rules (PR #4, merged)
From Wesley's playtest:
- A piece hits back only if it could legally attack the attacker's square.
  So pawns hit back only diagonally, and knights and bishops can hit and run.
- A slider is stopped by an enemy stepping onto its path, and strikes it there.

## Foundation pass (PR #2, merged)
- **Fixed dodge bug in `resolveTurn`:** if a target's own move failed, its
  attacker used to enter the vacated square for no damage, then bounce back.
  The log also said the target "moves away". Damage and moves now run inside
  `settle()`. Targets whose dodge failed are marked stuck and the turn
  re-settles. Each pass pins only the failures that don't depend on another
  failure, so a piece that really leaves is never hit.
- **Kingless boards:** `enemyOrders` returns `[]` instead of throwing.
  `resolveTurn(g, black?)` computes enemy orders only after the early return.
  `readRun` now rejects a kingless save that isn't in defeat, and any
  non-integer unit x/y.
- **Replaced the hard-coded king max HP of 5 with `HP.king`** in the app and
  in the rules.
- **Playwright:** `PLAYWRIGHT_CHROMIUM_PATH` sets the browser executable.
- **Docs:** README, meta description, exile-run (stuck-target rule, deploy
  note), art-direction status, plus this file and `CLAUDE.md`.
- **Tests:** 59 vitest and 4 e2e, all green.

## Open items
- Removing the dead prototype code is waiting on Mark. Its three vitest suites
  would go with it.
- `readRun` still accepts any `planned` orders. A save with a ghost `unitId`
  makes Resolve throw, and an illegal order teleports a piece. Fix: drop orders
  that `plan()` wouldn't accept.
- `exile-preview.yml` is redundant now that `main` deploys. Delete it.
- `prototype/familiar-opening` is unmerged and still on the old engine.
- Test gaps:
  - Longer collision chains.
  - `readRun` negatives (bad mode, phase, HP, out-of-bounds).
  - Rook recruit.
  - `campReason` branches.
  - The full-run test bot sees enemy orders, so it's stronger than a real player.
- App debt:
  - `App.tsx` is dense.
  - There's an empty header feedback export.
  - Modals lack Escape and a focus trap.
  - The Between Worlds dev lab was lost.

## Next
The design conversation on **Always trade vs Free hits**: which combat model to
keep, or what hybrid. Use playtest exports from both modes.
