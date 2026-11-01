import { describe, expect, it } from "vitest";
import { chain, labelStacks, parsePivot, splitList, takeLength, targetClasses, unsetPivot, type Mat, type Sample } from "../src/art/rigModel";

const I: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const move = (e: number, f: number): Mat => ({ ...I, e, f });
const box = { x: 0, y: 0, width: 10, height: 10 };
const part = (id: string, parent: string | null, pivot: { x: number; y: number }, parentM: Mat, m = parentM): Sample => ({ id, name: id, parent, pivot, parentM, m, bbox: box });

describe("pivot chain", () => {
  it("links each group's parent pivot to its own, through each frame's transforms", () => {
    // squash lunges 20 right; the prop hangs off it at the hand.
    const sk = chain([
      part("hop", null, { x: 50, y: 108 }, I),
      part("squash", "hop", { x: 50, y: 108 }, I, move(20, 0)),
      part("prop", "squash", { x: 74, y: 90 }, move(20, 0)),
    ]);
    expect(sk.joints.map(j => [j.id, j.at])).toEqual([["hop", { x: 50, y: 108 }], ["squash", { x: 50, y: 108 }], ["prop", { x: 94, y: 90 }]]);
    expect(sk.links).toEqual([
      { from: "hop", to: "squash", a: { x: 50, y: 108 }, b: { x: 50, y: 108 } },
      { from: "squash", to: "prop", a: { x: 50, y: 108 }, b: { x: 94, y: 90 } },
    ]);
    expect(sk.boxes.find(b => b.id === "squash")!.pts[0]).toEqual({ x: 20, y: 0 });
  });

  it("treats a group whose parent is missing as a root, and draws no box for a hidden one", () => {
    const sk = chain([{ ...part("shield", "gone", { x: 30, y: 90 }, I), hidden: true }]);
    expect(sk.links).toEqual([]);
    expect(sk.boxes).toEqual([]);
  });

  it("leaves out the joint of a group with no pivot this take, but keeps its box", () => {
    const sk = chain([part("squash", null, { x: 50, y: 108 }, I), { ...part("arm-front", "squash", { x: 0, y: 0 }, I), unset: true }]);
    expect(sk.joints.map(j => j.id)).toEqual(["squash"]);
    expect(sk.links).toEqual([]);
    expect(sk.boxes.map(b => b.id)).toEqual(["squash", "arm-front"]);
    expect(unsetPivot("0px 0px", "view-box")).toBe(true);
    expect(unsetPivot("0px 0px", "fill-box")).toBe(false);
  });

  it("rotates a pivot with its parent", () => {
    const quarter: Mat = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 };
    expect(chain([part("head", null, { x: 10, y: 0 }, quarter)]).joints[0].at).toEqual({ x: 0, y: 10 });
  });

  it("shares one label between stacked pivots", () => {
    const sk = chain([part("flip", null, { x: 50, y: 108 }, I), part("hop", "flip", { x: 50, y: 108 }, I), part("head", "hop", { x: 50, y: 74 }, I)]);
    expect(labelStacks(sk.joints).map(s => s.names)).toEqual([["flip", "hop"], ["head"]]);
  });
});

describe("rig CSS reading", () => {
  it("resolves view-box and fill-box pivots", () => {
    expect(parsePivot("74px 90px", "view-box", box)).toEqual({ x: 74, y: 90 });
    expect(parsePivot("9px 5px", "fill-box", { x: -9, y: -5, width: 18, height: 10 })).toEqual({ x: 0, y: 0 });
  });

  it("finds the group a .rig selector styles", () => {
    expect(targetClasses(".rig.act-attack .prop")).toEqual(["prop"]);
    expect(targetClasses('.rig.rig-rook.rebel.art-new:not([class*="skin-"]).act-attack .prop.sledge')).toEqual(["prop", "sledge"]);
    expect(targetClasses(".rig.act-idle")).toEqual(["rig"]);
    expect(targetClasses(".exile-piece .rig")).toBeNull();
    expect(splitList('.rig .a, .rig:not(.x,.y) .b')).toEqual([".rig .a", ".rig:not(.x,.y) .b"]);
  });

  it("times a take by its last finite animation, or a loop's longest cycle", () => {
    expect(takeLength([{ delay: 0, duration: 560, iterations: 1 }, { delay: 0, duration: 4300, iterations: Infinity }])).toBe(560);
    expect(takeLength([{ delay: 1500, duration: 700, iterations: 3 }, { delay: 0, duration: 2600, iterations: 1 }])).toBe(3600);
    expect(takeLength([{ delay: 0, duration: 1400, iterations: Infinity }, { delay: 0, duration: 4300, iterations: Infinity }])).toBe(4300);
  });
});
