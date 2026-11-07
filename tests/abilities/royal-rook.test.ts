import { describe, expect, it } from "vitest";
import { attack, attackTargets, endTurn, inCheck, kingThreat, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

const king: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", x: 3, y: 3, hp: 5 };
// A player-side Warden (a royal recruit), so his sweep can be driven through attack().
const warden: Unit = { id: "w", side: "white", kind: "rook", variant: "royal", x: 1, y: 2, hp: 5 };
const named: Unit = { id: "p", side: "black", kind: "pawn", variant: "royal", x: 1, y: 1, hp: 1 };
const ally: Unit = { id: "ally", side: "white", kind: "pawn", variant: "rebel", x: 0, y: 2, hp: 1 };
// A royal pawn parked out of everyone's way, so the battle stays on.
const bystander: Unit = { id: "far", side: "black", kind: "pawn", variant: "royal", x: 3, y: 0, hp: 1 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("The Warden (royal rook): Poleaxe Sweep", () => {
  it("hits every piece on his straight neighbours for 3, his own side included", () => {
    const knight: Unit = { id: "n", side: "black", kind: "knight", variant: "royal", x: 2, y: 2, hp: 3 };
    const g = board([king, warden, named, ally, knight, bystander]);
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "w", "p");
    expect(JSON.stringify(g)).toBe(before);
    expect(run.energy).toBe(2);
    // The named pawn, the knight beside him and his own pawn all fall together.
    expect(run.units.map(u => u.id).sort()).toEqual(["far", "king", "w"]);
    expect(step).toMatchObject({ kind: "strike", actor: "w", target: "p", focus: [{ x: 1, y: 1 }], killed: ["p", "ally", "n"] });
    expect(step!.damage).toEqual([{ id: "p", amount: 3 }, { id: "ally", amount: 3 }, { id: "n", amount: 3 }]);
    expect(step!.text).toBe("Your rook strikes Enemy pawn for 3, defeating it. The blow also hits Your pawn for 3 (defeated), Enemy knight for 3 (defeated).");
    // He swings from where he stands.
    expect(unit(run, "w")).toMatchObject({ x: 1, y: 2, hp: 5, acted: true });
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("must name an enemy beside him; the sweep never reaches diagonals or further", () => {
    const knight: Unit = { id: "n", side: "black", kind: "knight", variant: "royal", x: 2, y: 2, hp: 3 };
    const diagonal: Unit = { id: "d", side: "black", kind: "bishop", variant: "royal", x: 0, y: 1, hp: 3 };
    const g = board([king, warden, named, ally, knight, diagonal, bystander]);
    expect(attackTargets(g, unit(g, "w")!).map(t => t.id)).toEqual(["p", "n"]);
    expect(attack(g, "w", "ally")).toEqual({ run: g, step: null });
    expect(attack(g, "w", "d")).toEqual({ run: g, step: null });
    // The bishop on the diagonal is untouched by a sweep at the pawn.
    expect(unit(attack(g, "w", "p").run, "d")!.hp).toBe(3);
  });
  it("lets a braced piece caught in the sweep block 1 and counter if it reaches him", () => {
    const rook: Unit = { id: "r", side: "black", kind: "rook", variant: "royal", x: 2, y: 2, hp: 5, defending: true };
    const g = board([king, warden, named, rook, bystander]);
    const { run, step } = attack(g, "w", "p");
    expect(unit(run, "p")).toBeUndefined();
    expect(unit(run, "r")!.hp).toBe(5 - 2);
    expect(unit(run, "w")!.hp).toBe(5 - 3);
    expect(step!.damage).toEqual([{ id: "p", amount: 3 }, { id: "r", amount: 2 }, { id: "w", amount: 3 }]);
    expect(step!.text).toContain("Enemy rook counters for 3.");
  });
  it("cannot swing at all when the sweep would fell his own king", () => {
    const g = board([{ ...king, x: 1, y: 3, hp: 3 }, warden, named, bystander]);
    expect(attackTargets(g, unit(g, "w")!)).toEqual([]);
    expect(attack(g, "w", "p")).toEqual({ run: g, step: null });
    // A sturdier king merely takes the hit.
    const sturdy = { ...g, units: g.units.map(u => (u.id === "king" ? { ...u, hp: 5 } : u)) };
    const { run, step } = attack(sturdy, "w", "p");
    expect(step!.killed).toEqual(["p"]);
    expect(unit(run, "king")!.hp).toBe(2);
  });
  it("prices his own king's hook into the veto: a sleeping Marmalade at 3 HP takes 2 and lives", () => {
    // Marmalade (misfit king) takes 1 less from every blow while asleep, so the sweep deals him 2, not 3.
    // On the player's side: the Warden beside his own 3-HP Marmalade still has targets and leaves him at 1.
    const cat: Unit = { id: "king", side: "white", kind: "king", variant: "misfit", x: 1, y: 3, hp: 3 };
    const g = board([cat, warden, named, bystander]);
    expect(attackTargets(g, unit(g, "w")!).map(t => t.id)).toEqual(["p"]);
    const { run, step } = attack(g, "w", "p");
    expect(step!.damage).toEqual([{ id: "p", amount: 3 }, { id: "king", amount: 2 }]);
    expect(unit(run, "king")!.hp).toBe(1);
    // The veto weighs the blow with the rules' own damage calculation (the king's incoming hook included):
    // asleep at 2 HP the 2 still fells him, so the swing is refused.
    const frail = { ...g, units: g.units.map(u => (u.id === "king" ? { ...u, hp: 2 } : u)) };
    expect(attackTargets(frail, unit(frail, "w")!)).toEqual([]);
    // On the enemy side the same swing is offered to the AI, and it takes it.
    const enemyCat: Unit = { ...cat, id: "cat", side: "black" };
    const enemyWarden: Unit = { ...warden, side: "black" };
    const e = board([king, enemyWarden, enemyCat, { ...ally, x: 1, y: 1 }]);
    expect(attackTargets(e, unit(e, "w")!).map(t => t.id)).toEqual(["ally"]);
    const { run: after, steps } = endTurn(e);
    expect(steps[0]).toMatchObject({ kind: "strike", actor: "w", target: "ally", damage: [{ id: "ally", amount: 3 }, { id: "cat", amount: 2 }] });
    expect(unit(after, "ally")).toBeUndefined();
    expect(unit(after, "cat")!.hp).toBe(1);
  });
  it("as an enemy, leaves his swing unpaid when the knight's cleaner kill drains the pool, and sweeps once no friend stands behind him", () => {
    // The Warden on b3 could kill the pawn ahead of him, but the sweep would also fell the pawn behind him,
    // which costs the swing 160 points. The knight's clean kill scores higher, so it strikes first and the
    // pool (3) cannot pay for the Warden's blow. (The spec's flat -100 per friendly kill is not in turns.ts
    // yet: with energy to spare he would still take the trade.)
    const enemyWarden: Unit = { ...warden, side: "black", x: 1, y: 1 };
    const friend: Unit = { id: "friend", side: "black", kind: "pawn", variant: "royal", x: 1, y: 0, hp: 1 };
    const knight: Unit = { id: "n", side: "black", kind: "knight", variant: "royal", x: 4, y: 0, hp: 3 };
    const a: Unit = { ...ally, id: "a", x: 1, y: 2 };
    const c: Unit = { ...ally, id: "c", x: 5, y: 2 };
    const g = board([{ ...king, x: 2, y: 3 }, enemyWarden, friend, knight, a, c], { encounter: 1 });
    const { run, steps } = endTurn(g);
    expect(steps[0]).toMatchObject({ kind: "strike", actor: "n", target: "c" });
    expect(unit(run, "friend")).toBeDefined();
    expect(unit(run, "a")).toBeDefined();
    expect(unit(run, "c")).toBeUndefined();
    // Without the pawn behind him the sweep is the best blow on the board.
    const alone = endTurn({ ...g, units: g.units.filter(u => u.id !== "friend") });
    expect(alone.steps[0]).toMatchObject({ kind: "strike", actor: "w", target: "a" });
    expect(unit(alone.run, "a")).toBeUndefined();
    expect(unit(alone.run, "c")).toBeDefined();
  });
  it("threatens your king from his straights whatever he names, so a 3-HP king beside him is in check", () => {
    const enemyWarden: Unit = { ...warden, side: "black" };
    const g = board([{ ...king, x: 1, y: 3, hp: 3 }, enemyWarden, ally, bystander]);
    expect(attackTargets(g, unit(g, "w")!, 2).map(t => t.id)).toEqual(["king", "ally"]);
    expect(kingThreat(g)).toEqual({ damage: 3, attackers: ["w"] });
    expect(inCheck(g)).toBe(true);
  });
});
