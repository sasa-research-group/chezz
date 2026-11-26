import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Puzzle } from "../src/puzzle/engine";
import { bakeFor, bakedTrap, layoutKey, layoutOfPuzzle, needsBake } from "../src/diorama/levelBake";

const base: Puzzle = {
  width: 5, height: 12, moves: 3, goal: { type: "mate" }, holes: [{ x: 0, y: 0 }], walls: [{ x: 2, y: 3 }],
  trapdoors: [{ x: 1, y: 5 }, { x: 3, y: 8 }], switches: [{ x: 4, y: 4, kind: "lever", effect: { type: "trapdoors" } }],
  pieces: [["king", "white", 2, 11], ["king", "black", 2, 0]],
};
const key = (p: Puzzle) => layoutKey(layoutOfPuzzle(p));

describe("level bake key", () => {
  it("is 8 hex digits and the same for the same squares in any order", () => {
    expect(key(base)).toMatch(/^[0-9a-f]{8}$/);
    expect(key({ ...base, trapdoors: [...base.trapdoors!].reverse() })).toBe(key(base));
  });
  it("ignores the pieces, the goal and the move count: a bake is the room, not the puzzle", () => {
    expect(key({ ...base, pieces: [["king", "white", 0, 11]], goal: { type: "survive" }, moves: 9, name: "x" })).toBe(key(base));
  });
  it("changes with the board size or any baked square", () => {
    const k = key(base);
    expect(key({ ...base, height: 11 })).not.toBe(k);
    expect(key({ ...base, trapdoors: [{ x: 1, y: 5 }] })).not.toBe(k);
    expect(key({ ...base, sludge: [{ x: 0, y: 1 }] })).not.toBe(k);
    expect(key({ ...base, switches: [{ x: 4, y: 4, kind: "plate", effect: { type: "trapdoors" } }] })).not.toBe(k);
  });
  it("finds a bake only under its own key and size", () => {
    const l = layoutOfPuzzle(base), k = layoutKey(l);
    expect(bakeFor({ [k]: { w: 5, h: 12, trapdoors: [] } }, l)?.key).toBe(k);
    expect(bakeFor({ [k]: { w: 12, h: 5, trapdoors: [] } }, l)).toBeNull();
    expect(bakeFor({}, l)).toBeNull();
    expect(bakedTrap(k, 3, 8)).toBe(`levels/${k}/trap-3-8`);
  });

  it("gives the same key as the bake script's Python twin (tools/art/diorama/level_layout.py)", () => {
    expect(layoutKey(layoutOfPuzzle(base))).toBe(readFileSync("tests/level-key.txt", "utf8").trim());
  });
});

describe("boards past the 8-a-side preview", () => {
  const long = layoutOfPuzzle({ ...base, height: 20, trapdoors: [] });
  it("ask for a bake until there is one; small boards never do", () => {
    expect(needsBake(null, layoutOfPuzzle({ ...base, height: 8 }))).toBe(false);
    expect(needsBake({}, layoutOfPuzzle({ ...base, height: 8 }))).toBe(false);
    expect(needsBake(null, long)).toBeNull();
    expect(needsBake({}, long)).toBe(true);
    expect(needsBake({ [layoutKey(long)]: { w: 5, h: 20, trapdoors: [] } }, long)).toBe(false);
  });
});

describe("loading the bake list", () => {
  it("treats a missing or non-json list (a dev server's index.html) as no bakes", async () => {
    const { loadBakeIndex, resetBakeIndex } = await import("../src/diorama/levelBake");
    const real = globalThis.fetch;
    try {
      for (const res of [new Response("<!doctype html><html></html>", { status: 200 }), new Response("", { status: 404 })]) {
        resetBakeIndex();
        globalThis.fetch = (async () => res) as typeof fetch;
        expect(await loadBakeIndex("/")).toEqual({});
      }
      resetBakeIndex();
      globalThis.fetch = (async () => new Response('{"ab12cd34":{"w":5,"h":12,"trapdoors":[]}}')) as typeof fetch;
      expect(await loadBakeIndex("/")).toEqual({ ab12cd34: { w: 5, h: 12, trapdoors: [] } });
    } finally { globalThis.fetch = real; resetBakeIndex(); }
  });
});
