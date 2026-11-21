import { describe, expect, it } from 'vitest'
import { WALL_FADE, fadeStep, fadedWalls } from '../src/diorama/walls'

describe('fadedWalls', () => {
  const squares = [{ x: 1, y: 2, kind: 'wall' }, { x: 3, y: 2, kind: 'eye' }, { x: 2, y: 2, kind: 'gate' }, { x: 0, y: 2 }]
  it('fades a wall with a piece on the square right behind it', () => {
    expect([...fadedWalls(squares, [{ x: 1, y: 1 }])]).toEqual(['1,2'])
    expect([...fadedWalls(squares, [{ x: 3, y: 1 }])]).toEqual(['3,2'])
  })
  it('leaves walls alone for pieces beside, in front or two rows back', () => {
    expect(fadedWalls(squares, [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 1, y: 0 }, { x: 2, y: 1 }]).size).toBe(0)
  })
  it('only blocks fade, not gates or plain floor', () => {
    expect(fadedWalls(squares, [{ x: 2, y: 1 }, { x: 0, y: 1 }]).size).toBe(0)
  })
})

describe('fadeStep', () => {
  it('moves toward the faded opacity and stops there', () => {
    let o = 1
    for (let i = 0; i < 100; i++) o = fadeStep(o, true, 1 / 60)
    expect(o).toBe(WALL_FADE)
    expect(fadeStep(1, true, 0.1)).toBeLessThan(1)
  })
  it('comes back to solid once the piece leaves', () => {
    let o = WALL_FADE
    for (let i = 0; i < 100; i++) o = fadeStep(o, false, 1 / 60)
    expect(o).toBe(1)
  })
})
