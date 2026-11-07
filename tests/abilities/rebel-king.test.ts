import { describe, expect, it } from "vitest";
import { ENERGY, alt, altActions, attackTargets, defend, endTurn, inCheck, leaveCamp, move, moveTargets, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

// King Redcape (rebel king): Dub. Once per battle, for 2 energy, he knights an adjacent friendly pawn.
const redcape = (x: number, y: number, hp = 5): Unit => ({ id: "king", side: "white", kind: "king", variant: "rebel", hp, x, y });
const pawn = (id: string, x: number, y: number): Unit => ({ id, side: "white", kind: "pawn", variant: "rebel", hp: 1, x, y });
// Enemy bystanders wear casts whose hooks never fire here: Pip (rebel pawn) acts only on his own strike,
// Haystack (misfit rook) only on its own kill.
const foe = (id: string, kind: Unit["kind"], x: number, y: number, hp: number, variant: Unit["variant"] = "rebel"): Unit => ({ id, side: "black", kind, variant, hp, x, y });
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id)!;
// Encounter 2 is 6x6 with a wall band at y = 2..3 except x = 2, 3. A black pawn on a1 (0,1) is stuck
// there (its forward square and both strike squares are walls or off the board), so the enemy turn
// is quiet and the geometry around the dub stays put.
const lackey = foe("lackey", "pawn", 0, 1, 1);

