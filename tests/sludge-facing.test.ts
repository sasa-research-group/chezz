import { describe, expect, it } from "vitest";
import { faceFloor, FACE_FLOOR_GLSL, type V3 } from "../src/diorama/sludgeFacing";
import { readFileSync } from "node:fs";

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const v: V3 = unit([0, -0.4, 1]);  // the camera, high and square-on

describe("faceFloor", () => {
  it("leaves a normal that faces the camera alone", () => {
    const n: V3 = [0, 0, 1];
    expect(faceFloor(n, v, 0.4)).toEqual(n);
  });
  it("turns a dome's far side back towards the camera", () => {
    const n = unit([0, 1, 0.1]);  // leaning away: n.v < 0
    expect(dot(n, v)).toBeLessThan(0);
    const f = faceFloor(n, v, 0.4);
    expect(dot(f, v)).toBeGreaterThan(0.3);
    expect(Math.hypot(...f)).toBeCloseTo(1, 6);
  });
  it("keeps the normal's sideways lean", () => {
    const f = faceFloor(unit([0.7, 0.7, -0.1]), v, 0.4);
    expect(f[0]).toBeGreaterThan(0.3);
  });
  it("is the sum the live shader draws", () => {
    expect(FACE_FLOOR_GLSL).toContain("normalize(n + (minFace - nv) * v)");
    expect(readFileSync("src/proof/liveSludge.ts", "utf8")).toContain("faceFloor(normalize(vN), normalize(camPos - vWorld), minFace)");
  });
});
