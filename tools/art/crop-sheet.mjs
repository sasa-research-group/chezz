#!/usr/bin/env node
// Cuts the per-character tiles out of the style sheet using docs/art/crops.json.
//
//   node tools/art/crop-sheet.mjs [sheet] [--out art-out/crops]
//
// The sheet defaults to the committed docs/art/sheet-armour-talks.webp; pass a
// freshly generated 2528px PNG (art-out/sheet-armour-talks.png) for full-size
// tiles. Needs ImageMagick (`magick`).
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const config = JSON.parse(readFileSync(join(repoRoot, 'docs/art/crops.json'), 'utf8'))

let sheet = join(repoRoot, 'docs/art/sheet-armour-talks.webp')
let out = join(repoRoot, 'art-out', 'crops')
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') out = resolve(argv[++i] ?? '')
  else sheet = resolve(argv[i])
}

const probe = spawnSync('magick', ['identify', '-format', '%w', `${sheet}[0]`], { encoding: 'utf8' })
if (probe.error || probe.status !== 0) {
  console.error('crop-sheet: needs ImageMagick (`magick`) and a readable sheet')
  process.exit(1)
}
const scale = Number(probe.stdout) / config.referenceWidth
mkdirSync(out, { recursive: true })

for (const [name, [x, y, w, h]] of Object.entries(config.boxes)) {
  const box = [w, h].map((v) => Math.round(v * scale)).join('x') + `+${Math.round(x * scale)}+${Math.round(y * scale)}`
  const dest = join(out, `${name}.${config.format}`)
  const run = spawnSync('magick', [sheet, '-crop', box, '+repage', '-quality', String(config.quality), dest], { stdio: 'inherit' })
  if (run.status !== 0) process.exit(1)
  console.log(`${dest} (${box})`)
}
