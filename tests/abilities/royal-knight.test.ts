import { describe, expect, it } from "vitest";
import { ENERGY, approaches, attack, attackTargets, defend, endTurn, inCheck, kingThreat, move, moveTargets, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";
import { abilityOf } from "../../src/game/abilities";

// 4x4 board (encounter 0) unless a test says otherwise; coordinates below use the a1 = (0,3) file/rank names.
const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", x: 0, y: 3, hp: 5 };
const lance: Unit = { id: "l", side: "white", kind: "knight", variant: "royal", x: 1, y: 3, hp: 3 };
const rook: Unit = { id: "r", side: "black", kind: "rook", variant: "misfit", x: 0, y: 0, hp: 5 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Sir Lance (royal knight): Charge", () => {
  it("jump then charge: the strike costs 1 and deals 3", () => {
    const g = board([king, lance, rook]);
    expect(abilityOf(lance)?.ability).toBe("Charge");
    const before = JSON.stringify(g);
    // Tap-to-strike on the rook at a4 prices the way in at jump 2 + charge 1.
    expect(approaches(g, "l", "r")).toEqual([{ x: 2, y: 1, cost: 3 }]);
    const jumped = move(g, "l", { x: 2, y: 1 });
    expect(jumped.energy).toBe(ENERGY - 2);
    expect(attackTargets(jumped, unit(jumped, "l")!)).toEqual([{ x: 0, y: 0, cost: 1, id: "r" }]);
    const { run, step } = attack(jumped, "l", "r");
    expect(run.energy).toBe(ENERGY - 3);
    expect(unit(run, "r")!.hp).toBe(5 - 3);
    expect(step!.damage).toEqual([{ id: "r", amount: 3 }]);
    expect(JSON.stringify(g)).toBe(before);
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });

  it("from a standstill the strike costs the usual 2 and deals only 1", () => {
    const parked: Unit = { ...lance, x: 2, y: 1 };
    const g = board([king, parked, rook]);
    expect(attackTargets(g, parked)).toEqual([{ x: 0, y: 0, cost: 2, id: "r" }]);
    expect(attackTargets({ ...g, energy: 1 }, parked)).toEqual([]);
    const { run, step } = attack(g, "l", "r");
    expect(run.energy).toBe(ENERGY - 2);
    expect(unit(run, "r")!.hp).toBe(5 - 1);
    expect(step!.damage).toEqual([{ id: "r", amount: 1 }]);
    // The knight's reach is unchanged: the same L's as any knight.
    expect(moveTargets(g, parked).map(t => `${t.x},${t.y}:${t.cost}`).sort()).toEqual(["0,2:2", "1,3:2", "3,3:2"]);
  });

  it("a braced Lance who hasn't moved counters for 1", () => {
    // An enemy Dobbin on c3 strikes your braced Lance on b1 for 2 (1 after the block); the counter is a standing poke.
    const braced: Unit = { ...lance, defending: true, acted: true };
    const enemy: Unit = { id: "n", side: "black", kind: "knight", variant: "rebel", x: 2, y: 1, hp: 3 };
    const { run, steps } = endTurn(board([king, braced, enemy]));
    expect(steps.map(s => s.text)).toEqual(["Enemy knight strikes Your knight for 1. Your knight counters for 1."]);
    expect(unit(run, "l")!.hp).toBe(2);
    expect(unit(run, "n")!.hp).toBe(2);
  });

  it("a Lance who jumped and then braced still counters for 1: the lance needs a run-up, not a stance", () => {
    // Your Lance jumps d1 -> c3 (2) and braces (1); the enemy Nobody on a4 strikes him for 2 (1 after the block).
    const far: Unit = { ...lance, x: 3, y: 3 };
    const enemy: Unit = { id: "n", side: "black", kind: "knight", variant: "misfit", x: 0, y: 0, hp: 2 };
    const braced = defend(move(board([king, far, enemy]), "l", { x: 2, y: 1 }), "l");
    expect(unit(braced, "l")).toMatchObject({ x: 2, y: 1, moved: true, defending: true });
    const { run, steps } = endTurn(braced);
    expect(steps.map(s => s.text)).toEqual(["Enemy knight strikes Your knight for 1. Your knight counters for 1."]);
    expect(unit(run, "l")!.hp).toBe(2);
    expect(unit(run, "n")!.hp).toBe(1);
  });

  it("an enemy Lance that jumped last turn is a plodder this turn: his stale `moved` flag is not a charge", () => {
    // 6x4 board. The enemy Lance on f4 closes in on your king on b4, landing on e2 with its last jump of the turn.
    const k: Unit = { ...king, x: 1, y: 0, hp: 3 };
    const enemy: Unit = { id: "n", side: "black", kind: "knight", variant: "royal", x: 5, y: 0, hp: 3 };
    const { run } = endTurn(board([k, enemy], { encounter: 1 }));
    expect(unit(run, "n")).toMatchObject({ x: 4, y: 2, moved: true });
    // Your king steps to c3, in his knight reach. Standing still he strikes for 1 at cost 2, so this is no check:
    // the step is allowed and the threat reads 1, not the 3 his leftover flag would suggest.
    const stepped = move(run, "king", { x: 2, y: 1 });
    expect(unit(stepped, "king")).toMatchObject({ x: 2, y: 1 });
    expect(kingThreat(stepped)).toEqual({ damage: 1, attackers: ["n"] });
    expect(inCheck(stepped)).toBe(false);
    // And the real enemy turn agrees: a standing poke for 1.
    const next = endTurn(stepped);
    expect(next.steps.map(s => s.text)).toEqual(["Enemy knight strikes Your king for 1."]);
    expect(unit(next.run, "king")!.hp).toBe(2);
  });

  it("kingThreat: every landing square that sees your king counts 3, a parked Lance counts 1", () => {
    // 6x4 board, enemy pool 3. An enemy Lance on e2 can jump to c3 (2) and charge your king on b1 (1).
    const k: Unit = { ...king, x: 1, y: 3 };
    const enemy: Unit = { id: "n", side: "black", kind: "knight", variant: "royal", x: 4, y: 2, hp: 3 };
    const g = board([k, enemy], { encounter: 1 });
    expect(kingThreat(g)).toEqual({ damage: 3, attackers: ["n"] });
    expect(inCheck({ ...g, units: [{ ...k, hp: 3 }, enemy] })).toBe(true);
    // Parked on c3 already, he is a 1-damage plodder.
    expect(kingThreat({ ...g, units: [k, { ...enemy, x: 2, y: 1 }] })).toEqual({ damage: 1, attackers: ["n"] });
    // Deny the landing square (your pawn on c3) and nothing is left.
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", variant: "rebel", x: 2, y: 1, hp: 1 };
    expect(kingThreat({ ...g, units: [k, enemy, pawn] })).toEqual({ damage: 0, attackers: [] });
  });

  it("the enemy Lance lines up a charge: jump then strike for 3 with its whole pool", () => {
    const k: Unit = { ...king, x: 1, y: 3 };
    const enemy: Unit = { id: "n", side: "black", kind: "knight", variant: "royal", x: 4, y: 2, hp: 3 };
    const g = board([k, enemy], { encounter: 1 });
    const before = JSON.stringify(g);
    const { run, steps, spent } = endTurn(g);
    expect(JSON.stringify(g)).toBe(before);
    expect(steps.map(s => s.kind)).toEqual(["move", "strike"]);
    expect(steps[1].damage).toEqual([{ id: "king", amount: 3 }]);
    expect(unit(run, "n")).toMatchObject({ x: 2, y: 1 });
    expect(unit(run, "king")!.hp).toBe(5 - 3);
    expect(spent).toBe(3);
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
});
