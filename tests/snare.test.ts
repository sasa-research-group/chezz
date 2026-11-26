import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { SNARE_FPS, SNARE_N, SORT_NUDGE, frontGap, snareFrame, snareSquare, snareStart, snareTick, snareWant } from "../src/diorama/snare";
import { STAND_FRESH_MS, standGap, standing } from "../src/diorama/motion";

const S = 2.04;
// Diorama's at(): board (x, y) on a 5x5 board to the stage
const at = (x: number, y: number) => [(x - 2) * S, (2 - y) * S] as [number, number];
const N = 20;

describe("snare sheets per square", () => {
  it("names the bake folder's square: i from the left, j from the back", () => {
    expect(snareSquare(at(0, 0), S)).toBe("snare04");
    expect(snareSquare(at(3, 3), S)).toBe("snare31");
    expect(snareSquare(at(4, 4), S)).toBe("snare40");
    expect(snareSquare([3 * S, 0], S)).toBeNull();
  });
  it("ships both layers for every square, with the spring's 20 frames, all from the play camera", () => {
    for (let i = 0; i < SNARE_N; i++) for (let j = 0; j < SNARE_N; j++) for (const layer of ["spring", "front"]) {
      const f = `public/diorama/snare${i}${j}-${layer}`;
      expect(existsSync(`${f}0.webp`) && existsSync(`${f}0-glow.webp`), f).toBe(true);
      const d = JSON.parse(readFileSync(`${f}.json`, "utf8"));
      expect(d.square).toEqual([i, j]);
      expect(d.frames).toBe(N);
      expect(d.fps).toBe(SNARE_FPS);
      expect(d.tiles[0] * d.tiles[1]).toBeGreaterThanOrEqual(N);
      // the two layers share one crop, so their frames line up pixel for pixel
      const other = JSON.parse(readFileSync(`public/diorama/snare${i}${j}-${layer === "front" ? "spring" : "front"}.json`, "utf8"));
      expect(d.crop).toEqual(other.crop);
      expect(d.dq).toBeCloseTo(other.dq, 6);
    }
  });
});

describe("when the roots shut", () => {
  it("shut on a card at once, on a figure only once it stands there, never on an empty square", () => {
    expect(snareWant("card", false)).toBe(true);
    expect(snareWant("figure", false)).toBe(false);  // still running there
    expect(snareWant("figure", true)).toBe(true);
    expect(snareWant(null, true)).toBe(false);  // the one standing there was taken: let go
  });
});

describe("snare spring timing", () => {
  it("starts open, or already shut if the board comes up with a piece held", () => {
    expect(snareFrame(snareStart(false), N)).toBe(0);
    expect(snareFrame(snareStart(true), N)).toBe(N - 1);
  });
  it("plays the spring at 24 frames a second, then holds shut", () => {
    let s = snareTick(snareStart(false), true, 1 / 60, N);
    expect(snareFrame(s, N)).toBe(0);
    s = snareTick(s, true, 10 / SNARE_FPS, N);
    expect(snareFrame(s, N)).toBe(10);
    s = snareTick(s, true, 60, N);
    expect(snareFrame(s, N)).toBe(N - 1);
  });
  it("lets go by playing the spring backward, from wherever it got to", () => {
    let s = snareTick(snareStart(true), false, 5 / SNARE_FPS, N);
    expect(snareFrame(s, N)).toBe(N - 1 - 5);
    s = snareTick(s, false, 60, N);
    expect(snareFrame(s, N)).toBe(0);
    // caught again halfway open: closes from there, not from the start
    s = snareTick(snareTick(snareStart(true), false, 8 / SNARE_FPS, N), true, 2 / SNARE_FPS, N);
    expect(snareFrame(s, N)).toBe(N - 1 - 8 + 2);
  });
});

describe("the front roots sort just in front of the figure on the square", () => {
  it("nearer than the figure's quad, by its own sheet's gap", () => {
    expect(frontGap(1.45, 1.22)).toBeCloseTo(1.45 + SORT_NUDGE);
    expect(frontGap(2.24, 1.22)).toBeCloseTo(2.24 + SORT_NUDGE);  // dying there: the death sheet
    expect(frontGap(null, 1.22)).toBeCloseTo(1.22 + SORT_NUDGE);  // nobody: the bake's own place
  });
  it("still behind a resting figure one row nearer (1.67 nearer, its quad 1.43 to 1.48 in front of its feet)", () => {
    const row = S * 0.8192;
    for (const g of [1.43, 1.45, 1.47, 1.48, 1.69]) expect(frontGap(g, 1.22)).toBeLessThan(row + 1.43);
  });
});

describe("a figure says it is standing on a square", () => {
  afterEach(() => vi.useRealTimers());
  it("counts for a few frames after it last said so, with its sheet's gap", () => {
    vi.useFakeTimers({ now: 5000, toFake: ["performance"] });
    expect(standGap(at(1, 1)[0], at(1, 1)[1])).toBeNull();
    standing(at(1, 1)[0], at(1, 1)[1], 1.45);
    expect(standGap(at(1, 1)[0], at(1, 1)[1])).toBe(1.45);
    expect(standGap(at(2, 1)[0], at(2, 1)[1])).toBeNull();
    vi.advanceTimersByTime(STAND_FRESH_MS + 1);
    expect(standGap(at(1, 1)[0], at(1, 1)[1])).toBeNull();  // he left, or was struck down
  });
});
