# Handoff

## State
- **Branch `puzzle/dungeon` (exploration, Nov 13):** chess-rule dungeon
  puzzles with a perfect-play enemy, a Puzzles studio tab and solver. See
  `docs/puzzles.md`. Not merged into main.
- **Branch `claude/puzzle-3d` (Nov 19, on top of puzzle/dungeon):** a 2D/3D
  toggle on the Puzzles board. 3D is `src/diorama/` (R3F): three Cycles
  "plate" bakes of the set (3, 5, 8 squares; `public/diorama/`) rebuilt as
  depth meshes, other sizes cut at grout lines from the next bake up; other
  pieces are sprite cards; special squares are placeholder tints and blocks.
  Post: bloom, the stage compositor grade, the concept LUT. Rebake with
  `tools/art/diorama/bake.sh` and `bake_king.py`, which need `stage.py`
  and the Meshy assets in `~/.dos/scratch/d84406ef/` (not in the repo).
  No WebGL: falls back to 2D. Debug: `?fps`, `?dio=nobloom,nograde,nolut`.
  The white king is Cycles king A pre-rendered at 8 headings
  (`KingSprite.tsx`, `public/diorama/king8.*`) on a camera-facing quad
  The idle king now holds the royal blade in a two-handed middle guard (Wesley's picks, Nov 2026): sword built by
  `tools/art/diorama/build_sword.py` (royal_blade.glb), pose by `guard_pose.py` (king_guard.json, clay fists from
  `king_motion.attach_fists`), baked with `runguard.sh`. The walk and jog loops still have no sword.
  slid and scaled to his square; turns step through the in-between
  headings in ~0.2 s; idle is still plus ~1% breathing. The rigged glTF
  still casts his live VSM shadow (shadow-only), and `?king=live` shows it
  instead. Rebake: `bake_king_sprites.py` with `KING_RIM=1100
  KING_RIM_FIBONLY=1 RIM_PLAY=1 CROWN_RIM=2500 CROWN_EL=8.5` (rim behind
  him for the play camera on the felt only, plus a crown-only spot; the
  haze must stay in), then `king_atlas.py`. The shader lifts
  saturation (`TRIM` in KingSprite; dev `?ksat= ?klow= ?kexp= ?kcon=`). The set's depth mesh puts
  floating leaves in front of the back wall, so the sprite is depth-tested
  2 units nearer than it is, except over cards (stencil), where true depth
  is used. Gotcha: OIIO un-premultiplies on PNG write unless
  `oiio:UnassociatedAlpha=1` (white fringe). Pieces face their last move
  (`src/diorama/facing.ts`). Dev-only: `?shells=N`, `?kingsheet=name`.
- **Branch `claude/puzzle-run` (Nov 19, on puzzle/dungeon):** the king
  turns (~0.15 s), then walks to the square at a steady pace and stops into
  the idle; the dungeon's reply waits for him (`src/diorama/motion.ts`).
  Gaits (`king_motion.GAITS`): `walk` (A, brisk walk, default) and `jog`
  (B, light jog; `?kinggait=jog`), 16-frame loops baked with
  `tools/art/diorama/runbake.sh GAIT OUT` (one bake at a time), packed by
  `king_loop_atlas.py DIR public/diorama name=walk cps=2`. He moves at the
  loop's own ground speed (`cycle` x `cps`, frame from distance, so the feet
  stay planted), which makes a move about 1.5 s a square (`?kingcps=` to
  try another cadence). Only headings 0 and 2 are baked; the others slide
  his still frame. Dev: `?kingslow=8`.
Live at sasa-research-group.github.io/chezz (Pages deploys from `main`).
- **Rules:** turn-based (`src/game/turns.ts`, `docs/turn-based.md`). One
  move per turn by default: each side acts with one piece (move, then
  strike); the turn passes on its own once that piece strikes. No defending
  (removed for both sides). `"turn":
  "all"` brings back every piece acting. No promotion: pawns stop at the far
  row.
