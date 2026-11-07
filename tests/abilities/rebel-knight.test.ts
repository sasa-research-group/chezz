import { describe, expect, it } from "vitest";
import { ENERGY, approaches, attack, attackTargets, defend, endTurn, kingThreat, move, moveTargets, newRun, reaches, readRun, walkAndStrike } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";
import { abilityOf } from "../../src/game/abilities";

// 4x4 board (encounter 0) unless a test says otherwise; coordinates below use the a1 = (0,3) file/rank names.
const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", x: 0, y: 3, hp: 5 };
const dobbin: Unit = { id: "d", side: "white", kind: "knight", variant: "rebel", x: 1, y: 3, hp: 3 };
const rook: Unit = { id: "f", side: "black", kind: "rook", variant: "misfit", x: 0, y: 0, hp: 5 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Dobbin (rebel knight): Giddy-up", () => {
  it("jumps for 1, then strikes for the usual 2 and still has 1 to brace a friend", () => {
    const g = board([king, dobbin, rook]);
    expect(abilityOf(dobbin)?.ability).toBe("Giddy-up");
    // From b1 three L's stay on the board. a3's elbows are a1 (the king) and b3: one clear elbow is enough.
    expect(moveTargets(g, dobbin).map(t => `${t.x},${t.y}:${t.cost}`).sort()).toEqual(["0,1:1", "2,1:1", "3,2:1"]);
    expect(moveTargets(g, dobbin, 1)).toHaveLength(3);
    expect(moveTargets(g, dobbin, 0)).toEqual([]);
    // Tap-to-strike on the rook at a4 prices the way in at jump 1 + strike 2.
    expect(approaches(g, "d", "f")).toEqual([{ x: 2, y: 1, cost: 3 }]);
    const jumped = move(g, "d", { x: 2, y: 1 });
    expect(unit(jumped, "d")).toMatchObject({ x: 2, y: 1, moved: true });
    expect(jumped.energy).toBe(ENERGY - 1);
    expect(attackTargets(jumped, unit(jumped, "d")!)).toEqual([{ x: 0, y: 0, cost: 2, id: "f" }]);
    const { run } = attack(jumped, "d", "f");
    expect(unit(run, "f")!.hp).toBe(5 - 2);
    expect(run.energy).toBe(ENERGY - 3);
    expect(defend(run, "king").energy).toBe(0);
  });

  it("needs a clear elbow: both plugged (walls or pieces of either side) means no jump and no strike", () => {
    // 6x4 board with walls on d3 and d2. Dobbin on d1, your king on b1, an enemy pawn on c1, an enemy knight on c3.
    const d: Unit = { ...dobbin, x: 3, y: 3 };
    const k: Unit = { ...king, x: 1, y: 3 };
    const victim: Unit = { id: "v", side: "black", kind: "knight", variant: "misfit", x: 2, y: 1, hp: 2 };
    const plug: Unit = { id: "e", side: "black", kind: "pawn", variant: "royal", x: 2, y: 3, hp: 1 };
    const g = board([k, d, victim, plug], { encounter: 1 });
    // b2's elbows are b1 (own king) and d2 (wall): no jump. e3 and f2 keep an outer elbow clear.
    expect(moveTargets(g, d).map(t => `${t.x},${t.y}:${t.cost}`).sort()).toEqual(["4,1:1", "5,2:1"]);
    // The knight on c3 sits on an L whose elbows are c1 (enemy pawn) and d3 (wall): untouchable.
    expect(reaches(g, d, d, victim)).toBe(false);
    expect(attackTargets(g, d)).toEqual([]);
    expect(attack(g, "d", "v").step).toBeNull();
    // Once the pawn is gone the strike is on.
    const cleared = { ...g, units: g.units.filter(u => u.id !== "e") };
    expect(reaches(cleared, d, d, victim)).toBe(true);
    expect(attackTargets(cleared, d)).toEqual([{ x: 2, y: 1, cost: 2, id: "v" }]);
  });

  it("kingThreat: the 1-energy jump brings a far enemy Dobbin into range, and plugging an elbow removes him", () => {
    // 6x4 board, enemy pool 3. An enemy Dobbin on e2 jumps to c3 (1) and strikes your king on b1 (2).
    const k: Unit = { ...king, x: 1, y: 3 };
    const enemy: Unit = { id: "n", side: "black", kind: "knight", variant: "rebel", x: 4, y: 2, hp: 3 };
    const g = board([k, enemy], { encounter: 1 });
    expect(kingThreat(g)).toEqual({ damage: 2, attackers: ["n"] });
    // A knight with the ordinary 2-energy jump on the same square needs 4: out of reach.
    expect(kingThreat({ ...g, units: [k, { ...enemy, variant: "misfit", hp: 2 }] }).damage).toBe(0);
    // The strike L from c3 has elbows b3 and c1. Your pawns on both: no line to the king. One alone is not enough.
    const plugs: Unit[] = [{ id: "p1", side: "white", kind: "pawn", variant: "rebel", x: 1, y: 1, hp: 1 }, { id: "p2", side: "white", kind: "pawn", variant: "rebel", x: 2, y: 3, hp: 1 }];
    expect(kingThreat({ ...g, units: [k, enemy, ...plugs] })).toEqual({ damage: 0, attackers: [] });
    expect(kingThreat({ ...g, units: [k, enemy, plugs[0]] }).damage).toBe(2);
    // The patrol takes the line: jump (1) and strike (2) spend its whole pool.
    const before = JSON.stringify(g);
    const { run, spent } = endTurn(g);
    expect(JSON.stringify(g)).toBe(before);
    expect(unit(run, "n")).toMatchObject({ x: 2, y: 1 });
    expect(unit(run, "king")!.hp).toBe(5 - 2);
    expect(spent).toBe(3);
  });

  it("a braced Dobbin counters only strikers he reaches under the elbow rule", () => {
    // An enemy Dobbin braced on c3. Your Sir Lance on c1 jumps to a2 and charges it: 3, 2 after the block.
    const braced: Unit = { id: "e", side: "black", kind: "knight", variant: "rebel", x: 2, y: 1, hp: 3, defending: true, acted: true };
    const lance: Unit = { id: "l", side: "white", kind: "knight", variant: "royal", x: 2, y: 3, hp: 3 };
    const plugs: Unit[] = [{ id: "p", side: "white", kind: "pawn", variant: "rebel", x: 0, y: 1, hp: 1 }, { id: "q", side: "black", kind: "pawn", variant: "royal", x: 2, y: 2, hp: 1 }];
    const g = board([king, lance, braced, ...plugs]);
    const plugged = walkAndStrike(g, "l", { x: 0, y: 2 }, "e")!;
    expect(unit(plugged.run, "e")!.hp).toBe(1);
    // The L back to a2 has elbows a3 (your pawn) and c2 (its own pawn): the counter never comes.
    expect(unit(plugged.run, "l")!.hp).toBe(3);
    expect(plugged.step.text).not.toContain("counters");
    // With a3 clear the counter lands for the knight's 2.
    const clear = walkAndStrike({ ...g, units: g.units.filter(u => u.id !== "p") }, "l", { x: 0, y: 2 }, "e")!;
    expect(unit(clear.run, "l")!.hp).toBe(1);
    expect(clear.step.text).toContain("Enemy knight counters for 2");
  });

  it("is pure and survives a save round-trip", () => {
    const g = board([king, dobbin, rook]);
    const before = JSON.stringify(g);
    moveTargets(g, dobbin); attackTargets(g, dobbin); approaches(g, "d", "f"); kingThreat(g);
    const { run } = attack(move(g, "d", { x: 2, y: 1 }), "d", "f");
    expect(JSON.stringify(g)).toBe(before);
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
});
