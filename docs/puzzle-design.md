# Chess puzzles, applied to Chezz

Working rules are in `docs/turn-based.md`; the solver is `src/game/solver.ts`. Board features marked † (holes, portals, tunnel rows, hazards, exit tiles, the Ram) are proposed, not live.

## 1. Principles

1. **Sound or nothing.** A problem with a second key is "cooked" and unpublishable; a later alternative is a dual, tolerated only off the main line [WFCC Codex, ozproblems]. *In Chezz:* exactly one winning first turn (by core actions, §5), duals after it reported but allowed.
2. **The key is quiet.** Good keys are rarely checks or captures, and flight-giving keys are prized; checks and captures are what solvers try first [Britannica "key"; ChessBase solving reports]. *In Chezz:* the ⚔-badged cheapest strike is the try. Keys are a defend, a one-square sidestep, a pawn step, or a king step that adds an escape square.
3. **Economy.** Every unit either carries the idea or kills a cook; miniatures (≤7 pieces) are the ideal [ozproblems glossary]. *In Chezz:* ≤7 units on ≤6x6; walls and holes count. Delete each unit or wall and re-solve; if nothing breaks, cut it.
4. **Tries and set play.** A try almost works and fails to one defence; set play is what happens if the solver passes [ozproblems "phases"]. *In Chezz:* set play is `endTurn` now. Ship 2–3 tries per puzzle, each refuted by what the patrol actually does, shown with the existing Step playback.
5. **Build backwards from one truth.** Blow and Traynor compose from a fact the system makes true, then build the easiest board that needs it [Blow, IndieCade 2011; Traynor, GDC 2024]. *In Chezz:* start from the exact hit sum (rook 3 + king 2 = 5) or the ability consequence ("eaten knight legs jump the wall"), then add one obstacle.
6. **Assumption, catch, revelation.** A puzzle lures the obvious route, blocks it, and the reason transfers [GMTK "What makes a good puzzle"]. *In Chezz:* chess reflexes are the assumptions and all are false here: captures don't move you, a rook must travel before striking, check is answered by defend or a two-piece kill as well as by moving.
7. **Measure the only-move gap.** Lichess accepts a move only when it beats the runner-up by 0.7 win-chance; Chess.com also requires the opponent's reply not to be a blunder [lichess-puzzler; Chess.com puzzle database]. *In Chezz:* the reply is deterministic, so count winning first turns exactly, and re-solve against an adversarial enemy so a puzzle is not merely an AI exploit.
8. **Telegraph, don't surprise.** Into the Breach and Slay the Spire became puzzles once intent was visible, and a telegraph that lies is worse than none [Subset Games; Mega Crit GDC 2019]. *In Chezz:* show threatened squares (pool-aware, like `kingThreat`) plus a three-line patrol doctrine; a live exact plan flickers on 28% of actions and leaks the AI's tells.
9. **One new thing per level, introduced safely.** Hayashida's four beats: safe intro, under threat, twist, test [Nintendo four-step; Portal commentary]. *In Chezz:* the first board of each variant is a skill gate where the ability is the only affordable path; never a new board feature and a new variant together.
10. **Difficulty is hiddenness times plausible alternatives.** Hristova, Guid and Bratko predict measured difficulty from the search tree a human must build; Lichess rates puzzles with Glicko-2 from results [Chess Tempo studies; Lichess]. *In Chezz:* seed a prior from solver stats (distinct first turns, forced depth, near misses, quiet key), then let solve rates own the rating.
11. **Counter-intuitiveness is the measurable aha.** DeepMind rewards puzzles whose solution is a low-probability move under a human model [arXiv 2510.23881]. *In Chezz:* score your options with the patrol's own heuristic; a puzzle is good when the winning turn ranks low.
12. **Fairy conditions survive when they are one hook, one effect, stateless.** Take&Make lends the victim's walk once, immediately, with orthodox check, and outlived every "absolute" or timed variant [Popeye `take_and_make.c`, issue 431]. *In Chezz:* Consume borrows movement, not strike shape; the two-turn meal must be visible on the 🍴 badge; fix hook order (damage → counter → deaths → victim hooks → striker hooks → check).
13. **Twins.** One position, one change, a different unique solution each [Benko twins; Lorinc]. *In Chezz:* the three casts per kind are a twinning engine: same board, swap one piece's variant, three different keys.
14. **Interference and clearance.** Novotny blocks two lines on one square; Bristol clears a line with a "pointless" move [Novotny; ozproblems "Bristol"]. *In Chezz:* interference is energy interference (a blocker makes the route cost more than the pool), and a kill is a free clearance because the striker never moves.

## 2. What flips chess on its head here

