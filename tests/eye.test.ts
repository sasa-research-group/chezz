import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { EYE_FIGURE, SLEEP_FPS, TURN_STEP, WAKE_FPS, eyeFrame, eyeGlow, eyeStart, eyeTick, stareHeading } from "../src/diorama/eye";
import type { EyeAnim } from "../src/diorama/eye";
import { boardOf, start, stareOf } from "../src/puzzle/engine";
import type { Puzzle } from "../src/puzzle/engine";

const base = (p: Partial<Puzzle>): Puzzle => ({ width: 5, height: 5, holes: [], walls: [], pieces: [], goal: { type: "mate" }, moves: 1, ...p });

describe("eye stare (engine)", () => {
  const eye = { x: 2, y: 2 };
  it("looks at the nearest of your pieces in its row or column", () => {
    const pz = base({ eyes: [eye], pieces: [["rook", "white", 2, 1], ["knight", "white", 4, 2], ["king", "black", 0, 0]] });
    expect(stareOf(boardOf(pz), start(pz), eye)).toEqual({ x: 2, y: 1 });
  });
  it("sees nothing past an enemy piece or a wall, nor off its lines", () => {
    const pz = base({ eyes: [eye], walls: [{ x: 3, y: 2 }], pieces: [["rook", "white", 4, 2], ["pawn", "black", 2, 1], ["rook", "white", 2, 0], ["knight", "white", 0, 0]] });
    expect(stareOf(boardOf(pz), start(pz), eye)).toBeNull();
  });
  it("takes the first piece on a line as the one it sees", () => {
    const pz = base({ eyes: [eye], pieces: [["rook", "white", 0, 2], ["knight", "white", 1, 2]] });
    expect(stareOf(boardOf(pz), start(pz), eye)).toEqual({ x: 1, y: 2 });
  });
});

describe("eye motion", () => {
  const at = { x: 2, y: 2 }, N = 8;
  const run = (s: EyeAnim, want: number | null, secs: number, dt = 1 / 60) => {
    for (let t = 0; t < secs; t += dt) s = eyeTick(s, want, dt, N);
    return s;
  };
  it("heads toward the piece it sees, as the figures do (0 toward the camera, 2 right)", () => {
    expect(stareHeading(at, null)).toBeNull();
    expect(stareHeading(at, { x: 2, y: 4 })).toBe(0);
    expect(stareHeading(at, { x: 4, y: 2 })).toBe(2);
    expect(stareHeading(at, { x: 2, y: 0 })).toBe(4);
    expect(stareHeading(at, { x: 0, y: 2 })).toBe(6);
  });
  it("starts staring if it sees a piece when the board comes up, else dozing", () => {
    expect(eyeStart(2)).toMatchObject({ phase: "awake", k: 2 });
    expect(eyeStart(null).phase).toBe("doze");
  });
  it("snaps awake fast and nods off slowly", () => {
    const woke = run(eyeStart(null), 2, (N - 1) / WAKE_FPS + 0.05);
    expect(woke).toMatchObject({ phase: "awake", k: 2 });
    const half = run(woke, null, ((N - 1) / SLEEP_FPS) / 2);
    expect(half.phase).toBe("sleep");
    expect(run(half, null, (N - 1) / SLEEP_FPS).phase).toBe("doze");
    expect(SLEEP_FPS).toBeLessThan(WAKE_FPS / 2);
  });
  it("opens again from where its lids are if it spots a piece while nodding off", () => {
    const s = run(run(eyeStart(2), null, 0.3), 4, 1 / 60);
    expect(s.phase).toBe("wake");
    expect(s.k).toBe(4);
    expect(s.f).toBeGreaterThan(0);
  });
  it("turns to a new piece the short way round, one heading at a time", () => {
    let s = eyeStart(0);
    s = eyeTick(s, 6, TURN_STEP * 1.01, N);
    expect(s.k).toBe(7);  // 0 -> 6 goes back through 7, not up through 1..5
    s = run(s, 6, TURN_STEP * 2);
    expect(s).toMatchObject({ phase: "awake", k: 6 });
  });
  it("nods off from a heading that has a wake", () => {
    const s = run({ phase: "awake", k: 3, f: 0, t: 0 }, null, TURN_STEP * 1.5);
    expect(s.phase).toBe("sleep");
    expect(s.k % 2).toBe(0);
  });
  it("draws the doze loop, the wake frames or the still for its heading", () => {
    const doze = { frames: 8, fps: 1.4 };
    expect(eyeFrame({ phase: "doze", k: 0, f: 0, t: 1 }, doze, N)).toEqual({ sheet: "doze", k: 0, i: 1 });
    expect(eyeFrame({ phase: "awake", k: 5, f: 0, t: 0 }, doze, N)).toEqual({ sheet: "still", k: 5, i: 5 });
    expect(eyeFrame({ phase: "wake", k: 2, f: 3.6, t: 0 }, doze, N)).toEqual({ sheet: "wake", k: 2, i: 4 });
  });
  it("breathes its glow while dozing only", () => {
    const g = [0, 1, 2, 3].map(t => eyeGlow({ phase: "doze", k: 0, f: 0, t: 0 }, t));
    expect(Math.max(...g) - Math.min(...g)).toBeGreaterThan(0.3);
    expect(eyeGlow({ phase: "awake", k: 0, f: 0, t: 0 }, 1)).toBe(1);
  });
  it("ships its sheets: the still (8 headings), the wakes along its row and column, and the doze", () => {
    const d = "public/diorama/";
    for (const f of [`${EYE_FIGURE}8.json`, `${EYE_FIGURE}8.webp`, `${EYE_FIGURE}8-glow.png`, `${EYE_FIGURE}-wake.json`, `${EYE_FIGURE}-doze.json`, `${EYE_FIGURE}-doze0.webp`, `${EYE_FIGURE}-doze0-glow.webp`,
      ...[0, 2, 4, 6].flatMap(k => [`${EYE_FIGURE}-wake${k}.webp`, `${EYE_FIGURE}-wake${k}-glow.webp`])]) expect(existsSync(d + f), f).toBe(true);
    const wake = JSON.parse(readFileSync(`${d}${EYE_FIGURE}-wake.json`, "utf8"));
    expect(wake.frames).toBe(N);
    expect(wake.have).toEqual([0, 2, 4, 6]);
  });
});
