import { describe, expect, it } from "vitest";
import { ENERGY, alt, altActions, attack, canEscape, endTurn, inCheck, kingThreat, move, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";
import { isHexed } from "../../src/game/status";

// Encounter 0: 4x4, no walls, enemy energy 2 (one strike per enemy turn). White moves toward y=0.
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, energy: ENERGY, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);
const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", hp: 5, x: 0, y: 3 };
const ash: Unit = { id: "ash", side: "white", kind: "bishop", variant: "rebel", hp: 3, x: 3, y: 3 };
// The queen sits two squares up Ash's diagonal: (3,3) -> (2,2) -> (1,1).
const queen: Unit = { id: "q", side: "black", kind: "queen", variant: "royal", hp: 9, x: 1, y: 1 };

describe("Brother Ash (rebel bishop): Hex", () => {
  it("hexes an enemy anywhere along a clear diagonal for 2 energy, dealing no damage", () => {
    const g = board([king, ash, queen]);
    const [hex] = altActions(g, unit(g, "ash")!);
    expect(hex).toMatchObject({ id: "hex", cost: 2, targets: [{ x: 1, y: 1 }] });
    const before = JSON.stringify(g);
    const { run, step } = alt(g, "ash", "hex", { x: 1, y: 1 });
    expect(JSON.stringify(g)).toBe(before);
    expect(run.energy).toBe(ENERGY - 2);
    expect(unit(run, "ash")!.acted).toBe(true);
    // Hexed through the enemy's turn 1: nextTurn(g, "black") is this turn's number.
    expect(unit(run, "q")).toMatchObject({ hp: 9, mods: { hexed: true, hexedUntil: g.turn } });
    expect(step).toMatchObject({ kind: "alt", actor: "ash", target: "q", focus: [{ x: 1, y: 1 }], damage: [], killed: [] });
    expect(step!.text).toContain("hexes");
    expect(readRun(JSON.stringify(run))).toEqual(run);
    // He may move first and hex after; the hex is not a strike, so his peck is still a normal 2-damage blow.
    const walked = move(g, "ash", { x: 2, y: 2 });
    expect(altActions(walked, unit(walked, "ash")!)[0]?.targets).toEqual([{ x: 1, y: 1 }]);
    expect(attack(walked, "ash", "q").run.units.find(u => u.id === "q")!.hp).toBe(7);
  });
  it("needs a clear diagonal: a piece in between blocks the eyes, and a piece on his file is safe", () => {
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", variant: "rebel", hp: 1, x: 2, y: 2 };
    const onFile: Unit = { id: "n", side: "black", kind: "knight", variant: "royal", hp: 3, x: 3, y: 0 };
    const blocked = board([king, ash, queen, pawn, onFile]);
    expect(altActions(blocked, unit(blocked, "ash")!)).toEqual([]);
    expect(alt(blocked, "ash", "hex", { x: 1, y: 1 })).toEqual({ run: blocked, step: null });
    // Lift the pawn: the queen is a target again, the knight on his file still is not.
    const clear = board([king, ash, queen, onFile]);
    expect(altActions(clear, unit(clear, "ash")!)[0].targets).toEqual([{ x: 1, y: 1 }]);
    expect(alt(clear, "ash", "hex", { x: 3, y: 0 })).toEqual({ run: clear, step: null });
  });
  it("refuses the hex when he cannot pay for it", () => {
    const g = board([king, ash, queen], { energy: 1 });
    expect(altActions(g, unit(g, "ash")!)).toEqual([]);
    expect(alt(g, "ash", "hex", { x: 1, y: 1 })).toEqual({ run: g, step: null });
  });
  it("makes the victim deal 1 less through the enemy turn, then wears off before its following turn", () => {
    // The queen stands next to your rook; the king is out of her reach (enemy energy 2: no walk-and-strike).
    const rook: Unit = { id: "r", side: "white", kind: "rook", variant: "rebel", hp: 5, x: 0, y: 2 };
    const g = alt(board([king, ash, queen, rook]), "ash", "hex", { x: 1, y: 1 }).run;
    const first = endTurn(g);
    expect(first.steps.map(s => s.damage)).toEqual([[{ id: "r", amount: 2 }]]);
    expect(unit(first.run, "r")!.hp).toBe(3);
    // During your turn 2 the mark is still written on her but no longer bites; her turn 2 clears it.
    expect(unit(first.run, "q")!.mods).toEqual({ hexed: true, hexedUntil: 1 });
    expect(isHexed(unit(first.run, "q")!, first.run.turn)).toBe(false);
    const second = endTurn(first.run);
    expect(second.steps.map(s => s.damage)).toEqual([[{ id: "r", amount: 3 }]]);
    expect(unit(second.run, "q")!.mods).toBeUndefined();
  });
  it("can lift check without touching a piece: the hex takes the lethal blow below the king's HP", () => {
    // Ash at (3,0) looks down to (2,1), (1,2): the queen, who stands on your 3-HP king.
    const threatened: Unit = { ...king, hp: 3 };
    const g = board([threatened, { ...ash, x: 3, y: 0 }, { ...queen, x: 1, y: 2 }]);
    expect(kingThreat(g)).toEqual({ damage: 3, attackers: ["q"] });
    expect(inCheck(g)).toBe(true);
    expect(canEscape(g)).toBe(true);
    expect(endTurn(g).run).toBe(g);
    const { run } = alt(g, "ash", "hex", { x: 1, y: 2 });
    expect(kingThreat(run)).toEqual({ damage: 2, attackers: ["q"] });
    expect(inCheck(run)).toBe(false);
    expect(endTurn(run).run).not.toBe(run);
  });
});
