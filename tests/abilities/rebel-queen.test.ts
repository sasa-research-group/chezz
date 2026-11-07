import { describe, expect, it } from "vitest";
import { attack, attackTargets, defend, endTurn, kingThreat, moveTargets, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

const king: Unit = { id: "king", side: "white", kind: "king", x: 0, y: 3, hp: 5 };
const skillet: Unit = { id: "s", side: "white", kind: "queen", variant: "rebel", hp: 9, x: 1, y: 1 };
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Mother Skillet (rebel queen): Clang", () => {
  // 4x4, enemy pool 2. The rook stands diagonal to Skillet (a rook can't hit back) and straight
  // above your pawn, so it can still strike while dazed.
  const rook: Unit = { id: "r", side: "black", kind: "rook", hp: 5, x: 2, y: 2 };
  const pawn: Unit = { id: "p", side: "white", kind: "pawn", hp: 1, x: 2, y: 3 };

  it("hits for 2 and dazes the survivor: no moves on its next turn, but it may still strike", () => {
    const g = board([king, skillet, rook, pawn]);
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "s", "r");
    expect(JSON.stringify(g)).toBe(before);
    expect(step!.damage).toEqual([{ id: "r", amount: 2 }]);
    // Struck on your turn 1, the daze lasts through the enemy's turn 1.
    expect(unit(run, "r")).toMatchObject({ hp: 3, mods: { dazed: true, dazedUntil: 1 } });
    expect(run.log[0]).toBe("Enemy rook is dazed by the clang.");
    expect(readRun(JSON.stringify(run))).toEqual(run);
    // As the enemy sees it on its turn: nowhere to go, but the pawn is still in reach.
    expect(moveTargets(run, unit(run, "r")!, 2)).toEqual([]);
    expect(attackTargets(run, unit(run, "r")!)).toEqual([{ x: 2, y: 3, cost: 2, id: "p" }]);
    const { run: t2, steps } = endTurn(run);
    expect(steps.map(s => `${s.kind}:${s.actor}`)).toEqual(["strike:r"]);
    expect(unit(t2, "p")).toBeUndefined();
    expect(unit(t2, "r")).toMatchObject({ x: 2, y: 2, hp: 3 });
  });

  it("wears off when the dazed piece's following turn starts", () => {
    const { run } = attack(board([king, skillet, rook, pawn]), "s", "r");
    const t2 = endTurn(run).run;
    // Your turn 2: the mod is still on the rook, but it no longer bites once turn 2 is the enemy's
    // (the enemy turn clears moved/acted before asking, so ask the same way).
    expect(t2.turn).toBe(2);
    expect(unit(t2, "r")!.mods).toEqual({ dazed: true, dazedUntil: 1 });
    expect(moveTargets(t2, { ...unit(t2, "r")!, moved: false, acted: false }, 2).length).toBeGreaterThan(0);
    const { run: t3, steps } = endTurn(t2);
    expect(steps.some(s => s.kind === "move" && s.actor === "r")).toBe(true);
    expect(unit(t3, "r")!.mods).toBeUndefined();
  });

  it("leaves nothing behind on a piece the blow kills", () => {
    const knight: Unit = { id: "n", side: "black", kind: "knight", hp: 2, x: 2, y: 2 };
    const { run, step } = attack(board([king, skillet, knight, { ...pawn, x: 3, y: 3 }]), "s", "n");
    expect(step!.killed).toEqual(["n"]);
    expect(unit(run, "n")).toBeUndefined();
    expect(run.units.every(u => !u.mods)).toBe(true);
    expect(run.log.some(l => l.includes("dazed"))).toBe(false);
  });

  it("lifts a step-in threat on your king, while a dazed piece already in reach still counts", () => {
    // 6x4, enemy pool 3: the rook at a3 could step to a2 (1) and strike the king at a1 (2).
    const stepper: Unit = { ...rook, x: 0, y: 1 };
    const g = board([king, skillet, stepper], { encounter: 1 });
    expect(kingThreat(g)).toEqual({ damage: 3, attackers: ["r"] });
    const { run } = attack(g, "s", "r");
    expect(unit(run, "r")).toMatchObject({ hp: 3, mods: { dazed: true, dazedUntil: 1 } });
    expect(kingThreat(run)).toEqual({ damage: 0, attackers: [] });
    // Dazed pieces strike where they stand: one already beside the king is still a threat.
    const beside = board([king, skillet, { ...rook, x: 0, y: 2, mods: { dazed: true, dazedUntil: 1 } }], { encounter: 1 });
    expect(kingThreat(beside)).toEqual({ damage: 3, attackers: ["r"] });
  });

  it("dazes your piece for your whole next turn when an enemy Skillet lands the blow", () => {
    const mine: Unit = { id: "r", side: "white", kind: "rook", hp: 5, x: 2, y: 1 };
    const hers: Unit = { id: "q", side: "black", kind: "queen", variant: "rebel", hp: 9, x: 2, y: 2 };
    const g = board([king, mine, hers]);
    const before = JSON.stringify(g);
    const { run, steps } = endTurn(g);
    expect(JSON.stringify(g)).toBe(before);
    expect(steps.map(s => `${s.kind}:${s.actor}`)).toEqual(["strike:q"]);
    expect(steps[0].damage).toEqual([{ id: "r", amount: 2 }]);
    // Struck during the enemy's turn 1, the daze lasts through your turn 2.
    expect(run.turn).toBe(2);
    expect(unit(run, "r")).toMatchObject({ hp: 3, mods: { dazed: true, dazedUntil: 2 } });
    expect(moveTargets(run, unit(run, "r")!)).toEqual([]);
    expect(attackTargets(run, unit(run, "r")!)).toEqual([{ x: 2, y: 2, cost: 2, id: "q" }]);
    expect(unit(defend(run, "r"), "r")).toMatchObject({ defending: true });
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
});
