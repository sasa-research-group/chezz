import { describe, expect, it } from "vitest";
import fx from "./fixtures/sludge-bubbles.json";
import { surfaceHeight, tearAt, dropsInAir, swell, perlin, PERLIN_SCALE, type BubbleEvent, type Splat } from "../src/diorama/sludgeBubbles";

// Numbers from tools/art/diorama/sludge_fixture.py: the browser's bubbling must match the Cycles build's.
const events = fx.events as BubbleEvent[], splat = fx.splat as Splat[];

describe("live sludge bubbling matches sludge_bubbles.py", () => {
  it("has samples that are not all flat", () => {
    expect(fx.samples.filter(s => Math.abs(s.h) > 1e-3).length).toBeGreaterThan(20);
    expect(fx.samples.filter(s => s.tear > 0.1).length).toBeGreaterThan(3);
  });
  it("gives the same height everywhere it was sampled", () => {
    for (const s of fx.samples) expect(surfaceHeight(0, events, splat, s.x, s.y, s.t, fx.loop)).toBeCloseTo(s.h, 9);
  });
  it("tears the same dark holes", () => {
    for (const s of fx.samples) expect(tearAt(events, s.x, s.y, s.t, fx.loop)).toBeCloseTo(s.tear, 9);
  });
  it("flings the same blobs", () => {
    expect(fx.drops.some(d => d.air.length > 0)).toBe(true);
    for (const d of fx.drops) {
      const got = dropsInAir(events, d.t, fx.loop);
      expect(got.length).toBe(d.air.length);
      got.forEach((g, i) => g.forEach((v, k) => expect(v).toBeCloseTo(d.air[i][k], 9)));
    }
  });
  it("wraps: one loop later is the same surface", () => {
    const s = fx.samples[7];
    expect(surfaceHeight(0, events, splat, s.x, s.y, s.t + fx.loop, fx.loop)).toBeCloseTo(s.h, 9);
  });
  it("swells gently and loops", () => {
    const a = swell(0.03, 2.04, 0.3, -0.2, 1.1, 8), b = swell(0.03, 2.04, 0.3, -0.2, 9.1, 8);
    expect(a).toBeCloseTo(b, 9);
    expect(Math.abs(a)).toBeLessThanOrEqual(0.03 * PERLIN_SCALE);
  });
  it("swells with the spread and slope of Blender's noise (sd 0.279, mean |slope| 0.55)", () => {
    let s = 1, sum = 0, sq = 0, g = 0; const n = 20000, h = 1e-3;
    const r = () => { s = (s * 16807) % 2147483647; return (s / 2147483647) * 100 - 50; };
    for (let i = 0; i < n; i++) {
      const x = r(), y = r(), z = r(), v = PERLIN_SCALE * perlin(x, y, z);
      sum += v; sq += v * v; g += Math.abs(PERLIN_SCALE * perlin(x + h, y, z) - v) / h;
    }
    expect(Math.sqrt(sq / n - (sum / n) ** 2)).toBeCloseTo(0.279, 1);
    expect(g / n).toBeCloseTo(0.55, 1);
  });
  it("gives each sheet its own swell", () => {
    expect(swell(0.03, 2.04, 0.3, -0.2, 1.1, 8, 0)).not.toBeCloseTo(swell(0.03, 2.04, 0.3, -0.2, 1.1, 8, 1), 4);
  });
});
