import { describe, expect, it } from 'vitest'
import { loopFrame, showsCheck } from '../src/diorama/check'
import { boardOf, inCheck, start } from '../src/puzzle/engine'
import type { Puzzle } from '../src/puzzle/engine'

// as tools/art/diorama/check_pose.py bakes it: 48 frames round, the last one the same as the first
const CK = { fps: 24, frames: 47 }

describe('loopFrame', () => {
  it('plays at the bake rate and wraps round', () => {
    expect(loopFrame(0, CK)).toBe(0)
    expect(loopFrame(0.5, CK)).toBe(12)
    expect(loopFrame(46 / 24 + 0.01, CK)).toBe(46)
    expect(loopFrame(47 / 24 + 0.01, CK)).toBe(0)
    expect(loopFrame(10, CK)).toBe(240 % 47)
  })
  it('never goes below the first frame', () => {
    expect(loopFrame(-1, CK)).toBe(0)
  })
})

describe('showsCheck', () => {
  it('shows only standing still, in check, facing a heading whose sheet is in', () => {
    expect(showsCheck(true, true, false, true)).toBe(true)
    expect(showsCheck(false, true, false, true)).toBe(false)
    expect(showsCheck(true, false, false, true)).toBe(false)
    expect(showsCheck(true, true, true, true)).toBe(false)
    expect(showsCheck(true, true, false, false)).toBe(false)
  })
})

describe('the check flag on your king', () => {
  const pz = (rook: [number, number]): Puzzle => ({ width: 5, height: 5, moves: 2, goal: { type: 'mate' }, holes: [], walls: [],
    pieces: [['king', 'black', 0, 0], ['rook', 'black', ...rook], ['king', 'white', 2, 4]] })
  it('is on when an enemy attacks him, off when not', () => {
    const a = pz([2, 1]), b = pz([4, 1])
    expect(inCheck(boardOf(a), start(a), 'white')).toBe(true)
    expect(inCheck(boardOf(b), start(b), 'white')).toBe(false)
  })
})
