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

  it("keeps one copy of a lamp every sheet lists, so three pools' lamps fit the list (sheet -1: all)", () => {
    const names = ["fairy2_0", "fairy2_1", "lantern", "frontfill", "pool", "warmfill", "moon", "FairyBulb2_0", "FairyBulb2_1"];
    const lamps = [0, 1, 2].flatMap(k => names.map((n, i) => lamp(n, [i, 4, 6], k)));
    const pings = [ping([0, 0, 1]), ping([1, 0, 1], 1), ping([2, 0, 1], 2)];
    const { list, dropped } = glintList(pings, lamps, box, { max: 10 });
    expect(dropped).toBe(2);
    const all = glintList(pings, lamps, box, { max: 32 });
    expect(all.dropped).toBe(0);
    expect(all.list).toHaveLength(3 + names.length);
    expect(all.list.slice(3).every(g => g.sheet === -1)).toBe(true);
    expect(all.list.map(g => g.L).filter(L => L === 400)).toHaveLength(names.length);
    expect(list).toHaveLength(10);
  });

  it("keeps a lamp only one sheet lists on that sheet", () => {
    const lamps = [lamp("moon", [0, 0, 6], 0), lamp("moon", [0, 0, 6], 1), lamp("lantern", [0, -10, 4], 1)];
    const { list } = glintList([], lamps, box);
    expect(list.map(g => [g.sheet, g.at[2]])).toEqual([[-1, 6], [1, 4]]);
  });
});
