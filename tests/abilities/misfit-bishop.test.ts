import { describe, expect, it } from "vitest";
import { ENERGY, alt, altActions, attack, inCheck, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

// Encounter 0: 4x4, no walls. Encounter 1: 6x4, walls at (3,1) and (3,2), enemy energy 3.
// Encounter 2: 6x6, walls at x in {0,1,4,5} for y in {2,3}, enemy energy 3. White moves toward y=0.
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, energy: ENERGY, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);
const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", hp: 5, x: 0, y: 3 };
const goose: Unit = { id: "goose", side: "white", kind: "bishop", variant: "misfit", hp: 3, x: 1, y: 2 };
const enemy = (id: string, kind: Unit["kind"], x: number, y: number, hp: number, extra: Partial<Unit> = {}): Unit => ({ id, side: "black", kind, variant: "royal", hp, x, y, ...extra });

describe("Honkington (misfit bishop): HONK", () => {
  it("shoves every adjacent enemy one square straight away; a wall or the edge holds one in place", () => {
    // Encounter 1. The rook at (2,2) would land on the wall at (3,2); the pawn at (1,1) flies to (1,0),
    // the knight at (2,1) to (3,0). Nobody is hurt.
    const g = board([king, goose, enemy("r", "rook", 2, 2, 5), enemy("p", "pawn", 1, 1, 1), enemy("n", "knight", 2, 1, 3)], { encounter: 1 });
    const [honk] = altActions(g, unit(g, "goose")!);
    expect(honk).toMatchObject({ id: "honk", cost: 2, targets: [] });
    const before = JSON.stringify(g);
    const { run, step } = alt(g, "goose", "honk");
    expect(JSON.stringify(g)).toBe(before);
    expect(run.energy).toBe(ENERGY - 2);
    expect(unit(run, "goose")).toMatchObject({ x: 1, y: 2, acted: true });
    expect(unit(run, "r")).toMatchObject({ x: 2, y: 2, hp: 5 });
    expect(unit(run, "p")).toMatchObject({ x: 1, y: 0, hp: 1 });
    expect(unit(run, "n")).toMatchObject({ x: 3, y: 0, hp: 3 });
    expect(step).toMatchObject({ kind: "alt", actor: "goose", damage: [], killed: [], focus: [{ x: 3, y: 0 }, { x: 1, y: 0 }] });
    expect(step!.text).toBe("Your bishop honks! Enemy knight is shoved to d4. Enemy pawn is shoved to b4. Enemy rook holds its ground.");
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("the board edge or an occupied square holds a piece where it is", () => {
    // On the 4x4 board the pawn at (2,3) has nowhere to go: (3,4) is off the edge. The others fly.
    const g = board([king, goose, enemy("a", "pawn", 2, 3, 1), enemy("b", "pawn", 1, 1, 1), enemy("c", "knight", 2, 1, 3)]);
    const { run } = alt(g, "goose", "honk");
    expect(unit(run, "a")).toMatchObject({ x: 2, y: 3 });
    expect(unit(run, "b")).toMatchObject({ x: 1, y: 0 });
    expect(unit(run, "c")).toMatchObject({ x: 3, y: 0 });
    // An occupied square blocks too: a knight standing behind the pawn keeps it in place, and stays put itself.
    const blocked = board([king, goose, enemy("b", "pawn", 1, 1, 1), enemy("z", "knight", 1, 0, 3)]);
    const after = alt(blocked, "goose", "honk").run;
    expect(unit(after, "b")).toMatchObject({ x: 1, y: 1 });
    expect(unit(after, "z")).toMatchObject({ x: 1, y: 0 });
  });
  it("drops a shoved piece's brace, draws no counter, and does not promote a shoved pawn or spare a king", () => {
    // Goose at (1,1): the braced rook to its right flies to (3,1), the pawn below it lands on the far
    // row (1,3) and stays a pawn, and the enemy king on the diagonal is shoved to (3,3).
    const g = board([king, { ...goose, x: 1, y: 1 }, enemy("r", "rook", 2, 1, 5, { defending: true }), enemy("p", "pawn", 1, 2, 1), enemy("ek", "king", 2, 2, 5)]);
    const { run, step } = alt(g, "goose", "honk");
    expect(step!.damage).toEqual([]);
    expect(unit(run, "r")).toMatchObject({ x: 3, y: 1, hp: 5 });
    expect(unit(run, "r")).not.toHaveProperty("defending");
    expect(unit(run, "p")).toMatchObject({ x: 1, y: 3, kind: "pawn", hp: 1 });
    expect(run.promoting).toBeUndefined();
    expect(unit(run, "ek")).toMatchObject({ x: 3, y: 3, hp: 5 });
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("is only offered with an enemy adjacent, and only when he can pay", () => {
    const alone = board([king, goose, enemy("q", "queen", 3, 0, 9)]);
    expect(altActions(alone, unit(alone, "goose")!)).toEqual([]);
    expect(alt(alone, "goose", "honk")).toEqual({ run: alone, step: null });
    const broke = board([king, goose, enemy("q", "queen", 2, 1, 9)], { energy: 1 });
    expect(altActions(broke, unit(broke, "goose")!)).toEqual([]);
    expect(alt(broke, "goose", "honk")).toEqual({ run: broke, step: null });
  });
  it("is refused when the shove opens a line onto your king", () => {
    // Encounter 2. Your 3-HP king at a2 is screened from the enemy rook at c2 by the bishop at b2. The goose
    // at a1 would shove that bishop to c3, and the rook (3 energy: step to b2, strike) could then kill the king.
    const g = board([{ ...king, hp: 3, x: 0, y: 4 }, { ...goose, x: 0, y: 5 }, enemy("b", "bishop", 1, 4, 3), enemy("r", "rook", 2, 4, 5)], { encounter: 2 });
    expect(inCheck(g)).toBe(false);
    expect(altActions(g, unit(g, "goose")!).map(a => a.id)).toEqual(["honk"]);
    expect(alt(g, "goose", "honk")).toEqual({ run: g, step: null });
    // Without the rook the same honk goes through.
    const safe = board(g.units.filter(u => u.id !== "r"), { encounter: 2 });
    expect(unit(alt(safe, "goose", "honk").run, "b")).toMatchObject({ x: 2, y: 3 });
  });
  it("pecks for only 1", () => {
    const g = board([king, goose, enemy("n", "knight", 2, 1, 3)]);
    const { run, step } = attack(g, "goose", "n");
    expect(unit(run, "n")!.hp).toBe(2);
    expect(step!.damage).toEqual([{ id: "n", amount: 1 }]);
  });
});
