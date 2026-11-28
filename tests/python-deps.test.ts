import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// The Mac's python3 (Homebrew) has no numpy or Pillow, so the art scripts run with `uv run script.py`, which
// installs what the script's PEP 723 block (# /// script ... # ///) lists. A script that imports numpy or PIL
// without listing them fails under uv, and a script that runs another with sys.executable hands it the same
// interpreter, so the outer one must list the inner one's packages too. Scripts run inside Blender (import bpy)
// use Blender's own Python and are left out.
const root = process.cwd()
function pyFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : pyFiles(p)
    return f.endsWith('.py') ? [p] : []
  })
}
const needs = (src: string) => ({
  numpy: /^\s*(import numpy|from numpy)/m.test(src),
  pillow: /^\s*(import PIL|from PIL)/m.test(src),
})
const all = pyFiles(join(root, 'tools')).map((p) => ({ name: relative(root, p), src: readFileSync(p, 'utf8') }))
const byFile = new Map(all.map((s) => [s.name.split('/').pop()!, s.src]))
// what a script needs, with the scripts it starts through sys.executable
function needsAll(src: string) {
  const n = needs(src)
  if (src.includes('sys.executable')) {
    for (const [, f] of src.matchAll(/([A-Za-z_]\w*\.py)\b/g)) {
      const inner = byFile.get(f)
      if (inner && inner !== src) { const m = needs(inner); n.numpy ||= m.numpy; n.pillow ||= m.pillow }
    }
  }
  return n
}
const scripts = all
  .filter(({ src }) => !/^\s*import bpy/m.test(src))
  .filter(({ src }) => needsAll(src).numpy || needsAll(src).pillow)

describe('python art scripts', () => {
  it('finds the atlas packers', () => {
    expect(scripts.map((s) => s.name)).toEqual(expect.arrayContaining(['tools/art/diorama/king_atlas.py', 'tools/art/diorama/king_loop_atlas.py']))
  })

  it.each(scripts.map((s) => [s.name, s.src]))('%s lists its packages for uv run', (_name, src) => {
    const block = /^# \/\/\/ script\n((?:#.*\n)*?)# \/\/\/$/m.exec(src)
    expect(block, 'add a "# /// script" block with dependencies = [...]').not.toBeNull()
    const n = needsAll(src)
    if (n.numpy) expect(block![1]).toMatch(/"numpy"/)
    if (n.pillow) expect(block![1]).toMatch(/"pillow"/)
  })
})
