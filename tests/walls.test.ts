import { describe, expect, it } from 'vitest'
import { WALL_HALF_GLB, WALL_PIL_GLB, WALL_SEG_GLB, wallArms, wallPieces } from '../src/diorama/walls'

describe('wallArms', () => {
  const sq = (x: number, y: number, kind?: string) => ({ x, y, kind })
  it('runs a lone wall across its square, left to right', () => {
    expect(wallArms([sq(2, 2, 'wall')], 5, 5).get('2,2')).toEqual({ l: true, r: true, b: false, f: false, posts: ['l', 'r'] })
  })
  it('joins walls next to each other, and to gates', () => {
    const m = wallArms([sq(1, 2, 'wall'), sq(2, 2, 'gate'), sq(3, 2, 'wall'), sq(1, 1, 'wall'), sq(1, 3, 'hole')], 5, 5)
    expect(m.get('1,2')).toEqual({ l: false, r: true, b: true, f: false, posts: ['r'] })
    expect(m.get('3,2')).toEqual({ l: true, r: false, b: false, f: false, posts: ['l'] })
    expect(m.get('1,1')).toEqual({ l: false, r: false, b: false, f: true })
    expect(m.has('2,2')).toBe(false)
  })
  it('puts gate posts on the walls beside a gate', () => {
    const m = wallArms([sq(1, 2, 'wall'), sq(2, 2, 'gate'), sq(3, 2, 'wall'), sq(2, 1, 'wall'), sq(4, 2, 'gate-open')], 5, 5)
    expect(m.get('1,2')?.posts).toEqual(['r'])
    expect(m.get('3,2')?.posts).toEqual(['l', 'r'])
    expect(m.get('2,1')?.posts).toEqual(['f'])
  })
  it('runs a wall into the frame at the board edge', () => {
    const m = wallArms([sq(0, 2, 'wall'), sq(1, 2, 'wall'), sq(4, 0, 'wall'), sq(4, 1, 'wall')], 5, 5)
    expect(m.get('0,2')).toEqual({ l: true, r: true, b: false, f: false })
    expect(m.get('4,0')).toEqual({ l: false, r: false, b: true, f: true })
  })
})

describe('wallPieces', () => {
  const kinds = (ps: ReturnType<typeof wallPieces>) => ps.map(p => p.kind).sort().join(' ')
  it('lays a straight run as one whole stretch and no pillar', () => {
    expect(kinds(wallPieces({ l: true, r: true, b: false, f: false }, 1))).toBe('seg')
    const [p] = wallPieces({ l: false, r: false, b: true, f: true }, 1)
    expect(p.turn).toBeCloseTo(Math.PI / 2)
  })
  it('puts a pillar where the wall turns, with half stretches cut end to the pillar', () => {
    const ps = wallPieces({ l: false, r: true, b: true, f: false }, 1)
    expect(kinds(ps)).toBe('half half pil')
    const right = ps.find(p => p.x === 0.25)!, back = ps.find(p => p.y === 0.25)!
    expect(right).toMatchObject({ turn: 0, mirror: true })
    expect(back.turn).toBeCloseTo(Math.PI / 2); expect(back.mirror).toBe(true)
    const ends = wallPieces({ l: true, r: false, b: false, f: true }, 1)
    expect(ends.filter(p => p.kind === 'half').every(p => !p.mirror)).toBe(true)
  })
  it('ends a lone wall in a pillar on each end', () => {
    const ps = wallPieces({ l: true, r: true, b: false, f: false, posts: ['l', 'r'] }, 1)
    expect(kinds(ps)).toBe('pil pil seg')
  })
  it('looks the same for the same seed', () => {
    const a = { l: true, r: true, b: true, f: false }
    expect(wallPieces(a, 7)).toEqual(wallPieces(a, 7))
  })
})

describe('wall models', () => {
  it('ships all three pieces as small binary glTF files', async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of [WALL_SEG_GLB, WALL_HALF_GLB, WALL_PIL_GLB]) {
      const b = readFileSync(`public/${f}`)
      expect(b.subarray(0, 4).toString()).toBe('glTF')
      expect(b.length).toBeLessThan(2_000_000)
    }
  })
})
