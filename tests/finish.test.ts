import { describe, expect, it } from "vitest";
import { apply, boardOf, legalMoves, outcome, start } from "../src/puzzle/engine";
import type { Puzzle } from "../src/puzzle/engine";
import { finishingBlow, mateStage, mateStrikers } from "../src/puzzle/finish";

const base = (p: Partial<Puzzle>): Puzzle => ({ width: 4, height: 4, holes: [], walls: [], pieces: [], goal: { type: "mate" }, moves: 1, ...p });
const backRank = base({ pieces: [["king", "black", 0, 0], ["pawn", "black", 0, 1], ["pawn", "black", 1, 1], ["rook", "white", 3, 3], ["king", "white", 2, 3]] });

describe("checkmate finishing blow", () => {
  it("Back rank: the rook that mates is the only striker, and his blow takes the king's square", () => {
    const b = boardOf(backRank), s = apply(backRank, start(backRank), { from: { x: 3, y: 3 }, to: { x: 3, y: 0 } });
    expect(outcome(backRank, b, s)).toBe("win");
    const st = mateStrikers(b, s, legalMoves(backRank, b, s).length === 0);
    expect(st.map(q => [q.kind, q.x, q.y])).toEqual([["rook", 3, 0]]);
    const f = finishingBlow(b, s, st[0])!;
    expect(f.move).toEqual({ from: { x: 3, y: 0 }, to: { x: 0, y: 0 } });
    expect(f.state.pieces.some(q => q.kind === "king" && q.side === "black")).toBe(false);
    expect(f.state.pieces.find(q => q.kind === "rook")).toMatchObject({ x: 0, y: 0 });
  });

  it("a double-check mate offers both checkers, and either may strike", () => {
    const pz = base({ pieces: [["king", "black", 0, 0], ["pawn", "black", 1, 0], ["rook", "white", 0, 3], ["bishop", "white", 3, 3]] });
    const b = boardOf(pz), s = { ...start(pz), turn: "black" as const };
    expect(legalMoves(pz, b, s).length).toBe(0);
    const st = mateStrikers(b, s, true);
    expect(st.map(q => q.kind).sort()).toEqual(["bishop", "rook"]);
    expect(finishingBlow(b, s, { x: 3, y: 3 })!.move.to).toEqual({ x: 0, y: 0 });
    expect(finishingBlow(b, s, { x: 1, y: 0 })).toBeNull(); // not a checker
  });

  it("no strikers when black is merely in check, not to move, or stalemated", () => {
    const b = boardOf(backRank), s0 = start(backRank);
    expect(mateStrikers(b, s0, true)).toEqual([]); // white to move
    const check = apply(backRank, s0, { from: { x: 3, y: 3 }, to: { x: 3, y: 0 } });
    expect(mateStrikers(b, check, false)).toEqual([]); // has a move
  });

  it("the result line: pick with several, then the blow plays, then Checkmate!", () => {
    expect(mateStage(0, false, false)).toBeNull();
    expect(mateStage(1, false, false)).toBe("blow");
    expect(mateStage(2, false, false)).toBe("pick");
    expect(mateStage(2, true, false)).toBe("blow");
    expect(mateStage(1, true, true)).toBe("mate");
  });
});