- **Strikes don't displace.** A kill vacates a square instead of filling one; only Haystack captures like chess, so skewer-harvests and capture-onto-defended-square motifs belong to it alone.
- **Check is arithmetic.** Hits reachable within the pool must sum to the king's HP, so a 5-HP king is never in check from one piece and a 3-HP king escapes a rook by defending. Edgeless boards (cylinders, tori) still mate, by sum, not cornering.
- **Interference is priced.** A blocker in a corridor is a pin only while the rook's walk + 2 exceeds its pool: "pin distance" is pool − 2, readable from the enemy's energy.
- **Holes turn HP into geometry.** A 9-HP queen dies to a shove into a pit; a king on an island of holes is untouchable by sliders and helpless against a knight, the one ranged striker.
- **Adjacency becomes a board property.** Portals and tunnel rows make squares neighbours; the ⚔ badge appearing across a seam is the tutorial, and `reaches()` must wrap or knights silently miss.
- **The patrol is a rulebook.** Decoys and zugzwang are deductions from published doctrine (never strikes for 0; kill over wound; king over soldier). Two labelled classes: *vs every reply* and *patrol habits*.
- **Goals beyond mate.** Exit tiles, "hold N turns", "no promotion", "at full health": kings are tanky and most enemy groups have no king.

## 3. A puzzle taxonomy for Chezz

| Type | The player must see | Example | Verify |
|---|---|---|---|
| Arithmetic | hits sum to HP within 4 energy | queen 3 + king 2 kills a rook, nobody moves | win in 1, unique core |
| Quiet key | the key is a defend or step, not a strike | defended pawn stalls a pawn lane | no winning first turn contains a strike |
| Blind side | a braced piece counters only inside its shape | bishop hits a braced rook counter-free | counter steps absent in solution |
| Trapped fork | neither target can afford flight | rook beside a knight and a walled bishop | second victim has no legal escape next turn |
| Corridor pin | pin distance = pool − 2 | king steps one square, bishop unpins | `exposesKing` refuses the direct line |
| Energy Novotny | one blocker prices two routes over the pool | pawn on a file/diagonal crossing | each enemy slider's cheapest walk+strike > pool |
| Clearance | move the piece that is not attacking | rook vacates, queen follows | key strikes nothing |
| Promotion race | underpromote or block | knight promotion strikes over a wall | queen choice loses within N |
| Consume | eat for legs, not for value | Haystack eats a bishop to pass a keyhole | solution uses borrowed shape before expiry |
| Hazard | the board does the damage | shove into a pit; lure onto lava | victim HP > total damage dealt by pieces |
| Portal / seam | strikes and threats cross | strike through a portal, check across a seam | `reaches` wraps; knight tests |
| Patrol lure | the doctrine, not a hidden plan | 1-HP bait draws the whole pool | sound vs patrol, labelled as such |
| Escort | reach a tile, nothing promotes | king crosses a guarded corridor | stipulation predicate swapped into `isWin` |
| Twin | same board, three variants, three keys | rook / Haystack / Ram on one board | each key fails in the other two |

## 4. Ten puzzle concepts on atypical boards

Legend: rows top (your far row) to bottom; uppercase yours, lowercase enemy; `H` Haystack, `#` wall, `O` hole†, `A`/`B` portal pair† (a slide into A leaves B in the same direction; nothing stands on a portal; A and B are one square for strikes), `~` lava† (2 damage to whatever ends a turn on it), `=` tunnel row† (its two ends are neighbours), `E` exit†. Enemy pool in brackets.

**1. Island King** (1/5; kill the king in 3) [3]
```
5 . . . . r
4 . O O O .
3 . O k O .
2 . O O O .
1 . N . K .
```
N b1, K d1; k c3 (5 HP), r e5. Aha: every square beside the king is a pit, so nothing can ever stand next to him; the knight shells him from b1 three turns running (2+2+2) while your king sidesteps the rook that arrives on e1. Teaches: holes stop slides and kings, knights strike at range.

**2. Poisoned Meal** (2/5; clear in 2 at full health) [3]
```
4 . . b .
3 . p . .
2 . . H .
1 . K . .
```
H c2, K b1; p b3, b c4. Aha: the glowing pawn is bait: killing it rolls Haystack onto b3 under the bishop's diagonal. The key is c2→c3 and a straight strike up: the bishop dies, Haystack lands on c4 out of reach, and the pawn walks into the king. Teaches: a Consume kill is also a move; read the landing square.

**3. Keyhole** (2/5; kill the king in 2) [0, frozen garrison]
```
5 . . . # k
4 . . . # .
3 . . . . #
2 . H b . .
1 K . . . .
```
H b2, K a1; b c2, k e5 (3 HP). Aha: e4 is reachable only diagonally through d3, so a rook can never get there; eat the bishop, slide c2→d3→e4 on borrowed legs, then strike straight up. Teaches: Consume lends movement, never the strike shape; the meal expires after two turns.

