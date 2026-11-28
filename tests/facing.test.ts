import { describe, expect, it } from 'vitest'
import { snapDir, track, yawOf } from '../src/diorama/facing'

const at = (x: number, y: number) => ({ x, y })
const st = (...ps: [number, number][]) => ({ pieces: ps.map(([x, y]) => at(x, y)) })

describe('snapDir', () => {
  it('maps board steps to Blender floor directions (y toward the back)', () => {
    expect(snapDir(1, 0)).toEqual([1, 0])
    expect(snapDir(-1, 0)).toEqual([-1, 0])
    expect(snapDir(0, -1)).toEqual([0, 1]) // toward the back row
    expect(snapDir(0, 1)).toEqual([0, -1]) // toward the camera
    expect(snapDir(2, -2)).toEqual([1, 1])
    expect(snapDir(0, 0)).toBeNull()
  })
  it('snaps knight moves to the nearest of the 8 directions', () => {
    expect(snapDir(1, -2)).toEqual([1, 1]) // 63 degrees: nearer the diagonal
    expect(snapDir(2, 1)).toEqual([1, -1])
  })
  it('turns facings into yaws: camera 0, right a quarter turn, back a half', () => {
    expect(yawOf(null)).toBe(0)
    expect(yawOf([1, 0])).toBeCloseTo(Math.PI / 2)
    expect(yawOf([0, 1])).toBeCloseTo(Math.PI)
  })
})

describe('track', () => {
  it('starts with everyone facing the camera', () => {
    expect(track([st([0, 4], [2, 2])], [])).toEqual([{ id: 'p0', facing: null }, { id: 'p1', facing: null }])
  })
  it('keeps ids across moves and faces the last move', () => {
    const r = track([st([0, 4], [2, 2]), st([0, 3], [2, 2]), st([0, 3], [3, 2])],
      [{ from: at(0, 4), to: at(0, 3) }, { from: at(2, 2), to: at(3, 2) }])
    expect(r).toEqual([{ id: 'p0', facing: [0, 1] }, { id: 'p1', facing: [1, 0] }])
  })
  it('drops a captured piece and faces the captured square', () => {
    const r = track([st([0, 4], [1, 3]), st([1, 3])], [{ from: at(0, 4), to: at(1, 3) }])
    expect(r).toEqual([{ id: 'p0', facing: [1, 1] }])
  })
  it('turns a striking statue without moving it', () => {
    const r = track([st([2, 2], [2, 0]), st([2, 2])], [{ from: at(2, 2), to: at(2, 0), strike: true }])
    expect(r).toEqual([{ id: 'p0', facing: [0, 1] }])
  })
  it('turns a piece pulling a lever toward it, and leaves it on its square', () => {
    const r = track([st([3, 2]), st([3, 2])], [{ from: at(3, 2), to: at(2, 2), pull: true }])
    expect(r).toEqual([{ id: 'p0', facing: [-1, 0] }])
  })
  it('treats a pass as no turn', () => {
    expect(track([st([1, 1]), st([1, 1])], [null])).toEqual([{ id: 'p0', facing: null }])
  })
})
