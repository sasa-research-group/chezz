import { describe, expect, it } from "vitest";
import { alt, altActions, moveTargets, move, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";
import { isWall, passable } from "../../src/game/board";

const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", x: 0, y: 3, hp: 5 };
const brick: Unit = { id: "b", side: "white", kind: "rook", variant: "rebel", x: 2, y: 1, hp: 5 };
// A royal pawn parked out of everyone's way, so the battle stays on.
const bystander: Unit = { id: "p", side: "black", kind: "pawn", variant: "royal", x: 5, y: 0, hp: 1 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, encounter: 1, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);
const WALL = { x: 3, y: 1 };

describe("Brick (rebel rook): Demolish", () => {
  it("knocks down an adjacent encounter wall for 2, after a move, and the gap stays open to slide through", () => {
    // Brick starts on c1 and slides two squares up the file to stand beside the toll gate's wall.
    const g = move(board([king, { ...brick, x: 2, y: 3 }, bystander]), "b", { x: 2, y: 1 });
    expect(g.energy).toBe(2);
    const [action] = altActions(g, unit(g, "b")!);
    expect(action).toMatchObject({ id: "demolish", label: "Demolish (2)", cost: 2, targets: [WALL] });
    const before = JSON.stringify(g);
    const { run, step } = alt(g, "b", "demolish", WALL);
    expect(JSON.stringify(g)).toBe(before);
    expect(run.energy).toBe(0);
    expect(run.broken).toEqual([WALL]);
    expect(run.walls).toBeUndefined();
    expect(isWall(run, WALL)).toBe(false);
    expect(passable(run, WALL)).toBe(true);
    expect(unit(run, "b")).toMatchObject({ x: 2, y: 1, acted: true });
    expect(step).toMatchObject({ kind: "alt", actor: "b", focus: [WALL], damage: [], killed: [] });
    expect(run.log[0]).toBe("Your rook demolishes the wall at d3.");
    // The other wall still stands; Brick is spent for the turn.
    expect(isWall(run, { x: 3, y: 2 })).toBe(true);
    expect(altActions(run, unit(run, "b")!)).toEqual([]);
    // Next turn the file is open: a rook slides straight through the gap.
    const fresh = { ...run, turn: run.turn + 1, energy: 4, units: run.units.map(u => (u.id === "b" ? { ...u, acted: false, moved: false } : u)) };
    const moves = moveTargets(fresh, unit(fresh, "b")!);
    expect(moves).toContainEqual({ x: 3, y: 1, cost: 1 });
    expect(moves).toContainEqual({ x: 5, y: 1, cost: 3 });
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("smashes a wall an ability raised (Nobody's suit) by forgetting it", () => {
    // Encounter 0 has no walls of its own; the suit at (2,2) is the only one.
    const suit = { x: 2, y: 2 };
    const g = board([king, { ...brick, x: 1, y: 2 }, { ...bystander, x: 3, y: 0 }], { encounter: 0, walls: [suit] });
    expect(isWall(g, suit)).toBe(true);
    expect(altActions(g, unit(g, "b")!)[0].targets).toEqual([suit]);
    const { run, step } = alt(g, "b", "demolish", suit);
    expect(step).not.toBeNull();
    expect(run.walls).toBeUndefined();
    expect(run.broken).toBeUndefined();
    expect(isWall(run, suit)).toBe(false);
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("clears a square where a suit stands on an encounter wall in one swing", () => {
    // Only a crafted save stacks both layers today (gates and levers may later); one Demolish still
    // leaves plain floor: the suit is forgotten and the encounter wall marked broken together.
    const g = board([king, brick, bystander], { walls: [WALL] });
    expect(isWall(g, WALL)).toBe(true);
    const { run, step } = alt(g, "b", "demolish", WALL);
    expect(step).not.toBeNull();
    expect(run.energy).toBe(2);
    expect(run.walls).toBeUndefined();
    expect(run.broken).toEqual([WALL]);
    expect(isWall(run, WALL)).toBe(false);
    expect(passable(run, WALL)).toBe(true);
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("targets only orthogonally adjacent walls: not edges, empty squares or diagonals", () => {
    // Cornered on an empty board: the edges around Brick are not walls.
    const corner = board([{ ...king, x: 3, y: 3 }, { ...brick, x: 0, y: 0 }, { ...bystander, x: 3, y: 0 }], { encounter: 0 });
    expect(altActions(corner, unit(corner, "b")!)).toEqual([]);
    // Diagonal to the wall at d3: no swing.
    const diagonal = board([king, { ...brick, x: 2, y: 0 }, bystander]);
    expect(altActions(diagonal, unit(diagonal, "b")!)).toEqual([]);
    // Beside it, only the wall is offered, never the empty squares around Brick.
    const beside = board([king, brick, bystander]);
    expect(altActions(beside, unit(beside, "b")!)[0].targets).toEqual([WALL]);
    expect(alt(beside, "b", "demolish", { x: 2, y: 0 })).toEqual({ run: beside, step: null });
  });
  it("needs 2 energy", () => {
    const g = board([king, brick, bystander], { energy: 1 });
    const before = JSON.stringify(g);
    expect(altActions(g, unit(g, "b")!)).toEqual([]);
    expect(alt(g, "b", "demolish", WALL)).toEqual({ run: g, step: null });
    expect(JSON.stringify(g)).toBe(before);
  });
  it("is refused when opening the wall would expose your king", () => {
    // The king (3 HP) shelters west of the wall at d2; an enemy rook waits east of it. Breaking the wall
    // lets the rook step into the gap and strike him, so the swing is refused like any move into check.
    const rook: Unit = { id: "r", side: "black", kind: "rook", variant: "royal", x: 4, y: 2, hp: 5 };
    const g = board([{ ...king, x: 2, y: 2, hp: 3 }, { ...brick, x: 3, y: 3 }, rook]);
    expect(altActions(g, unit(g, "b")!)[0].targets).toEqual([{ x: 3, y: 2 }]);
    expect(alt(g, "b", "demolish", { x: 3, y: 2 })).toEqual({ run: g, step: null });
    // With a healthier king the same swing goes through.
    const safe = { ...g, units: g.units.map(u => (u.id === "king" ? { ...u, hp: 5 } : u)) };
    expect(alt(safe, "b", "demolish", { x: 3, y: 2 }).run.broken).toEqual([{ x: 3, y: 2 }]);
  });
});
