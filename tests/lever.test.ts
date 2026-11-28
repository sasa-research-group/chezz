import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { LEVER_FPS, LEVER_GRACE_MS, LEVER_N, LEVER_THROW, leverFrame, leverMoving, leverSquare, leverStart, leverThrows, leverTick, leversBusy, setLeverMoving } from '../src/diorama/lever'

const S = 2.04
// Diorama's at(): board (x, y) on a 5x5 board to the stage
const at = (x: number, y: number) => [(x - 2) * S, (2 - y) * S] as [number, number]
const step = 1 / LEVER_FPS

describe('lever sheets per square', () => {
  it("names the bake folder's square (i from the left, j from the back)", () => {
    expect(leverSquare(at(0, 0), S)).toBe('lever04')
    expect(leverSquare(at(4, 4), S)).toBe('lever40')
    expect(leverSquare(at(2, 2), S)).toBe('lever22')
    expect(leverSquare([3 * S, 0], S)).toBeNull()
  })
  it('ships a sheet for every square: two throws, right then left', () => {
    for (let i = 0; i < LEVER_N; i++) for (let j = 0; j < LEVER_N; j++) {
      const base = `public/diorama/lever${i}${j}-throw`
      expect(existsSync(`${base}0.webp`) && existsSync(`${base}0-glow.webp`), base).toBe(true)
      const sh = JSON.parse(readFileSync(`${base}.json`, 'utf8'))
      expect(sh.frames).toBe(2 * LEVER_THROW)
      expect(sh.throwFrames).toBe(LEVER_THROW)
      expect(sh.fps).toBe(LEVER_FPS)
      expect(sh.t[0]).toBe(0)
      expect(sh.t[LEVER_THROW]).toBe(1)
    }
  })
})

describe('leverThrows', () => {
  it('counts the moves that stopped on the lever, and skips passes', () => {
    const p = { x: 1, y: 2 }
    expect(leverThrows([], p)).toBe(0)
    expect(leverThrows([{ to: { x: 1, y: 2 } }, null, { to: { x: 0, y: 2 } }, { to: { x: 1, y: 2 } }], p)).toBe(2)
  })
})

describe('the throw', () => {
  it('waits for the move to land, then throws right over the first half of the sheet and rests there', () => {
    let s = leverStart(0, 0)
    expect(leverFrame(s)).toBe(0)
    s = leverTick(s, 1, 1000, 300, step)          // the piece is still on its way
    expect(leverFrame(s)).toBe(0)
    expect(leverMoving(s)).toBe(true)             // its gates already wait
    s = leverTick(s, 1, 1000 + LEVER_GRACE_MS, 0, step)
    const seen: number[] = []
    for (let k = 0; k < 40 && leverMoving(s); k++) { seen.push(leverFrame(s)); s = leverTick(s, 1, 2000, 0, step) }
    expect(seen[0]).toBe(0)
    expect(seen[seen.length - 1]).toBe(LEVER_THROW - 1)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(leverMoving(s)).toBe(false)
    expect(leverFrame(s)).toBe(LEVER_THROW)       // resting right: the left throw's first frame
  })
  it('throws back left over the second half of the sheet', () => {
    let s = leverStart(1, 0)
    s = leverTick(s, 2, 1000, 0, step)
    s = leverTick(s, 2, 1000 + LEVER_GRACE_MS, 0, step)
    expect(leverFrame(s)).toBe(LEVER_THROW)
    for (let k = 0; k < 40 && leverMoving(s); k++) s = leverTick(s, 2, 2000, 0, step)
    expect(leverFrame(s)).toBe(0)
  })
  it('snaps to rest on an undo or a restart instead of throwing', () => {
    let s = leverStart(3, 0)
    s = leverTick(s, 0, 1000, 0, step)
    expect(leverMoving(s)).toBe(false)
    expect(leverFrame(s)).toBe(0)
    s = leverTick(leverTick(leverStart(0, 0), 1, 1000, 0, step), 1, 1200, 0, step)   // mid-throw...
    s = leverTick(s, 0, 1300, 0, step)                                                // ...undone
    expect(leverMoving(s)).toBe(false)
    expect(leverFrame(s)).toBe(0)
  })
  it('a board that comes up already thrown shows it at rest', () => {
    expect(leverMoving(leverStart(1, 0))).toBe(false)
    expect(leverFrame(leverStart(1, 0))).toBe(LEVER_THROW)
  })
})

describe('gates wait for levers', () => {
  it('is busy while any lever moves', () => {
    expect(leversBusy()).toBe(false)
    setLeverMoving('a', true); setLeverMoving('b', true)
    setLeverMoving('a', false)
    expect(leversBusy()).toBe(true)
    setLeverMoving('b', false)
    expect(leversBusy()).toBe(false)
  })
})
