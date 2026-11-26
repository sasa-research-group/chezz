// The live lights on the 3D board: a bake's own lamp list (bake_set.py stage_lights, saved from real bakes in
// fixtures/stage-lights.json) gives the same lights as the hand-placed 5x5 ones, and a long board gets one per stretch.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { liveLights } from "../src/diorama/liveLights";
import type { SetInfo } from "../src/diorama/set";

const fx = JSON.parse(fs.readFileSync("tests/fixtures/stage-lights.json", "utf8"));
const src5 = JSON.parse(fs.readFileSync("public/diorama/set5.json", "utf8")) as SetInfo;
const level = (k: "square5" | "hall5x12", nx: number, ny: number) =>
  ({ ...src5, ...fx[k], n: Math.min(nx, ny), nx, ny }) as SetInfo & { lights: never };

describe("live lights", () => {
  it("an old bake with no lamp list keeps the 5x5 stage's lights", () => {
    const ls = liveLights({ ...src5, lights: undefined }, 5, 5);
    expect(ls.map(l => l.name)).toEqual(["lantern", "framekey", "pool", "warmfill", "moon"]);
    const lantern = ls[0], H = src5.H;
    expect(lantern.kind).toBe("point");
    expect(lantern.at).toEqual([-1.08 * H, -5.98 * H, 2.6 * H]);
    expect(lantern.intensity).toBeCloseTo(4046 / (4 * Math.PI));
    expect(ls[4].intensity).toBeCloseTo(101 / Math.PI); // the moon is an area light
  });

  it("a 5x5 bake's own lamps match the hand-placed ones", () => {
    const own = liveLights(level("square5", 5, 5), 5, 5);
    const hand = liveLights({ ...src5, ...fx.square5, lights: undefined }, 5, 5);
    expect(own.map(l => l.name).sort()).toEqual(hand.map(l => l.name).sort());
    for (const h of hand) {
      const o = own.find(l => l.name === h.name)!;
      o.at.forEach((v, i) => expect(v).toBeCloseTo(h.at[i], 1));
      o.dir.forEach((v, i) => expect(v).toBeCloseTo(h.dir[i], 1));
      expect(o.intensity / h.intensity).toBeCloseTo(1, 2);
      expect(o.angle).toBeCloseTo(h.angle, 1);
      expect(o.color).toEqual(h.color);
    }
  });

  it("a long hall gets the front lights once per stretch, all down its length", () => {
    const ls = liveLights(level("hall5x12", 5, 12), 5, 12);
    const S = fx.hall5x12.S, ys = (n: string) => ls.filter(l => l.name === n).map(l => l.at[1]).sort((a, b) => a - b);
    expect(ls).toHaveLength(13);
    expect(ys("lantern")).toHaveLength(1); // the lantern stays once, in front
    for (const n of ["pool", "warmfill", "moon", "framekey"]) expect(ys(n)).toHaveLength(3);
    // the pools spread from in front of the hall to its back half, not bunched at the 5x5 spots
    const p = ys("pool");
    expect(p[0]).toBeLessThan(-6 * S / 2);
    expect(p[2]).toBeGreaterThan(0);
    // a copy re-aimed at its own stretch keeps the narrower cone the bake gave it
    const wf = ls.filter(l => l.name === "warmfill").map(l => l.angle).sort();
    expect(wf[0]).toBeLessThan(wf[2]);
  });

  it("drops a lamp the game has no look for", () => {
    const info = { ...level("square5", 5, 5), lights: [{ name: "wallbase", at: [0, 0, 1], dir: [0, 1, 0], watts: 5 }] };
    expect(liveLights(info as never, 5, 5)).toEqual([]);
  });
});
