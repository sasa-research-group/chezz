#!/usr/bin/env node
// Turns a painted sprite run (a docs/art/recipes/paint-*.json recipe) into one trimmed,
// transparent webp for the game.
//
//   node tools/art/sprite.mjs docs/art/recipes/paint-rebel-pawn.json [--out art-out] [--install]
//
// Reads art-out/<id>/: the background-removed image (last step) for the alpha, and the pose
// (the step before it) for the colour, since the background remover returns a smaller image.
// Then it erodes the alpha by a pixel to drop the grey fringe, drops specks under 0.2% of the
// image, trims to the ink, scales to the recipe's `sprite.height` (default 480 px), and grows
// the outer outline by `sprite.outline` px in ink (default 12), because at 48px the painted
// outline alone is too thin to read. Writes art-out/<id>/sprite.webp.
// --install copies it to src/assets/sprites/<character>.webp, where <character> is the id
// without its "paint-" prefix, and records its pixel size in src/assets/sprites/sizes.json.
// Needs ImageMagick (`magick`).
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 && !!argv.splice(i, 1) }
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i < 0 ? fallback : argv.splice(i, 2)[1] }
const install = flag('install')
const outRoot = resolve(opt('out', join(repoRoot, 'art-out')))
const [recipePath] = argv
const fail = (m) => { console.error(`sprite: ${m}`); process.exit(1) }
if (!recipePath) fail('usage: node tools/art/sprite.mjs <paint recipe.json> [--out dir] [--install]')

const recipe = JSON.parse(readFileSync(resolve(recipePath), 'utf8'))
const work = join(outRoot, recipe.id)
const stepFile = (i) => join(work, `step-${i + 1}${recipe.steps[i].name ? `-${recipe.steps[i].name}` : ''}.png`)
const [colour, alpha] = [recipe.steps.length - 2, recipe.steps.length - 1].map(stepFile)
if (recipe.steps.length < 2 || !existsSync(colour) || !existsSync(alpha)) fail(`run the recipe first: node tools/art/gen.mjs ${recipePath}`)

function magick(...args) {
  const run = spawnSync('magick', args, { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (run.error || run.status !== 0) fail(`magick ${args.join(' ')}\n${run.stderr || run.error}`)
  return run.stdout.trim()
}

const { height = 480, outline = 12 } = recipe.sprite ?? {}
const [W, H] = magick('identify', '-format', '%w %h', colour).split(' ').map(Number)
const speck = Math.round(W * H * 0.002)
const ink = '#1f1a19'
const file = join(work, 'sprite.webp')
magick(colour, '(', alpha, '-alpha', 'extract', '-resize', `${W}x${H}!`, '-threshold', '50%', '-morphology', 'Erode', 'Disk:1',
  '-define', `connected-components:area-threshold=${speck}`, '-define', 'connected-components:mean-color=true', '-connected-components', '8', ')',
  '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-compose', 'Over', '-trim', '+repage', '-resize', `x${height}`,
  '-bordercolor', 'none', '-border', String(outline),
  '(', '+clone', '-alpha', 'extract', '-threshold', '50%', '-morphology', 'Dilate', `Disk:${outline}`, '-background', ink, '-alpha', 'shape', ')',
  '+swap', '-compose', 'Over', '-composite', '-trim', '+repage', '-quality', '88', '-define', 'webp:alpha-quality=95', file)
const size = magick('identify', '-format', '%w %h', file).split(' ').map(Number)
console.log(`${recipe.id}: ${size.join('×')}px → ${file}`)

if (install) {
  const id = recipe.id.replace(/^paint-/, '')
  const dir = join(repoRoot, 'src/assets/sprites')
  mkdirSync(dir, { recursive: true })
  copyFileSync(file, join(dir, `${id}.webp`))
  const sizesFile = join(dir, 'sizes.json')
  const sizes = existsSync(sizesFile) ? JSON.parse(readFileSync(sizesFile, 'utf8')) : {}
  sizes[id] = size
  const sorted = Object.fromEntries(Object.keys(sizes).sort().map((k) => [k, sizes[k]]))
  writeFileSync(sizesFile, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`installed ${id}.webp`)
}
