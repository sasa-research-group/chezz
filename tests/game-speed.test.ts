import { afterEach, describe, expect, it, vi } from 'vitest'

// motion.ts reads the saved speed when it loads, so each case imports a fresh copy over its own storage.
const fresh = async (saved: Record<string, string> = {}) => {
  const store = { ...saved }
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
  })
  vi.resetModules()
  return { m: await import('../src/diorama/motion'), store }
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('game speed', () => {
  it('starts at normal speed', async () => {
    const { m } = await fresh()
    expect(m.gameSpeed()).toBe(1)
  })
  it('remembers fast-forward on this device', async () => {
    const { m, store } = await fresh()
    m.setGameSpeed(2)
    expect(m.gameSpeed()).toBe(2)
    expect(store['chezz.speed']).toBe('2')
    const again = await fresh(store)
    expect(again.m.gameSpeed()).toBe(2)
  })
  it('ignores a junk saved value', async () => {
    const { m } = await fresh({ 'chezz.speed': '9' })
    expect(m.gameSpeed()).toBe(1)
  })
  it('still works with no storage at all', async () => {
    vi.stubGlobal('localStorage', undefined)
    vi.resetModules()
    const m = await import('../src/diorama/motion')
    expect(m.gameSpeed()).toBe(1)
    m.setGameSpeed(2)
    expect(m.gameSpeed()).toBe(2)
  })
})
