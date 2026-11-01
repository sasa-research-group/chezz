import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const recipeDir = join(root, 'docs/art/recipes')
const recipes = readdirSync(recipeDir).filter((f) => f.endsWith('.json'))

describe('art recipes', () => {
  it('has the kept images', () => {
    expect(recipes).toEqual(expect.arrayContaining(['sheet-armour-talks.json', 'rebel-rook.json']))
  })

  it.each(recipes)('%s dry-runs and names files that exist', (file) => {
    const recipe = JSON.parse(readFileSync(join(recipeDir, file), 'utf8'))
    const out = execFileSync('node', ['tools/art/gen.mjs', join(recipeDir, file), '--dry-run'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, REPLICATE_API_TOKEN: '' },
    })
    expect(out).toContain(`recipe ${recipe.id}`)
    for (const step of recipe.steps) {
      for (const image of step.images ?? []) {
        if (image !== '$previous') expect(existsSync(join(root, image)), image).toBe(true)
      }
    }
  })
})

describe('sheet crops', () => {
  it('has one box per character inside the reference sheet', () => {
    const crops = JSON.parse(readFileSync(join(root, 'docs/art/crops.json'), 'utf8'))
    expect(Object.keys(crops.boxes)).toHaveLength(18)
    for (const [x, y, w, h] of Object.values<number[]>(crops.boxes)) {
      expect(x + w).toBeLessThanOrEqual(crops.referenceWidth)
      expect(y + h).toBeLessThanOrEqual(1696)
    }
  })
})
