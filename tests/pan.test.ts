import { describe, expect, it } from "vitest";
import { HYST, SWIPE_PX, ease, nearestStop, stageOf, stepStop, swipeDir, trapStop } from "../src/diorama/pan";
import type { Stop } from "../src/diorama/pan";

// a 5 x 12 hall's stops (level_layout.py stops(5, 12)): front, middle, back
const HALL: Stop[] = [[0, -3], [0, 0], [0, 3]];
// a 24 x 24 board's corner of stops, rows of x
const GRID: Stop[] = [[-3, -3], [0, -3], [3, -3], [-3, 0], [0, 0], [3, 0]];

describe("panning stops", () => {
  it("puts board squares in stop units, the back row at the back", () => {
    expect(stageOf(5, 12, 2, 0)).toEqual([0, 5.5]);   // puzzle y = 0 is the back row
    expect(stageOf(5, 12, 2, 11)).toEqual([0, -5.5]);
    expect(stageOf(5, 12, 0, 6)).toEqual([-2, -0.5]);
  });

  it("rests on the stop nearest the piece", () => {
    expect(nearestStop(HALL, stageOf(5, 12, 2, 11))).toBe(0);  // the king at the front
    expect(nearestStop(HALL, stageOf(5, 12, 2, 0))).toBe(2);   // at the back
    expect(nearestStop(HALL, [0, 0.4])).toBe(1);
  });

  it("doesn't flick between two stops on the line between them", () => {
    expect(nearestStop(HALL, [0, -1.6], 1)).toBe(1);           // a hair nearer the front: stays in the middle
    expect(nearestStop(HALL, [0, -1.5 - HYST - 0.01], 1)).toBe(0);  // well past it: goes
    expect(nearestStop(HALL, [0, 1.6], 1)).toBe(1);
  });

  it("swipes one stop over, and only that way", () => {
    expect(stepStop(HALL, 0, [0, 1])).toBe(1);
    expect(stepStop(HALL, 1, [0, 5])).toBe(2);
    expect(stepStop(HALL, 2, [0, 1])).toBe(2);                 // nothing further back
    expect(stepStop(HALL, 1, [1, 0])).toBe(1);                 // nothing to the side
    expect(stepStop(GRID, 4, [1, 0.2])).toBe(5);
    expect(stepStop(GRID, 4, [0, -1])).toBe(1);
    expect(stepStop(GRID, 4, [0, 0])).toBe(4);
  });

  it("reads a swipe the way the board follows the finger", () => {
    expect(swipeDir(SWIPE_PX - 1, 0)).toBeNull();              // a tap that wobbled
    expect(swipeDir(0, 80)).toEqual([-0, 80]);                 // finger down: the camera goes toward the back
    expect(swipeDir(80, 0)).toEqual([-80, 0]);                 // finger right: the camera goes left
  });

  it("eases in and out", () => {
    expect(ease(-1)).toBe(0); expect(ease(0)).toBe(0); expect(ease(0.5)).toBe(0.5); expect(ease(1)).toBe(1); expect(ease(2)).toBe(1);
    expect(ease(0.1)).toBeLessThan(0.1);
  });

  it("shows a trapdoor's own sheet from a stop that baked it, else the nearest that did", () => {
    expect(trapStop([1, 2], HALL, 1)).toBe(1);
    expect(trapStop([1, 2], HALL, 0)).toBe(1);
    expect(trapStop([0], HALL, 2)).toBe(0);
    expect(trapStop([], HALL, 0)).toBeNull();
    expect(trapStop(undefined, HALL, 0)).toBeNull();
  });
});
