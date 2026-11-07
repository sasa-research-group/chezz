import { describe, expect, it } from "vitest";
import { attack, attackTargets, dealtTo, endTurn, inCheck, kingThreat, move, newRun, promote, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

const king: Unit = { id: "king", side: "white", kind: "king", x: 0, y: 3, hp: 5 };
// Your pawns here are Grumbles: Hop leaves the strike itself alone, unlike Pip's shove.
const pawn: Unit = { id: "p", side: "white", kind: "pawn", variant: "misfit", hp: 1, x: 2, y: 2 };
const wigness: Unit = { id: "w", side: "black", kind: "queen", variant: "royal", hp: 9, x: 1, y: 1 };
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Her Wigness (royal queen): Beneath Me", () => {
  it("never strikes a pawn, even one beside her, while a knight beside her is fair game", () => {
    const mine: Unit = { ...wigness, side: "white", x: 1, y: 2 };
    const theirs: Unit = { id: "e", side: "black", kind: "pawn", hp: 1, x: 0, y: 1 };
    const knight: Unit = { id: "n", side: "black", kind: "knight", hp: 3, x: 2, y: 2 };
    const g = board([king, mine, theirs, knight]);
    const before = JSON.stringify(g);
    expect(attackTargets(g, mine)).toEqual([{ x: 2, y: 2, cost: 2, id: "n" }]);
    expect(attack(g, "w", "e")).toEqual({ run: g, step: null });
    const { run, step } = attack(g, "w", "n");
    expect(JSON.stringify(g)).toBe(before);
    expect(step!.killed).toEqual(["n"]);
    expect(unit(run, "e")).toMatchObject({ hp: 1 });
  });

  it("takes 0 from a pawn and does not counter it even when braced, but counters a rook as any queen", () => {
    // Unbraced: nothing but her ability stands between the pawn's 1 and her hide.
    const bare = board([king, pawn, wigness]);
    expect(dealtTo(bare, pawn, wigness)).toBe(0);
    const jab = attack(bare, "p", "w");
    expect(jab.step!.damage).toEqual([{ id: "w", amount: 0 }]);
    expect(jab.step!.text).toBe("Your pawn strikes Enemy queen for 0.");
    expect(unit(jab.run, "w")).toMatchObject({ hp: 9 });
    // Braced: the block would have turned the 1 into 0 anyway; what matters is that she doesn't hit back.
    const rook: Unit = { id: "r", side: "white", kind: "rook", hp: 5, x: 1, y: 2 };
    const g = board([king, pawn, rook, { ...wigness, defending: true }]);
    const poke = attack(g, "p", "w");
    expect(poke.step!.damage).toEqual([{ id: "w", amount: 0 }]);
    expect(poke.step!.text).toBe("Your pawn strikes Enemy queen for 0.");
    expect(unit(poke.run, "w")).toMatchObject({ hp: 9 });
    expect(unit(poke.run, "p")).toMatchObject({ hp: 1 });
    // Her block still softens the rook's blow, and she hits back for 3.
    const blow = attack(g, "r", "w");
    expect(blow.step!.damage).toEqual([{ id: "w", amount: 2 }, { id: "r", amount: 3 }]);
    expect(unit(blow.run, "r")).toMatchObject({ hp: 2 });
  });

  it("threatens your king like any queen, and a pawn beside her is no shield", () => {
    const g = board([king, { ...wigness, x: 1, y: 2 }, { ...pawn, x: 0, y: 2 }]);
    expect(kingThreat(g)).toEqual({ damage: 3, attackers: ["w"] });
    expect(inCheck(g)).toBe(false);
    expect(attackTargets(g, unit(g, "w")!)).toEqual([{ x: 0, y: 3, cost: 2, id: "king" }]);
    expect(readRun(JSON.stringify(g))).toEqual(g);
  });

  it("notices a pawn the moment it promotes beside her", () => {
    const g = board([king, { ...pawn, x: 2, y: 1 }, { ...wigness, x: 3, y: 0 }]);
    expect(attackTargets(g, unit(g, "w")!)).toEqual([]);
    const moved = move(g, "p", { x: 2, y: 0 });
    expect(moved.promoting).toBe("p");
    expect(attackTargets(moved, unit(moved, "w")!)).toEqual([]);
    const { run } = promote(moved, "p", "knight");
    expect(unit(run, "p")).toMatchObject({ kind: "knight" });
    expect(attackTargets(run, unit(run, "w")!)).toEqual([{ x: 2, y: 0, cost: 2, id: "p" }]);
  });

  it("as an enemy, leaves your pawn alone even when it is the only piece in reach", () => {
    const g = board([king, { ...pawn, x: 2, y: 1 }, { ...wigness, x: 3, y: 2 }]);
    const before = JSON.stringify(g);
    const { run, steps } = endTurn(g);
    expect(JSON.stringify(g)).toBe(before);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every(s => s.kind !== "strike")).toBe(true);
    expect(unit(run, "p")).toMatchObject({ hp: 1, x: 2, y: 1 });
  });
});
