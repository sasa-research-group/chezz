import { describe, expect, it } from "vitest";
import { glowGain, DOME_GLOW_GLSL } from "../src/diorama/sludgeGlow";

describe("the dome glow", () => {
  it("leaves the flat pool alone", () => expect(glowGain(1, 0.3)).toBe(1));
  it("raises a 60-degree side by the full strength, a 30-degree one by a quarter", () => {
    expect(glowGain(0.5, 0.3)).toBeCloseTo(1.3, 9);
    expect(glowGain(Math.cos(Math.PI / 6), 0.3)).toBeCloseTo(1.075, 9);
  });
  it("is off at strength 0, and safe past the clamp", () => {
    expect(glowGain(0.2, 0)).toBe(1);
    expect(Number.isFinite(glowGain(1.0000001, 0.3))).toBe(true);
  });
  it("has the same sum in GLSL", () => expect(DOME_GLOW_GLSL).toContain("1.0 + domeGlow * t * t"));
});