describe("King Redcape (rebel king): Dub", () => {
  it("knights an adjacent pawn into a kneeling rebel knight whose reach is live next turn", () => {
    // The pawn is alight (Wick's burn): the dub changes kind, cast and HP and nothing else, so it keeps burning.
    const g = board([redcape(3, 2), { ...pawn("p", 2, 2), mods: { burning: 2 } }, lackey], { encounter: 2 });
    expect(altActions(g, unit(g, "king"))).toMatchObject([{ id: "dub", label: "Dub (2)", cost: 2, targets: [{ x: 2, y: 2 }] }]);
    // As a pawn it strikes forward diagonals only, so the lackey on a1 is out of reach.
    expect(attackTargets(g, unit(g, "p"))).toEqual([]);
    const before = JSON.stringify(g);
    const { run, step } = alt(g, "king", "dub", { x: 2, y: 2 });
    expect(JSON.stringify(g)).toBe(before);
    expect(unit(run, "p")).toEqual({ id: "p", side: "white", kind: "knight", variant: "rebel", hp: 3, x: 2, y: 2, moved: true, acted: true, mods: { burning: 2 } });
    expect(run.energy).toBe(ENERGY - 2);
    expect(run.flags).toEqual({ dubbed: true });
    expect(run.promoting).toBeUndefined();
    expect(unit(run, "king").acted).toBe(true);
    expect(step).toMatchObject({ kind: "alt", actor: "king", target: "p", from: "pawn", focus: [{ x: 2, y: 2 }], damage: [], killed: [] });
    expect(step!.text).toContain("dubs");
    expect(run.log[0]).toBe(step!.text);
    // It kneels: no move, strike or brace for the rest of the turn.
    expect(moveTargets(run, unit(run, "p"))).toEqual([]);
    expect(attackTargets(run, unit(run, "p"))).toEqual([]);
    expect(defend(run, "p")).toBe(run);
    expect(readRun(JSON.stringify(run))).toEqual(run);
    // Next turn it jumps like a knight: the lackey a pawn could never touch is now a strike away.
    const next = endTurn(run).run;
    expect(next.phase).toBe("player");
    expect(attackTargets(next, unit(next, "p"))).toEqual([{ x: 0, y: 1, cost: 2, id: "lackey" }]);
    // No cure came with the sword: the burn it carried ticked at the start of your turn.
    expect(unit(next, "p")).toMatchObject({ hp: 2, mods: { burning: 1 } });
  });
  it("is offered once per battle", () => {
    const g = board([redcape(3, 2), pawn("p", 2, 2), pawn("q", 3, 1), lackey], { encounter: 2 });
    expect(altActions(g, unit(g, "king"))[0].targets).toEqual(expect.arrayContaining([{ x: 2, y: 2 }, { x: 3, y: 1 }]));
    const dubbed = alt(g, "king", "dub", { x: 2, y: 2 }).run;
    expect(unit(dubbed, "q").kind).toBe("pawn");
    const next = endTurn(dubbed).run;
    expect(next.flags).toEqual({ dubbed: true });
    expect(unit(next, "king").acted).toBeUndefined();
    expect(altActions(next, unit(next, "king"))).toEqual([]);
    const refused = alt(next, "king", "dub", { x: 3, y: 1 });
    expect(refused).toEqual({ run: next, step: null });
    expect(unit(next, "q").kind).toBe("pawn");
  });
  it("targets only friendly pawns on his 8 neighbours, costs 2, and may follow a move but not an action", () => {
    const g = board([redcape(1, 2), pawn("p", 1, 3), { ...pawn("far", 3, 3) }, { id: "b", side: "white", kind: "bishop", variant: "rebel", hp: 3, x: 0, y: 2 }, foe("e", "pawn", 2, 2, 1)]);
    expect(altActions(g, unit(g, "king"))[0].targets).toEqual([{ x: 1, y: 3 }]);
    // The enemy pawn beside him is not a target, and the rules refuse an unlisted square.
    expect(alt(g, "king", "dub", { x: 2, y: 2 })).toEqual({ run: g, step: null });
    // With 1 energy the dub is not affordable.
    const poor = { ...g, energy: 1 };
    expect(altActions(poor, unit(poor, "king"))).toEqual([]);
    expect(alt(poor, "king", "dub", { x: 1, y: 3 })).toEqual({ run: poor, step: null });
    // He may walk up to the pawn first (1 + 2 energy), but not dub after bracing.
    const walked = move(g, "king", { x: 2, y: 3 });
    expect(walked).not.toBe(g);
    const { run } = alt(walked, "king", "dub", { x: 1, y: 3 });
    expect(unit(run, "p")).toMatchObject({ kind: "knight", variant: "rebel", hp: 3 });
    expect(run.energy).toBe(ENERGY - 3);
    expect(altActions(defend(g, "king"), unit(defend(g, "king"), "king"))).toEqual([]);
    // Nobody to knight: no action at all.
    const alone = board([redcape(1, 2), foe("e", "pawn", 3, 0, 1)]);
    expect(altActions(alone, unit(alone, "king"))).toEqual([]);
  });
  it("comes back for the next battle: spawn clears the flag", () => {
    const camp: Run = { ...newRun(), phase: "camp", flags: { dubbed: true } };
    const road = leaveCamp(camp);
    expect(road.encounter).toBe(1);
    expect(road.flags).toBeUndefined();
    expect(altActions(road, unit(road, "king"))).toEqual([]); // no pawn beside him yet, but the dub itself is back
    expect(readRun(JSON.stringify(camp))).toEqual(camp);
  });
  it("moves nobody, so it is allowed while already in check", () => {
    // A Haystack on b3 reaches the 3-HP king on b2: check. Dubbing the pawn on a2 is still his to take.
    const g = board([redcape(1, 2, 3), pawn("p", 0, 2), foe("r", "rook", 1, 1, 5, "misfit")]);
    expect(inCheck(g)).toBe(true);
    const before = JSON.stringify(g);
    const { run, step } = alt(g, "king", "dub", { x: 0, y: 2 });
    expect(JSON.stringify(g)).toBe(before);
    expect(step).not.toBeNull();
    expect(unit(run, "p")).toMatchObject({ kind: "knight", hp: 3, x: 0, y: 2 });
    expect(unit(run, "king")).toMatchObject({ x: 1, y: 2, hp: 3 });
    expect(inCheck(run)).toBe(true);
  });
});
