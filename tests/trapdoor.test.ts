import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { TRAP_FPS, TRAP_N, trapFrame, trapSquare, trapStart, trapTick } from "../src/diorama/trapdoor";

const S = 2.04;
// Diorama's at(): board (x, y) on a 5x5 board to the stage
const at = (x: number, y: number) => [(x - 2) * S, (2 - y) * S] as [number, number];

describe("trapdoor sheet per square", () => {
  it("names the bake folder's square: i from the left, j from the back", () => {
    expect(trapSquare(at(0, 0), S)).toBe("trap04");
    expect(trapSquare(at(3, 3), S)).toBe("trap31");
    expect(trapSquare(at(4, 4), S)).toBe("trap40");
  });
  it("has no sheet off the baked 5x5", () => {
    expect(trapSquare([3 * S, 0], S)).toBeNull();
    expect(trapSquare([0, -3 * S], S)).toBeNull();
  });
  it("ships a sheet for every square, with the drop's frames", () => {
    for (let i = 0; i < TRAP_N; i++) for (let j = 0; j < TRAP_N; j++) {
      const f = `public/diorama/trap${i}${j}`;
      expect(existsSync(`${f}-drop0.webp`) && existsSync(`${f}-drop0-glow.webp`), f).toBe(true);
      const d = JSON.parse(readFileSync(`${f}-drop.json`, "utf8"));
      expect(d.square).toEqual([i, j]);
      expect(d.frames).toBe(35);
      expect(d.tiles[0] * d.tiles[1]).toBeGreaterThanOrEqual(d.frames);
      expect(d.exposure).toBe(0);
    }
  });
});

describe("trapdoor drop timing", () => {
  const N = 35;
  it("starts shut, or already hanging if the board comes up with it fallen", () => {
    expect(trapFrame(trapStart(false), N)).toBe(0);
    expect(trapFrame(trapStart(true), N)).toBe(N - 1);
  });
  it("plays the drop once at 24 frames a second when it opens, then holds the last frame", () => {
    let s = trapTick(trapStart(false), true, 1 / 60);
    expect(trapFrame(s, N)).toBe(0);
    s = trapTick(s, true, 10 / TRAP_FPS);
    expect(trapFrame(s, N)).toBe(10);
    s = trapTick(s, true, 60);
    expect(trapFrame(s, N)).toBe(N - 1);
  });
  it("snaps shut again on undo or restart", () => {
    const s = trapTick(trapStart(true), false, 1 / 60);
    expect(trapFrame(s, N)).toBe(0);
    expect(trapFrame(trapTick(s, true, 0), N)).toBe(0);
  });
});
