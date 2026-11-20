// The 3D board's baked set: which bake a board size uses, where it is cut, and that the play camera fits.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { cut, playCamera, slide, sourceFor } from "../src/diorama/set";
import type { SetInfo } from "../src/diorama/set";

const info = (n: number) => JSON.parse(fs.readFileSync(`public/diorama/set${n}.json`, "utf8")) as SetInfo;

describe("diorama set", () => {
  it("every board from 2x2 to 8x8 has a bake at least as big", () => {
    for (let w = 2; w <= 8; w++) for (let h = 2; h <= 8; h++) {
      const n = sourceFor(w, h);
      expect(n).toBeGreaterThanOrEqual(Math.max(w, h));
      expect(fs.existsSync(`public/diorama/set${n}.webp`)).toBe(true);
    }
  });
  it("cuts on grout lines and closes the gap exactly", () => {
    const S = 2;
    expect(cut(5, 5, S).shift).toBe(0);
    const c = cut(8, 3, S); // keep 2 left columns and 1 right
    expect(c.lo).toBe(-8 + 4); expect(c.hi).toBe(8 - 2); expect(c.shift).toBe(5);
    // the kept bands meet after sliding: right edge of the left band = left edge of the right band
    expect(c.lo + c.shift).toBe(c.hi - c.shift);
  });
  it("slides bulbs with their quarter and drops the ones in the cut", () => {
    const i = info(8), S = i.S;
    expect(slide(i, 8, 8, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(slide(i, 4, 8, [0, 0, 3])).toBeNull();
    expect(slide(i, 4, 8, [-3.9 * S, 0, 3])).toEqual([-3.9 * S + 2 * S, 0, 3]);
  });
  it("the 5x5 play camera is the bake camera", () => {
    const i = info(5);
    expect(playCamera(i, 5, 5, 4 / 3).zoom).toBeCloseTo(i.camera.zoom, 6);
  });
  it("small boards back the camera off no further than their bake", () => {
    for (const [w, h] of [[2, 2], [3, 3], [2, 3]]) expect(playCamera(info(3), w, h, 4 / 3).zoom).toBeGreaterThanOrEqual(info(3).camera.zoom);
  });
});
