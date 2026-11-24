import { afterEach, describe, expect, it, vi } from 'vitest'
import { GAP, strikeFrame, strikePlan, strikeTravel } from '../src/diorama/strike'
import { lastCapture } from '../src/diorama/facing'
import { clearTime, hitTime, willClear, willHit } from '../src/diorama/motion'

// as tools/art/diorama/strike_pose.py bakes it
const ST = { fps: 24, frames: 29, hit: 12, travel: 0.32 }
const at = (x: number, y: number) => ({ x, y })
const st = (...ps: [number, number][]) => ({ pieces: ps.map(([x, y]) => at(x, y)) })

describe('strikePlan', () => {
  it('walks to a stand-off point the leap covers, then strikes', () => {
    const p = strikePlan(2, ST)
    expect(p.walk).toBeCloseTo(1.68)
    expect(p.length).toBeCloseTo(29 / 24)
    expect(p.hitAt).toBeCloseTo(0.5)
  })
  it('is all leap when the enemy is closer than the leap', () => {
    expect(strikePlan(0.2, ST).walk).toBe(0)
  })
  it('lands the taker a gap short of the enemy, so the two figures never overlap', () => {
    const S = 2.04, gap = GAP * S, p = strikePlan(S, ST, gap)
    expect(p.walk + ST.travel + gap).toBeCloseTo(S)  // walk, leap, then the gap to the enemy's centre
    expect(gap).toBeGreaterThan(0.6 * S)  // two figures about 0.6 of a square wide stand clear of each other
    expect(gap).toBeLessThan(S)  // still next to it, not back on his own square
  })
})

describe('the taken square clearing', () => {
  it('tells the taker when the piece he took has gone, for clears announced since his move', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    expect(clearTime(5, 5, 0)).toBeNull()
    willClear(5, 5, 2500)
    expect(clearTime(5, 5, 900)).toBe(2500)
    expect(clearTime(5, 5, 1200)).toBeNull()  // an older piece's clear, not this move's
    vi.restoreAllMocks()
  })
})

describe('strikeFrame', () => {
  it('plays at the bake rate and holds the last frame', () => {
    expect(strikeFrame(0, ST)).toBe(0)
    expect(strikeFrame(0.5, ST)).toBe(12)
    expect(strikeFrame(5, ST)).toBe(28)
    expect(strikeFrame(-1, ST)).toBe(0)
  })
})

describe('strikeTravel', () => {
  it('leaves the floor after the crouch and lands on the hit', () => {
    expect(strikeTravel(0, ST)).toBe(0)
    expect(strikeTravel(5, ST)).toBe(0)
    expect(strikeTravel(8, ST)).toBeGreaterThan(0)
    expect(strikeTravel(8, ST)).toBeLessThan(1)
    expect(strikeTravel(12, ST)).toBe(1)
    expect(strikeTravel(28, ST)).toBe(1)
  })
})

describe('lastCapture', () => {
  it('finds the taker and the taken piece', () => {
    const r = lastCapture([st([0, 4], [1, 3]), st([1, 3])], [{ from: at(0, 4), to: at(1, 3) }])
    expect(r).toEqual({ by: 0, victim: 1 })
  })
  it('is null for a plain move, a pass or no moves', () => {
    expect(lastCapture([st([0, 4]), st([0, 3])], [{ from: at(0, 4), to: at(0, 3) }])).toBeNull()
    expect(lastCapture([st([0, 4]), st([0, 4])], [null])).toBeNull()
    expect(lastCapture([st([0, 4])], [])).toBeNull()
  })
  it('counts a statue strike, the statue staying put', () => {
    const r = lastCapture([st([0, 0], [2, 2]), st([0, 0])], [{ from: at(0, 0), to: at(2, 2), strike: true }])
    expect(r).toEqual({ by: 0, victim: 1 })
  })
  it('looks only at the last move', () => {
    const r = lastCapture([st([0, 4], [1, 3]), st([1, 3]), st([1, 2])],
      [{ from: at(0, 4), to: at(1, 3) }, { from: at(1, 3), to: at(1, 2) }])
    expect(r).toBeNull()
  })
})

describe('willHit / hitTime', () => {
  afterEach(() => vi.useRealTimers())
  it('tells a taken piece when the blow lands on its square', () => {
    vi.useFakeTimers({ now: 1000, toFake: ['performance'] })
    const before = performance.now()
    willHit(2.0048, -4.0096, 0.5)
    expect(hitTime(2.0048, -4.0096, before)).toBe(before + 500)
    expect(hitTime(0, 0, before)).toBeNull()
  })
  it('ignores a blow announced before the piece was taken', () => {
    vi.useFakeTimers({ now: 1000, toFake: ['performance'] })
    willHit(1, 1, 0.5)
    vi.advanceTimersByTime(100)
    expect(hitTime(1, 1, performance.now())).toBeNull()
  })
})
