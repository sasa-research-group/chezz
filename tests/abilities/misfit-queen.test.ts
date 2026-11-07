import { describe, expect, it } from "vitest";
import { attack, endTurn, newRun, readRun } from "../../src/game/turns";
import type { Run, Unit } from "../../src/game/turns";

const king: Unit = { id: "king", side: "white", kind: "king", x: 0, y: 3, hp: 5 };
const wick: Unit = { id: "w", side: "white", kind: "queen", variant: "misfit", hp: 9, x: 2, y: 1 };
// Diagonal to Wick (a rook can't hit back) and diagonal to the king, so the AI has nowhere better
// to be and nothing to strike: it just sits there and burns.
const rook: Unit = { id: "r", side: "black", kind: "rook", hp: 5, x: 1, y: 2 };
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, ...extra });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("Wick (misfit queen): Candlelight", () => {
  it("sets a struck piece alight: 1 at the start of each of its next two turns, then it stops", () => {
    // Braced: the block softens the blow to 2, but neither stops the fire nor the ticks.
    const g = board([king, wick, { ...rook, defending: true }]);
    const before = JSON.stringify(g);
    const { run, step } = attack(g, "w", "r");
    expect(JSON.stringify(g)).toBe(before);
    expect(step!.damage).toEqual([{ id: "r", amount: 2 }]);
    expect(unit(run, "r")).toMatchObject({ hp: 3, mods: { burning: 2 } });
    expect(run.log[0]).toBe("Enemy rook catches fire.");
    expect(readRun(JSON.stringify(run))).toEqual(run);
    const t1 = endTurn(run).run;
    expect(unit(t1, "r")).toMatchObject({ hp: 2, mods: { burning: 1 } });
    expect(t1.log).toContain("Enemy rook burns for 1.");
    const t2 = endTurn(t1).run;
    expect(unit(t2, "r")).toMatchObject({ hp: 1 });
    expect(unit(t2, "r")!.mods).toBeUndefined();
    const t3 = endTurn(t2).run;
    expect(unit(t3, "r")).toMatchObject({ hp: 1 });
  });

  it("burns a Haystack for three turns, and a second hit resets the fire rather than stacking it", () => {
    const hay: Unit = { ...rook, id: "h", variant: "misfit", defending: true };
    const { run } = attack(board([king, wick, hay]), "w", "h");
    expect(unit(run, "h")).toMatchObject({ hp: 3, mods: { burning: 3 } });
    const t1 = endTurn(run).run;
    expect(unit(t1, "h")).toMatchObject({ hp: 2, mods: { burning: 2 } });
    const t2 = endTurn(t1).run;
    expect(unit(t2, "h")).toMatchObject({ hp: 1, mods: { burning: 1 } });
    // The third tick takes it before it can act, and the road is clear.
    const t3 = endTurn(t2);
    expect(t3.steps).toEqual([]);
    expect(unit(t3.run, "h")).toBeUndefined();
    expect(t3.run.phase).toBe("camp");
    // Hitting a piece that is already burning puts the fire back to 2, never 3.
    const relit = attack(board([king, wick, { ...rook, mods: { burning: 1 } }]), "w", "r").run;
    expect(unit(relit, "r")).toMatchObject({ hp: 2, mods: { burning: 2 } });
  });

  it("burns down 1 at the start of each of her own turns and gutters out at 0, with no kill credit", () => {
    const g = board([king, wick, rook]);
    const before = JSON.stringify(g);
    const t1 = endTurn(g).run;
    expect(JSON.stringify(g)).toBe(before);
    expect(unit(t1, "w")).toMatchObject({ hp: 8 });
    expect(t1.log).toContain("Your queen burns down.");
    expect(unit(endTurn(t1).run, "w")).toMatchObject({ hp: 7 });
    // Her last turn: the candle goes out before she can act; the battle goes on without her.
    const low = endTurn(board([king, { ...wick, hp: 1 }, rook])).run;
    expect(unit(low, "w")).toBeUndefined();
    expect(low.log).toContain("Your queen gutters out.");
    expect(low.phase).toBe("player");
    expect(unit(low, "king")).toMatchObject({ hp: 5 });
    // An enemy Wick on her last HP never gets to act, and nobody is credited with the kill.
    const theirs = endTurn(board([king, { ...wick, id: "e", side: "black", hp: 1 }]));
    expect(theirs.steps).toEqual([]);
    expect(unit(theirs.run, "e")).toBeUndefined();
    expect(theirs.run.phase).toBe("camp");
  });

  // The spec wants kingThreat to count fire as unavoidable damage, and today it ignores it entirely:
  // a burning king at 1 HP is not in check, and a 4-HP king beside an enemy Wick is not in check
  // either, though her 3 plus the first tick (which lands before he acts) kills him. kingThreat
  // only prices enemy strikes; see missing_hooks in the build report.
  it.todo("counts a pending burn tick on your king as unavoidable damage in kingThreat");
  it.todo("puts a 4-HP king in check when an enemy Wick stands beside him: 3 now, 1 before he acts");
});
