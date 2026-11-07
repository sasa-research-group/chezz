import { describe, expect, it } from "vitest";
import { ENERGY, attack, endTurn, inCheck, newRun, readRun, walkAndStrike } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

// 4x4 board (encounter 0): a4 is (0,0), b3 is (1,1), c2 is (2,2). White strikes toward y = 0.
// Every enemy carries an explicit cast so the test reads the same whatever its default ability does;
// the knight is Nobody (2 HP, otherwise a plain knight).
const king: Unit = { id: "king", side: "white", kind: "king", x: 0, y: 3, hp: 5 };
const pip: Unit = { id: "pip", side: "white", kind: "pawn", variant: "rebel", x: 2, y: 2, hp: 1 };
const knight: Unit = { id: "n", side: "black", kind: "knight", variant: "misfit", x: 1, y: 1, hp: 2 };
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Pip (rebel pawn): Heave", () => {
  it("shoves a survivor one square further along the strike and logs it", () => {
    const g = board([king, pip, knight]);
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "pip", "n");
    expect(JSON.stringify(g)).toBe(before);
    // Pip on c2 forks b3: the knight takes 1 and is heaved on to a4. Pip stays put.
    expect(unit(run, "n")).toMatchObject({ x: 0, y: 0, hp: 1 });
    expect(unit(run, "pip")).toMatchObject({ x: 2, y: 2, acted: true });
    expect(run.energy).toBe(ENERGY - 2);
    expect(run.log[0]).toBe("Enemy knight is shoved to a4.");
    expect(step!.units).toEqual(run.units);
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });

  it("does not shove a kill, nor onto an occupied square, off the board or into a wall", () => {
    // A 1-HP pawn falls; nothing lands on a4.
    const weak: Unit = { id: "p", side: "black", kind: "pawn", variant: "royal", x: 1, y: 1, hp: 1 };
    const killed = attack(board([king, pip, weak]), "pip", "p").run;
    expect(unit(killed, "p")).toBeUndefined();
    expect(killed.units.some(u => u.x === 0 && u.y === 0)).toBe(false);
    // Another piece already stands on a4: the knight is hit but stays.
    const corner: Unit = { id: "c", side: "black", kind: "pawn", variant: "royal", x: 0, y: 0, hp: 1 };
    expect(unit(attack(board([king, pip, knight, corner]), "pip", "n").run, "n")).toMatchObject({ x: 1, y: 1, hp: 1 });
    // The board edge: a knight in the corner has nowhere to go.
    expect(unit(attack(board([king, { ...pip, x: 1, y: 1 }, { ...knight, x: 0, y: 0 }]), "pip", "n").run, "n")).toMatchObject({ x: 0, y: 0, hp: 1 });
    // A wall: on the toll-gate board (6x4) the shove from b1 through c2 would land on the wall at d3.
    const gate = board([king, { ...pip, x: 1, y: 3 }, { ...knight, x: 2, y: 2 }], { encounter: 1 });
    expect(unit(attack(gate, "pip", "n").run, "n")).toMatchObject({ x: 2, y: 2, hp: 1 });
  });

  it("a braced survivor counters from its own square, then is shoved with its shield still up", () => {
    // A braced rook takes 0 from the fork (so the heave needs no damage) and cannot counter on a diagonal.
    const rook: Unit = { id: "r", side: "black", kind: "rook", variant: "rebel", x: 1, y: 1, hp: 5, defending: true };
    const shoved = attack(board([king, pip, rook]), "pip", "r").run;
    expect(unit(shoved, "r")).toMatchObject({ x: 0, y: 0, hp: 5, defending: true });
    expect(unit(shoved, "pip")).toMatchObject({ hp: 1 });
    // A braced king does reach c2 from b3: his counter fells Pip first, and the fork still heaves him.
    const foe: Unit = { id: "k", side: "black", kind: "king", variant: "rebel", x: 1, y: 1, hp: 5, defending: true };
    const traded = attack(board([king, pip, foe]), "pip", "k").run;
    expect(unit(traded, "pip")).toBeUndefined();
    expect(unit(traded, "k")).toMatchObject({ x: 0, y: 0, hp: 5, defending: true });
  });

  it("heaves at the end of a tap-to-strike walk too", () => {
    const g = board([king, { ...pip, y: 3 }, knight]);
    const result = walkAndStrike(g, "pip", { x: 2, y: 2 }, "n");
    expect(result).not.toBeNull();
    expect(unit(result!.walked, "pip")).toMatchObject({ x: 2, y: 2, moved: true });
    expect(unit(result!.run, "n")).toMatchObject({ x: 0, y: 0, hp: 1 });
    expect(result!.run.energy).toBe(ENERGY - 3);
  });

  it("is refused when the shove would leave your king in check", () => {
    // From b3 the knight does not reach a 2-HP king on c3; from a4 it would, so the heave is self-check.
    const low: Unit = { ...king, x: 2, y: 1, hp: 2 };
    const g = board([low, pip, knight]);
    expect(inCheck(g)).toBe(false);
    expect(attack(g, "pip", "n")).toEqual({ run: g, step: null });
    // The same heave is fine once the king stands clear of the knight's new reach.
    expect(unit(attack(board([king, pip, knight]), "pip", "n").run, "n")).toMatchObject({ x: 0, y: 0 });
  });

  it("an enemy Pip heaves your piece during the enemy turn", () => {
    const foe: Unit = { id: "e", side: "black", kind: "pawn", variant: "rebel", x: 1, y: 1, hp: 1 };
    const rook: Unit = { id: "r", side: "white", kind: "rook", variant: "rebel", x: 2, y: 2, hp: 5 };
    const { run, steps } = endTurn(board([king, rook, foe]));
    // Black forks toward larger y: from b3 the pitchfork hits c2 and heaves the rook on to d1.
    expect(steps.map(s => s.kind)).toEqual(["strike"]);
    expect(unit(run, "r")).toMatchObject({ x: 3, y: 3, hp: 4 });
    expect(steps[0].units).toContainEqual(expect.objectContaining({ id: "r", x: 3, y: 3 }));
    expect(run.turn).toBe(2);
  });
});
