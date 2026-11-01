import { describe, expect, it } from "vitest";
import { META_KEY, creditWin, emptyMeta, equip, loadMeta, readMeta, saveMeta, type Meta, type SkinRef } from "../src/game/meta";
import { newRun, readRun } from "../src/game/turns";

const SKINS: SkinRef[] = [{ id: "frog", kind: "pawn" }, { id: "goose", kind: "bishop" }];
const won = () => ({ ...newRun(), phase: "victory" as const });

describe("readMeta", () => {
  it("gives an empty meta for nothing, bad JSON or a wrong shape", () => {
    for (const raw of [null, "", "{", "[]", "3", JSON.stringify({ version: 2, unlocked: [], equipped: {} }), JSON.stringify({ version: 1, unlocked: "frog", equipped: {} }), JSON.stringify({ version: 1, unlocked: [], equipped: [] })])
      expect(readMeta(raw, SKINS)).toEqual(emptyMeta());
  });
  it("drops unknown, duplicate and unowned ids, and skins worn on the wrong piece", () => {
    const raw = JSON.stringify({ version: 1, unlocked: ["frog", "frog", "gone", 7], equipped: { pawn: "frog", bishop: "goose", king: "frog" }, lastWin: "x" });
    expect(readMeta(raw, SKINS)).toEqual({ version: 1, unlocked: ["frog"], equipped: { pawn: "frog" }, lastWin: "x" });
  });
  it("round-trips through save and load", () => {
    const store = new Map<string, string>();
    const fake = () => ({ getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const m: Meta = { version: 1, unlocked: ["frog"], equipped: { pawn: "frog" }, lastWin: "abc" };
    expect(saveMeta(fake, m)).toBe(true);
    expect(store.has(META_KEY)).toBe(true);
    expect(loadMeta(fake, SKINS)).toEqual(m);
  });
  it("survives storage that throws", () => {
    const blocked = () => { throw new Error("SecurityError"); };
    expect(loadMeta(blocked, SKINS)).toEqual(emptyMeta());
    expect(saveMeta(blocked, emptyMeta())).toBe(false);
  });
});

describe("creditWin", () => {
  it("unlocks skins in order, one per won run", () => {
    const first = creditWin(emptyMeta(), won(), SKINS);
    expect(first.unlocked).toBe("frog");
    const other = { ...won(), turn: 9 };
    const second = creditWin(first.meta, other, SKINS);
    expect(second.unlocked).toBe("goose");
    expect(second.meta.unlocked).toEqual(["frog", "goose"]);
    expect(creditWin(second.meta, { ...won(), turn: 10 }, SKINS).meta.unlocked).toEqual(["frog", "goose"]);
  });
  it("credits the same run only once, so a reload of its victory unlocks nothing", () => {
    const once = creditWin(emptyMeta(), won(), SKINS).meta;
    expect(creditWin(once, won(), SKINS)).toEqual({ meta: once });
  });
  it("still recognises a credited run after it is saved and loaded again", () => {
    const run = won(), once = creditWin(emptyMeta(), run, SKINS).meta;
    const reloaded = readRun(JSON.stringify(run))!;
    expect(reloaded).not.toBeNull();
    expect(creditWin(readMeta(JSON.stringify(once), SKINS), reloaded, SKINS).unlocked).toBeUndefined();
  });
  it("ignores runs that are not won", () => {
    for (const phase of ["player", "camp", "defeat"] as const) expect(creditWin(emptyMeta(), { ...newRun(), phase }, SKINS).unlocked).toBeUndefined();
  });
});

describe("equip", () => {
  const owned: Meta = { ...emptyMeta(), unlocked: ["frog"] };
  it("wears and takes off an unlocked skin", () => {
    const on = equip(owned, SKINS[0], true);
    expect(on.equipped).toEqual({ pawn: "frog" });
    expect(equip(on, SKINS[0], false).equipped).toEqual({});
  });
  it("refuses a locked skin", () => expect(equip(owned, SKINS[1], true)).toBe(owned));
});
