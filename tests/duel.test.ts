import { describe, expect, it } from "vitest";
import { CHOICES, defaultSettings, options, resolve, solveDuel, solveMatrix, stateKey } from "../src/lab/duel";
import type { Choice, Rule, Settings } from "../src/lab/duel";
import { newRun, resolveTurn } from "../src/game/exile";
import type { Order, Run, Unit } from "../src/game/exile";

const close = (a: number[], b: number[]) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 4));

describe("matrix game solver", () => {
  it("solves rock-paper-scissors as a uniform mix worth 0", () => {
    const r = solveMatrix([[0, -1, 1], [1, 0, -1], [-1, 1, 0]]);
    expect(r.value).toBeCloseTo(0, 6); close(r.row, [1 / 3, 1 / 3, 1 / 3]); close(r.col, [1 / 3, 1 / 3, 1 / 3]);
  });
  it("solves an unbalanced guessing game", () => {
    const r = solveMatrix([[3, -1], [-1, 1]]);
    close(r.row, [1 / 3, 2 / 3]); close(r.col, [1 / 3, 2 / 3]); expect(r.value).toBeCloseTo(1 / 3, 6);
  });
  it("finds a pure saddle point", () => {
    const r = solveMatrix([[2, 3], [1, 0]]);
    close(r.row, [1, 0]); close(r.col, [1, 0]); expect(r.value).toBeCloseTo(2, 6);
  });
});

// E0: the duel's single-turn damage must match the real resolver in exile.ts.
const toMode = (rule: Rule) => (rule === "trade" ? "retaliation" : "ambush") as const;
function realTurn(rule: Rule, hp: [number, number], a: Choice, b: Choice) {
  const king: Unit = { id: "king", side: "white", kind: "king", hp: hp[0], x: 1, y: 2 };
  const foe: Unit = { id: "foe", side: "black", kind: "rook", hp: hp[1], x: 2, y: 2 };
  // A far-away pawn gives white a harmless order so an "advance" (no order) still resolves.
  const filler: Unit = { id: "filler", side: "white", kind: "pawn", hp: 1, x: 3, y: 1 };
  const order = (u: Unit, c: Choice, target: Unit, away: { x: number; y: number }): Order[] =>
    c === "strike" ? [{ unitId: u.id, to: { x: target.x, y: target.y } }] : c === "guard" ? [{ unitId: u.id, to: { x: u.x, y: u.y }, defend: true }] : c === "sidestep" ? [{ unitId: u.id, to: away }] : [];
  const g: Run = { ...newRun(toMode(rule)), units: [king, foe, filler] };
  const planned = [...order(king, a, foe, { x: 0, y: 2 }), { unitId: filler.id, to: { x: 3, y: 0 } }];
  const run = resolveTurn({ ...g, planned }, order(foe, b, king, { x: 3, y: 2 })).run;
  const hpOf = (id: string) => run.units.find(u => u.id === id)?.hp ?? 0;
  return [hpOf("king"), hpOf("foe")];
}

describe("duel resolution", () => {
  for (const rule of ["trade", "free"] as const)
    for (const a of CHOICES) for (const b of CHOICES) it(`matches exile.ts in ${rule}: ${a} vs ${b}`, () => {
      const settings: Settings = { ...defaultSettings, rule, guard: "current", goal: 3 };
      const hp: [number, number] = [3, 2];
      const next = resolve(settings, { hp, progress: [0, 0] }, a, b).state;
      expect(next.hp).toEqual(realTurn(rule, hp, a, b));
    });
  it("shield guard takes nothing and still returns a full hit", () => {
    const s: Settings = { ...defaultSettings, rule: "free", guard: "shield" };
    expect(resolve(s, { hp: [3, 2], progress: [0, 0] }, "strike", "guard").state.hp).toEqual([1, 2]);
  });
  it("advance builds progress toward the goal and wins on reaching it", () => {
    const s: Settings = { ...defaultSettings, goal: 2 };
    const r = resolve(s, { hp: [3, 3], progress: [1, 0] }, "advance", "guard");
    expect(r.state.progress).toEqual([2, 0]); expect(r.winner).toBe(0);
  });
  it("doesn't advance a piece that dies this turn", () => {
    const r = resolve({ ...defaultSettings, rule: "free" }, { hp: [3, 2], progress: [0, 0] }, "strike", "advance");
    expect(r.state.progress).toEqual([0, 0]); expect(r.text.join(" ")).not.toContain("advances"); expect(r.winner).toBe(0);
  });
  it("only offers sidestep to a side that can flee, and advance only with a goal", () => {
    const s: Settings = { ...defaultSettings, canFlee: [false, true], goal: 0 };
    expect(options(s, 0)).toEqual(["strike", "guard"]);
    expect(options(s, 1)).toEqual(["strike", "guard", "sidestep"]);
  });
});

describe("duel solver", () => {
  it("makes striking the only sensible choice in free hits when nobody can flee or advance", () => {
    const s: Settings = { ...defaultSettings, rule: "free", guard: "current", goal: 0, canFlee: [false, false] };
    const sol = solveDuel(s).get(stateKey({ hp: [3, 3], progress: [0, 0] }))!;
    expect(sol.mix[0][sol.options[0].indexOf("strike")]).toBeGreaterThan(0.99);
  });
  it("is symmetric: equal pieces with equal options are worth 0", () => {
    const sol = solveDuel(defaultSettings).get(stateKey({ hp: [3, 3], progress: [0, 0] }))!;
    expect(sol.value).toBeCloseTo(0, 4);
  });
  it("values a healthier piece above a weaker one", () => {
    const sol = solveDuel(defaultSettings);
    expect(sol.get(stateKey({ hp: [4, 2], progress: [0, 0] }))!.value).toBeGreaterThan(0);
  });
});