- **Developer toggles** (studio Mechanics tab, top "Developer" group; saved
  in `rules.json`): `movement` chess or tactics (walk N orthogonal squares
  around blockers, strike within a Chebyshev reach; numbers per kind in
  `tactics`), and moves per turn `turn` 1, 2, 3 or `"all"` for both sides.
  Defaults are today's game (chess, 1). Rules in `docs/turn-based.md`
  (Turns, Movement).
- **Strikes:** every struck piece that survives strikes back if it can reach
  the attacker (`counter` switch). Strike range is
  per kind in `rules.json` (`range`: 1 or `"line"`); bishops are `"line"`:
  they hit any enemy down an open diagonal without moving, drawn as a
  streak. Sliders (rook, bishop, queen) move any distance in both turn
  modes, for you and the enemy.
- **Stats as data:** `src/game/rules.json` (HP, damage, strike range,
  strikebacks on/off, turn mode, prices, heal, start gold), checked by `rules.ts`. The
  studio's Mechanics tab edits it in place, redraws its diagrams live, and
  saves under `npm run dev` (Download JSON on a static build). Level test
  runs play by the unsaved rules. A stats save never breaks the levels:
  spawn HP above a kind's max is clamped when the battle starts and shown as
  an amber warning (Levels and Mechanics tabs); no level error depends on the
  rules. Tests that pin numbers play by fixed copies in `tests/fixtures/`
  (`newRun(data)`, `startAt(..., data)`, `readRun(raw, data)`; the browser
  tests swap the JSON modules via `tests/browser/fixed.ts`), so retuning the
  shipped files can't break them; `tests/browser/shipped.spec.ts` and the
  levels test are the only checks on the shipped data, and pin no numbers.
- **Levels:** data in `src/game/levels/levels.json` (`docs/levels.md`). The
  studio's Levels tab edits them, saves under `npm run dev`, and test-runs one
  level in the real game with a test army and no saves touched. Checks are
  errors (block Save/Play) or amber warnings (design rules, never block).
  The Army tool sets starts and the exact test unit on each (or None); Undo /
  Redo per level (Ctrl/⌘ Z). No "wall ahead of start" warning any more.
- **Items:** a team bag (3 slots, in your team bar) of one-use items: Bomb
  (−1 to every enemy in a 2×2 you aim) and Decoy (a 1-HP straw pawn next to
  your pieces; enemies strike it, it blocks lines). Free, one per turn, no
  undo, check-guarded; enemies don't use them. Numbers in `rules.json`
  (`slots`, `items`), rules in `docs/turn-based.md` (Items). Tutorial battle 3
  hands out a Bomb, battle 4 a Decoy (`handout`); each tutorial level replaces
  the bag. Icons: `src/assets/items/`, `docs/art/PROPS.md`. No shop or battle
  rewards for items yet.
- **Switches (battle 2):** a floor switch fires a one-shot spear trap along
  set rows, hitting every piece on them, either side (`switches` in
  `levels.json`; `stepOnto`, `spring`, `volleyAt` in `turns.ts`). Any piece
  fires it; the enemy steps on one only when the spears hurt you more than
  it, and check counts a volley that would kill the king. Battle 2 teaches
  it: switch at a1, spears on ranks 4 and 3 for 2. Tapping a switch once
  (or hovering) lights the rows and the damage per piece; the volley plays
  in `components/SpearTrap.tsx`. The studio's Switch tool places them
  (hover one in the list to light its ranks); each has a `type` (only
  `"spears"`), so a new kind of switch adds a type to
  `SwitchType`/`SWITCH_TYPES` and a case where `spring` resolves it.
  Art from recipes `docs/art/recipes/paint-prop-*.json` (`docs/art/PROPS.md`).