**4. The Tunnel** (1/5; clear in 1) [3]
```
4 . . . . .
3 . . . . .
2 =R # . . n=
1 . K . . .
```
R a2, K b1; n e2. Aha: the wall blocks the obvious path, but on the tunnel row a2's western neighbour is e2; the ⚔ 2 badge appears on the knight the moment you select the rook. Teaches: edges are not walls; the short way round is the cheap way round.

**5. Two Doors** (3/5; kill the king in 2) [2]
```
4 . . . # . .
3 . . . # B n
2 . H A # . .
1 K . . # . k
```
H b2, K a1; n f3, k f1 (3 HP). Aha: A and B are one square, so a strike aimed east into A lands on f3; the kill drops Haystack beyond the wall with a knight's legs, and next turn a jump-or-step plus a straight strike finishes the king wherever he closes in. Teaches: portals carry strikes; Consume as clearance.

**6. The Pit** (2/5; clear in 1) [3]
```
5 . . R . .
4 . . . B .
3 . . q . .
2 . . O . .
1 K . . . .
```
R c5 (Ram†, royal rook: its strike shoves the target one square along the line; a shove into a hole kills), B d4, K a1; q c3 (9 HP). Aha: the bishop's advertised strike scratches 2 of 9; the rook steps to c4 and shoves her into the pit. Teaches: hazards ignore HP; line the shove up.

**7. Lava Patrol** (3/5, patrol habits; clear in 2) [3]
```
5 . r . . .
4 . ~ . . .
3 . . . . .
2 . P . . .
1 K . . . B
```
K a1, P b2, B e1; r b5 (4 HP). Aha: step the pawn to b3; the only square from which the rook can afford move + strike is the lava, and the doctrine says it takes the kill. It ends its turn burning (4→2), and the bishop walks e1→c3 and finishes it. Teaches: predict the patrol from its rules; the pawn is a lure, not a loss.

**8. Pin Distance** (2/5; kill the pawn this turn, king safe) [3]
```
3 . . . . p
2 # # # . #
1 . r B K .
```
K d1 (2 HP), B c1; r b1, p e3. Aha: the bishop wears a red ✕ because the rook could step to c1 and strike d1 (1+2 = 3). Shift the king to e1 and the rook is one square too far (2+2 > 3); now bishop c1→d2 strikes e3. Teaches: a pin is sized by the enemy's pool; unpin by moving the king.

**9. Knight's Wage** (2/5; clear in 1) [3]
```
4 . . . .
3 P # p .
2 . # . .
1 K # . .
```
P a3, K a1; p c3. Aha: promote on a4 and the picker's default queen reaches nothing across the spine; a knight strikes c3 from a4 on the promotion turn (1+2). Teaches: underpromotion; a promoted piece may still strike.

**10. The Toll Corridor** (2/5, patrol habits; reach E at full health in 2) [2]
```
3 # # b # #
2 K . E . .
1 # # # P #
```
K a2, P d1; b c3. Aha: b2 and d2 are both on the bishop's diagonals and it can afford one strike. Step the pawn to d2 and the king to b2 in the same turn; the patrol takes the kill, and the king walks onto E before it can strike again. Teaches: a sacrifice that buys a square, read from the doctrine (kill over wound).

## 5. Verification

Every puzzle is proven on the engine, not by hand. `playerOutcomes` enumerates every distinct position reachable this turn (`boardKey` dedupes orderings; measured 16–1,194 positions per turn, 4–5× fewer than ordered sequences); `endTurn` gives the one deterministic reply; `solve` deepens iteratively with a transposition memo and a feasibility bound (remaining enemy HP vs the damage deliverable in the turns left). Measured cost: depth 2 exhaustive on every current board in under 5 s, depth 3 on 3-piece boards in under 90 s; deeper runs use `nodeBudget`. Stipulations are predicates swapped into `isWin`: clear, kill the king, exit tile, hold N turns, no promotion, at full health.

A puzzle ships only when all pass:

