#!/usr/bin/env node
// Turns a painted board prop (switch, launcher, spear) into one trimmed, transparent webp, the
// way sprite.mjs does for characters: colour from the painted image, alpha from its cutout,
// trimmed to the ink, scaled, with the outer outline thickened in ink. Prompts: docs/art/PROPS.md.
//
//   node tools/art/prop.mjs <painted.png> <cutout.png> <out.webp> [--height 240 | --width 720] [--outline 6]
//
// Needs ImageMagick (`magick`).
import { spawnSync } from 'node:child_process'

const argv = process.argv.slice(2)
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i < 0 ? fallback : argv.splice(i, 2)[1] }
const height = opt('height'), width = opt('width'), outline = opt('outline', '6')
const [colour, alpha, out] = argv
if (!colour || !alpha || !out) { console.error('usage: node tools/art/prop.mjs <painted.png> <cutout.png> <out.webp> [--height N | --width N] [--outline N]'); process.exit(1) }

function magick(...args) {
  const run = spawnSync('magick', args, { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (run.error || run.status !== 0) { console.error(`magick ${args.join(' ')}\n${run.stderr || run.error}`); process.exit(1) }
  return run.stdout.trim()
}
const [W, H] = magick('identify', '-format', '%w %h', colour).split(' ').map(Number)
const speck = Math.round(W * H * 0.002)
const ink = '#1f1a19'
magick(colour, '(', alpha, '-alpha', 'extract', '-resize', `${W}x${H}!`, '-threshold', '50%', '-morphology', 'Erode', 'Disk:1',
  '-define', `connected-components:area-threshold=${speck}`, '-define', 'connected-components:mean-color=true', '-connected-components', '8', ')',
  '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', '-compose', 'Over', '-trim', '+repage', '-resize', width ? `${width}x` : `x${height ?? 240}`,
  '-bordercolor', 'none', '-border', outline,
  '(', '+clone', '-alpha', 'extract', '-threshold', '50%', '-morphology', 'Dilate', `Disk:${outline}`, '-background', ink, '-alpha', 'shape', ')',
  '+swap', '-compose', 'Over', '-composite', '-trim', '+repage', '-quality', '88', '-define', 'webp:alpha-quality=95', out)
console.log(`${out}: ${magick('identify', '-format', '%w×%h', out)}px`)
