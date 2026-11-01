#!/usr/bin/env node
// Splits a painted parts sheet (made by a docs/art/recipes/paint-*.json recipe) into one
// trimmed, transparent webp per rig part, ready for the painted rig (src/components/paint/).
//
//   node tools/art/cut-parts.mjs docs/art/recipes/paint-rebel-pawn.json [--out art-out] [--install]
//
// Reads art-out/<id>/: the last step's background-removed sheet for the alpha, and the step
// before it (the full-resolution parts sheet) for the colour, since the background remover
// returns a smaller image. Then:
// 1. flattens onto white and flood-fills the outside from the corners, which removes both the
//    background and the white die-cut border the model draws round each part;
// 2. erodes the alpha by one pixel to drop the light fringe left at the outline;
// 3. finds each opaque blob and gives it to the nearest part centre in the recipe's `parts`
//    ({ name: [x, y] } as fractions of the sheet), crops each part to its blobs and scales it
//    by `partScale` (default 0.5). Specks under 0.2% of the sheet are dropped. `rotate`
//    ({ part: degrees clockwise }) turns a part here, so the committed image stays upright
//    and trimmed and its box is still its ink (tests/figure-bounds.test.ts measures boxes);
// 4. with `outline` (pixels), thickens each part's outer outline in ink, as the drawn rigs do.
// Writes art-out/<id>/parts/<part>.webp and sizes.json ({ part: [width, height] } in pixels).
// --install copies them to src/assets/paint/<character>/, where <character> is the id
// without its "paint-" prefix. Needs ImageMagick (`magick`).
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
const fail = (m) => { console.error(`cut-parts: ${m}`); process.exit(1) }
if (!recipePath) fail('usage: node tools/art/cut-parts.mjs <paint recipe.json> [--out dir] [--install]')

const recipe = JSON.parse(readFileSync(resolve(recipePath), 'utf8'))
if (!recipe.parts) fail(`${recipe.id} has no "parts" centres`)
const work = join(outRoot, recipe.id)
const stepFile = (i) => join(work, `step-${i + 1}${recipe.steps[i].name ? `-${recipe.steps[i].name}` : ''}.png`)
const [colour, alpha] = [recipe.steps.length - 2, recipe.steps.length - 1].map(stepFile)
if (recipe.steps.length < 2 || !existsSync(colour) || !existsSync(alpha)) fail(`run the recipe first: node tools/art/gen.mjs ${recipePath}`)

