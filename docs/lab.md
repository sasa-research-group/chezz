# Chezz Lab

Small rule experiments, separate from the game. Play at `lab.html` next to the
game (locally: http://127.0.0.1:5173/lab.html). The plan behind them is the
experiment ladder in `reports/Simultaneous chess tactics design.md`.

## Experiment 1: the Duel (E0, E1, E2, E4)

One king against one. Both sides secretly pick, then reveal:

- **Strike:** deal your current HP as damage.
- **Guard:** stay put and hit back anyone who strikes you.
- **Sidestep:** strikes at you miss this turn.
- **Advance:** one step toward your gate. Reaching it wins.

Switches: combat rule (Always trade / Free hits), Guard strength, gate race
length, each side's HP, and whether each side may sidestep.

Guard strength:
- **As in game:** Always trade absorbs 1; both modes hit back.
- **Full block:** take nothing, hit back in full.
- **Off:** guarding is just standing still.

**Rules code.** `src/lab/duel.ts` is pure. Its single-turn damage matches the
real resolver in `exile.ts` for every pair of choices in both modes (E0,
`tests/duel.test.ts`). It assumes the two pieces stay engaged and ignores the
board.

**Enemy.** The enemy plays the optimal mixed strategy for the current state,
found by Shapley value iteration with an exact small matrix-game solver. Win
scores +1, loss −1, draw 0. A discount of 0.999 per turn makes endless
stalling count as a draw while still valuing a slow win almost fully.

**Feedback.** After each duel the player rates it from 1 (coin flip) to 5 (I
read them) and can add a note. The log is kept in `localStorage`
(`chezz.lab.v1`) and can be exported as JSON.

### What the solver says (before any human play)

All rows start at 3 v 3, Sidestep on for both sides. "Pure" means one move is
always right.

| Rule | Guard | Gate | What happens |
|---|---|---|---|
| Always trade | as in game | off | Pure Guard. Nobody attacks (draw). |
| Free hits | as in game | off | Pure Strike, then mutual destruction. |
| Always trade | as in game | 3 | Pure Advance. Fighting is irrelevant. |
| Free hits | as in game | 3 | Pure Strike at equal HP. |
| Free hits | full block | 3 | **Mixed: about 10% Strike, 45% Guard, 45% Advance.** |

Only Free hits with a Full block Guard and a reason to do something else
(the gate) produces real guessing at equal HP: about 10% Strike, 45% Guard and
45% Advance. That matches the report's prediction.

Unequal HP (3 v 2):
- **Gate off:** every unequal cell is pure. The weaker piece sidesteps or
  guards forever, and the duel stalls into a draw.
- **Gate on:** every unequal cell mixes, but in most modes the stronger side
  wins almost surely (value 0.9 to 1.0).
- **Exception:** Free hits with Full block stays close (0.38) and keeps all
  three of Strike, Guard and Advance in play.

The "Show the math" panel shows the full HP grid for the current rules.

### What to try

1. Play about 5 duels under the current game rules (Free hits, Guard "As in
   game", gate 3). Then play about 5 under Full block. Compare your ratings.
2. Turn the gate off and see whether duels feel solved.
3. Turn your Sidestep off. Does being cornered change how you play?
