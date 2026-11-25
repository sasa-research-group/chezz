import { describe, expect, it } from "vitest";
import { glintList, type Lamp, type Ping } from "../src/diorama/sludgeGlints";

const box: [number[], number[]] = [[-5, -5, -1], [5, 5, 7]];
const ping = (at: number[], sheet = 0): Ping => ({ sheet, at, size: 0.1, power: 2, color: [1, 1, 1] });
const lamp = (name: string, at: number[], sheet = 0): Lamp => ({ sheet, name, at, radius: 0.05, radiance: 400, color: [1.6, 0.9, 0.5] });

describe("glintList (the discs the live sludge mirrors)", () => {
  it("puts pings first and counts them", () => {
    const { list, nPings } = glintList([ping([0, 0, 1]), ping([1, 0, 1], 1)], [lamp("fairy2_0", [0, 4, 6])], box);
    expect(nPings).toBe(2);
    expect(list.map(g => g.sheet)).toEqual([0, 1, 0]);
    expect(list[2].L).toBe(400);
  });

  it("drops a ping behind a wall but keeps a lamp hanging in front of the open box", () => {
    const { list, nPings } = glintList([ping([0, -9, 1])], [lamp("lantern", [0, -10, 4])], box);
    expect(nPings).toBe(0);
    expect(list).toHaveLength(1);
  });

  it("draws a ping as Cycles' square area light: same area, radiance power / (pi size^2)", () => {
    const g = glintList([ping([0, 0, 1])], [], box).list[0];
    expect(Math.PI * g.r * g.r).toBeCloseTo(0.1 * 0.1, 9);
    expect(g.L).toBeCloseTo(2 / (Math.PI * 0.01), 9);
  });

  it("scales and skips lamps by name, and caps the list", () => {
    const lamps = [lamp("moon", [0, 0, 6]), lamp("FairyBulb2_0", [0, 4, 6]), lamp("fairy2_0", [0, 4, 6])];
    const { list } = glintList([], lamps, box, { gain: 2, skip: ["moon", ""] });
    expect(list.map(g => g.L)).toEqual([800, 800]);
    expect(glintList(Array.from({ length: 40 }, () => ping([0, 0, 1])), lamps, box, { max: 32 }).list).toHaveLength(32);
  });
});
