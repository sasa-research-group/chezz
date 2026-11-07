import { describe, expect, it } from "vitest";
import { ENERGY, approaches, attack, attackTargets, endTurn, kingThreat, maxHp, moveTargets, newRun, passable, promote, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";
import { abilityOf } from "../../src/game/abilities";

// 4x4 board (encounter 0) unless a test says otherwise; coordinates below use the a1 = (0,3) file/rank names.
const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", x: 3, y: 3, hp: 5 };
const nobody: Unit = { id: "n", side: "black", kind: "knight", variant: "misfit", x: 0, y: 1, hp: 2 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Nobody (misfit knight): Hollow", () => {
  it("dies into a wall that stops slides and strikes but not a knight's jump, and the save keeps it", () => {
    // Your rook on a2 strikes Nobody on a3; an enemy pawn waits on a4 behind him; your knight stands on b2.
    const rook: Unit = { id: "r", side: "white", kind: "rook", variant: "rebel", x: 0, y: 2, hp: 5 };
    const knight: Unit = { id: "k", side: "white", kind: "knight", variant: "misfit", x: 1, y: 2, hp: 2 };
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", variant: "royal", x: 0, y: 0, hp: 1 };
    const g = board([king, rook, knight, nobody, pawn]);
    expect(abilityOf(nobody)?.ability).toBe("Hollow");
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "r", "n");
    expect(JSON.stringify(g)).toBe(before);
    expect(step!.killed).toEqual(["n"]);
    expect(unit(run, "n")).toBeUndefined();
    expect(run.walls).toEqual([{ x: 0, y: 1 }]);
    expect(passable(run, { x: 0, y: 1 })).toBe(false);
    expect(run.log[0]).toBe("Enemy knight's empty suit stands as a wall at a3.");
    expect(readRun(JSON.stringify(run))).toEqual(run);
    // Next turn the rook can't slide up the a-file or get at the pawn behind the suit (it could without the wall)...
    const fresh: Run = { ...run, energy: ENERGY, units: run.units.map(u => (u.side === "white" ? { ...u, moved: false, acted: false } : u)) };
    expect(moveTargets(fresh, unit(fresh, "r")!).filter(t => t.y < 2)).toEqual([]);
    expect(approaches(fresh, "r", "p")).toEqual([]);
    expect(approaches({ ...fresh, walls: undefined }, "r", "p")).toEqual([{ x: 0, y: 1, cost: 3 }]);
    // ...but a knight's jump is a leap: yours still strikes the pawn over the suit.
    expect(attackTargets(fresh, unit(fresh, "k")!)).toEqual([{ x: 0, y: 0, cost: 2, id: "p" }]);
  });

  it("falls to any cause: a counter or a burn tick leaves the suit too", () => {
    // Your Nobody on b1 strikes a braced enemy Dobbin on c3: 1 lands, the counter for 2 kills him.
    const k: Unit = { ...king, x: 0, y: 3 };
    const mine: Unit = { ...nobody, id: "m", side: "white", x: 1, y: 3 };
    const braced: Unit = { id: "e", side: "black", kind: "knight", variant: "rebel", x: 2, y: 1, hp: 3, defending: true, acted: true };
    const { run, step } = attack(board([k, mine, braced]), "m", "e");
    expect(step!.text).toContain("Enemy knight counters for 2, defeating it");
    expect(unit(run, "m")).toBeUndefined();
    expect(run.walls).toEqual([{ x: 1, y: 3 }]);
    expect(run.log[0]).toBe("Your knight's empty suit stands as a wall at b1.");
    // An enemy Nobody burning on 1 HP dies at the start of the patrol's turn, before it moves.
    const burning: Unit = { ...nobody, x: 3, y: 0, hp: 1, mods: { burning: 1 } };
    const bystander: Unit = { id: "o", side: "black", kind: "pawn", variant: "royal", x: 3, y: 3, hp: 1 };
    const after = endTurn(board([k, burning, bystander])).run;
    expect(unit(after, "n")).toBeUndefined();
    expect(after.walls).toEqual([{ x: 3, y: 0 }]);
    expect(after.history).toContain("Enemy knight's empty suit stands as a wall at d4.");
  });

  it("the kill is judged with the new wall: the suit seals the file, and stacks with walls already raised", () => {
    // 6x4 board, enemy pool 3. An enemy rook on a4 behind Nobody on a3; your king on a2, your knight on b1.
    const k: Unit = { ...king, x: 0, y: 2 };
    const rook: Unit = { id: "r", side: "black", kind: "rook", variant: "misfit", x: 0, y: 0, hp: 5 };
    const knight: Unit = { id: "k", side: "white", kind: "knight", variant: "misfit", x: 1, y: 3, hp: 2 };
    const g = board([k, knight, nobody, rook], { encounter: 1, walls: [{ x: 5, y: 0 }] });
    expect(kingThreat(g).damage).toBe(0);
    const { run } = attack(g, "k", "n");
    expect(run.walls).toEqual([{ x: 5, y: 0 }, { x: 0, y: 1 }]);
    // The rook still can't come down the file: no threat.
    expect(kingThreat(run).damage).toBe(0);
    // Had an ordinary knight stood there, the rook would step onto a3 (1) and strike the king (2) for 3.
    const plain = attack({ ...g, units: g.units.map(u => (u.id === "n" ? { ...u, variant: "rebel" } : u)) }, "k", "n").run;
    expect(plain.walls).toEqual([{ x: 5, y: 0 }]);
    expect(kingThreat(plain)).toEqual({ damage: 3, attackers: ["r"] });
  });

  it("a Haystack that eats Nobody rolls onto the square and flattens the suit, so no wall is left", () => {
    // Your Haystack on b2 strikes Nobody on b3: the suit rises as he falls (onDeath), then the hay rolls over it (afterStrike).
    const k: Unit = { ...king, x: 0, y: 3 };
    const hay: Unit = { id: "h", side: "white", kind: "rook", variant: "misfit", x: 1, y: 2, hp: 5 };
    const far: Unit = { id: "p", side: "black", kind: "pawn", variant: "royal", x: 3, y: 0, hp: 1 };
    const { run, step } = attack(board([k, hay, { ...nobody, x: 1, y: 1 }, far]), "h", "n");
    expect(step!.killed).toEqual(["n"]);
    expect(run.walls).toBeUndefined();
    expect(passable(run, { x: 1, y: 1 })).toBe(true);
    expect(unit(run, "h")).toMatchObject({ x: 1, y: 1, mods: { absorbed: "knight" } });
    expect(run.log.slice(0, 2)).toEqual(["Your rook rolls onto b3 and flattens the wall there.", "Enemy knight's empty suit stands as a wall at b3."]);
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });

  it("has 2 HP: saves with more are rejected, and a misfit pawn crowned a knight becomes a 2-HP Nobody", () => {
    expect(maxHp(nobody)).toBe(2);
    const g = board([king, nobody]);
    expect(readRun(JSON.stringify(g))).toEqual(g);
    expect(readRun(JSON.stringify({ ...g, units: [king, { ...nobody, hp: 3 }] }))).toBeNull();
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", variant: "misfit", x: 2, y: 0, hp: 1 };
    const { run } = promote(board([king, pawn, nobody], { promoting: "p" }), "p", "knight");
    expect(unit(run, "p")).toMatchObject({ kind: "knight", variant: "misfit", hp: 2 });
  });
});
