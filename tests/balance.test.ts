import { describe, expect, it } from "vitest";
import { ENCOUNTERS, HP, buy, endTurn, leaveCamp, newRun, startAt } from "../src/game/turns";
import type { Kind, Run } from "../src/game/turns";
import { typicalArmy } from "../src/game/levels";
import { playTurn } from "./turns-strategy";

// Balance readout from the search player. It logs what a run looks like rather than pinning it:
// the player is a short search, so its results are a floor on what a person manages, not a target.

const TURN_LIMIT = 30;
type Result = { phase: Run["phase"]; turns: number; left: string };
const army = (g: Run) => g.units.filter(u => u.side === "white").map(u => `${u.kind}${u.hp}/${HP[u.kind]}`).join(" ") || "none";

function playBattle(g: Run): { run: Run; result: Result } {
  const start = g.encounter;
  let turns = 0;
  while (g.phase === "player" && g.encounter === start && turns++ < TURN_LIMIT) {
    g = playTurn(g);
    if (g.phase === "player") g = endTurn(g).run;
  }
  return { run: g, result: { phase: g.phase === "player" ? "player" : g.phase, turns, left: army(g) } };
}

/** A whole run: `shop` picks what to buy at each hideout. */
function playRun(shop: (g: Run) => Run): Result[] {
  let g = newRun();
  const results: Result[] = [];
  while (g.phase === "player") {
    const { run, result } = playBattle(g);
    results.push(result);
    if (run.phase !== "camp") break;
    g = leaveCamp(shop(run));
  }
  return results;
}
const show = (name: string, rs: Result[]) => console.log(`${name}\n${rs.map((r, i) => `  battle ${i + 1}: ${r.phase === "player" ? "stalled" : r.phase} in ${r.turns} turns, left ${r.left}`).join("\n")}`);

describe("balance readout", () => {
  it("plays each battle with its typical army", () => {
    const rs = ENCOUNTERS.map((_, i) => playBattle(startAt(i, typicalArmy(ENCOUNTERS, i), 0)).result);
    show(`Typical armies: ${ENCOUNTERS.map((_, i) => typicalArmy(ENCOUNTERS, i).join("+")).join(", ")}`, rs);
    expect(rs).toHaveLength(ENCOUNTERS.length);
  });
  it("plays each battle with a lone king", () => {
    const rs = ENCOUNTERS.map((_, i) => playBattle(startAt(i, ["king"] as Kind[], 0)).result);
    show("Lone king, battle by battle", rs);
    expect(rs).toHaveLength(ENCOUNTERS.length);
  });
  it("plays the whole run, buying a rook and then healing with what's left", () => {
    const rs = playRun(g => {
      let next = buy(g, "rook");
      for (let n = 0; n < 3; n++) next = buy(next, "heal");
      return next;
    });
    show("Whole run, buying a rook then healing", rs);
    expect(rs.length).toBeGreaterThan(0);
  });
  it("plays the whole run with a lone king who never recruits", () => {
    const rs = playRun(g => g);
    show("Whole run, lone king", rs);
    expect(rs.length).toBeGreaterThan(0);
  });
});
