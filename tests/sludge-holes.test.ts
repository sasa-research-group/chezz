import { describe, expect, it } from "vitest";
import { coatFactor, holeKnobs, rgbKnob, HOLE_DEFAULTS } from "../src/diorama/sludgeHoles";
import { readFileSync } from "node:fs";

describe("the torn holes' knobs", () => {
  it("reads one number as grey and three as r,g,b", () => {
    expect(rgbKnob("1.2")).toEqual([1.2, 1.2, 1.2]);
    expect(rgbKnob("1,2,3")).toEqual([1, 2, 3]);
  });
  it("refuses a knob that is not numbers", () => expect(() => rgbKnob("blue")).toThrow());
  it("defaults to the round-13 fit: greener, less blue torn light; a stronger, cooler coat", () => {
    const k = holeKnobs(new URLSearchParams());
    expect(HOLE_DEFAULTS.lift).toBe("1.15,1.37,0.6");
    expect(k.lift[1]).toBeGreaterThan(k.lift[0]);
    expect(k.lift[2]).toBeLessThan(1);
    expect(k.coat[2]).toBeGreaterThan(k.coat[1]);
    expect(k.coat[1]).toBeGreaterThan(k.coat[0]);
  });
  it("lets the URL override each knob", () => {
    const k = holeKnobs(new URLSearchParams("hole=1&holecoat=1"));
    expect(k).toEqual({ lift: [1, 1, 1], coat: [1, 1, 1] });
  });
  it("leaves whole skin's coat alone and gives a full hole the whole tint", () => {
    expect(coatFactor([2, 3.2, 4.5], 0)).toEqual([1, 1, 1]);
    expect(coatFactor([2, 3.2, 4.5], 1)).toEqual([2, 3.2, 4.5]);
    expect(coatFactor([3, 3, 3], 0.5)).toEqual([2, 2, 2]);
  });
  it("is wired the same way in the shader", () => {
    const src = readFileSync(new URL("../src/proof/liveSludge.ts", import.meta.url), "utf8");
    expect(src).toContain("open = dec(lookIn(torn, rest, n, nr)) * holeLift");
    expect(src).toContain("mix(vec3(1.0), holeCoat, tear)");
  });
});
