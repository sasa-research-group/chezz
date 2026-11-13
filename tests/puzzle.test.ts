import { describe, expect, it } from "vitest";
import { apply, boardOf, legalMoves, outcome, start } from "../src/puzzle/engine";
import type { Puzzle } from "../src/puzzle/engine";
import { NEVER, analyze, bestReply, solver } from "../src/puzzle/solve";
import { PUZZLES, formatPuzzles, parsePuzzles } from "../src/puzzle/puzzles";

const base = (p: Partial<Puzzle>): Puzzle => ({ width: 4, height: 4, holes: [], walls: [], pieces: [], goal: { type: "mate" }, moves: 1, ...p });

describe("puzzle engine", () => {
  it("finds a back-rank mate in one, and only one key", () => {
    // Black king a4 (top-left), white rook d1, white king c2... mate with Rd4? King a4 hemmed by own pawns a3 b3.
    const pz = base({ pieces: [["king", "black", 0, 0], ["pawn", "black", 0, 1], ["pawn", "black", 1, 1], ["rook", "white", 3, 3], ["king", "white", 2, 3]] });
    const a = analyze(pz);
    expect(a.ok && a.par).toBe(1);
    expect(a.ok && a.keys).toEqual(["Rd4"]);
  });

  it("stops sliders at holes and walls; knights leap walls but not onto them", () => {
    const pz = base({ holes: [{ x: 1, y: 3 }], walls: [{ x: 0, y: 2 }], pieces: [["rook", "white", 0, 3], ["knight", "white", 3, 3]] });
    const s = start(pz), b = boardOf(pz);
    const rook = legalMoves(pz, b, s).filter(m => m.from.x === 0).map(m => `${m.to.x}${m.to.y}`);
    expect(rook).toEqual([]);
    const knight = legalMoves(pz, b, s).filter(m => m.from.x === 3).map(m => `${m.to.x}${m.to.y}`).sort();
    expect(knight).toEqual(["12", "21"]);
  });

  it("escort: a peasant that steps onto the exit is saved; a captured one fails", () => {
    const pz = base({ goal: { type: "escort", exits: [{ x: 0, y: 0 }] }, pieces: [["peasant", "white", 0, 1], ["rook", "black", 3, 3]] });
    const a = analyze(pz);
    expect(a.ok && a.par).toBe(1);
    const lost = base({ goal: { type: "escort", exits: [{ x: 3, y: 0 }] }, moves: 2, pieces: [["peasant", "white", 0, 3], ["rook", "black", 3, 3]] });
    const b = analyze(lost);
    expect(b.ok && b.par).toBe(NEVER);
  });

  it("the dungeon refutes when it can", () => {
    // Capture 1: the white rook could take the knight, but it's the dungeon's move? No: white moves first, takes. Par 1.
    const pz = base({ goal: { type: "capture", count: 1 }, pieces: [["rook", "white", 0, 3], ["knight", "black", 0, 0]] });
    const a = analyze(pz);
    expect(a.ok && a.par).toBe(1);
    // Two moves needed; after the first the knight runs to safety.
    const far = base({ goal: { type: "capture", count: 1 }, moves: 2, pieces: [["bishop", "white", 0, 3], ["knight", "black", 3, 1]] });
    const sv = solver(far), s0 = start(far);
    const s1 = apply(far, s0, legalMoves(far, sv.b, s0)[0]);
    expect(bestReply(sv, s1)).not.toBeNull();
    expect(outcome(far, sv.b, s0)).toBeNull();
  });

  it("survive: still standing after the last reply wins", () => {
    const pz = base({ goal: { type: "survive" }, moves: 2, pieces: [["king", "white", 0, 3], ["rook", "black", 3, 0]] });
    const a = analyze(pz);
    expect(a.ok && a.par).toBe(2);
  });
});

describe("puzzles file", () => {
  it("loads, every puzzle is solvable, and round-trips", () => {
    expect(PUZZLES.length).toBeGreaterThan(0);
    for (const pz of PUZZLES) { const a = analyze(pz); expect(a.ok && a.par <= pz.moves, pz.name).toBe(true); }
    const text = formatPuzzles(PUZZLES);
    const back = parsePuzzles(JSON.parse(text));
    expect(back.ok && formatPuzzles(back.puzzles)).toBe(text);
  });
});
