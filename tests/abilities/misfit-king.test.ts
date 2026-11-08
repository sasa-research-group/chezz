import { describe, expect, it } from "vitest";
import { ENERGY, attack, attackTargets, canDefend, canEscape, dealtTo, defend, endTurn, inCheck, kingThreat, move, moveTargets, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

// Marmalade (misfit king): Catnap. Asleep he cannot move, strike or brace; every blow on him deals 1
// less, asleep or awake; a friend ending a move beside him wakes him for the turn (queen moves), then
// he naps again. The other pieces here are finished abilities whose movement and damage are their
// kind's: Haystack (misfit rook), King Gilt (royal king, deals 1) and King Redcape (rebel king). The
// pawn is Pip (rebel), whose only hook fires on his own strike.
const cat = (side: Unit["side"], x: number, y: number, hp = 5, extra: Partial<Unit> = {}): Unit => ({ id: side === "white" ? "king" : "m", side, kind: "king", variant: "misfit", hp, x, y, ...extra });
const hay = (id: string, side: Unit["side"], x: number, y: number): Unit => ({ id, side, kind: "rook", variant: "misfit", hp: 5, x, y });
const redcape: Unit = { id: "king", side: "white", kind: "king", variant: "rebel", hp: 5, x: 0, y: 3 };
const gilt = (x: number, y: number): Unit => ({ id: "gilt", side: "black", kind: "king", variant: "royal", hp: 5, x, y });
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id)!;

