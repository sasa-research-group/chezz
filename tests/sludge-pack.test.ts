import { describe, expect, it } from "vitest";
import fx from "./fixtures/sludge-bubbles.json";
import { surfaceHeight, tearAt, type BubbleEvent, type Splat } from "../src/diorama/sludgeBubbles";
import { packFrame, packedHeight, packedTear, SLUDGE_PACK_GLSL, MAX_ITEMS } from "../src/diorama/sludgePack";

const events = fx.events as BubbleEvent[], splat = fx.splat as Splat[];

describe("the packed (GPU) bubbling is the same surface as sludgeBubbles.ts", () => {
  it("gives the same height at every fixture sample", () => {
    for (const s of fx.samples) {
      const p = packFrame(events, splat, s.t, fx.loop);
      expect(packedHeight(p, s.x, s.y)).toBeCloseTo(surfaceHeight(0, events, splat, s.x, s.y, s.t, fx.loop), 5);
    }
  });
  it("tears the same holes", () => {
    for (const s of fx.samples) {
      const p = packFrame(events, splat, s.t, fx.loop);
      expect(packedTear(p, s.x, s.y)).toBeCloseTo(tearAt(events, s.x, s.y, s.t, fx.loop), 5);
    }
  });
  it("matches on a dense grid through a whole loop, bubbles mid-burst included", () => {
    const xs = fx.samples.map(s => s.x), ys = fx.samples.map(s => s.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let worst = 0, moving = 0;
    for (let k = 0; k < 24; k++) {
      const t = (k / 24) * fx.loop, p = packFrame(events, splat, t, fx.loop);
      for (let i = 0; i <= 30; i++) for (let j = 0; j <= 30; j++) {
        const x = x0 + (x1 - x0) * i / 30, y = y0 + (y1 - y0) * j / 30;
        const want = surfaceHeight(0, events, splat, x, y, t, fx.loop);
        if (Math.abs(want) > 1e-3) moving++;
        worst = Math.max(worst, Math.abs(packedHeight(p, x, y) - want), Math.abs(packedTear(p, x, y) - tearAt(events, x, y, t, fx.loop)));
      }
    }
    expect(moving).toBeGreaterThan(200);
    expect(worst).toBeLessThan(1e-5);
  });
  it("packs only what is alive, and counts what doesn't fit", () => {
    const p = packFrame(events, splat, 0.3, fx.loop);
    expect(p.nBub).toBeLessThan(events.length);
    expect(p.nSplat).toBe(splat.length);
    expect(p.dropped).toBe(0);
    const many = Array.from({ length: MAX_ITEMS + 5 }, () => splat[0] ?? [0, 0, 1, 0]) as Splat[];
    expect(packFrame([], many, 0, fx.loop).dropped).toBe(5);
  });
  it("has the shader's twins of each function", () => {
    for (const f of ["sludgeHeight", "sludgeTear", "perlin3", "bubbleH"]) expect(SLUDGE_PACK_GLSL).toContain(f);
  });
});
