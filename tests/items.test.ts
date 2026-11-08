import { describe, expect, it } from "vitest";
import * as turns from "../src/game/turns";
import { attackTargets, canEscape, endTurn, inCheck, itemReason, itemTargets, leaveCamp, moveTargets, reaches, readRun, turnSpent, tutorialRun, useItem } from "../src/game/turns";
import type { Encounter, Item, Rules, Run, Unit } from "../src/game/turns";
import { FIXED, stored } from "./fixtures";

// Fixed rules (bomb −1 over 2×2, decoy 1 HP, 3 slots), so retuning the shipped files never moves these tests.
const RULES = FIXED.rules;
const OPEN: Encounter = { reward: 0, width: 6, height: 6, walls: [], spawns: [["pawn", 5, 0]], starts: [{ x: 0, y: 5 }] };
const king: Unit = { id: "king", side: "white", kind: "king", x: 0, y: 5, hp: 5 };
const foe = (id: string, kind: Unit["kind"], x: number, y: number, hp = RULES.hp[kind]): Unit => ({ id, side: "black", kind, x, y, hp });
function board(units: Unit[], items: Item[], extra: Partial<Run> = {}): Run {
  return { ...turns.newRun(FIXED), phase: "player", level: OPEN, units, items, ...extra };
}
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("bomb", () => {
  it("hits every enemy in the 2×2 square it's aimed at, and nothing outside it or on your side", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 1, y: 2, hp: 5 };
    const g = board([king, rook, foe("a", "pawn", 1, 1), foe("b", "pawn", 2, 1), foe("c", "pawn", 2, 2, 1), foe("out", "pawn", 3, 3)], ["bomb"]);
    const { run, step } = useItem(g, "bomb", { x: 1, y: 1 });
    expect(step).toMatchObject({ kind: "item", item: "bomb", killed: ["c"], text: "Bomb −1 × 3 · 1 killed" });
    expect(step!.area).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }]);
    expect([unit(run, "a")!.hp, unit(run, "b")!.hp, unit(run, "c"), unit(run, "out")!.hp]).toEqual([1, 1, undefined, 2]);
    expect(unit(run, "r")!.hp).toBe(5);
    expect(run.items).toEqual([]);
    expect(run.log[0]).toBe("Bomb −1 × 3 · 1 killed");
  });
  it("aims only at squares with an enemy in them, on the board", () => {
    const g = board([king, foe("a", "pawn", 5, 0)], ["bomb"]);
    expect(itemTargets(g, "bomb")).toEqual([{ x: 4, y: 0 }]);
    expect(useItem(g, "bomb", { x: 0, y: 0 }).run).toBe(g);
  });
  it("wins the battle when it kills the last enemy", () => {
    const g = board([king, foe("a", "pawn", 3, 3, 1)], ["bomb"]);
    expect(useItem(g, "bomb", { x: 2, y: 2 }).run.phase).toBe("victory");
  });
});

describe("decoy", () => {
  it("goes on an empty square next to one of your pieces, as a 1-HP straw pawn that never acts", () => {
    const wall: Encounter = { ...OPEN, walls: [{ x: 1, y: 5 }] };
    const g = board([king, foe("a", "pawn", 1, 4)], ["decoy"], { level: wall });
    expect(itemTargets(g, "decoy")).toEqual([{ x: 0, y: 4 }]);
    const { run, step } = useItem(g, "decoy", { x: 0, y: 4 });
    const decoy = run.units.find(u => u.decoy)!;
    expect(decoy).toMatchObject({ side: "white", kind: "pawn", hp: 1, x: 0, y: 4 });
    expect(step).toMatchObject({ kind: "item", item: "decoy", text: "Decoy → a2" });
    expect(moveTargets(run, decoy)).toEqual([]);
    expect(attackTargets(run, decoy)).toEqual([]);
    expect(useItem(g, "decoy", { x: 3, y: 3 }).run).toBe(g);
  });
  it("draws the enemy's strike, never strikes back, and blocks lines", () => {
    const tough: Rules = { ...RULES, items: { ...RULES.items, decoy: { hp: 3 } } };
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 3, y: 3, hp: 5 };
    const g = board([king, rook, foe("p", "pawn", 2, 1)], ["decoy"], { rules: tough });
    const placed = useItem(g, "decoy", { x: 3, y: 2 }).run;
    const { run, steps } = endTurn(placed);
    expect(steps[0]).toMatchObject({ kind: "strike", target: placed.units.find(u => u.decoy)!.id });
    expect(steps[0].counter).toBeUndefined();
    expect(unit(run, "p")!.hp).toBe(RULES.hp.pawn);
    expect(run.units.find(u => u.decoy)!.hp).toBe(2);
    // On a lane: the bishop's diagonal to the king is cut.
    const lane = board([king, foe("b", "bishop", 5, 0)], ["decoy"]);
    const blocked = useItem(lane, "decoy", { x: 1, y: 4 }).run;
    expect(reaches(lane, unit(lane, "b")!, unit(lane, "b")!, king)).toBe(true);
    expect(reaches(blocked, unit(blocked, "b")!, unit(blocked, "b")!, king)).toBe(false);
  });
  it("stays behind when the battle is won", () => {
    const g = board([king, foe("a", "pawn", 3, 3, 1)], ["decoy", "bomb"]);
    const placed = useItem(g, "decoy", { x: 1, y: 4 }).run;
    const won = useItem({ ...placed, itemUsed: undefined }, "bomb", { x: 2, y: 2 }).run;
    expect(won.units.some(u => u.decoy)).toBe(false);
  });
});