describe("Marmalade (misfit king): Catnap", () => {
  it("sleeps: no moves, strikes or brace, every blow deals 1 less, and being struck does not wake him", () => {
    // Your Haystack on d3 stands right under the sleeping enemy cat on d4.
    const g = board([redcape, hay("h", "white", 3, 1), cat("black", 3, 0)]);
    const m = unit(g, "m");
    expect(moveTargets(g, m)).toEqual([]);
    expect(attackTargets(g, m)).toEqual([]);
    expect(canDefend(g, m)).toBe(false);
    expect(dealtTo(g, unit(g, "h"), m)).toBe(2);
    // The -1 is his whether he naps or zooms: the sentence says every hit.
    expect(dealtTo(g, unit(g, "h"), { ...m, mods: { awake: true } })).toBe(2);
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "h", "m");
    expect(JSON.stringify(g)).toBe(before);
    expect(step).toMatchObject({ target: "m", damage: [{ id: "m", amount: 2 }], killed: [] });
    expect(unit(run, "m").hp).toBe(3);
    expect(unit(run, "m").mods).toBeUndefined();
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("wakes when a friend ends a move beside him, zooms like a queen, and naps when the turn ends", () => {
    // Encounter 1 (6x4, enemy energy 3). The pawn on e4 marches to e3 beside the cat on f4 (1 energy);
    // with 2 left the woken cat slides two squares down the f-file toward your king on f1.
    const pawn: Unit = { id: "bp", side: "black", kind: "pawn", variant: "rebel", hp: 1, x: 4, y: 0 };
    const g = board([{ ...redcape, x: 5, y: 3 }, pawn, cat("black", 5, 0)], { encounter: 1 });
    expect(inCheck(g)).toBe(false);
    const { run, steps } = endTurn(g);
    expect(steps.map(s => [s.actor, s.kind])).toEqual([["bp", "move"], ["m", "move"]]);
    expect(steps[0].units.find(u => u.id === "m")).toMatchObject({ x: 5, y: 0, mods: { awake: true } });
    expect(steps[1].units.find(u => u.id === "m")).toMatchObject({ x: 5, y: 2, mods: { awake: true } });
    expect(run.log.some(l => l.includes("wakes up beside Enemy pawn"))).toBe(true);
    // The turn is over: he is asleep again where he landed.
    expect(unit(run, "m")).toMatchObject({ x: 5, y: 2 });
    expect(unit(run, "m").mods).toBeUndefined();
    expect(run.log.some(l => l.includes("naps again"))).toBe(true);
    // Asleep beside your king he still threatens him: the pawn can step beside him again (1) and wake him to strike (2).
    expect(kingThreat(run).attackers).toEqual(expect.arrayContaining(["m", "bp"]));
    // With no friend left to nudge him he is harmless.
    const alone = { ...run, units: run.units.filter(u => u.id !== "bp") };
    expect(kingThreat(alone).attackers).not.toContain("m");
    expect(readRun(JSON.stringify(run))).toEqual(run);
  });
  it("as your king: a nudge gives him queen moves, a strike and a brace for the turn", () => {
    // Your sleeping cat on b1, your Haystack on d1, and an enemy cat (asleep, so harmless) on a2 touching him.
    const g = board([cat("white", 1, 3), hay("h", "white", 3, 3), cat("black", 0, 2)]);
    const king = unit(g, "king");
    expect(moveTargets(g, king)).toEqual([]);
    expect(attackTargets(g, king)).toEqual([]);
    expect(defend(g, "king")).toBe(g);
    const before = JSON.stringify(g);
    const woken = move(g, "h", { x: 2, y: 3 });
    expect(JSON.stringify(g)).toBe(before);
    expect(unit(woken, "king").mods).toEqual({ awake: true });
    expect(woken.log[0]).toBe("Your king wakes up beside Your rook: zoomies!");
    const moves = moveTargets(woken, unit(woken, "king"));
    expect(moves).toEqual(expect.arrayContaining([{ x: 1, y: 2, cost: 1 }, { x: 0, y: 3, cost: 1 }, { x: 1, y: 0, cost: 3 }, { x: 3, y: 1, cost: 2 }]));
    expect(moves).not.toContainEqual(expect.objectContaining({ x: 2, y: 3 }));
    expect(attackTargets(woken, unit(woken, "king"))).toEqual([{ x: 0, y: 2, cost: 2, id: "m" }]);
    expect(readRun(JSON.stringify(woken))).toEqual(woken);
    const braced = defend(woken, "king");
    expect(unit(braced, "king")).toMatchObject({ defending: true, mods: { awake: true } });
    expect(braced.energy).toBe(ENERGY - 2);
    // His own move beside the Haystack is not a nudge: one wake-up line only.
    expect(move(woken, "king", { x: 1, y: 2 }).log.filter(l => l.includes("zoomies")).length).toBe(1);
    // When your turn ends he dozes off before the enemy moves, and is still asleep on your next turn.
    const { run } = endTurn(braced);
    expect(unit(run, "king")).toMatchObject({ x: 1, y: 3, hp: 5 });
    expect(unit(run, "king").mods).toBeUndefined();
    expect(moveTargets(run, unit(run, "king"))).toEqual([]);
  });
  it("counts the -1 in check arithmetic, and a lone sleeper just lies there", () => {
    // An enemy Haystack on b2 deals 3: through the nap that is 2, so a 3-HP cat is safe where a 3-HP Redcape is in check.
    const rook = hay("r", "black", 1, 2);
    expect(inCheck(board([cat("white", 1, 3, 3), rook]))).toBe(false);
    expect(inCheck(board([{ ...redcape, x: 1, y: 3, hp: 3 }, rook]))).toBe(true);
    // King Gilt's 1 fades to nothing on the cat, asleep or awake.
    expect(kingThreat(board([cat("white", 1, 3), gilt(2, 2)]))).toEqual({ damage: 0, attackers: [] });
    expect(kingThreat(board([cat("white", 1, 3, 5, { mods: { awake: true } }), gilt(2, 2)]))).toEqual({ damage: 0, attackers: [] });
    const lone = board([cat("white", 1, 3, 2), rook]);
    expect(kingThreat(lone)).toEqual({ damage: 2, attackers: ["r"] });
    expect(inCheck(lone)).toBe(true);
    // Nothing he can do himself: no move, no strike, no brace. The turn ends and the blow lands.
    expect(canEscape(lone)).toBe(false);
    expect(endTurn(lone).run.phase).toBe("defeat");
    // With a friend to nudge him awake, the escape is "nudge, then step": the Haystack to c1 wakes him, and a1 is off the enemy's straight reach.
    const nudged = board([cat("white", 1, 3, 2), hay("ally", "white", 3, 3), rook]);
    expect(canEscape(nudged)).toBe(true);
    expect(endTurn(nudged).steps).toEqual([]);
    const out = move(move(nudged, "ally", { x: 2, y: 3 }), "king", { x: 0, y: 3 });
    expect(unit(out, "king")).toMatchObject({ x: 0, y: 3 });
    expect(inCheck(out)).toBe(false);
  });
  it("prices the woken cat like the sleeping one, so a nudge beside an enemy is never refused as into-check", () => {
    // An enemy Haystack on b2 deals the 3-HP cat on b1 2 through the nap: no check. Waking him must not
    // change that sum, or the nudge to c1 would be refused while ending the turn shows him surviving.
    const g = board([cat("white", 1, 3, 3), hay("ally", "white", 3, 3), hay("r", "black", 1, 2)]);
    expect(inCheck(g)).toBe(false);
    const nudged = move(g, "ally", { x: 2, y: 3 });
    expect(nudged).not.toBe(g);
    expect(unit(nudged, "king").mods).toEqual({ awake: true });
    expect(kingThreat(nudged)).toEqual({ damage: 2, attackers: ["r"] });
    expect(inCheck(nudged)).toBe(false);
    const { run, steps } = endTurn(nudged);
    expect(steps[0]).toMatchObject({ kind: "strike", actor: "r", target: "king", damage: [{ id: "king", amount: 2 }] });
    expect(unit(run, "king")).toMatchObject({ x: 1, y: 3, hp: 1 });
    expect(unit(run, "king").mods).toBeUndefined();
    // The one blow that lands on him awake, a counter to his own strike, is softened the same way.
    const bold = board([cat("white", 1, 3, 5, { mods: { awake: true } }), { ...hay("r", "black", 1, 2), defending: true }]);
    const { step } = attack(bold, "king", "r");
    expect(step).toMatchObject({ target: "r", damage: [{ id: "r", amount: 1 }, { id: "king", amount: 2 }] });
    expect(step!.text).toContain("Enemy rook counters for 2");
  });
});
