import { describe, expect, it } from "vitest";
import { apply, boardOf, gateOpen, inCheck, keyOf, legalMoves, outcome, start } from "../src/puzzle/engine";
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

describe("eyes and sleepers", () => {
  it("a sleeper can't move or capture; an eye that sees you wakes it", () => {
    // Sleeping rook a4 eyes the peasant? No: the eye is at d4, looking down the d-file.
    const pz = base({ goal: { type: "survive" }, moves: 1, eyes: [{ x: 3, y: 0 }], pieces: [["peasant", "white", 0, 3], ["rook", "black", 0, 0, "asleep"]] });
    const b = boardOf(pz), s0 = start(pz);
    expect(s0.pieces.find(p => p.side === "black")!.asleep).toBe(true);
    // Peasant b1 is out of sight: the rook stays asleep and has no moves.
    const quiet = apply(pz, s0, legalMoves(pz, b, s0).find(m => m.to.x === 1 && m.to.y === 3)!);
    expect(legalMoves(pz, b, quiet)).toEqual([]);
    // Peasant d... can't reach d-file in one; use a2 → stays out. Now put the peasant into the d-file.
    const loud = base({ ...pz, pieces: [["peasant", "white", 2, 3], ["rook", "black", 0, 0, "asleep"]] });
    const s1 = start(loud);
    const seen = apply(loud, s1, legalMoves(loud, boardOf(loud), s1).find(m => m.to.x === 3 && m.to.y === 3)!);
    expect(seen.pieces.some(p => p.asleep)).toBe(false);
  });
  it("pieces block an eye's view", () => {
    const pz = base({ goal: { type: "survive" }, eyes: [{ x: 3, y: 0 }], pieces: [["rook", "white", 3, 1], ["pawn", "white", 3, 3], ["knight", "black", 0, 0, "asleep"]] });
    // The rook in front is seen at the start: everyone wakes.
    expect(start(pz).pieces.some(p => p.asleep)).toBe(false);
    const hidden = base({ ...pz, pieces: [["pawn", "black", 3, 1], ["pawn", "white", 3, 3], ["knight", "black", 0, 0, "asleep"]] });
    expect(start(hidden).pieces.some(p => p.asleep)).toBe(true);
  });
});

describe("sludge", () => {
  it("kills a piece that stops in it, counts an enemy as captured, and kings can't step in", () => {
    // Zugzwang: the black knight's only moves land in sludge.
    const pz = base({ goal: { type: "capture", count: 1 }, sludge: [{ x: 1, y: 2 }, { x: 2, y: 1 }], pieces: [["knight", "black", 0, 0], ["king", "white", 3, 3], ["king", "black", 3, 0]] });
    const b = boardOf(pz), s0 = start(pz);
    expect(legalMoves(pz, b, s0).some(m => m.to.x === 2 && m.to.y === 2)).toBe(true);
    const k = base({ ...pz, pieces: [["king", "white", 1, 3], ["king", "black", 3, 0]] });
    expect(legalMoves(k, boardOf(k), start(k)).some(m => m.to.x === 1 && m.to.y === 2)).toBe(false);
    const rook = base({ goal: { type: "capture", count: 1 }, sludge: [{ x: 0, y: 1 }], pieces: [["rook", "black", 0, 0], ["king", "white", 3, 3]] });
    const s1 = { ...start(rook), turn: "black" as const };
    const dunk = apply(rook, s1, { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } });
    expect(dunk.pieces.length).toBe(1);
    expect(dunk.taken).toBe(1);
    // ...but it can slide across it.
    expect(legalMoves(rook, boardOf(rook), s1).some(m => m.to.y === 2 && m.to.x === 0)).toBe(true);
  });
});

describe("traps", () => {
  it("a trapdoor falls open behind the piece that leaves it", () => {
    const pz = base({ goal: { type: "survive" }, moves: 2, trapdoors: [{ x: 0, y: 3 }], pieces: [["rook", "white", 0, 3], ["king", "black", 3, 0]] });
    const b = boardOf(pz), s0 = start(pz);
    const up = apply(pz, s0, { from: { x: 0, y: 3 }, to: { x: 0, y: 1 } });
    expect(up.doors).toBe(1);
    const back = { ...up, turn: "white" as const };
    expect(legalMoves(pz, b, back).some(m => m.to.x === 0 && m.to.y === 3)).toBe(false);
    // A rook can still slide across a closed trapdoor.
    const across = base({ ...pz, trapdoors: [{ x: 0, y: 2 }] });
    expect(legalMoves(across, boardOf(across), start(across)).some(m => m.to.x === 0 && m.to.y === 1)).toBe(true);
  });
  it("a snared piece can't move but still gives check", () => {
    const pz = base({ snares: [{ x: 0, y: 3 }], pieces: [["rook", "white", 0, 3], ["king", "white", 3, 3], ["king", "black", 0, 0]] });
    const b = boardOf(pz), s0 = start(pz);
    expect(legalMoves(pz, b, s0).every(m => m.from.x === 3)).toBe(true);
    expect(inCheck(b, s0, "black")).toBe(true);
  });
});

