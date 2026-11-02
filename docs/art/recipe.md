# Concept sheet and new concepts

The style reference `sheet-armour-talks.webp` (18 portraits) and the stonemason
`rebel-rook.webp`. Style rules: `docs/art-style.md`. In-game sprites: `PAINTED.md`.

## Regenerate

Setup as in `PAINTED.md`. The recipes hold the exact prompts.

```sh
node tools/art/gen.mjs docs/art/recipes/sheet-armour-talks.json   # the sheet, 1 call
node tools/art/gen.mjs docs/art/recipes/rebel-rook.json           # rebel rook, 2 chained calls
node tools/art/crop-sheet.mjs art-out/sheet-armour-talks.png      # 18 tiles from a fresh sheet
```

`crop-sheet.mjs` with no argument cuts the committed sheet. Boxes are in
`docs/art/crops.json`, in pixels of the original 2528px sheet. About $0.13 per call.

## One new character (template)

Keep the Direction and STYLE paragraphs verbatim; change only SUBJECT.

```
Single character portrait for a 2D chess game, head and shoulders, centred on a plain flat tan background (#c6b393), no text, no labels, no title, no frame. Direction: ARMOUR DOES THE TALKING. Almost every face is hidden or reduced to two simple black dot eyes peeking through a visor slot, a cross-shaped helmet opening, a hood shadow, a grille or a beard. Personality comes from the silhouette and design of each helmet, hat, armour piece and prop: dents, patches, rivets, plumes, chainmail, straps.

SUBJECT: <FACTION LOOK>: <PIECE> <headgear>, <face treatment>, <body/armour>, <prop>. The headgear must read as a chess <piece> crest.

STYLE: bold flash-era 2D brawler cartoon, very thick even black outlines, flat fills, one hard cel shadow, crisp white highlights, chunky big-headed proportions, funny and appealing.
```

Faction looks:
- `scrappy rebel exile (patched, mismatched, earthy, one bright accent)`
- `royal patrol (polished royal-blue armour with gold trim)`
- `wonky unlockable oddball, an animal or object, NOT blue armour (keep the piece's headgear shape)`

For a full body, replace "head and shoulders" with "full body, standing, three-quarter
view, feet visible". To run it, copy `recipes/rebel-rook.json` and change step 1's prompt.

## What the model ignored on the sheet

- It drew big name plates and a title: say "no text, no labels, no title".
- Every tile came out the same tan: state the background.
- The odd knight came out patrol blue: say "NOT blue armour".
- The odd queen got one flame: ask for "a crown of three flame points".
- Several faces came out bigger than asked; the style guide sets the patrol queen and
  king as the limit.
