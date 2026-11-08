import { describe, expect, it } from "vitest";
import * as turns from "../src/game/turns";
import { attack, attackTargets, endTurn, inCheck, kingThreat, move, moveTargets, sidelined, turnSpent } from "../src/game/turns";
import type { Encounter, Kind, Rules, Run, Unit } from "../src/game/turns";
import { FIXED } from "./fixtures";

const RULES = FIXED.rules;
const per = (n: number): Record<Kind, number> => ({ king: n, queen: n, rook: n, bishop: n, knight: n, pawn: n });
const TACTICS: Rules = { ...RULES, movement: "tactics", tactics: { move: per(2), reach: { ...per(1), bishop: 3 } } };
const OPEN: Encounter = { reward: 0, width: 5, height: 5, walls: [], spawns: [], starts: [] };
const board = (units: Unit[], rules: Rules, level: Encounter = OPEN): Run => ({ ...turns.newRun(FIXED), phase: "player", units, rules, level, items: undefined });
const piece = (id: string, side: Unit["side"], kind: Kind, x: number, y: number, hp = RULES.hp[kind]): Unit => ({ id, side, kind, x, y, hp });
const squares = (ps: { x: number; y: number }[]) => ps.map(p => `${p.x},${p.y}`).sort();

describe("tactics movement", () => {
  it("walks up to its number of straight steps, around walls and pieces", () => {
    const level = { ...OPEN, walls: [{ x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }] };
    const rook = piece("r", "white", "rook", 1, 2), friend = piece("king", "white", "king", 1, 1);
    // The wall and the friend both block; (3,2) is two squares away but only round the wall.
    expect(squares(moveTargets(board([rook, friend], TACTICS, level), rook))).toEqual(squares([{ x: 0, y: 2 }, { x: 0, y: 1 }, { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }]));
  });
  it("lets pawns walk any way", () => {
    const pawn = piece("p", "white", "pawn", 2, 2);
    expect(moveTargets(board([pawn], { ...TACTICS, tactics: { ...TACTICS.tactics, move: per(1) } }), pawn)).toHaveLength(4);
  });
  it("strikes anything within reach, diagonals counting, over pieces and walls", () => {
    const level = { ...OPEN, walls: [{ x: 1, y: 3 }] };
    const bishop = piece("b", "white", "bishop", 0, 4), rook = piece("r", "white", "rook", 4, 4);
    const near = piece("n", "black", "pawn", 3, 3), far = piece("f", "black", "pawn", 3, 1), out = piece("o", "black", "pawn", 4, 0);
    const g = board([bishop, rook, near, far, out], TACTICS, level);
    expect(attackTargets(g, bishop).map(t => t.id).sort()).toEqual(["f", "n"]);
    expect(attackTargets(g, rook).map(t => t.id)).toEqual(["n"]);
  });
  it("draws a strikeback only from one square away", () => {
    const king = piece("king", "white", "king", 0, 4), bishop = piece("b", "white", "bishop", 0, 2);
    const ranged = attack(board([king, bishop, piece("e", "black", "rook", 2, 2)], TACTICS), "b", "e");
    expect(ranged.step?.counter).toBeUndefined();
    const close = attack(board([king, bishop, piece("e", "black", "rook", 1, 2)], TACTICS), "b", "e");
    expect(close.step?.counter).toBeDefined();
  });
  it("puts the king in check from an enemy that could walk up and strike, and the enemy does", () => {
    const king = piece("king", "white", "king", 2, 4, 1), rook = piece("e", "black", "rook", 2, 0);
    const walk3 = { ...TACTICS, tactics: { ...TACTICS.tactics, move: { ...per(3), king: 0 } } };
    expect(inCheck(board([king, rook], walk3))).toBe(true);
    expect(endTurn(board([king, rook], walk3)).run.phase).toBe("defeat");
    // Two steps leave it a square short: no check, and it closes in.
    expect(inCheck(board([king, rook], TACTICS))).toBe(false);
    const { steps } = endTurn(board([king, rook], TACTICS));
    expect(steps.map(s => [s.kind, s.focus[0]])).toEqual([["move", { x: 2, y: 2 }]]);
  });
});

describe("moves per turn", () => {
  const TWO: Rules = { ...RULES, turn: 2 };
  it("lets two of your pieces act, then sidelines the rest", () => {
    const king = piece("king", "white", "king", 4, 4), a = piece("a", "white", "rook", 0, 4), b = piece("b", "white", "rook", 1, 4);
    const foe = piece("f", "black", "rook", 0, 0), foe2 = piece("g", "black", "rook", 1, 0);
    const g = board([king, a, b, foe, foe2], TWO);
    const one = move(g, "a", { x: 0, y: 1 });
    expect(sidelined(one, one.units.find(u => u.id === "b")!)).toBe(false);
    expect(turnSpent(attack(one, "a", "f").run)).toBe(false);
    const both = move(attack(one, "a", "f").run, "b", { x: 1, y: 1 });
    expect(sidelined(both, both.units.find(u => u.id === "king")!)).toBe(true);
    expect(turnSpent(both)).toBe(false);
    expect(turnSpent(attack(both, "b", "g").run)).toBe(true);
  });
  it("counts a piece that fell to a strikeback toward the two", () => {
    const king = piece("king", "white", "king", 4, 4), a = piece("a", "white", "pawn", 0, 1, 1), b = piece("b", "white", "rook", 3, 4);
    const fell = attack(board([king, a, b, piece("f", "black", "queen", 1, 0)], TWO), "a", "f").run;
    expect(fell.units.some(u => u.id === "a")).toBe(false);
    expect(sidelined(fell, fell.units.find(u => u.id === "b")!)).toBe(false);
    const after = move(fell, "b", { x: 3, y: 3 });
    expect(sidelined(after, after.units.find(u => u.id === "king")!)).toBe(true);
  });
  it("makes the enemy act with up to two pieces", () => {
    const level = { ...OPEN, width: 6, height: 6 };
    const units = [piece("king", "white", "king", 2, 5), piece("e1", "black", "rook", 0, 0), piece("e2", "black", "rook", 3, 0), piece("e3", "black", "rook", 5, 0)];
    const actors = (r: Rules) => new Set(endTurn(board(units, r, level)).steps.map(s => s.actor)).size;
    expect(actors(TWO)).toBe(2);
    expect(actors({ ...RULES, turn: "all" })).toBe(3);
  });
  it("adds up the two hardest hits on the king for check", () => {
    const units = [piece("king", "white", "king", 2, 4, 2), piece("p1", "black", "pawn", 1, 3), piece("p2", "black", "pawn", 3, 3), piece("p3", "black", "pawn", 0, 2)];
    expect(kingThreat(board(units, TWO)).damage).toBe(2);
    expect(inCheck(board(units, TWO))).toBe(true);
    expect(inCheck(board(units, { ...RULES, turn: 1 }))).toBe(false);
  });
});