- **Tutorial:** the five levels are the tutorial (`tutorial` block in
  `levels.json`: preset army; optional `handout: { items }` hook, unused so far). A new player plays
  them linearly with preset armies, no hideout or gold; a loss retries the
  battle; finishing sets `tutorialDone` in the meta and unlocks the roguelike
  (hub, recruits, gold), which for now replays the same levels. Developer menu:
  Skip / Reset tutorial. Studio: "Tutorial level" box and preset army.
  **For now the game is only the tutorial** (owner, Nov 8): `ROGUELIKE_OPEN = false`
  in `App.tsx` hides every way into the roguelike (finishing offers Play again,
  no Skip/Reset rows, saved roguelike runs aren't resumed); its code stays.
- **Deploy phase:** every battle opens with your pieces on the start squares;
  drag (or tap, tap) to move or swap them, then Begin (`deploy`, `begin` in
  `turns.ts`).
- **Art:** one painted sprite per piece and skin, moved whole
  (`SpriteRig.tsx`, `sprite.css`, `docs/art/PAINTED.md`); look in
  `docs/art-style.md`.
- **Skins** (`docs/art/SKINS.md`): winning a run unlocks the next rebel skin
  (`meta.ts`). No in-game picker now; skins will be unlocked on the map. A skin
  worn in an old save still draws.
- **Studio** (`art.html` → `src/art/`): Cast, Stage, Levels, Style guide,
  Mechanics (with the stats editor on top).
- **Table UI:** a 100dvh wooden table: `TopBar.tsx` ("Battle n of N", gold,
  menu), tilted board with a team bar on each edge (`table/TeamBar.tsx`:
  enemy above, yours below with the king's hearts; turn labels, playback
  caption and Check sit in the bars' middle), HUD strip (`table/`: Cancel,
  Skip during playback, End turn pill; `table.css`). A turn where the enemy
  does nothing shows ENEMY WAITS.
  ENEMY PHASE / YOUR PHASE banners sweep across the screen (`table/PhaseBanner.tsx`, ~1 s, shorter when fast).
- **☰ menu** (`PauseMenu.tsx`): player items, then a Developer section (Art
  studio, Jump to battle N: tap twice; fresh saved run with the level's test
  army). A regular game: no playtest notes, export or feedback copy.
- **In the game:** tap to strike
  (walk up and strike), knight leaps, check (End turn locks while the king
  could die next turn; moves into check blocked), checkmate finale, hideout
  hub (`Hub.tsx`) with barracks and locked placeholders. A strikeback plays as
  its own beat (swing, impact, damage) and logs its own line.
- **Previews and intent:** moves are previews until a strike or End
  turn (Cancel / Escape takes them back; saved with the turn's start so a
  reload can cancel). Hover or tap an enemy for its card and its plan
  (`enemyPlan` in `turns.ts`, drawn by `IntentMarks` in `BoardArt.tsx`).
- **No narrator text:** on screen only numbers, nouns and icons. Story
  unwritten (`Encounter.story` hook). Ask before adding prose.
- **Balance**: the owner tunes `rules.json` and `levels.json` by hand in the studio.

## Open items
- The test player (`tests/turns-strategy.ts`) is a two-turn search; balance
  numbers are a floor, so playtest the new levels.
- Intent shows one enemy at a time (hover or tap); no always-on view of the
  whole enemy turn yet. A move with nothing left to do now waits for End turn.
- App debt: `App.tsx` is dense; intro/end modals lack Escape and
  a focus trap (`useDialogKeys` in `PauseMenu.tsx` is ready to reuse).
- Dead-end/loop audit (Oct 11), waiting on Wesley's play to pick fixes:
  no turn
  limit, so stalling is endless (a pawn walled in front or on the far row can't move); a king already in
  check can strike himself to death on a counter. No insufficient-material
  draws; End turn is never impossible.
- Deletion candidates: the lab (`lab.html`, `src/lab/`), the old engine
  (`src/game/exile.ts`, `docs/exile-run.md`), the research in `reports/` and
  `research_notes/`.