describe("gates and switches", () => {
  const wall = [0, 1, 3].map(x => ({ x, y: 2 }));
  it("a plate holds its gate open only while pressed; a gate can't close on a piece", () => {
    const pz = base({ goal: { type: "survive" }, moves: 3, walls: wall, gates: [{ x: 2, y: 2 }], switches: [{ x: 0, y: 3, kind: "plate", effect: { type: "gates", gates: [{ x: 2, y: 2 }] } }], pieces: [["rook", "white", 0, 0], ["king", "white", 2, 3]] });
    const b = boardOf(pz), s0 = start(pz);
    expect(legalMoves(pz, b, s0).some(m => m.from.x === 2 && m.to.y === 2)).toBe(false);
    // With the rook on the plate, the gate opens.
    const s1 = { ...s0, pieces: s0.pieces.map(p => (p.kind === "rook" ? { ...p, x: 0, y: 3 } : p)) };
    expect(legalMoves(pz, b, s1).some(m => m.from.x === 2 && m.to.y === 2)).toBe(true);
    const inGate = { ...apply(pz, s1, { from: { x: 2, y: 3 }, to: { x: 2, y: 2 } }), turn: "white" as const };
    // The rook leaves the plate, but the king in the gate holds it open and can walk on.
    const left = { ...apply(pz, inGate, { from: { x: 0, y: 3 }, to: { x: 1, y: 3 } }), turn: "white" as const };
    expect(gateOpen(b, left, 0)).toBe(true);
    // Once the king walks on, nothing holds it: it shuts.
    const through = apply(pz, left, { from: { x: 2, y: 2 }, to: { x: 2, y: 1 } });
    expect(gateOpen(b, through, 0)).toBe(false);
  });
  it("a lever flips each time; flood and wake effects fire", () => {
    const pz = base({ goal: { type: "survive" }, moves: 4, eyes: [], gates: [{ x: 3, y: 0 }],
      switches: [{ x: 0, y: 2, kind: "lever", effect: { type: "gates", gates: [{ x: 3, y: 0 }] } }, { x: 1, y: 2, kind: "lever", effect: { type: "sludge", squares: [{ x: 3, y: 3 }] } }, { x: 2, y: 2, kind: "plate", effect: { type: "wake" } }],
      pieces: [["rook", "white", 0, 3], ["knight", "black", 3, 3], ["bishop", "black", 0, 0, "asleep"]] });
    const b = boardOf(pz), s0 = start(pz);
    const lever = apply(pz, s0, { from: { x: 0, y: 3 }, to: { x: 0, y: 2 } });
    expect(gateOpen(b, lever, 0)).toBe(true);
    const flood = apply(pz, { ...s0, pieces: s0.pieces.map(p => (p.kind === "rook" ? { ...p, x: 1, y: 3 } : p)) }, { from: { x: 1, y: 3 }, to: { x: 1, y: 2 } });
    expect(flood.taken).toBe(1);
    expect(flood.pieces.some(p => p.kind === "knight")).toBe(false);
    const wake = apply(pz, { ...s0, pieces: s0.pieces.map(p => (p.kind === "rook" ? { ...p, x: 2, y: 3 } : p)) }, { from: { x: 2, y: 3 }, to: { x: 2, y: 2 } });
    expect(wake.pieces.some(p => p.asleep)).toBe(false);
  });
});

describe("new enemies", () => {
  it("a statue strikes from where it stands and never moves", () => {
    const pz = base({ goal: { type: "survive" }, pieces: [["rook", "black", 0, 0, "statue"], ["knight", "white", 0, 3], ["king", "white", 3, 3]] });
    const b = boardOf(pz), s = { ...start(pz), turn: "black" as const };
    const moves = legalMoves(pz, b, s);
    expect(moves).toEqual([{ from: { x: 0, y: 0 }, to: { x: 0, y: 3 }, strike: true }]);
    const after = apply(pz, s, moves[0]);
    expect(after.pieces.find(p => p.side === "black")).toMatchObject({ x: 0, y: 0, statue: true });
    expect(after.pieces.some(p => p.kind === "knight")).toBe(false);
  });
  it("a coward never captures or stops where you attack", () => {
    const pz = base({ goal: { type: "capture", count: 1 }, pieces: [["coward", "black", 1, 1], ["rook", "white", 0, 3], ["pawn", "white", 1, 2]] });
    const b = boardOf(pz), s = { ...start(pz), turn: "black" as const };
    const to = legalMoves(pz, b, s).map(m => `${m.to.x}${m.to.y}`).sort();
    // The rook covers the a-file, the pawn the two squares ahead of it diagonally; the coward never takes the pawn.
    expect(to).toEqual(["10", "20", "22"]);
  });
  it("tells a white pawn from a peasant in the solver's memo", () => {
    const a = base({ pieces: [["pawn", "white", 1, 1], ["king", "black", 3, 0]] }), b2 = base({ pieces: [["peasant", "white", 1, 1], ["king", "black", 3, 0]] });
    expect(keyOf(start(a))).not.toBe(keyOf(start(b2)));
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
