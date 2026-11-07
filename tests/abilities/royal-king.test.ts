import { describe, expect, it } from "vitest";
import { attack, attackTargets, endTurn, kingThreat, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

// King Gilt (royal king): Bodyguards. A blow aimed at him lands on an adjacent friend the striker could
// also reach; he himself deals 1.
const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", hp: 5, x: 0, y: 3 };
const gilt: Unit = { id: "gilt", side: "black", kind: "king", variant: "royal", hp: 5, x: 2, y: 1 };
const mine = (id: string, kind: Unit["kind"], x: number, y: number, hp: number, variant: Unit["variant"] = "rebel"): Unit => ({ id, side: "white", kind, variant, hp, x, y });
// Gilt's guards are bystanders whose casts never act here: Pip (rebel pawn) and Dobbin (rebel knight) have
// hooks only for their own moves and strikes, Haystack (misfit rook, the braced guard) only for its own kill.
const guard = (id: string, kind: Unit["kind"], x: number, y: number, hp: number, extra: Partial<Unit> = {}): Unit => ({ id, side: "black", kind, variant: "rebel", hp, x, y, ...extra });
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("King Gilt (royal king): Bodyguards", () => {
  it("hands a rook's blow to the adjacent pawn the rook could also reach, and takes 0 himself", () => {
    // Rook on c2 strikes Gilt on c1; the pawn on b2 is beside Gilt and a straight step from the rook.
    const g = board([king, mine("r", "rook", 2, 2, 5), gilt, guard("bp", "pawn", 1, 2, 1)]);
    expect(attackTargets(g, unit(g, "r")!)).toEqual(expect.arrayContaining([{ x: 2, y: 1, cost: 2, id: "gilt" }, { x: 1, y: 2, cost: 2, id: "bp" }]));
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "r", "gilt");
    expect(JSON.stringify(g)).toBe(before);
    expect(unit(run, "gilt")!.hp).toBe(5);
    expect(unit(run, "bp")).toBeUndefined();
    expect(step).toMatchObject({ kind: "strike", actor: "r", target: "bp", focus: [{ x: 1, y: 2 }], damage: [{ id: "bp", amount: 3 }], killed: ["bp"] });
    expect(step!.text).toMatch(/^Enemy pawn takes the blow meant for Enemy king\. /);
    expect(run.log[0]).toBe(step!.text);
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("is hit when no neighbour is within the striker's reach: geometry of reach", () => {
    // Bishop on b2 reaches Gilt diagonally. The pawn on c2 is beside Gilt but a straight step from the
    // bishop; the pawn on c3 is on the bishop's diagonal but not beside Gilt. Neither guards him.
    const g = board([king, mine("b", "bishop", 1, 2, 3), gilt, guard("near", "pawn", 2, 2, 1), guard("far", "pawn", 2, 3, 1)]);
    const { run, step } = attack(g, "b", "gilt");
    expect(unit(run, "gilt")!.hp).toBe(3);
    expect(unit(run, "near")!.hp).toBe(1);
    expect(unit(run, "far")!.hp).toBe(1);
    expect(step).toMatchObject({ target: "gilt", damage: [{ id: "gilt", amount: 2 }], killed: [] });
    expect(step!.text).not.toContain("meant for");
  });
  it("picks the guard with the most HP (ties: lowest id), whose own brace and counter apply", () => {
    // Two guards in the rook's reach: the braced Haystack on b2 (5 HP) outranks the pawn on d2.
    const g = board([king, mine("r", "rook", 2, 2, 5), { ...gilt, defending: true }, guard("g1", "rook", 1, 2, 5, { variant: "misfit", defending: true }), guard("g2", "pawn", 3, 2, 1)]);
    const { run, step } = attack(g, "r", "gilt");
    expect(unit(run, "g1")!.hp).toBe(5 - (3 - 1));
    expect(unit(run, "g2")!.hp).toBe(1);
    expect(unit(run, "gilt")!.hp).toBe(5);
    // The guard counters as if it were the target; Gilt, braced or not, never counters for it.
    expect(unit(run, "r")!.hp).toBe(5 - 3);
    expect(step!.damage).toEqual([{ id: "g1", amount: 2 }, { id: "r", amount: 3 }]);
    expect(step!.text).toContain("Enemy rook counters for 3");
    // Equal HP: the lowest id stands in.
    const tie = board([king, mine("r", "rook", 2, 2, 5), gilt, guard("b", "pawn", 1, 2, 1), guard("a", "pawn", 3, 2, 1)]);
    expect(attack(tie, "r", "gilt").step).toMatchObject({ target: "a", killed: ["a"] });
  });
  it("lets a Haystack eat the guard it killed and roll onto the guard's square", () => {
    const g = board([king, mine("h", "rook", 2, 2, 5, "misfit"), gilt, guard("n", "knight", 1, 2, 3)]);
    const { run, step } = attack(g, "h", "gilt");
    expect(unit(run, "n")).toBeUndefined();
    expect(unit(run, "gilt")!.hp).toBe(5);
    expect(unit(run, "h")).toMatchObject({ x: 1, y: 2, acted: true, mods: { absorbed: "knight", absorbedUntil: g.turn + 2 } });
    expect(step).toMatchObject({ target: "n", killed: ["n"], focus: [{ x: 1, y: 2 }] });
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("only ever strikes for 1, in check arithmetic and on the board", () => {
    const g = board([{ ...king, x: 1, y: 1 }, { ...gilt, x: 2, y: 2 }]);
    expect(kingThreat(g)).toEqual({ damage: 1, attackers: ["gilt"] });
    const { run, steps } = endTurn(g);
    expect(steps[0]).toMatchObject({ kind: "strike", actor: "gilt", target: "king", damage: [{ id: "king", amount: 1 }] });
    expect(unit(run, "king")!.hp).toBe(4);
  });
});
