import { describe, expect, it } from "vitest";
import { attack, attackTargets, canDefend, defend, endTurn, moveTargets, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";
import { isWall, passable } from "../../src/game/board";

// Haystack itself is covered in tests/turns.test.ts ("piece variants"); these are its riders.
const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", x: 0, y: 3, hp: 5 };
const haystack: Unit = { id: "h", side: "white", kind: "rook", variant: "misfit", x: 1, y: 3, hp: 5 };
// A royal pawn parked out of everyone's way, so the battle stays on.
const bystander: Unit = { id: "far", side: "black", kind: "pawn", variant: "royal", x: 3, y: 0, hp: 1 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);
/** A meal eaten last turn: it lasts through this turn and the next. */
const meal = (g: Pick<Run, "turn">, absorbed = "knight") => ({ absorbed, absorbedUntil: g.turn + 1 });

describe("Haystack (misfit rook): Consume riders", () => {
  it("is too full to brace while digesting, and braces again once the meal wears off", () => {
    const g = board([king, { ...haystack, mods: meal(newRun()) }, bystander]);
    expect(canDefend(g, unit(g, "h")!)).toBe(false);
    const before = JSON.stringify(g);
    expect(defend(g, "h")).toBe(g);
    expect(JSON.stringify(g)).toBe(before);
    // Still digesting on the next turn.
    const t2 = endTurn(g).run;
    expect(unit(t2, "h")!.mods).toEqual(meal(g));
    expect(defend(t2, "h")).toBe(t2);
    // The turn after, the straw has forgotten the meal and may brace.
    const t3 = endTurn(t2).run;
    expect(unit(t3, "h")!.mods).toBeUndefined();
    const braced = defend(t3, "h");
    expect(unit(braced, "h")).toMatchObject({ defending: true, acted: true });
    expect(braced.energy).toBe(t3.energy - 1);
  });
  it("as an enemy, never braces while digesting even when a brace would save it", () => {
    // Walled into the corner with 2 HP, a knight's jump away from your knight: only a block keeps it alive.
    const enemyHay: Unit = { ...haystack, side: "black", x: 0, y: 0, hp: 2 };
    const knight: Unit = { id: "n", side: "white", kind: "knight", variant: "rebel", x: 2, y: 1, hp: 3 };
    const walls = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
    const plain = board([{ ...king, x: 3, y: 3 }, enemyHay, knight], { walls });
    expect(endTurn(plain).steps.map(s => s.kind)).toEqual(["defend"]);
    expect(unit(endTurn(plain).run, "h")!.defending).toBe(true);
    // Digesting a pawn (which cannot climb the wall ahead of it), it has nothing it may do.
    const full = board([{ ...king, x: 3, y: 3 }, { ...enemyHay, mods: { absorbed: "pawn", absorbedUntil: plain.turn } }, knight], { walls });
    expect(canDefend(full, unit(full, "h")!)).toBe(false);
    const { run, steps } = endTurn(full);
    expect(steps).toEqual([]);
    expect(unit(run, "h")!.defending).toBeFalsy();
  });
  it("keeps rook-shaped strikes while it moves like its meal", () => {
    const leapAway: Unit = { id: "k", side: "black", kind: "pawn", variant: "royal", x: 2, y: 1, hp: 1 };
    const beside: Unit = { id: "b", side: "black", kind: "pawn", variant: "royal", x: 1, y: 2, hp: 1 };
    const g = board([king, { ...haystack, mods: meal(newRun()) }, leapAway, beside]);
    expect(moveTargets(g, unit(g, "h")!)).toContainEqual({ x: 3, y: 2, cost: 2 });
    expect(attackTargets(g, unit(g, "h")!).map(t => t.id)).toEqual(["b"]);
  });
  it("saves and restores a digesting Haystack", () => {
    const g = board([king, { ...haystack, mods: meal(newRun()) }, bystander]);
    expect(readRun(JSON.stringify(g))).toEqual(g);
    const next = endTurn(g).run;
    expect(unit(next, "h")!.mods).toEqual(meal(g));
    expect(readRun(JSON.stringify(next))).toEqual(next);
  });
  it("eating Nobody leaves no empty suit behind: the hay rolls onto the square and flattens it", () => {
    // Nobody's death raises a wall where he stood (onDeath runs in removeDead, before the roll-on);
    // the Haystack then lands on that very square, so the suit is crushed and the square stays floor.
    const nobody: Unit = { id: "n", side: "black", kind: "knight", variant: "misfit", x: 1, y: 1, hp: 2 };
    const square = { x: 1, y: 1 };
    const g = board([king, { ...haystack, x: 1, y: 2 }, nobody, bystander]);
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "h", "n");
    expect(JSON.stringify(g)).toBe(before);
    expect(step!.killed).toEqual(["n"]);
    expect(unit(run, "h")).toMatchObject({ x: 1, y: 1, acted: true, mods: { absorbed: "knight", absorbedUntil: g.turn + 2 } });
    expect(run.walls).toBeUndefined();
    expect(isWall(run, square)).toBe(false);
    expect(passable(run, square)).toBe(true);
    expect(run.log[0]).toBe("Your rook rolls onto b3 and flattens the wall there.");
    // A valid save: nothing stands on a wall.
    expect(readRun(JSON.stringify(run))).toEqual(run);
    // Only the suit under the hay goes; a wall elsewhere is left standing.
    const elsewhere = { x: 3, y: 3 };
    const walled = attack({ ...g, walls: [elsewhere] }, "h", "n").run;
    expect(walled.walls).toEqual([elsewhere]);
    expect(isWall(walled, elsewhere)).toBe(true);
    expect(readRun(JSON.stringify(walled))).toEqual(walled);
  });
});
