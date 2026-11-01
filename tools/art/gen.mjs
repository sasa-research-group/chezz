#!/usr/bin/env node
// Runs one art recipe (docs/art/recipes/*.json) against the Replicate HTTP API.
//
//   node tools/art/gen.mjs docs/art/recipes/rebel-rook.json [--out art-out] [--from 2] [--dry-run]
// --from N re-runs from step N, reusing step N-1's image from an earlier run.
//
// Needs Node 18+, REPLICATE_API_TOKEN, and ImageMagick (`magick`) only when a
// recipe has a postprocess. See docs/art/GENERATING.md.
// A step may name its own `model`; with `imageField` it sends its one image under that
// input name and no prompt (background removal models take `image`).
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const API = 'https://api.replicate.com/v1'
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

function parseArgs(argv) {
  const args = { recipe: null, out: join(repoRoot, 'art-out'), dryRun: false, from: 1 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--out') args.out = resolve(argv[++i] ?? '')
    else if (a === '--from') args.from = Number(argv[++i])
    else if (a.startsWith('--')) fail(`unknown flag ${a}`)
    else if (!args.recipe) args.recipe = resolve(a)
    else fail(`unexpected argument ${a}`)
  }
  if (!args.recipe) fail('usage: node tools/art/gen.mjs <recipe.json> [--out dir] [--from step] [--dry-run]')
  if (!Number.isInteger(args.from) || args.from < 1) fail('--from takes a step number, 1 or more')
  return args
}

function fail(message) {
  console.error(`gen: ${message}`)
  process.exit(1)
}

function loadRecipe(file) {
  let recipe
  try {
    recipe = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    fail(`cannot read ${file}: ${e.message}`)
  }
  for (const key of ['id', 'model', 'output']) {
    if (typeof recipe[key] !== 'string' || !recipe[key]) fail(`${basename(file)}: "${key}" must be a non-empty string`)
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) fail(`${basename(file)}: "steps" must be a non-empty array`)
  recipe.steps.forEach((step, i) => {
    step.images ??= []
    if (step.imageField) {
      if (step.images.length !== 1) fail(`${basename(file)}: step ${i + 1} has an imageField, so it takes exactly one image`)
    } else if (typeof step.prompt !== 'string' || !step.prompt) fail(`${basename(file)}: step ${i + 1} has no prompt`)
    step.images.forEach((img) => {
      if (img === '$previous') {
        if (i === 0) fail(`${basename(file)}: step 1 cannot use $previous`)
      } else if (!existsSync(resolve(repoRoot, img))) {
        fail(`${basename(file)}: step ${i + 1} image not found: ${img}`)
      }
    })
  })
  return recipe
}

function dataUri(file) {
  const mime = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`
}

function buildInput(step, images) {
  if (step.imageField) return { [step.imageField]: images[0], ...(step.input ?? {}) }
  const input = { prompt: step.prompt, output_format: 'png' }
  if (step.aspect_ratio) input.aspect_ratio = step.aspect_ratio
  if (images.length) input.image_input = images
  return { ...input, ...(step.input ?? {}) }
}

async function replicate(path, init) {
  const token = process.env.REPLICATE_API_TOKEN
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'chezz-art-gen/1', ...init.headers },
  })
  if (!res.ok) fail(`Replicate ${res.status} on ${path}: ${(await res.text()).slice(0, 500)}`)
  return res.json()
}

async function runPrediction(model, input) {
  let prediction = await replicate(`/models/${model}/predictions`, {
    method: 'POST',
    headers: { Prefer: 'wait' },
    body: JSON.stringify({ input }),
  })
  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    await new Promise((r) => setTimeout(r, 2000))
    prediction = await replicate(`/predictions/${prediction.id}`, { method: 'GET' })
  }
  if (prediction.status !== 'succeeded') fail(`prediction ${prediction.status}: ${prediction.error ?? 'no error given'}`)
  const url = [prediction.output].flat().find((v) => typeof v === 'string' && v.startsWith('http'))
  if (!url) fail('prediction returned no image URL')
  const image = await fetch(url)
  if (!image.ok) fail(`download failed with ${image.status}`)
  return Buffer.from(await image.arrayBuffer())
}

function postprocess(source, dest, options) {
  const args = [source]
  if (options.resize) args.push('-resize', `${options.resize}!`)
  if (options.quality) args.push('-quality', String(options.quality))
  args.push(dest)
  const run = spawnSync('magick', args, { stdio: 'inherit' })
  if (run.error || run.status !== 0) fail('postprocess needs ImageMagick: install it so `magick` is on PATH')
}

function printDryRun(recipe, args) {
  console.log(`recipe ${recipe.id}: model ${recipe.model}, ${recipe.steps.length} step(s)`)
  recipe.steps.forEach((step, i) => {
    const images = step.images.map((img) =>
      img === '$previous' ? '<output of previous step>' : `${img} (${readFileSync(resolve(repoRoot, img)).length} bytes)`,
    )
    const input = buildInput(step, step.images.map(() => '<image data URI>'))
    const shown = input.prompt ? { ...input, prompt: `${input.prompt.slice(0, 80)}... (${input.prompt.length} chars)` } : input
    console.log(`\nstep ${i + 1} ${step.name ?? ''}`)
    console.log(`POST ${API}/models/${step.model ?? recipe.model}/predictions`)
    console.log(`images: ${images.length ? images.join(', ') : 'none'}`)
    console.log(JSON.stringify(shown, null, 2))
  })
  if (recipe.postprocess) console.log(`\npostprocess: ${JSON.stringify(recipe.postprocess)}`)
  console.log(`\nwould write ${join(args.out, recipe.output)}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const recipe = loadRecipe(args.recipe)
  if (args.dryRun) return printDryRun(recipe, args)
  if (!process.env.REPLICATE_API_TOKEN) fail('REPLICATE_API_TOKEN is not set (https://replicate.com/account/api-tokens)')

  if (args.from > recipe.steps.length) fail(`--from ${args.from}: ${recipe.id} has ${recipe.steps.length} step(s)`)
  const workDir = join(args.out, recipe.id)
  mkdirSync(workDir, { recursive: true })
  const stepFile = (i, step) => join(workDir, `step-${i + 1}${step.name ? `-${step.name}` : ''}.png`)
  let previous = args.from > 1 ? stepFile(args.from - 2, recipe.steps[args.from - 2] ?? fail(`no step ${args.from - 1}`)) : null
  if (previous && !existsSync(previous)) fail(`--from ${args.from} needs ${previous} from an earlier run`)
  for (const [i, step] of recipe.steps.entries()) {
    if (i + 1 < args.from) continue
    const images = step.images.map((img) => dataUri(img === '$previous' ? previous : resolve(repoRoot, img)))
    console.log(`step ${i + 1}/${recipe.steps.length} ${step.name ?? ''} ...`)
    const png = await runPrediction(step.model ?? recipe.model, buildInput(step, images))
    previous = stepFile(i, step)
    writeFileSync(previous, png)
    console.log(`  saved ${previous}`)
  }
  const dest = join(args.out, recipe.output)
  if (recipe.postprocess) postprocess(previous, dest, recipe.postprocess)
  else writeFileSync(dest, readFileSync(previous))
  console.log(`wrote ${dest}`)
}

main()
