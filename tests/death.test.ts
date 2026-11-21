import { describe, expect, it } from 'vitest'
import { LIE, SHEET_WAIT, deathSettles, SINK, TIP, deathFrame, faceTaker, mated, showsDeath, takenFall } from '../src/diorama/death'
import { boardOf, inCheck, legalMoves, start } from '../src/puzzle/engine'
import type { Puzzle } from '../src/puzzle/engine'

// as tools/art/diorama/death_pose.py bakes it: 78 frames at 24 fps, played once
const DT = { fps: 24, frames: 78 }

describe('deathFrame', () => {
  it('plays at the bake rate from the first frame', () => {
    expect(deathFrame(0, DT)).toBe(0)
    expect(deathFrame(0.5, DT)).toBe(12)
    expect(deathFrame(-1, DT)).toBe(0)
  })
  it('plays once and holds the last frame', () => {
    expect(deathFrame(77 / 24 + 0.01, DT)).toBe(77)
    expect(deathFrame(78 / 24 + 0.01, DT)).toBe(77)
    expect(deathFrame(60, DT)).toBe(77)
  })
})

describe('showsDeath', () => {
  it("shows only mated, standing still, with his heading's sheet in", () => {
    expect(showsDeath(true, true, true)).toBe(true)
    expect(showsDeath(false, true, true)).toBe(false)
    expect(showsDeath(true, false, true)).toBe(false)
    expect(showsDeath(true, true, false)).toBe(false)
  })
})

describe('mated', () => {
  it('needs check, his turn and no legal move', () => {
    expect(mated(true, true, 0)).toBe(true)
    expect(mated(false, true, 0)).toBe(false)
    expect(mated(true, false, 0)).toBe(false)
    expect(mated(true, true, 2)).toBe(false)
  })
  // white king in the bottom-left corner; black rooks on his rank and the next
  const pz = (rooks: [number, number][]): Puzzle => ({ width: 5, height: 5, moves: 2, goal: { type: 'mate' }, holes: [], walls: [],
    pieces: [['king', 'black', 4, 0], ...rooks.map(r => ['rook', 'black', ...r] as Puzzle['pieces'][number]), ['king', 'white', 0, 4]] })
  const isMated = (p: Puzzle) => {
    const b = boardOf(p), s = { ...start(p), turn: 'white' as const }
    return mated(inCheck(b, s, 'white'), true, legalMoves(p, b, s).length)
  }
  it('is on for a back-rank mate, off when he can step out', () => {
    expect(isMated(pz([[4, 4], [3, 3]]))).toBe(true)
    expect(isMated(pz([[4, 4]]))).toBe(false)
  })
})

describe('takenFall', () => {
  it('stands until the blow lands', () => {
    expect(takenFall(-0.5, null)).toEqual({ tip: 0, sink: 0, visible: true })
    expect(takenFall(-0.5, 1.08)).toEqual({ tip: 0, sink: 0, visible: true })
  })
  it('without a death: tips over, then sinks out', () => {
    expect(takenFall(TIP / 2, null).tip).toBeCloseTo(0.25)
    expect(takenFall(TIP, null)).toMatchObject({ tip: 1, sink: 0, visible: true })
    expect(takenFall(TIP + SINK / 2, null).sink).toBeCloseTo(0.5)
    expect(takenFall(TIP + SINK + 0.01, null).visible).toBe(false)
  })
  it('with a death: never tips, lies still after it, then sinks out', () => {
    const d = 26 / 24
    expect(takenFall(0.5, d)).toEqual({ tip: 0, sink: 0, visible: true })
    expect(takenFall(d + LIE - 0.01, d).sink).toBe(0)
    expect(takenFall(d + LIE + SINK / 2, d).sink).toBeCloseTo(0.5)
    expect(takenFall(d + LIE + SINK + 0.01, d).visible).toBe(false)
  })
})

describe('faceTaker', () => {
  it('faces back along the blow, toward the taker', () => {
    expect(faceTaker([0, 1])).toEqual([0, -1])
    expect(faceTaker([1, -1])).toEqual([-1, 1])
    expect(faceTaker([0, 0])).toEqual([0, 0])
  })
})

describe("deathSettles", () => {
  it("waits for the blow to land", () => {
    expect(deathSettles(100, null, 1)).toBe(false);
    expect(deathSettles(99, 100, 1)).toBe(false);
    expect(deathSettles(100, 100, 1)).toBe(true);
  });
  it("a piece with no death sheet settles on the blow", () => {
    expect(deathSettles(100, 100, undefined)).toBe(true);
  });
  it("waits for a loading death sheet, but not forever", () => {
    expect(deathSettles(100 + SHEET_WAIT, 100, null)).toBe(false);
    expect(deathSettles(101 + SHEET_WAIT, 100, null)).toBe(true);
  });
});
