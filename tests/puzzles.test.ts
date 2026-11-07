import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUZZLES, startPuzzle, readRun } from "../src/game/turns";
import { lineToText, solve } from "../src/game/solver";

/** Every Guild puzzle must have a forced win within its turn limit against the enemy AI (the solver
 * searches exhaustively when tiles or abilities are in play). The intended line is printed so the
 * docs can quote it. */
describe("Guild puzzles", () => {
  for (const [i, e] of PUZZLES.entries()) {
    it(`${e.title}: forced win in ${e.turns} turn(s)`, () => {
      const start = startPuzzle(i);
      expect(readRun(JSON.stringify(start))).not.toBeNull();
      const r = solve(start, { maxTurns: e.turns!, nodeBudget: Number(process.env.PUZZLE_NODES ?? 60_000) });
      if (!r.won) throw new Error(`${e.title}: ${r.reason} after ${r.nodes} nodes`);
      const report = `${e.title} (${r.turns} turns, ${r.winningFirstMoves} winning first move(s)${r.countComplete ? "" : ", count cut short by the budget"}, ${r.nodes} nodes):\n  ` + lineToText(start, r.line).join("\n  ");
      if (process.env.PUZZLE_LOG) appendFileSync(process.env.PUZZLE_LOG, report + "\n");
      expect(r.turns).toBeLessThanOrEqual(e.turns!);
    }, 600_000);
  }
});
