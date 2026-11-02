# Chezz art pipeline: concept, guide, builder, judge

> Status (Nov 2026): plan, partly built. Built so far: style guide (`docs/art-style.md`, `docs/art/`), studio target section, reproducible concept generation (`tools/art/gen.mjs`, `docs/art/recipes/`, `tools/art/crop-sheet.mjs`, `docs/art/GENERATING.md`; the concept stage's `generate_image` calls can use it instead of the personal MCP). From the pawn pilot: the judge sheet (`tools/art/shoot.mjs`, `art.html?sheet=…` in `src/art/Sheet.tsx`), studio shots (`tools/art/studio-shots.mjs`), `docs/art/BRIEF.md` and `docs/art/JUDGE.md`. They live in `docs/art/` and `src/components/`, not the `art/` and `src/style/` paths below. Painted sprites (Nov 2026): one image-generated sprite per piece and skin, the game's only art, `docs/art/PAINTED.md`; the studio is rebuilt around them. The SVG shape kit (`inkKit.tsx`, `Armour*.tsx`) that the pilot built was removed then; this plan still describes code-drawn rigs in places. Not built: concept folders, policy.json, verdicts, the Pipeline studio area, the art-run skill. The soundgarden references are to the owner's other project this was modelled on; nothing here depends on it.

Four stages, two owner gates. Sized for code-drawn SVG/CSS art: a dozen rigs, a hideout, a board, a HUD.

```
brief ─▶ CONCEPT ──[owner picks]──▶ BUILDER ⇄ JUDGE (≤4 rounds) ──[owner approves]──▶ merged
              ▲                         ▲         ▲
              └──────── STYLE GUIDE (tokens + rules) ─┘
```

## How soundgarden does it (what this plan copies from)

| Stage | Soundgarden | File |
|---|---|---|
| Concept | `image-gen` MCP makes production boards: plain background, game camera angle, 3×3 or 4×4 cells, one object per cell. Notes per object: footprint, height, 3 defining features, palette hexes, animation. Source frames kept in `options/`. A spec per id adds a "construction" section and declared `corrections` (deliberate departures from the board). | `moodboards/README.md`, `cells.json`, `specs/<id>.json` |
| Guide | `PRINCIPLES.md`: prose rules from an owner review that outrank the judge. `check.py` enforces the measurable ones (contact, facing, twist, budgets). `policy.json` holds every number. | `tools/blender/PRINCIPLES.md`, `tools/policy.json` |
| Builder | One brief per builder from a template: ids, track, reference, policy lines, owned files, loop, report format. Kit parts first. One gap per pass. | `tools/blender/BRIEF-TEMPLATE.md`, `.claude/skills/art-batch/` |
| Judge | Image-only. A 4-panel sheet (board, build, build turned, onion skin). Fixed rubric K S P C M B, 0–10 anchors, weighted W, top 3 gaps with numeric fixes, fixed reply format. 3 samples, median. Blind A/B with SAME option decides promotion. Stop: gate passes, or 3 non-wins → change technique, or 20 passes → "stuck". | `tools/judge/rubric.md`, `pair.md` |
| Owner | Not in the loop. Verdicts go to `calibration.json` to tune the judge (agrees ~16/22). `review/state.json` freezes verified models. | `tools/judge/CALIBRATION.md`, `docs/review.md` |

Lessons it paid for, worth keeping: open-ended "score 0–100" anchors on its own advice; judge varies ±2, so don't chase one-point moves; a chain of A/B wins can wander, so A/B against the committed build too; the judge over-rewards literal likeness, so guide rules outrank it; the board is a guide, not gospel.

## Folder layout

| Path | What | Format |
|---|---|---|
| `src/style/tokens.ts` | Palette, stroke presets, canvases, proportions, timing, easing. Game and studio both import it. | TS consts |
| `src/style/rules.ts` | Prose rules, each tagged with how it's checked: `lint`, `shot` or `judge`. | TS array `{id, rule, check}` |
| `art/concepts/<id>/brief.md` | What, where in the game, size in px, states, neighbours. | Markdown, ≤30 lines |
| `art/concepts/<id>/options/` | Every generated option, all rounds (`r1-a.png`…). | PNG |
| `art/concepts/<id>/concept.json` | Prompts, model, cost per call, status, pick, owner note, corrections, dates. | JSON |
| `art/concepts/<id>/pick.png` | The approved concept. | PNG |
| `art/concepts/<id>/rounds.jsonl` | One judge result per round: scores, gaps, sheet path, build commit. | JSONL |
| `art/concepts/<id>/final.png` | Judge sheet the owner approved. | PNG |
| `art/BRIEF.md` | Builder brief template. | Markdown |
| `art/JUDGE.md` | Rubric, anchors, reply format, A/B prompt. | Markdown |
| `art/policy.json` | Pass floors, round limits, models, sizes, frame counts. | JSON |
| `art/verdicts.jsonl` | Owner's final verdict beside the judge's score, per asset. | JSONL |
| `tests/style.test.ts` | Lint checks over tokens and art sources. | vitest |
| `tools/art/shoot.mjs` | Renders an asset's judge sheet. | Node + Playwright |
| `src/art/Pipeline.tsx` | Studio area for assets in flight. | React |
| `.claude/skills/art-run/SKILL.md` | Lead's playbook for one asset end to end. | Skill |

Concept PNGs load in the studio through `import.meta.glob`. They ship with `art.html` only, not the game bundle.

## In the studio (`art.html`)

Built (Nov 2026, rebuilt around the painted sprites): **Cast** (every sprite as a still, plus unpainted skins), **Stage** (one piece, one button per animation, slow modes on the game's `--spd`), **Style guide**, **Mechanics**. The old catalog, cast × state matrices and Rig tab are gone (`DECISIONS.md`, "studio rebuilt around the painted sprites").

Planned, not built:
- **Pipeline area.** One card per asset: status chip (`concept` · `awaiting pick` · `building` · `judging` · `awaiting owner` · `approved`), the brief, the options grid with the pick outlined, the latest sheet and scores, round history.
- **Style guide.** Rendered from `tokens.ts` and `rules.ts`, not hand-kept tables. Each rule shows its check tag. The studio wins conflicts with `docs/art-direction-exile.md`.
- **Solo mode.** The stage (`art.html#stage/<side>-<kind>`) already shows one piece; the shooter would need a paused-frame mode.

## 1. Concept

| Step | Who | Detail |
|---|---|---|
| Brief | lead | `brief.md`: purpose, screen spot, px size at 390 wide and 1440 wide, states (e.g. bell: idle, ring, locked), neighbours. |
| Generate | concept agent (Sonnet) | `image-gen` `generate_image`, `n: 4`. `reference_image_paths`: 2–3 studio screenshots (cast pairs, board) so options match the cast. Prompt fixed prefix: flat vector sticker, thick dark-brown outline, flat fills with one hard shade, no gradients, no texture, plain parchment background, game camera angle. |
| Model | | Cheap first pass with Nano Banana 2.1; `gpt` (GPT Image 2.5) for a final clean option. Soundgarden found OpenRouter out of credits and used Replicate; check before starting. |
| Curate | concept agent | Drop off-style options. Make a contact sheet labelled A–D. Log prompt, model and cost in `concept.json`. |
| States strip | concept agent, after pick | One `edit_image` on the pick: the asset in each state side by side. One change per edit. |
| Limit | | 2 rounds of 4. Past that the lead asks the owner what's missing instead of rolling again. |

**Gate 1: owner picks.** The lead sends the contact sheet and the Pipeline link with one question: "A, B, C, D, or redo with …? Recommend B because …". The answer goes into `concept.json` (`pick`, `note`, `date`). If the pick needs a new token (brass, lantern glow, table wood), the lead lists it in the same question. A yes adds it to the guide.

## 2. Style guide

Source of truth: `src/style/tokens.ts` + `src/style/rules.ts`. The studio tab renders them. `PieceRig.tsx`, `Hub.tsx`, `exile.css` and `rig.css` consume them (CSS through custom properties set from tokens).

| Rule | Check | How |
|---|---|---|
| Every hex in art sources is a named token | lint | Grep art sources for hexes, diff against tokens; small allowlist with reasons. Replaces today's swatch "missing" check. |
| Ink outline widths | lint | `strokeWidth` literals in art components must be a token (`outer 3.5`, `feature 2.2`, `arm 9/5`, `fine 1.6`). New art uses the presets, not raw numbers. |
| Canvas | lint | Character rigs `viewBox 0 0 100 120`, feet y=108. Each new kind (HUD piece, building) declares its canvas in tokens. |
| Timing table matches CSS | lint | `RIG_MS` (and new `HUD_MS`) equal the keyframe durations in the CSS. |
| One beat ≤1s at 1× | lint | All one-shots ≤1000 ms except an allowlist (`cheer`, `mate`). |
| Reduced motion | lint | Each new animation sits under the global reduced-motion rule or has its own. |
| Art is `aria-hidden` | shot | DOM check in solo mode. |
| ≤3 fills per part, plus ink, white and skin | shot | Count distinct fills in the rendered SVG. |
| Height order king > queen > bishop > knight ≈ rook > pawn | shot | Bounding boxes from the cast lineup. |
| Side readable without colour | judge | Greyscale panel. |
| No detail under 6 units, no mud at 48 px | judge | Silhouette and game-size panels. |
| Flat fill + one hard shade, no gradients | lint + judge | Lint bans `<linearGradient>`/`<radialGradient>` in art sources; the judge checks the look. |
| Anticipation, squash, follow-through | judge | Frames panel. |

Lint and shot checks gate before the judge is called. The judge receives the `judge`-tagged rules verbatim.

## 3. Builder

**Input**: `art/BRIEF.md` filled by the lead:
- `brief.md`, `pick.png`, states strip, declared `corrections` (deliberate departures from the concept, each feature + change + reason, so the judge doesn't mark them down)
- tokens and rules (paths, not pasted)
- kit to reuse: the painted sprites and their recipes, `.flip > .hop > .squash` layering, `SpriteStill` in `src/art/kit.tsx`
- owned files, branch name `claude/art-<id>`, policy lines (floors, round limit)
- the judge's gaps from the last round, if any

**Output**, one commit per round on `claude/art-<id>`:
- component in `src/components/` (or a function in an existing one), CSS in the matching sheet
- new tokens or timing rows, if the gate-1 answer approved them
- catalog entry with `id`, every state shown, plus its Pipeline card status
- report: what changed, which gap it targeted, check results

**Loop**: one gap per round, GAP1 first. Before handing to the judge: `npm test -- style`, `npx tsc -b`, `node tools/art/shoot.mjs <id>`, then look at its own sheet. Checks run once per round, not per edit. The builder never scores itself.

Model: Opus medium for characters and animated pieces; Sonnet for static props and buildings.

## 4. Judge

Fresh-context subagent, spawned per round. Image-only: it gets the sheet, `art/JUDGE.md`, the `judge`-tagged rules and the corrections list. No repo reads, no builder transcript.

**Sheet** (`tools/art/shoot.mjs <id>`; Playwright headless, `--disable-audio-output`):

| Panel | How |
|---|---|
| Concept | `pick.png` |
| Game size | Solo mode at the asset's real px size, phone (390×844) and desktop (1440×1000), on its backdrop |
| Zoom | Same at device scale factor 4 |
| In context | The asset in its real spot beside neighbours (board on the table, building on the map) |
| Greyscale + 48 px black silhouette | CSS filters in solo mode |
| Frames | Per state, 8 frames: pause every animation (`document.getAnimations()`, SVG `pauseAnimations()`), set `currentTime` to each step. No wall-clock waits, so sheets come out identical run to run. |

**Rubric**: each criterion 0–10, with anchors in `JUDGE.md`:

| | Criterion | 10 / 7 / 4 |
|---|---|---|
| R | Reads at game size | names itself instantly at real px / one part muddy / reads as a blob |
| S | On style | indistinguishable from the cast's construction / one rule bent / looks from another game |
| C | Matches the concept | silhouette, parts, palette as picked (minus declared corrections) / one mass or part off / different design |
| M | Motion (animated only) | clear anticipation, squash, settle; timing reads / one beat mushy / stiff or noisy |
| X | Fits in context | sits on the table or map like it belongs / scale or weight slightly off / sticks out |

Reply format, nothing else:
```
R=<n> S=<n> C=<n> M=<n|-> X=<n>
GAP1: part | what differs | concrete fix (units, hex, ms)
GAP2: …
GAP3: …
```

**Pass**: lint and shot checks green, every criterion ≥7, R and S ≥8. Floors, not a weighted sum: easier to read and harder to game. Retune after the pilot from `verdicts.jsonl`.

**Noise**: one call per round. A score within 1 of a floor gets a second call; take the lower. When the builder claims a fix but scores are flat, run a blind A/B (order random, `SAME` allowed) of best vs new. Promote only on a win. A/B the final against round 1 too, since a chain of small wins can wander.

**Stop**: pass → Gate 2. Two rounds without a win → builder changes approach once. Round 4 without pass → escalate to the owner with the best build, its sheet and the open gaps.

Model: Opus, high effort (CLAUDE.md's reviewer tier). The same tier every round, so scores compare.

## Owner touchpoints

| Gate | What the owner sees | Answer |
|---|---|---|
| 1. Concept | Contact sheet A–D, Pipeline link, any new tokens | letter, or "redo with …" |
| 2. Final | `final.png`, the studio entry, the game on the dev server | yes / "fix …" |

Nowhere else. Briefs, guide edits that follow from gate 1, judge rounds and merges into local `main` run without asking. Escalation after round 4 is a gate-2 question asked early. The verdict at gate 2 goes into `verdicts.jsonl` beside the judge's scores; after 5 assets, compare and retune `JUDGE.md`.

## Pilot

**The End-turn bell** from the Diorama layout.
- Useful now: it's the most-pressed control and it survives the mechanics rework, since any turn-based version ends a turn.
- Exercises every stage: a new material set (brass, wood) that extends the guide, three states (idle, ring, locked during check), a ≤1 s swing animation, a 96 px game size that the judge can read.
- One instance, one component (`src/components/TableArt.tsx`), so a bad round costs little.

Second run: the energy lantern (lit, out, flicker on preview, relight), reusing the bell's tokens. If the owner picks Tray over Diorama, pilot the armory instead: it's a placeholder in `Hub.tsx` today and static, with no dependence on the HUD.

## Phases

| # | Step | Done when |
|---|---|---|
| 0 | Move palette, strokes, canvas and `RIG_MS` into `src/style/tokens.ts`; PieceRig, Hub and the studio import them. | `tsc -b` and the studio e2e pass; `shoot.mjs` of the cast lineup is pixel-identical before and after (run after phase 2, or a one-off Playwright screenshot diff now). |
| 1 | `tests/style.test.ts`: hex, stroke, canvas, timing, ≤1 s and gradient lint. `rules.ts` with check tags. | `npm test` green; a planted off-token hex and a 1.2 s one-shot each fail it. |
| 2 | Solo mode + `tools/art/shoot.mjs`. | Sheet for `king` renders all panels; two runs give byte-identical PNGs. |
| 3 | Studio: Pipeline area, catalog concept thumbnails, style guide rendered from tokens/rules. | Studio e2e covers the new area at 390 px with no horizontal scroll and no console errors, using a fixture concept. |
| 4 | `art/BRIEF.md`, `art/JUDGE.md`, `art/policy.json`, the `art-run` skill. | Judge dry run on the king's sheet returns a parseable reply; two runs differ by ≤1 per criterion. |
| 5 | Pilot: bell, gates 1 and 2. | Owner approves at gate 2; `rounds.jsonl` and `verdicts.jsonl` written; branch merged into local `main`. |
| 6 | Retro: fold "what slowed me down" into the kit or tools; retune floors. | `JUDGE.md`/`policy.json` updated, or a note that nothing needed changing. |

Phases 0–3 are code and get the usual reviewer pass before merging. Phase 4 is text. Phases 0–4 don't depend on the UI direction; phase 5 waits for it.

## Borrowed from soundgarden / left out

| Borrowed | Left out |
|---|---|
| Concept image as the build target, options kept for later edits | Production boards with cell cropping (`cells.json`, `cells.py`) |
| Spec "construction" + declared `corrections` | Blender seeds, `iterate.mjs` warm servers, per-builder ports |
| Guide rules outrank the judge; numbers in one policy file | Triangle budgets, perf evidence, preservation and twist checks |
| Measurable rules as checks that gate before the judge | `check.py`'s 3D geometry checks |
| Fixed rubric with anchors, fixed reply format, top 3 gaps with numeric fixes | Weighted W, 3-sample median every call, rubric versions stamped on every score |
| Image-only judge in fresh context | Codex judge with Opus fallback |
| Blind A/B with SAME; one gap per pass; change technique after non-wins; round limit then escalate | 20-pass budgets, hero sub-assemblies, Tripo/hybrid escape hatches |
| Game-size and zoomed renders (`@0.5`/`@2`) | Turned views, onion skin (2D art has no far side; the concept is a different medium) |
| Owner verdicts logged beside judge scores | `calibrate.py` train/held-out splits, `review/state.json` hashes, owner guards |
| Kit first, report missing kit parts | Batches of 3–6 ids per builder, 4 builders at once |
| A skill as the lead's playbook | Board, `land.sh`, trains, test runner, spend ledger auto-commits |
| — | Soundgarden's owner-free loop: Chezz keeps two owner gates, since there are few assets and the owner's taste is the point |
