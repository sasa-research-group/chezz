import { describe, expect, it } from "vitest";
import { ENERGY, attack, attackTargets, defend, endTurn, inCheck, newRun, readRun, strikeExposesKing } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

// Encounter 0: 4x4, no walls, enemy energy 2. White moves toward y=0.
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, energy: ENERGY, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);
const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", hp: 5, x: 0, y: 3 };
const lens: Unit = { id: "lens", side: "black", kind: "bishop", variant: "royal", hp: 3, x: 2, y: 1 };

describe("Bishop Lens (royal bishop): Foresight", () => {
  it("counters a diagonal striker for 2 without bracing", () => {
    const bishop: Unit = { id: "b", side: "white", kind: "bishop", variant: "rebel", hp: 3, x: 1, y: 2 };
    const g = board([king, bishop, lens]);
    expect(unit(g, "lens")!.defending).toBeUndefined();
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "b", "lens");
    expect(JSON.stringify(g)).toBe(before);
    expect(unit(run, "lens")!.hp).toBe(1);
    expect(unit(run, "b")!.hp).toBe(1);
    expect(step!.damage).toEqual([{ id: "lens", amount: 2 }, { id: "b", amount: 2 }]);
    expect(step!.text).toContain("Enemy bishop counters for 2");
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("sees only diagonally: a blow from a rank or file draws no counter", () => {
    // Your king steps up to strike him from straight below; he survives at 1 and just blinks.
    const straight = board([{ ...king, x: 2, y: 2 }, lens]);
    const byKing = attack(straight, "king", "lens");
    expect(unit(byKing.run, "lens")!.hp).toBe(1);
    expect(unit(byKing.run, "king")!.hp).toBe(5);
    expect(byKing.step!.damage).toEqual([{ id: "lens", amount: 2 }]);
    expect(byKing.step!.text).not.toContain("counters");
    // A rook from the side fells him outright, and nothing comes back.
    const rook: Unit = { id: "r", side: "white", kind: "rook", variant: "rebel", hp: 5, x: 3, y: 1 };
    const byRook = attack(board([king, rook, lens]), "r", "lens");
    expect(unit(byRook.run, "lens")).toBeUndefined();
    expect(byRook.step!.damage).toEqual([{ id: "lens", amount: 3 }]);
    expect(unit(byRook.run, "r")!.hp).toBe(5);
  });
  it("never braces: defend() refuses him", () => {
    const mine: Unit = { ...lens, id: "L", side: "white", x: 2, y: 2 };
    const g = board([king, mine, { id: "e", side: "black", kind: "pawn", variant: "royal", hp: 1, x: 3, y: 0 }]);
    expect(defend(g, "L")).toBe(g);
    expect(unit(g, "L")!.defending).toBeUndefined();
  });
  it("the enemy AI does not brace him even when a brace is all that would save him", () => {
    // Hemmed in at a1 by his own pawn (dazed, with nothing of yours in its reach, so it has no play),
    // with your rook on his file: an ordinary bishop braces, Lens does not.
    const hemmed: Unit = { ...lens, x: 0, y: 0 };
    const guard: Unit = { id: "gp", side: "black", kind: "pawn", variant: "royal", hp: 1, x: 1, y: 1, mods: { dazed: true, dazedUntil: 9 } };
    const rook: Unit = { id: "r", side: "white", kind: "rook", variant: "rebel", hp: 5, x: 0, y: 1 };
    const g = board([{ ...king, x: 3, y: 3 }, rook, hemmed, guard]);
    const control = endTurn({ ...g, units: g.units.map(u => (u.id === "lens" ? { ...u, variant: "rebel" as const } : u)) });
    expect(control.steps.map(s => [s.kind, s.actor])).toEqual([["defend", "lens"]]);
    const { run, steps } = endTurn(g);
    expect(steps.filter(s => s.kind === "defend")).toEqual([]);
    expect(unit(run, "lens")!.defending).toBeFalsy();
  });
  it("refuses a king whose counter would leave him in check", () => {
    // A 4-HP king is safe beside him (Lens deals 2), but striking him draws a counter that leaves the
    // king at 2, inside Lens's lethal reach. (A king he could already kill is in check before the blow
    // and the rules let a king in check act freely, so that case is never the refused one.)
    const frail: Unit = { ...king, hp: 4, x: 1, y: 2 };
    const g = board([frail, lens]);
    expect(inCheck(g)).toBe(false);
    expect(attackTargets(g, unit(g, "king")!).map(t => t.id)).toEqual(["lens"]);
    expect(strikeExposesKing(g, "king", "lens")).toBe(true);
    expect(attack(g, "king", "lens")).toEqual({ run: g, step: null });
    // With HP to spare the same strike is allowed, and the counter still lands.
    const sturdy = board([{ ...frail, hp: 5 }, lens]);
    expect(strikeExposesKing(sturdy, "king", "lens")).toBe(false);
    expect(unit(attack(sturdy, "king", "lens").run, "king")!.hp).toBe(3);
  });
});
