import { describe, expect, it } from "vitest";
import { attack, begin, buy, campReason, courseOf, leaveCamp, newRun, readRun, retry, roguelikeCourse, tutorialCourse, tutorialRun } from "../src/game/turns";
import type { Encounter, GameData, Run } from "../src/game/turns";
import { creditWin, emptyMeta, markTutorial, readMeta } from "../src/game/meta";
import { ENCOUNTERS } from "../src/game/turns";
import { FIXED, FIXED_LEVELS, stored } from "./fixtures";

/** The fixed battles with the first two in the tutorial, each with its own preset army. */
const LEVELS: Encounter[] = FIXED_LEVELS.map((l, i) => i === 0 ? { ...l, tutorial: { army: [{ kind: "king", x: 1, y: 3 }] } }
  : i === 1 ? { ...l, tutorial: { army: [{ kind: "rook", x: 1, y: 4 }, { kind: "king", x: 5, y: 4 }] } } : l);
const DATA: GameData = { ...FIXED, levels: LEVELS };

/** Wins the current battle on the spot: one 1-HP enemy pawn next to the king, struck down. */
function win(g: Run): Run {
  const king = g.units.find(u => u.id === "king")!;
  const board: Run = { ...begin(g), units: [...g.units.filter(u => u.side === "white"), { id: "foe", side: "black", kind: "pawn", x: king.x, y: king.y - 1, hp: 1 }] };
  return attack(board, "king", "foe").run;
}

describe("the tutorial", () => {
  it("plays the tutorial levels and the roguelike the rest, falling back to every level while it has none", () => {
    expect(tutorialCourse(LEVELS)).toEqual([0, 1]);
    expect(roguelikeCourse(LEVELS)).toEqual([2]);
    expect(roguelikeCourse(FIXED_LEVELS)).toEqual([0, 1, 2]);
    expect(newRun(DATA).encounter).toBe(2);
  });
  it("deals each level's preset army as placed, at full HP, with no gold", () => {
    const g = tutorialRun(DATA);
    expect(g).toMatchObject({ tutorial: true, encounter: 0, phase: "deploy", gold: 0 });
    expect(g.units.filter(u => u.side === "white").map(u => [u.kind, u.x, u.y])).toEqual([["king", 1, 3]]);
  });
  it("runs linearly: a won battle opens no camp, and the next battle replaces your pieces with its own army", () => {
    const cleared = win(tutorialRun(DATA));
    expect(cleared.phase).toBe("camp");
    expect(cleared.gold).toBe(0);
    expect(campReason(cleared, "pawn")).toBe("No camp in the tutorial");
    expect(buy({ ...cleared, gold: 99 }, "pawn")).toEqual({ ...cleared, gold: 99 });
    const hurt = { ...cleared, units: cleared.units.map(u => ({ ...u, hp: 1 })) };
    const next = leaveCamp(hurt);
    expect(next).toMatchObject({ encounter: 1, phase: "deploy", tutorial: true });
    expect(next.units.filter(u => u.side === "white").map(u => [u.kind, u.x, u.y, u.hp])).toEqual([["rook", 1, 4, FIXED.rules.hp.rook], ["king", 5, 4, FIXED.rules.hp.king]]);
    expect(courseOf(next)).toEqual([0, 1]);
  });
  it("ends in victory after its last level, never reaching the roguelike's levels", () => {
    const last = win(leaveCamp(win(tutorialRun(DATA))));
    expect(last.phase).toBe("victory");
    expect(leaveCamp(last)).toBe(last);
  });
  it("retries a lost battle fresh, at the same level", () => {
    const started = tutorialRun(DATA, 1);
    const lost: Run = { ...begin(started), phase: "defeat", units: started.units.filter(u => u.id !== "king") };
    expect(retry(lost)).toEqual(started);
    expect(retry(begin(started))).toEqual(begin(started));
  });
  it("only starts on a tutorial level", () => {
    expect(() => tutorialRun(DATA, 2)).toThrow();
  });
  it("saves and reloads; a save outside its course or with recruits is discarded, and an old save loads as the roguelike", () => {
    const g = leaveCamp(win(tutorialRun(DATA)));
    expect(readRun(stored(g), DATA)).toEqual(g);
    expect(readRun(stored({ ...g, encounter: 2 }), DATA)).toBeNull();
    expect(readRun(stored({ ...g, tutorial: "yes" }), DATA)).toBeNull();
    expect(readRun(stored({ ...win(tutorialRun(DATA)), recruits: [] }), DATA)).toBeNull();
    const old = newRun(FIXED);
    expect(readRun(stored(old), FIXED)?.tutorial).toBeUndefined();
  });
  it("ships a tutorial whose every level starts with its preset army", () => {
    const course = tutorialCourse(ENCOUNTERS);
    expect(course.length).toBeGreaterThan(0);
    for (const i of course) expect(tutorialRun(undefined, i).units.filter(u => u.side === "white").length).toBe(ENCOUNTERS[i].tutorial!.army.length);
  });
});

describe("tutorial progress in meta", () => {
  it("finishing the tutorial marks it done and unlocks no skin", () => {
    const won = win(leaveCamp(win(tutorialRun(DATA))));
    const { meta, unlocked } = creditWin(emptyMeta(), won, [{ id: "frog", kind: "pawn" }]);
    expect(meta.tutorialDone).toBe(true);
    expect(unlocked).toBeUndefined();
  });
  it("can be skipped and reset, and round-trips through a save", () => {
    const done = markTutorial(emptyMeta(), true);
    expect(readMeta(JSON.stringify(done), [])).toEqual(done);
    expect(markTutorial(done, true)).toBe(done);
    expect(markTutorial(done, false)).toEqual(emptyMeta());
    expect(readMeta(JSON.stringify({ ...emptyMeta(), tutorialDone: "yes" }), [])).toEqual(emptyMeta());
  });
});