1. **Win exists** within N against the patrol.
2. **No shortcut**: `solve` with N−1 fails (Popeye's StopOnShortSolutions).
3. **Unique key**: `winningFirstMoves === 1`, where first turns are compared by *core*: strip each action from a winning plan and re-solve; actions whose removal still wins are idle (spare-energy defends, sidesteps) and collapse. Different cores are a cook. Orderings of one core are one solution. The final turn may have several kill orders.
4. **Duals** after turn 1 are reported, not fatal; the author tightens or accepts.
5. **Economy lint**: remove each unit and wall; the puzzle must break or cook.
6. **Tries**: first turns that survive one reply then lose are listed with the patrol's refutation for the post-mortem.
7. **Class**: re-solve with an adversarial enemy (AND-OR over its affordable action combos). Pass = *vs every reply*; fail = *patrol habits*, labelled in-game so players learn the AI's tell, not a false rule.

Known hazard: `boardKey` omits the turn number while `absorbedUntil` is absolute; store it as turns-left or memo results leak across depths. Each puzzle is a vitest whose name is its one-sentence statement; CI fails on a cook.

## 6. Progression

Packs are ordered by the chess ladder with a Chezz "step 0" first: arithmetic (strike costs 2, so 4 energy is two steps and a blow; hits add up; a pawn deals 0 to a defender; check at HP ≤ 3), then hanging piece, trapped fork, corridor pin, blind side, sequencing, mate zone, lure, and last the variant line motifs. Board families enter one at a time: holes → tunnel strike → tunnel movement → portal pass → portal strike → hazard → collapse, each with a strike-only intro before a movement puzzle.

Each variant ability gets a four-board arc: (1) safe, the ability is the only affordable path and the badge glows; (2) the same under threat or in check; (3) combined with one base rule; (4) test with no new rule and no glow. Practice boards are labelled with the teaching goal, allow three-tier hints (piece, square, ghost replay; "show solution" marks it unsolved) and update ratings at low weight (0.2, as Lichess treats hinting themes). The test board is unlabelled, hint-free, full weight, and twins the practice board with one piece's cast swapped. A consolidation fight with nothing new follows every three or four teaching boards; enemy energy drops by one on the board that introduces a feature and returns after it.

## 7. Sources

- WFCC Codex: https://www.wfcc.ch/?p=198
- OzProblems glossary, phases, Bristol, walkabouts: https://www.ozproblems.com/
- Britannica "key (chess)": https://www.britannica.com/topic/key-chess
- ChessBase solving-championship reports: https://en.chessbase.com/post/world-solving-championship-solutions-3
- Novotny / Grimshaw: https://en.wikipedia.org/wiki/Novotny_(chess)
- Benko twins: https://en.chessbase.com/post/pal-benko-eleven-twins
- Popeye solver (Take&Make, Make&Take, Circe, issues 341/431/509): https://github.com/thomas-maeder/popeye
- lichess-puzzler generator and tagger: https://github.com/ornicar/lichess-puzzler
- Lichess puzzle rating and selection (lila): https://github.com/lichess-org/lila
- Chess.com puzzle database: https://www.chess.com/blog/CHESScom/how-we-built-a-puzzle-database-with-half-a-million-puzzles
- Generating Creative Chess Puzzles (DeepMind, 2025): https://arxiv.org/abs/2510.23881
- Iqbal, aesthetics of computer-generated problems: https://arxiv.org/abs/1309.3039
- Puzzle difficulty estimation (FedCSIS 2025): https://annals-csis.org/Volume_43/drp/pdf/4532.pdf
- Blow, puzzle design process: https://www.gamedeveloper.com/design/indiecade-inside-jonathan-blow-s-puzzle-design-process
- Traynor, System-Centric Puzzle Design (GDC 2024): https://gdcvault.com/play/1034267/System-Centric-Puzzle-Design-in
- Grant, 30 Puzzle Design Lessons (GDC 2021): https://gdcvault.com/play/1027306/30-Puzzle-Design-Lessons-From
- GMTK, What Makes a Good Puzzle: https://notes.hamatti.org/gaming/puzzle-game-design
- Teikari on Baba Is You: https://www.redbull.com/int-en/baba-is-you-interview
- Into the Breach, Road to the IGF: https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-
- Slay the Spire metrics (GDC 2019): https://www.gamedeveloper.com/design/learn-i-slay-the-spire-i-s-metrics-driven-approach-to-game-balancing-at-gdc-2019
- Nintendo four-step level design: https://www.nintendolife.com/news/2015/03/video_nintendos_four_step_stage_design_is_why_you_love_super_mario_games_so_much
- Portal developer commentary: https://theportalwiki.com/wiki/Portal_developer_commentary
- Cylinder chess: https://en.wikipedia.org/wiki/Cylinder_chess
- Portal chess: https://en.wikipedia.org/wiki/Portal_chess
- Wormhole Chess: https://chessvariants.com/32turn.dir/wormhole.html
- Betza, Ideal and Practical Values: https://chessvariants.org/piececlopedia.dir/ideal-and-practical-values.html
- Gardner minichess solved: https://arxiv.org/abs/1307.7118
- Pawnbarian review (intent display): https://thinkygames.com/reviews/pawnbarian-a-dense-and-intricate-deck-building-gem/
- Fast Downward stubborn sets (partial-order reduction): https://github.com/aibasel/downward
