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
  it("the play camera sees every fairy bulb (no trunk or solid moss in front)", () => {
    for (const n of [3, 5, 8]) {
      const i = info(n), depth = new Uint16Array(fs.readFileSync(`public/diorama/set${n}.depth`).buffer.slice(0));
      const M = i.camera.matrixWorld, f = i.camera.sensor / i.camera.lens, [w, h] = i.res, [gw, gh] = i.grid, st = i.stride;
      const hidden = i.bulbs.filter(b => {
        // into camera space (the matrix is a rotation plus a move), then onto the depth grid
        const v = [0, 1, 2].map(r => b[r] - M[r][3]);
        const [xc, yc, zc] = [0, 1, 2].map(c => M[0][c] * v[0] + M[1][c] * v[1] + M[2][c] * v[2]);
        const d = -zc, px = (xc / (f * d) + 0.5) * w, py = (0.5 - yc / (f * (h / w) * d)) * h;
        const ci = Math.round(px / st), cj = Math.round(py / st);
        // somewhere within a bulb's width the camera reaches the bulb (or past it)
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          const k = (cj + dj) * gw + ci + di;
          if (ci + di < 0 || ci + di >= gw || cj + dj < 0 || cj + dj >= gh) continue;
          if (i.near + (depth[k] - 1) / 65534 * (i.far - i.near) >= d - 0.04 * i.H) return false;
        }
        return true;
      });
      expect(hidden, `set${n}`).toEqual([]);
    }
  });
  it("small boards back the camera off no further than their bake", () => {
    for (const [w, h] of [[2, 2], [3, 3], [2, 3]]) expect(playCamera(info(3), w, h, 4 / 3).zoom).toBeGreaterThanOrEqual(info(3).camera.zoom);
  });
});
