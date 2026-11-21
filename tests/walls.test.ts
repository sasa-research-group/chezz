import { describe, expect, it } from 'vitest'
import { WALL_FADE, WALL_T, fadeStep, fadedWalls, wallArms, wallBricks } from '../src/diorama/walls'

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


describe('wallArms', () => {
  const sq = (x: number, y: number, kind?: string) => ({ x, y, kind })
  it('runs a lone wall across its square, left to right', () => {
    expect(wallArms([sq(2, 2, 'wall')], 5, 5).get('2,2')).toEqual({ l: true, r: true, b: false, f: false })
  })
  it('joins walls next to each other, and to gates', () => {
    const m = wallArms([sq(1, 2, 'wall'), sq(2, 2, 'gate'), sq(3, 2, 'wall'), sq(1, 1, 'wall'), sq(1, 3, 'hole')], 5, 5)
    expect(m.get('1,2')).toEqual({ l: false, r: true, b: true, f: false })
    expect(m.get('3,2')).toEqual({ l: true, r: false, b: false, f: false })
    expect(m.get('1,1')).toEqual({ l: false, r: false, b: false, f: true })
    expect(m.has('2,2')).toBe(false)
  })
  it('runs a wall into the frame at the board edge', () => {
    const m = wallArms([sq(0, 2, 'wall'), sq(1, 2, 'wall'), sq(4, 0, 'wall'), sq(4, 1, 'wall')], 5, 5)
    expect(m.get('0,2')).toEqual({ l: true, r: true, b: false, f: false })
    expect(m.get('4,0')).toEqual({ l: false, r: false, b: true, f: true })
  })
})

describe('wallBricks', () => {
  const ext = (bs: ReturnType<typeof wallBricks>) => ({
    x0: Math.min(...bs.map(b => b.x - b.sx / 2)), x1: Math.max(...bs.map(b => b.x + b.sx / 2)),
    y0: Math.min(...bs.map(b => b.y - b.sy / 2)), y1: Math.max(...bs.map(b => b.y + b.sy / 2)),
  })
  it('lays a straight wall thin, edge to edge, with a moss cap and no pier', () => {
    const bs = wallBricks({ l: true, r: true, b: false, f: false }, 1), e = ext(bs)
    expect(e.x0).toBeCloseTo(-0.5); expect(e.x1).toBeCloseTo(0.5)
    expect(e.y1).toBeLessThanOrEqual(WALL_T * 0.6)
    expect(bs.filter(b => b.moss)).toHaveLength(1)
    expect(Math.max(...bs.map(b => b.z + b.sz / 2))).toBeCloseTo(1)
  })
  it('stops at a pier in the middle when the wall ends there', () => {
    const e = ext(wallBricks({ l: false, r: true, b: false, f: false }, 1))
    expect(e.x0).toBeGreaterThan(-0.2); expect(e.x1).toBeCloseTo(0.5)
  })
  it('turns a corner: runs right and away from the camera', () => {
    const e = ext(wallBricks({ l: false, r: true, b: true, f: false }, 1))
    expect(e.x1).toBeCloseTo(0.5); expect(e.y1).toBeCloseTo(0.5); expect(e.y0).toBeGreaterThan(-0.2)
  })
  it('looks the same for the same seed', () => {
    const a = { l: true, r: true, b: false, f: false }
    expect(wallBricks(a, 7)).toEqual(wallBricks(a, 7))
  })
})
