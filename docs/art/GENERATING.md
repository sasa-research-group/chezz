# Generating the concept art

Everything the kept art depends on is in this repo. Prompts and settings live in `docs/art/recipes/*.json`; `tools/art/gen.mjs` runs one. Nothing needs a personal tool.

## Prerequisites

- Node 18 or newer (uses built-in `fetch`; no npm packages).
- A Replicate account with a little credit and an API token (https://replicate.com/account/api-tokens). Export it: `export REPLICATE_API_TOKEN=r8_...`. Never commit it.
- ImageMagick, so `magick` is on PATH (`brew install imagemagick`), for the resize and webp step and for cropping.

## Regenerate the kept images

```sh
node tools/art/gen.mjs docs/art/recipes/sheet-armour-talks.json   # style sheet, 1 call
node tools/art/gen.mjs docs/art/recipes/rebel-rook.json           # rebel rook, 2 chained calls
node tools/art/crop-sheet.mjs art-out/sheet-armour-talks.png      # 18 tiles from a fresh sheet
```

Results go to `art-out/` (gitignored), never over the committed files. Intermediate steps are in `art-out/<id>/step-N-*.png`. Add `--dry-run` to print the requests without calling the API; `--out <dir>` changes the folder. If you like a result, copy it into `docs/art/` yourself and keep it under about 800KB.

`crop-sheet.mjs` with no argument cuts the committed 2000px sheet instead (tiles come out 321px wide, not 406). Boxes are in `docs/art/crops.json`, in pixels of the original 2528px sheet, scaled to whatever sheet you pass. They were recovered by matching the committed crops against the committed sheet, since the original cuts were done by hand and not recorded; a regenerated crop is within a pixel or two of the committed one.

Cost is roughly $0.13 per call (Nano Banana Pro).

## Painted sprites

```sh
node tools/art/gen.mjs docs/art/recipes/paint-rebel-pawn.json            # pose, then background removal
node tools/art/gen.mjs docs/art/recipes/paint-rebel-pawn.json --from 2   # redo the background removal only
node tools/art/sprite.mjs docs/art/recipes/paint-rebel-pawn.json --install
```

The `paint-*.json` recipes make the in-game painted sprites (the default art), one whole image per piece. Their last step uses another model (`"model": "bria/remove-background"`, about $0.02) with `"imageField": "image"`, which sends the previous image under that input name with no prompt. `--from N` reuses step N-1's image from an earlier run in `art-out/<id>/`. The extra key `sprite` (`height`, `outline`) is read by `tools/art/sprite.mjs`, which trims the image, thickens its outer outline and, with `--install`, writes `src/assets/sprites/<id>.webp` and `sizes.json`. About $0.15 per character. Full guide: `docs/art/PAINTED.md`.

## What the recipes do

A recipe is JSON: `model`, `steps` (each with `prompt`, optional `aspect_ratio`, `images`, optional `input` merged into the request), optional `postprocess` (`resize`, `quality`; output is webp), and `output`. In `images`, the first entry is the source image, the rest are references, and `"$previous"` means the previous step's output. Image paths are relative to the repo root. Each step is one request to `POST /v1/models/<model>/predictions` with `image_input` as base64 data URIs and `output_format: png`.

## A new character from the template

1. Take the template and faction looks in `docs/art/recipe.md`; keep the Direction and STYLE paragraphs verbatim and change only SUBJECT.
2. Copy `docs/art/recipes/rebel-rook.json` to `docs/art/recipes/<faction>-<piece>.json`. Put your subject in step 1's prompt, with the sheet as the style reference (`images`: your source or none, then `docs/art/sheet-armour-talks.webp`). For a fresh design with no source image, make step 1 text only (`"images": ["docs/art/sheet-armour-talks.webp"]`) and say "in the art style of this image".
3. Keep step 2 (the re-frame) with the label text changed and a same-faction tile as the reference, so the tile matches.
4. `--dry-run`, then run it, look at the result at full size, and commit the recipe together with any image you keep. `npm test` checks every recipe parses and names files that exist.

## Honest limits

Image models are not deterministic. The committed webp files are the canonical assets. A regeneration will be close in design and style but not pixel-identical; expect different details, and sometimes a different pose or a drift listed in `recipe.md`.

Seed: Replicate's `google/nano-banana-pro` takes no `seed` input (checked October 2026; its inputs are `prompt`, `resolution`, `image_input`, `aspect_ratio`, `output_format`, `safety_filter_level`, `allow_fallback_model`). So the existing images had none and cannot be reproduced exactly. If the model gains a seed, add it per step as `"input": { "seed": 7 }` in new recipes.