function magick(...args) {
  const run = spawnSync('magick', args, { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (run.error || run.status !== 0) fail(`magick ${args.join(' ')}\n${run.stderr || run.error}`)
  return run.stdout.trim()
}

const [W, H] = magick('identify', '-format', '%w %h', colour).split(' ').map(Number)
const clean = join(work, 'clean.png')
const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].flatMap(([x, y]) => ['-draw', `color ${x},${y} floodfill`])
magick(colour, '(', alpha, '-alpha', 'extract', '-resize', `${W}x${H}!`, ')', '-compose', 'CopyOpacity', '-composite',
  '-background', 'white', '-alpha', 'remove', '-alpha', 'set', '-fill', 'none', '-fuzz', '14%', ...corners,
  '-channel', 'A', '-morphology', 'Erode', 'Disk:1', '+channel', clean)

const speck = Math.round(W * H * 0.002)
const blobs = magick(clean, '-alpha', 'extract', '-threshold', '50%', '-define', 'connected-components:verbose=true',
  '-define', `connected-components:area-threshold=${speck}`, '-connected-components', '8', 'null:')
  .split('\n').map((l) => l.match(/(\d+)x(\d+)\+(\d+)\+(\d+) ([\d.]+),([\d.]+) ([\d.e+]+) srgb\(255,255,255\)/)).filter(Boolean)
  .map(([, w, h, x, y, cx, cy, area]) => ({ w: +w, h: +h, x: +x, y: +y, cx: cx / W, cy: cy / H, area: +area }))
  .sort((a, b) => b.area - a.area)
const boxes = {}
for (const b of blobs) {
  const [name] = Object.entries(recipe.parts).map(([n, [px, py]]) => [n, Math.hypot(px - b.cx, py - b.cy)]).sort((a, c) => a[1] - c[1])[0]
  const box = boxes[name]
  // A crumb well outside a part's main blob is a stray, not a detached tip.
  const [mx, my] = [b.x + b.w / 2, b.y + b.h / 2]
  const outside = box && (mx < box.x0 || mx > box.x1 || my < box.y0 || my > box.y1)
  if (outside && b.area < box.area * 0.05) { console.log(`dropped a ${b.w}×${b.h}px stray near ${name}`); continue }
  boxes[name] = box
    ? { ...box, x0: Math.min(box.x0, b.x), y0: Math.min(box.y0, b.y), x1: Math.max(box.x1, b.x + b.w), y1: Math.max(box.y1, b.y + b.h), n: box.n + 1 }
    : { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h, n: 1, area: b.area }
}
const missing = Object.keys(recipe.parts).filter((n) => !boxes[n])
if (missing.length) fail(`no blob near ${missing.join(', ')}; move its centre in the recipe's "parts" (blob centres: ${blobs.map((b) => `${b.cx.toFixed(2)},${b.cy.toFixed(2)}`).join(' ')})`)

const scale = recipe.partScale ?? 0.5
// The painted outline is about a third of the drawn rigs' at game size, so it vanishes at
// 48px; `outline` (pixels, after scaling) grows each part's silhouette in ink behind it.
const ink = '#1f1a19', grow = recipe.outline ?? 0
const outlineArgs = grow ? ['-bordercolor', 'none', '-border', String(grow), '(', '+clone', '-alpha', 'extract', '-threshold', '50%', '-morphology', 'Dilate', `Disk:${grow}`,
  '-background', ink, '-alpha', 'shape', ')', '+swap', '-compose', 'Over', '-composite'] : []
const partsDir = join(work, 'parts')
mkdirSync(partsDir, { recursive: true })
const sizes = {}
for (const [name, { x0, y0, x1, y1, n }] of Object.entries(boxes)) {
  const file = join(partsDir, `${name}.webp`)
  const turn = recipe.rotate?.[name] ? ['-background', 'none', '-rotate', String(recipe.rotate[name]), '-trim', '+repage'] : []
  // Specks inside the crop (the CC pass above only skipped them) are filled out of the alpha.
  const despeck = ['(', '+clone', '-alpha', 'extract', '(', '+clone', '-threshold', '50%', '-define', `connected-components:area-threshold=${speck}`,
    '-define', 'connected-components:mean-color=true', '-connected-components', '8', ')', '-compose', 'Multiply', '-composite', ')',
    '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-compose', 'Over', '-bordercolor', 'none', '-border', '1', '-trim', '+repage']
  magick(clean, '-crop', `${x1 - x0}x${y1 - y0}+${x0}+${y0}`, '+repage', ...despeck, '-resize', `${scale * 100}%`, ...turn,
    ...outlineArgs, '-quality', '88', '-define', 'webp:alpha-quality=95', file)
  sizes[name] = magick('identify', '-format', '%w %h', file).split(' ').map(Number)
  console.log(`${name.padEnd(9)} ${sizes[name].join('×')}px from ${n} blob(s)`)
}
writeFileSync(join(partsDir, 'sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`)

if (install) {
  const dest = join(repoRoot, 'src/assets/paint', recipe.id.replace(/^paint-/, ''))
  mkdirSync(dest, { recursive: true })
  for (const f of ['sizes.json', ...Object.keys(recipe.parts).map((n) => `${n}.webp`)]) copyFileSync(join(partsDir, f), join(dest, f))
  console.log(`installed into ${dest}`)
}
