# Concept recipe: "Armour does the talking"

How `sheet-armour-talks.webp` was made, and how to make new concepts that match it. Style rules: `docs/art-style.md`.

## Model

- Tool: `image-gen` MCP, `generate_image`
- Model: `replicate/google/nano-banana-pro`
- Aspect ratio: `3:2`
- Reference images: none
- Output: 2528×1696 PNG (compressed copy in this folder)

## Full prompt (verbatim)

```
Character select sheet for a 2D chess game: a grid of 18 head-and-shoulders portrait tiles in 3 rows of 6, each tile with its own flat saturated background colour, small label under each. Direction: ARMOUR DOES THE TALKING. Almost every face is hidden or reduced to two simple black dot eyes peeking through a visor slot, a cross-shaped helmet opening, a hood shadow, a grille or a beard. Personality comes from the silhouette and design of each helmet, hat, armour piece and prop: dents, patches, rivets, plumes, chainmail, straps. Every character is a distinct design, never a palette swap.

ROW 1, scrappy rebel exiles (patched, mismatched, earthy, one bright accent each): PAWN dented cooking pot helmet pulled over the eyes with two punched eye holes, pitchfork; KNIGHT tin bucket helm with a crooked eye slot, riding a wooden hobby horse on a stick; BISHOP tall pointed parchment mitre over a shadowed hood with two dot eyes, crook; ROOK stonemason in a little stone castle-tower helmet with a window for eyes, mallet; QUEEN kettle-shaped helm with a small crown welded on, breastplate over an apron, frying pan; KING crown pulled down to the eyes over a huge wild beard, only two dots visible, chipped sword.

ROW 2, royal patrol (polished royal-blue armour with gold trim): PAWN crested morion helmet, huge moustache under it, long pike; KNIGHT full plate with a tall blue plume, on a plated hobby horse, lance; BISHOP gilded mitre-shaped great-helm with round spectacle lenses for eyes; ROOK enormous great-helm shaped like a castle keep, halberd; QUEEN tall ornate helm shaped like towering powdered hair, sceptre; KING jewelled crown fused to a smug visor with a waxed moustache sculpted on it.

ROW 3, wonky unlockable oddballs (keep each piece's headgear shape): PAWN a grumpy frog in the cooking pot; KNIGHT an empty suit of armour on a rocking horse; BISHOP a goose in a mitre; ROOK a walking haystack with battlements; QUEEN a living melting candle with a crown of flame; KING a sleepy cat in a too-big crown.

STYLE: bold flash-era 2D brawler cartoon, very thick even black outlines, flat fills, one hard cel shadow, crisp white highlights, chunky big-headed proportions, funny and appealing.
```

## One new character (template)

Keep the Direction and STYLE paragraphs verbatim. Swap only the SUBJECT line.

```
Single character portrait for a 2D chess game, head and shoulders, centred on a plain flat tan background (#c6b393), no text, no labels, no title, no frame. Direction: ARMOUR DOES THE TALKING. Almost every face is hidden or reduced to two simple black dot eyes peeking through a visor slot, a cross-shaped helmet opening, a hood shadow, a grille or a beard. Personality comes from the silhouette and design of each helmet, hat, armour piece and prop: dents, patches, rivets, plumes, chainmail, straps.

SUBJECT: <FACTION LOOK>: <PIECE> <headgear>, <face treatment>, <body/armour>, <prop>. The headgear must read as a chess <piece> crest.

STYLE: bold flash-era 2D brawler cartoon, very thick even black outlines, flat fills, one hard cel shadow, crisp white highlights, chunky big-headed proportions, funny and appealing.
```

Faction looks to paste into `<FACTION LOOK>`:

- `scrappy rebel exile (patched, mismatched, earthy, one bright accent)`
- `royal patrol (polished royal-blue armour with gold trim)`
- `wonky unlockable oddball, an animal or object, NOT blue armour (keep the piece's headgear shape)`

Example: `SUBJECT: scrappy rebel exile (patched, mismatched, earthy, one bright accent): ROOK burly stonemason in a castle-tower great-helm with a T-shaped eye slot, bare muscular arms, leather cross straps, big mallet resting on his shoulder, only two dot eyes visible in the slot. The headgear must read as a chess rook crest.`

For a full-body game pose, replace "head and shoulders" with "full body, standing, three-quarter view, feet visible".

## What drifted from the prompt

- Labels: the prompt asked for "small label under each"; the model drew large bold piece-name plates and added a "CHARACTER SELECT" title and a castle backdrop. For single characters, say "no text, no labels, no title".
- Tile colours: every tile came out the same tan instead of its own saturated colour. Fine for reference; state the background explicitly.
- Odd knight: the empty suit came out in patrol royal blue. The oddball line in the template says "NOT blue armour".
- Odd queen: one candle flame, not a crown of flame. Ask for "a crown of three flame points".
- Faces: more face than asked on the rebel pawn (the pot sits above a bare face instead of over the eyes), rebel queen, patrol pawn, patrol queen and patrol king (sculpted mask); the frog and cat have full creature faces. The owner approved the sheet as is; the style guide sets the patrol queen and king as the limit.
- Rebel rook: glowing embers behind bars instead of a window.
- Rebel knight: a T-shaped opening, not a crooked eye slot.
- Patrol knight: rides a horse in steel barding, not a plated hobby horse.
- Odd knight: a carved wooden horse with no rockers visible.
- Patrol queen: a real wig over a small steel cap, not a helm shaped like hair, and no crown.
- Patrol king: the crown sits on hair rather than fused to the visor. The owner prefers the sheet-1 rook (`sheet1-rebel-rook.webp`); the example SUBJECT above describes it.
