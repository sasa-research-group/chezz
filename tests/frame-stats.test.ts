import { describe, expect, it } from "vitest";
import { frameStats } from "../src/proof/frameStats";

describe("phone bench frame stats", () => {
  it("reads a steady 60 fps", () => {
    const s = frameStats(Array(120).fill(1000 / 60));
    expect(s.fps).toBeCloseTo(60, 5);
    expect(s.median).toBeCloseTo(16.67, 1);
  });
  it("puts hitches in the slowest 5%, not the median", () => {
    const s = frameStats([...Array(95).fill(16), ...Array(5).fill(100)]);
    expect(s.median).toBe(16);
    expect(s.p95).toBe(100);
    expect(s.fps).toBeCloseTo(1000 * 100 / (95 * 16 + 500), 5);
  });
  it("copes with no frames", () => expect(frameStats([]).fps).toBe(0));
});
