import { describe, expect, it } from "vitest";
import { ENERGY, abilityOf, approaches, attack, attackTargets, endTurn, kingThreat, move, newRun, promote, readRun, walkAndStrike } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

// 4x4 board (encounter 0). White thrusts toward y = 0, black toward y = 3.
const king: Unit = { id: "king", side: "white", kind: "king", x: 0, y: 3, hp: 5 };
/** Your own Sergeant (a royal pawn on the rebel side) on c1. */
const mine: Unit = { id: "mine", side: "white", kind: "pawn", variant: "royal", x: 2, y: 3, hp: 1 };
/** The patrol's Sergeant on b3. */
const pike: Unit = { id: "pike", side: "black", kind: "pawn", variant: "royal", x: 1, y: 1, hp: 1 };
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Sergeant Pike (royal pawn): Pike", () => {
  it("strikes straight ahead, one square or two over an empty one, never diagonally", () => {
    const far: Unit = { id: "far", side: "black", kind: "knight", variant: "royal", x: 2, y: 1, hp: 3 };
    const diag: Unit = { id: "diag", side: "black", kind: "pawn", variant: "royal", x: 3, y: 2, hp: 1 };
    const g = board([king, mine, far, diag]);
    // The knight two squares up the c-file is a target; the pawn on the forward diagonal is not.
    expect(attackTargets(g, mine).map(t => t.id)).toEqual(["far"]);
    const before = JSON.stringify(g);
    const { run } = attack(g, "mine", "far");
    expect(JSON.stringify(g)).toBe(before);
    expect(unit(run, "far")!.hp).toBe(2);
    expect(run.energy).toBe(ENERGY - 2);
    expect(readRun(JSON.stringify(run))).toEqual(run);
    // A piece on the square between blocks the long thrust: only the near square is in reach.
    const near: Unit = { id: "near", side: "black", kind: "pawn", variant: "royal", x: 2, y: 2, hp: 1 };
    const blocked = board([king, mine, far, diag, near]);
    expect(attackTargets(blocked, mine).map(t => t.id)).toEqual(["near"]);
    expect(attack(blocked, "mine", "far").step).toBeNull();
    // So does a wall raised there (Nobody's suit).
    expect(attackTargets(board([king, mine, far], { walls: [{ x: 2, y: 2 }] }), mine)).toEqual([]);
  });

  it("lines up for a tap-to-strike two squares off the target", () => {
    const target: Unit = { id: "t", side: "black", kind: "rook", variant: "royal", x: 2, y: 0, hp: 5 };
    const g = board([king, mine, target]);
    expect(attackTargets(g, mine)).toEqual([]);
    expect(approaches(g, "mine", "t")).toEqual([{ x: 2, y: 2, cost: 3 }]);
    const result = walkAndStrike(g, "mine", { x: 2, y: 2 }, "t");
    expect(unit(result!.run, "t")!.hp).toBe(4);
    expect(result!.run.energy).toBe(ENERGY - 3);
  });

  it("threatens a king two squares ahead through an empty square; interposing lifts it", () => {
    // Enemy Pike on b3, your king on b1: b2 is empty, so the pike counts for 1.
    const exposed: Unit = { ...king, x: 1, y: 3 };
    expect(kingThreat(board([exposed, pike]))).toEqual({ damage: 1, attackers: ["pike"] });
    // Any piece on b2 breaks the line, and so does a wall raised there.
    const plug: Unit = { id: "plug", side: "white", kind: "pawn", variant: "rebel", x: 1, y: 2, hp: 1 };
    expect(kingThreat(board([exposed, pike, plug]))).toEqual({ damage: 0, attackers: [] });
    expect(kingThreat(board([exposed, pike], { walls: [{ x: 1, y: 2 }] }))).toEqual({ damage: 0, attackers: [] });
    // Beside him on the diagonal the king is untouchable; directly ahead he is hit for 1.
    expect(kingThreat(board([{ ...king, x: 0, y: 2 }, pike])).damage).toBe(0);
    expect(kingThreat(board([{ ...king, x: 1, y: 2 }, pike])).damage).toBe(1);
  });

  it("a braced Pike counters only along the pike: a diagonal striker is safe", () => {
    const braced: Unit = { ...pike, hp: 2, defending: true };
    // Your king on b2 stands on the pike's tip: his blow deals 1 through the brace and draws a counter.
    const ahead = attack(board([{ ...king, x: 1, y: 2 }, braced]), "king", "pike").run;
    expect(unit(ahead, "pike")!.hp).toBe(1);
    expect(unit(ahead, "king")!.hp).toBe(4);
    // From c2, the diagonal, the same blow lands and nothing comes back.
    const flank = attack(board([{ ...king, x: 2, y: 2 }, braced]), "king", "pike").run;
    expect(unit(flank, "pike")!.hp).toBe(1);
    expect(unit(flank, "king")!.hp).toBe(5);
  });

  it("promotes normally, and the new piece strikes in its own shape", () => {
    const sergeant: Unit = { ...mine, y: 1 };
    const foe: Unit = { id: "e", side: "black", kind: "pawn", variant: "royal", x: 1, y: 2, hp: 1 };
    const moved = move(board([king, sergeant, foe]), "mine", { x: 2, y: 0 });
    expect(moved.promoting).toBe("mine");
    expect(attackTargets(moved, unit(moved, "mine")!)).toEqual([]);
    const { run } = promote(moved, "mine", "knight");
    expect(unit(run, "mine")).toMatchObject({ kind: "knight", hp: 3 });
    expect(attackTargets(run, unit(run, "mine")!).map(t => t.id)).toEqual(["e"]);
  });
  it("an enemy Pike that reaches your back row crowns Her Wigness, while the road's plain pawns still crown a plain queen", () => {
    // Black moves toward larger y; the far row of the 4x4 board is y = 3. The king stays out of reach.
    const runner: Unit = { ...pike, x: 3, y: 2 };
    const { run } = endTurn(board([king, runner]));
    const crowned = unit(run, "pike")!;
    expect(crowned).toMatchObject({ kind: "queen", variant: "royal", hp: 9 });
    expect(abilityOf(crowned)?.name).toBe("Her Wigness");
    const plain = unit(endTurn(board([king, { ...runner, variant: undefined }])).run, "pike")!;
    expect(plain).toMatchObject({ kind: "queen" });
    expect(abilityOf(plain)).toBeUndefined();
  });
});