describe("item rules", () => {
  it("can't leave your king open to a kill", () => {
    // The pawn blocks the bishop's diagonal to a 2-HP king: bombing it dead would open the line.
    const weak = { ...king, x: 4, y: 4, hp: 2 };
    const g = board([weak, foe("b", "bishop", 0, 0), foe("p", "pawn", 2, 2, 1)], ["bomb"]);
    expect(inCheck(g)).toBe(false);
    expect(useItem(g, "bomb", { x: 2, y: 2 }).run).toBe(g);
    expect(itemTargets(g, "bomb")).toEqual([{ x: 0, y: 0 }]);
  });
  it("counts as a way out of check", () => {
    // A one-file corridor: the king can't step out of the queen's file, but a decoy can stand in it.
    const file: Encounter = { reward: 0, width: 1, height: 6, walls: [], spawns: [], starts: [] };
    const g = board([{ ...king, hp: 3 }, foe("q", "queen", 0, 0)], ["decoy"], { level: file });
    expect(inCheck(g)).toBe(true);
    expect(canEscape(g)).toBe(true);
    expect(canEscape({ ...g, items: [] })).toBe(false);
    expect(endTurn(g).run).toBe(g);
  });
  it("is one per turn, free, and End turn makes the next one ready", () => {
    const g = board([king, foe("a", "pawn", 3, 0), foe("b", "pawn", 5, 0)], ["bomb", "bomb"]);
    const used = useItem(g, "bomb", { x: 2, y: 0 }).run;
    expect(itemReason(used, "bomb")).toBe("One item per turn");
    expect(useItem(used, "bomb", { x: 4, y: 0 }).run).toBe(used);
    // The king can still move after the item.
    expect(moveTargets(used, unit(used, "king")!).length).toBeGreaterThan(0);
    const next = endTurn(used).run;
    expect(next.itemUsed).toBeUndefined();
    expect(itemReason(next, "bomb")).toBe("");
    expect(itemReason(next, "decoy")).toBe("None left");
  });
  it("keeps the turn open after a strike while an item could still be used", () => {
    const g = board([king, foe("a", "pawn", 1, 4), foe("b", "pawn", 4, 0)], ["bomb"]);
    const struck = turns.attack(g, "king", "a").run;
    expect(turnSpent(struck)).toBe(false);
    expect(turnSpent({ ...struck, items: [] })).toBe(true);
  });
});

describe("hand-outs", () => {
  const level = (items?: Item[]): Encounter => ({ ...OPEN, tutorial: { army: [{ kind: "king", x: 0, y: 5 }] }, ...(items && { handout: { items } }) });
  const data = { rules: RULES, levels: [level(["bomb"]), level(), level(["decoy", "decoy", "decoy", "bomb"])] };
  it("replace the bag on each tutorial level, up to the slots", () => {
    const first = tutorialRun(data);
    expect(first.items).toEqual(["bomb"]);
    const second = leaveCamp({ ...first, items: ["decoy"] as Item[], phase: "camp" });
    expect(second.items).toBeUndefined();
    expect(leaveCamp({ ...second, phase: "camp" }).items).toEqual(["decoy", "decoy", "decoy"]);
  });
  it("leave a roguelike bag alone on a level without one", () => {
    const plain = { rules: RULES, levels: [OPEN, OPEN] };
    const g = { ...turns.newRun(plain), items: ["bomb" as const], phase: "camp" as const };
    expect(leaveCamp(g).items).toEqual(["bomb"]);
  });
});

describe("saved items", () => {
  it("round-trip the bag and a decoy, load old saves without them, and refuse junk", () => {
    const g = board([king, foe("a", "pawn", 3, 3)], ["decoy", "bomb"], { level: undefined, units: [{ ...king, x: 1, y: 3 }, foe("a", "pawn", 3, 0)] });
    const placed = useItem(g, "decoy", { x: 1, y: 2 }).run;
    expect(readRun(stored(placed), FIXED)).toEqual(placed);
    const { items: _, ...old } = JSON.parse(stored(g));
    expect(readRun(JSON.stringify(old), FIXED)?.items).toBeUndefined();
    expect(readRun(JSON.stringify({ ...old, items: ["sword"] }), FIXED)).toBeNull();
  });
});
