import { describe, expect, it } from "vitest";
import { ENERGY, approaches, attack, canDefend, defend, endTurn, maxHp, move, moveTargets, newRun, promote, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

// 4x4 board (encounter 0). White hops toward y = 0, black toward y = 3.
const king: Unit = { id: "king", side: "white", kind: "king", x: 0, y: 3, hp: 5 };
const grumble: Unit = { id: "g", side: "white", kind: "pawn", variant: "misfit", x: 2, y: 3, hp: 1 };
const rook: Unit = { id: "r", side: "black", kind: "rook", variant: "royal", x: 2, y: 2, hp: 5 };
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Grumble (misfit pawn): Hop", () => {
  it("hops two squares forward over an enemy for 2 energy, then strikes with the rest of the pool", () => {
    const low: Unit = { id: "p", side: "black", kind: "pawn", variant: "royal", x: 1, y: 0, hp: 1 };
    const g = board([king, grumble, rook, low]);
    // The rook on c2 blocks the step, not the hop.
    expect(moveTargets(g, grumble)).toEqual([{ x: 2, y: 1, cost: 2 }]);
    const before = JSON.stringify(g);
    const hopped = move(g, "g", { x: 2, y: 1 });
    expect(JSON.stringify(g)).toBe(before);
    expect(unit(hopped, "g")).toMatchObject({ x: 2, y: 1, moved: true });
    expect(hopped.energy).toBe(ENERGY - 2);
    expect(readRun(JSON.stringify(hopped))).toEqual(hopped);
    // Hop 2 + strike 2 is the whole pool, and tap-to-strike prices it that way.
    expect(approaches(g, "g", "p")).toEqual([{ x: 2, y: 1, cost: 4 }]);
    expect(attack(hopped, "g", "p").run.energy).toBe(0);
    // With nothing in the way both the step and the hop are offered.
    expect(moveTargets(board([king, grumble]), grumble)).toEqual([{ x: 2, y: 2, cost: 1 }, { x: 2, y: 1, cost: 2 }]);
  });

  it("vaults a wall, but needs an open landing square and 2 energy", () => {
    // A wall raised on c2 (Nobody's suit) is nothing to a hop.
    expect(moveTargets(board([king, grumble], { walls: [{ x: 2, y: 2 }] }), grumble)).toEqual([{ x: 2, y: 1, cost: 2 }]);
    // The toll gate's walls at d2 and d3 are two deep: from d1 the landing is itself a wall, so no hop.
    const gate = board([king, { ...grumble, x: 3, y: 3 }], { encounter: 1 });
    expect(moveTargets(gate, unit(gate, "g")!)).toEqual([]);
    // An occupied landing square blocks it, and so does a pool of 1; the plain step survives both.
    expect(moveTargets(board([king, grumble, { ...rook, y: 1 }]), grumble)).toEqual([{ x: 2, y: 2, cost: 1 }]);
    expect(moveTargets(board([king, grumble], { energy: 1 }), grumble)).toEqual([{ x: 2, y: 2, cost: 1 }]);
  });

  it("never defends", () => {
    const g = board([king, grumble, rook]);
    expect(canDefend(g, grumble)).toBe(false);
    expect(defend(g, "g")).toBe(g);
    expect(unit(defend(g, "king"), "king")!.defending).toBe(true);
  });

  it("a hop onto the far row promotes", () => {
    const g = board([king, { ...grumble, y: 2 }, { ...rook, y: 1 }]);
    const hopped = move(g, "g", { x: 2, y: 0 });
    expect(hopped.promoting).toBe("g");
    expect(unit(hopped, "g")).toMatchObject({ x: 2, y: 0, kind: "pawn" });
    expect(readRun(JSON.stringify(hopped))).toEqual(hopped);
    // Grumble always crowns a knight: no other choice is taken.
    for (const kind of ["queen", "rook", "bishop"] as const) expect(promote(hopped, "g", kind).run).toBe(hopped);
    // The cast carries through promotion: a misfit pawn crowned a knight is Nobody, at Nobody's HP.
    const { run } = promote(hopped, "g", "knight");
    expect(unit(run, "g")).toMatchObject({ kind: "knight", variant: "misfit", hp: maxHp({ side: "white", variant: "misfit", kind: "knight" }) });
    expect(run.promoting).toBeUndefined();
  });

  it("an enemy Grumble hops over your piece onto the far row and is crowned a knight (Nobody)", () => {
    const foe: Unit = { id: "e", side: "black", kind: "pawn", variant: "misfit", x: 2, y: 1, hp: 1 };
    const mine: Unit = { id: "r", side: "white", kind: "rook", variant: "rebel", x: 2, y: 2, hp: 5 };
    const g = board([king, mine, foe]);
    // The hop is in his move list, so kingThreat's step-in search would see it; but hop 2 + strike 2
    // outruns every enemy pool on the road today (2 or 3), so no board yet can show a hop as check.
    expect(moveTargets(g, foe, 2)).toEqual([{ x: 2, y: 3, cost: 2 }]);
    const { run, steps } = endTurn(g);
    expect(steps.map(s => s.kind)).toEqual(["move", "promote"]);
    expect(unit(run, "e")).toMatchObject({ x: 2, y: 3, kind: "knight", variant: "misfit", hp: 2 });
    expect(run.turn).toBe(2);
  });
});
