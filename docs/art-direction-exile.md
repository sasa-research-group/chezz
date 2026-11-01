# Escape from Exile: art and animation direction

Status (Oct 31 2026): the look is superseded by **`docs/art-style.md`**
("armour does the talking", reference art in `docs/art/`). This doc still
owns the motion principles and timings (section 2), damage and defence
states (3.4), the animation spec (3.5), accessibility (3.6) and the avoid
list (4). Section 1 is background reading. Where this doc and
`docs/art-style.md` disagree on the look, the style guide wins.

The current rigs (`src/components/PieceRig.tsx`, `src/rig.css`, see
`art.html`) are the Oct 10 cast of misfit humans with Pizza Tower energy and
a blue patrol. They have not been redrawn to the new guide yet.

Original status: proposal, Oct 10 2026. The retired "Between Worlds" look and its
doc were removed with the old prototype (see git history). The live cast is
`src/components/PieceRig.tsx` with animations in `src/rig.css`.

**Hard rule:** animation only presents a `Resolution`. Every duration below is
scaled by the playback speed. Skip and reduced motion must reach the same final
frame.

---

## 1. References: what to take, what to leave

### Castle Crashers (The Behemoth; art by Dan Paladin)
- **Look:** a Newgrounds-era vector style made in Flash. It uses thick dark
  outlines, flat fills and big-headed bodies (roughly 1:1.2 head to body). The
  knights are near-identical and differ mainly by **colour and one helmet
  feature**, so four players stay readable in a crowd. Faces are tiny: a visor
  slit or two dot eyes, with emotion carried by the brow line and the body pose.
- **Animation:** cut-out limb rigs with snappy poses held on purpose. Damage has
  big anticipation, a smear-like strike pose, a short freeze, then a knockback
  arc. Defeat is slapstick: enemies flop, bounce, pop out of armour or fly
  offscreen, and the comedy comes from overshoot.
- **Take:** shared bodies with one distinct hat per type, colour-coded sides,
  and slapstick deaths. **Leave:** their exact helmet-and-visor knight, coloured
  knights in a row, and the particular Paladin face.
