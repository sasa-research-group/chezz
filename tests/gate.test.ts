import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { GATE_FPS, GATE_GRACE_MS, GATE_N, gateFrame, gateSquare, gateStart, gateTick, gateTurn, gateWait, gateWaitStart } from '../src/diorama/gate'

const S = 2.04
// Diorama's at(): board (x, y) on a 5x5 board to the stage
const at = (x: number, y: number) => [(x - 2) * S, (2 - y) * S] as [number, number]
const N = 15

describe('gateTurn', () => {
  it('faces along a wall that runs across the row', () => {
    expect(gateTurn([{ x: 1, y: 2, kind: 'wall' }, { x: 2, y: 2, kind: 'gate' }, { x: 3, y: 2, kind: 'wall' }], 2, 2)).toBe(0)
  })
  it('turns a quarter for a wall that runs front to back', () => {
    expect(gateTurn([{ x: 2, y: 1, kind: 'wall' }, { x: 2, y: 2, kind: 'gate' }, { x: 2, y: 3, kind: 'wall' }], 2, 2)).toBeCloseTo(Math.PI / 2)
  })
  it('stays across when it stands alone or at a corner with a row wall', () => {
    expect(gateTurn([{ x: 2, y: 2, kind: 'gate' }], 2, 2)).toBe(0)
    expect(gateTurn([{ x: 1, y: 2, kind: 'wall' }, { x: 2, y: 1, kind: 'wall' }], 2, 2)).toBe(0)
  })
})

describe('gate sheets per square', () => {
  it("names the bake folder's square (i from the left, j from the back) and the way it faces", () => {
    expect(gateSquare(at(0, 0), S, 0)).toBe('gate04')
    expect(gateSquare(at(3, 3), S, 0)).toBe('gate31')
    expect(gateSquare(at(2, 2), S, Math.PI / 2)).toBe('gate22q')
    expect(gateSquare([3 * S, 0], S, 0)).toBeNull()
  })
  it('ships both layers for every square, both ways round, all from the play camera', () => {
    for (let i = 0; i < GATE_N; i++) for (let j = 0; j < GATE_N; j++) for (const q of ['', 'q']) for (const layer of ['swing', 'front']) {
      const f = `public/diorama/gate${i}${j}${q}-${layer}`
      expect(existsSync(`${f}0.webp`) && existsSync(`${f}0-glow.webp`), f).toBe(true)
      const d = JSON.parse(readFileSync(`${f}.json`, 'utf8'))
      expect(d.square).toEqual([i, j])
      expect(d.turn).toBeCloseTo(q ? Math.PI / 2 : 0)
      expect(d.fps).toBe(GATE_FPS)
      expect(d.tiles[0] * d.tiles[1]).toBeGreaterThanOrEqual(d.frames)
      // shut on the first frame, open on the last
      expect(d.open[0]).toBe(0)
      expect(d.open[d.frames - 1]).toBeCloseTo(1)
      // the two layers share one crop, so their frames line up pixel for pixel
      const other = JSON.parse(readFileSync(`public/diorama/gate${i}${j}${q}-${layer === 'front' ? 'swing' : 'front'}.json`, 'utf8'))
      expect(d.crop).toEqual(other.crop)
      expect(d.dq).toBeCloseTo(other.dq, 6)
    }
  })
})

describe('gate swing timing', () => {
  it('starts where the board is, without replaying', () => {
    expect(gateFrame(gateStart(false), N)).toBe(0)
    expect(gateFrame(gateStart(true), N)).toBe(N - 1)
  })
  it('opens at 24 frames a second, then holds open', () => {
    let s = gateTick(gateStart(false), true, 1 / 60, N)
    expect(gateFrame(s, N)).toBe(0)
    s = gateTick(s, true, 6 / GATE_FPS, N)
    expect(gateFrame(s, N)).toBe(6)
    s = gateTick(s, true, 60, N)
    expect(gateFrame(s, N)).toBe(N - 1)
  })
  it('shuts by playing the swing backward, from wherever it got to', () => {
    let s = gateTick(gateStart(true), false, 4 / GATE_FPS, N)
    expect(gateFrame(s, N)).toBe(N - 1 - 4)
    s = gateTick(s, false, 60, N)
    expect(gateFrame(s, N)).toBe(0)
    s = gateTick(gateTick(gateStart(true), false, 8 / GATE_FPS, N), true, 2 / GATE_FPS, N)
    expect(gateFrame(s, N)).toBe(N - 1 - 8 + 2)
  })
})

describe('gateWait', () => {
  it('holds the doors until the move that flipped the gate has landed', () => {
    let w = gateWaitStart(false, 0)
    w = gateWait(w, true, 10, 0) // the board flips it as the rook sets off; his frame hasn't said yet
    expect(w.shown).toBe(false)
    w = gateWait(w, true, 50, 900) // the rook is walking to the plate
    expect(w.shown).toBe(false)
    w = gateWait(w, true, 900, 30)
    expect(w.shown).toBe(false)
    w = gateWait(w, true, 960, 0) // he lands: the doors swing
    expect(w.shown).toBe(true)
  })
  it('waits out the grace even when nothing reports a move yet', () => {
    let w = gateWait(gateWaitStart(true, 0), false, 1000, 0)
    expect(w.shown).toBe(true)
    w = gateWait(w, false, 1000 + GATE_GRACE_MS, 0)
    expect(w.shown).toBe(false)
  })
  it('starts as the board says, and a flip back before landing never moves the doors', () => {
    expect(gateWaitStart(true, 0).shown).toBe(true)
    let w = gateWait(gateWaitStart(false, 0), true, 10, 500)
    w = gateWait(w, false, 200, 300)
    w = gateWait(w, false, 2000, 0)
    expect(w.shown).toBe(false)
  })
})