- Sources: Paladin interviews on [gamedev.net (2010)](https://gamedev.net/tutorials/business/business-and-law/interview-with-dan-paladin-r2770)
  and [gamedev.net (2007)](https://gamedev.net/tutorials/industry/interviews/the-behemoth-r2353);
  [Gamasutra, Fulp and Paladin](https://gamedeveloper.com/design/taunting-the-behemoth-tom-fulp-and-dan-paladin-cry-out);
  [PAX East 2011 spotlight](https://blogcritics.org/pax-east-2011-spotlighting-the-behemoth/)
  (Paladin: imitation is fine as long as a look "stays distinct enough");
  [Hardcore Gaming 101](https://www.hardcoregaming101.net/castle-crashers/).

### Cult of the Lamb (Massive Monster; art director James Pearmain)
- **Look:** cute, round, soft-cornered creatures with large heads. Eyes are
  simple black ovals or dots with no irises, and the whole face changes with
  one lid or brow shape. A tight palette of saturated reds, creams and blacks
  sits against muted grounds. The horror is in the context, not in gore. The
  2D characters sit in 3D-lit spaces.
- **Animation:** Spine skeletal cut-out rigs with lots of squash, wobbly
  secondary motion (ears, cloaks) and very bouncy idles. Followers do happy
  hops. Sacrifices and deaths get a dramatic hold and a theatrical flourish.
- **Take:** the "cute versus sinister" contrast, mapped to *cute exiles versus
  pompous royal patrol*; dot eyes with expressive lids; ear and plume
  follow-through. **Leave:** occult iconography, the lamb's crown, and its red
  and cream palette signature.
- Sources: Pearmain interviews on [Inverse](https://inverse.com/gaming/cult-of-the-lamb-concept-art-interview-massive-monster)
  and [DreadXP](https://www.dreadxp.com/?p=27832) (the team aimed between cute
  and evil, without gore); [NME](https://www.nme.com/features/cult-of-the-lamb-is-happy-tree-friends-meets-midsommar-and-it-just-might-be-your-new-favourite-game-3207717);
  [Stevivor preview with Julian Winton](https://stevivor.com/previews/cult-lamb-preview-aussie-made-diabolical/);
  [Spine showcase quote](https://en.esotericsoftware.com/spine-showcase);
  [Devolver crossover interview](https://www.devolverdigital.com/blog/post/Cult-of-the-Lamb-Dont-Starve-Together-Crossover-but-make-it-an-interview).

### Dicey Dungeons (Terry Cavanagh; art by Marlowe Dobbe)
- **Why it matters:** this is the closest structural match. Every player
  character shares **one base body (a die)**, and the team set them apart with
  "visual archetypes, facial features, outfits and colours". Chess pieces are
  the same problem. Enemies were redesigned from their *mechanic* outward: the
  vampire bat became a health-draining vacuum cleaner. The tone is "Alice in
  Wonderland", deliberately not grimdark. Each enemy got idle animation, which
  Cavanagh called worth the work.
- **Take:** a shared torso with variety in heads and props; designs that come
  from mechanics (the rook's look should *say* "moves in straight lines and
  blocks"); flat colour with a single shade.
- Sources: [Game Developer, Road to the IGF](https://www.gamedeveloper.com/disciplines/road-to-the-igf-cavanagh-houston-dobbe-s-i-dicey-dungeons-i-);
  [Cliqist, Dobbe on the art](https://cliqist.com/2019/07/02/marlowe-dobbe-on-the-art-of-dicey-dungeons/);
  [Wireframe, Cavanagh](https://wireframe.raspberrypi.com/articles/dicey-dungeons-terry-cavanagh-interview).

### Into the Breach (Subset Games; art by Justin Ma)
- **Why it matters:** it is a small-board tactics game where **reading the
  board beats spectacle**. Units are chunky, each with a distinct silhouette and
  one dominant team colour. Enemy intent is drawn on the board before it
  happens. Hits are quick: a flash, a short shake and a damage number, and play
  moves on.
- **Take:** intent and attack overlays outrank character animation, and each
  hit should finish in well under a second. Units must read at 1x zoom on a
  laptop.
- Sources: [GDC 2019 "Into the Breach Design Postmortem" (Matthew Davis)](https://gdcvault.com/play/1025772/-Into-the-Breach-Design);
  [80.lv summary](https://80.lv/articles/gdc-2019-an-inside-look-at-into-the-breach);
  [Game Developer, Road to the IGF](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-);
  [PC Gamer preview](https://pcgamer.com/into-the-breach-preview).

### Paper Mario (Intelligent Systems)
- **Why it matters:** its flat cut-out characters live on a tilted stage, which
  is exactly our setup: SVG pieces standing on a CSS-tilted board. The signature
  gag is the **paper flip**, where a character turns around with a `scaleX`
  through 0. Battles are staged like a puppet theatre: hop in, act, hop back.
- **Take:** use `scaleX` flips to change facing, give pieces a drop shadow on the
  board plane, and act out moves as theatrical beats. **Leave:** the papercraft
  textures and the stage-and-audience framing.
- Sources: [Iwata Asks](https://www.nintendo.com/en-gb/-690475.html);
  [Siliconera on Naohiko Aoyama's concept](https://www.siliconera.com/?p=258547);
  [GoNintendo on the 2000 interview](https://gonintendo.com/stories/367260-nintendo-tried-pre-rendered-visuals-and-traditional-polygons-for).

### Don't Starve (Klei; creative director Jeff Agala), as a cautionary note
It shows how much one consistent line language buys: a scratchy, uneven ink line
in a "newspaper cartoon" style influenced by Gorey and Burton. Its wobbly line
and dark palette **muddy at 60px**, so we borrow only the confidence of a
single consistent line, not the texture. Sources: [Game Developer, Road to the IGF](https://gamedeveloper.com/design/road-to-the-igf-klei-entertainment-s-i-don-t-starve-i-);
[Gamasutra](https://gamedeveloper.com/design/-i-don-t-starve-i-a-tim-burton-take-on-i-minecraft-i-).

### Game-feel sources (cross-cutting)
- Jan Willem Nijman, "The Art of Screenshake"
  ([video](https://www.youtube.com/watch?v=AJdEqssNZ-U),
  [Kenney's list](https://kenney.nl/learn/must-see-videos-for-indie-developers)):
  covers hit pause, shake, knockback and permanence (debris that stays).
- Jonasson and Purho, "Juice it or lose it" (GDC Europe 2012), via the
  [Juicy Break notes](https://crcdng.itch.io/juicy-break).
- Masahiro Sakurai on hit stop
  ([coverage](https://nintendowire.com/news/2022/12/12/this-week-in-sakurai-12-5-12-11-fine-tuning-hit-stop-and-cheating-the-system/)):
  freeze both attacker and victim, shake the victim (not the attacker) during
  the freeze, and scale the freeze with the hit's power.

---

## 2. The 12 principles at 60–120px

At this size, **poses read and in-betweens don't**. Favour fewer, more extreme
keys and hold them.

| Principle | What it means for a 60–120px SVG piece |
|---|---|
| Squash and stretch | Scale the whole body group around the feet (`transform-origin: 50% 92%`). Range from 0.85/1.15 (normal) to 0.7/1.3 (impact). Keep the area roughly constant. |
| Anticipation | Every move and attack starts with a crouch or lean-back of 80–160ms. This matters most because playback is simultaneous. |
| Staging | Only the acting piece animates big. Others drop to a calm idle, and the board overlay (attack line) leads. |
| Straight-ahead vs pose-to-pose | Pose-to-pose only: 3–5 keyframes per action. |
| Follow-through and overlap | Hat, plume or mane lag the body by 40–60ms, using a separate `<g>` with a delayed animation. |
| Slow in / slow out | Use ease-out on arrivals, ease-in on wind-ups and a hard linear snap on the strike. |
| Arcs | Hops follow a parabola. Animate `translateY` on an inner group with its own easing while `left/top` moves the outer one. |
| Secondary action | Blinks, a sword wobble or a nervous pawn glance, kept to one per piece. |
| Timing | See the table below. Anything under ~50ms is invisible except as a flash. |
| Exaggeration | 15–25° tilts and 1.3x stretch. Subtle motion disappears at 80px. |
| Solid drawing | Keep the volume consistent across poses: the body and head are separate groups that never change shape, only transform. |
| Appeal | Big head, small body, readable face, one memorable prop. |

**Typical timings (ms at 1x speed).** These are working values in the range
action and tactics games use (60fps: 1 frame ≈ 17ms). They are recommendations,
not measured from the reference games.

| Beat | Duration |
|---|---|
| Idle breath loop | 1,800–2,600 (offset per piece so they don't sync) |
| Blink | 120, every 3–6s at random. Presentation-only randomness is fine, outside `exile.ts`. |
| Hop / move per square | 220–320 plus 60–100 landing squash |
| Attack wind-up | 120–200 |
| Strike | 60–90 |
| Hit stop (freeze both) | 60–120, scaled by damage |
| Recovery | 180–260 |
| Hit flash (white fill) | 60–90 |
| Hit knockback and settle | 200–300 |
| Damage number float | 600–800 |
| Death sequence | 600–900 total |
| Screen or board shake | 120–200, amplitude 2–5px, decaying |

---

## 3. Look, states and motion

The look (construction, sides, silhouettes, palette) moved to
`docs/art-style.md` on Oct 31 2026. The "Rebel puppets" token designs and
their colours are retired. Sections 3.4–3.6 below still apply to whatever
art the game uses.

### 3.4 Damage and defence states
- **Wounded (≤50% HP):** one bandage cross plus a droopy lid. **Critical (1 HP):**
  sweat drop plus wobble added to the idle. These are geometry changes, not
  colour only.
- **Guarding:** the piece raises a round buckler (rebels) or kite shield
  (patrol), and a teal arc appears under the base. The existing `guard-ring` stays.
- **Selected:** a pale-gold outer glow plus the piece rises 4 units.
- Damage numbers keep their current place and size (`damage-pop`) in damage red
  with a cream outline.

### 3.5 Animation spec per state

Easing tokens (CSS custom properties):
- `--ease-out-back: cubic-bezier(.34,1.56,.64,1)` for landings and pop-ins
- `--ease-in: cubic-bezier(.55,0,1,.45)` for wind-ups and falls
- `--ease-snap: linear` for strikes
- `--ease-soft: cubic-bezier(.45,0,.55,1)` for idle loops

Structure each piece as nested groups: `.pos` (board position) > `.hop` (Y arc) >
`.squash` (scale, origin at the feet) > `.body` / `.head` / `.prop` / `.face`.
Use WAAPI (`el.animate`) for one-shot beats, so playback can `await
anim.finished` and apply `playbackRate` for speed. Use CSS keyframes for loops.

**Idle** (loop 2,200ms ± a 300ms per-piece offset, `--ease-soft`)
- 0% scale(1,1). 50% scale(1.03,0.97) with the head translateY +1. Then back.
- The prop and head-crest lag by 120ms. Blink: lids scaleY 1→0.1→1 over 120ms.
- Patrol idles are stiffer: half the amplitude, with a march-in-place tick every
  4s.

**Move** (per square: 280ms. For multi-square slides, 280 + 120 per extra square.)
1. 0–90ms anticipation: squash to (1.12, 0.86), with a lean of 8° away from the
   direction of travel.
2. 90–240ms flight: stretch (0.92, 1.1), hop up 18 units (a full square for the
   knight, 28 units with a 60ms hang at the apex).
3. 240–330ms landing: squash (1.18, 0.82) → `--ease-out-back` → (1,1).
   **Dust:** 3 puffs.
- Change facing with a `scaleX` paper flip (90ms) before the move.
- Rook: no hop, a heavy slide with 2px board shake on arrival. Bishop: diagonal
  skip with two mini-hops.

**Attack** (about 520ms total, plus hit stop)
1. Wind-up 160ms `--ease-in`: lean back 15°, squash (1.1, 0.9), with the prop
   raised behind the head.
2. Strike 70ms `--ease-snap`: lunge 30–40% of the way toward the target, stretch
   (0.85, 1.2), prop sweeping through. Add a **smear**: a 50ms ink-coloured
   arc path at 60% opacity.
3. Impact (hit stop 80ms, +20ms per damage point, capped at 140ms): both pieces
   freeze, and the target shakes ±2 units at 30ms intervals. Show **stars**: a
   4-point burst of 3 stars.
4. Recovery 220ms `--ease-out-back` back to rest.

**Defend** (300ms): a quick crouch (1.08, 0.92) with the shield popping in by
scale 0→1.15→1 `--ease-out-back`. A 1px teal ring pulses outward once. When
blocking a hit: a "tink" spark (2 white lines) and no knockback.

**Hit** (380ms, starting at impact)
1. 0–80ms **white flash**: a duplicate silhouette `<use>` filled `#fff8e6`,
   fading 1→0. Eyes switch to "><".
2. 80–300ms knockback: translate 6 units away and tilt 12° toward the
   attacker's side, then settle with `--ease-out-back`.
- If HP crosses a threshold, swap in the wounded geometry at the end of the
  frame.

**Death** (800ms; slapstick, never gore)
1. 0–120ms: a held "uh-oh" pose with X eyes, and the crest pops up 10 units off
   the head.
2. 120–520ms: the body falls over (rotate 90°, `--ease-in`) with one bounce
   (rotate 80→90). The crest lands next to it with a ding of 2 stars.
3. 520–800ms: a **puff of smoke** (4–5 circles, scale 0.4→1.3, opacity 1→0).
   The piece fades with it and leaves a small **ghost tombstone or a dropped
   crest** for the rest of the battle (permanence, per Nijman). Patrol pawns
   could leave just the pike.
- **King death:** a 300ms extra hold, the crown rolls offscreen, then cut to
  defeat.

**Particles** (pure SVG, at most 8 per beat, removed on `finish`):
- Dust: cream `#efe3c6` circles, r 3–5, with an ink outline.
- Stars: 4-point, gold with an ink outline.
- Smoke: grey `#cfc6b8` circles.
- Sweat: one teal teardrop.

Spawn particles in a board-level overlay so the tilt transform doesn't distort
them. Board shake goes on `.board-plane` only, never the page: 2–5px for 160ms,
only on hits of 2+ damage and on death.

### 3.6 Accessibility
- **`prefers-reduced-motion: reduce`**
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion),
  [WCAG 2.3.3](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)).
  Turn off idle loops, hops, shake, smears and particles. Moves become a 150ms
  crossfade or a straight slide. Hits keep the **flash and damage number**,
  since they carry information, at 0 travel. Death becomes a 200ms fade to the
  tombstone. Hit stop becomes a plain 150ms pause so the order of events stays
  readable. The final state must match the full-motion final state exactly; add
  an e2e assertion for that. The current global `animation-duration: .01ms`
  override is a fallback, not the design.
- **Colour-blind safety:** never let colour carry the side alone. Pair the
  blue patrol against earthy rebels with shape markers: patches and wear vs
  smooth plate and gold trim, round vs diamond ground shadows, and distinct
  HP badges (current markers: the studio's Side markers table). Check with a
  deuteranopia/protanopia simulator and a greyscale screenshot.
- No flashing faster than 3 Hz. Keep hit flashes to one pulse.

---

## 4. Avoid

- **Copying recognizable IP:** Castle Crashers' visor-slit knights in coloured
  rows, its animal orbs, its exact face; Cult of the Lamb's lamb, red crown,
  pentagram/occult motifs and its red-and-cream palette; Paper Mario's paper
  texture. Borrow principles, not designs.
- **Mud at small sizes:** gradients, texture, hairline strokes, more than 3
  fills per piece, details smaller than 6 units, dark-on-dark (patrol blue needs
  its light trim), and outlines thinner than 3.5 units at 100 wide.
- **Over-detail at game size:** fingers, rivets, belt buckles, multiple props.
  One prop per piece. The reference sheet's detail is for concepts only; see
  `docs/art-style.md` section 9 for what survives at 48–90px.
- **Animation that hides the board:** long sequences (keep any single beat at
  1s or less at 1x), off-board flight paths, or shake that moves the HUD.
- **Randomness in rules code:** blink and idle offsets live in presentation
  only. `exile.ts` stays pure.
- **Gore:** defeat is comedy (pop, flop, puff), never blood.
