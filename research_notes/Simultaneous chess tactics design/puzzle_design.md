# Puzzle and level design for Chezz: crafting tactics puzzles, teaching mechanics, solver-assisted generation, playtesting tiny experiments

Scope note: Several primary pages (80.lv, chess.com, marctenbosch.com, gamedeveloper.com) failed to fetch from this container (DNS errors), so many findings below rest on search-result excerpts of those pages rather than full reads. Where a claim comes only from a secondary summary, it is flagged.

## 1. Chess problem composition: what makes a good chess puzzle, and how the conventions transfer to small boards

### Takeaway
Composed chess problems have a mature, explicit quality standard: one unique key move (a second solution, a "cook", disqualifies the problem), a preferably quiet and counterintuitive key, economy of material, space and motivation, and plausible near-miss "tries" that fail to exactly one defence. These map almost directly onto a "win in N turns" Chezz puzzle checked by an exhaustive solver.

### Cited Findings
- In a directmate only one first move should force mate. A problem with two keys is "cooked" and would not be published. A non-intended winning first move is a "cook", and computer testing has made cooks rare. — [The Problemist beginner guide](https://mail.theproblemist.org/beginner.pl?type=b_int); [Glossary of chess problems](https://wikipedia.com/wiki/Solus_rex) (via search summary)
- Extra solutions are also criticised on aesthetic grounds: they cheapen the intended one. — [ozproblems: chess problem](https://www.ozproblems.com/problem-world/chess-problem) (via search summary)
- "Tries" are plausible first moves that nearly work but are refuted by a single defence. They are a deliberate device that makes the real key harder to find and more satisfying. — [chess.com, Rocky64: An introduction to composed chess problems](https://www.chess.com/blog/Rocky64/an-introduction-to-composed-chess-problems) (via search summary)
- Keys are rarely checks, and captures are almost unheard of (taking a pawn is tolerated). Good keys reduce White's options and/or give Black more, and do not look like strong moves. — [The Problemist beginner guide](https://mail.theproblemist.org/beginner.pl?type=b_int) (via search summary)
- How strong a key must be depends on the problem's era and construction. Composers want the best key they can get, but most would not give up the theme for it. — [The Problemist beginner guide](https://mail.theproblemist.org/beginner.pl?type=b_int) (via search summary)
- Economy has three parts: material/force (no unused pieces), space, and motivation (every line serves the theme). If a theme can be shown in fewer moves, it should be. The solution should be explained by a theme, not by disjointed calculation. — [ozproblems](https://www.ozproblems.com/problem-world/chess-problem); [chess.com Rocky64](https://www.chess.com/blog/Rocky64/an-introduction-to-composed-chess-problems) (via search summary)
- A "dual" (two White continuations after a Black defence) is a flaw but is often excused if the problem is otherwise strong. Helpmates are the exception: multiple intended solutions are common there. — [The Problemist beginner guide](https://mail.theproblemist.org/beginner.pl?type=b_int); [Glossary of chess problems](https://wikipedia.com/wiki/Solus_rex) (via search summary)

### Inferences
- Translation to Chezz: "win in N turns" plays the role of mate-in-N. Accept a puzzle only when exactly one first order set (the key) forces the win against every enemy reply. Treat a second winning first turn as a cook, which is fatal. Treat alternative winning orders on later turns as duals, which can be tolerated, especially in teaching levels.
- Simultaneous orders complicate the "key". The key is the player's whole order set for turn 1, and refutations are enemy order sets. A solver must quantify over all enemy order combinations (or the enemy's scripted/telegraphed policy, if enemies are deterministic like Into the Breach). If enemy intent is shown in advance, the puzzle collapses to a single-agent search, which is far cheaper to check and closer to a classic problem with a fixed defence.
- Quiet keys are the "aha" for Chezz. A key that is not an attack (stepping a piece out of a line so a simultaneous hit lands, or deliberately taking a hit because damage resolves from the start-of-turn HP snapshot) matches "does not look like a strong move".
- Tries are measurable. Count first-turn order sets that win against all but one or two enemy replies, or that fall one HP short. Good puzzles have a few attractive tries. Zero tries means the answer is obvious; very many means it is noisy.
- Economy of material suggests a removal test. Every unit, wall and HP value should be necessary: deleting it should break uniqueness or the solution. A solver can check this automatically (see section 4).
- Small boards (4×4 to 6×6) are well suited to exhaustive verification, which is the modern standard for "sound" problems. Every published Chezz puzzle should be computer-tested.

### Gaps
- I could not fetch the full Problemist / British Chess Problem Society guidance; the quality criteria above are from search-result excerpts. No source found on conventions for problems on reduced boards specifically (e.g., 4×4 or 5×5 chess problem traditions), though minichess variants exist.
- No source found on chess problem conventions for simultaneous-move variants.

## 2. Lessons from designers: Into the Breach, Hoplite, Desktop Dungeons, Baba Is You, Stephen's Sausage Roll, Snakebird/Draknek, The Witness, Portal, Nintendo

### Takeaway
Across these designers the common principles are: start from one core idea or interaction per level; show everything the player needs (telegraphing, deterministic outcomes); make each level produce a realisation rather than busywork; teach by constrained play, not text; and prototype puzzles cheaply before building the full engine. Into the Breach's telegraphed, near-deterministic small-board combat is the closest analogue to Chezz.

### Cited Findings
**Into the Breach (Subset Games)**
- Matthew Davis's GDC 2019 "'Into the Breach' Design Postmortem" covered early drafts through final balancing: cutting features, borrowing mechanics, choosing difficulty and how much randomness to use. The game took four years after FTL. — [GDC Vault](https://gdcvault.com/play/1025772/-Into-the-Breach-Design); [GDC news](https://www.gdconf.com/news/get-inside-look-making-breach-gdc-2019)
- All enemy attacks are telegraphed in minimalist, turn-based combat. — [Epic Games Store listing](https://store.epicgames.com/p/into-the-breach)
- Knowing the exact outcome of each action makes the game feel like "violent chess", with relatively little probability, uncertainty or risk. — [GameSpot review](https://gamespot.com/reviews/into-the-breach-review-a-mechanized-masterpiece/1900-6416865/)
- Caveat: I could not access the talk's content (it is on paywalled GDC Vault, and the 80.lv summary failed to fetch), so its specific lessons are not cited here.

**Hoplite and Michael Brough**
- Correction to the brief: Hoplite was made by Doug Cowley (Magma Fortress), not Michael Brough. It plays as a series of small, randomly generated levels. — [Electron Dance on Hoplite](https://www.electrondance.com/hoplite/) (via search summary)
- Brough is known for tightly focused explorations of a single mechanical aspect of the roguelike, on unusually small grids. "Broughlike" names this style, and 868-HACK is the best-known example. — [Wikipedia: Michael Brough](https://en.wikipedia.org/wiki/Michael_Brough_(game_designer)) (via search summary)

**Desktop Dungeons (QCF Design)**
- Combat is deterministic, an idea inherited from Tower of the Sorcerer and also seen in DROD RPG. One exception is the Rogue's random dodge. — [Wurb: Desktop Dungeons](https://www.wurb.com/stack/?p=740)
- Its authored puzzle dungeons are not random, are much smaller than normal dungeons, and show everything from the start. Players cannot bring items in and must use every trick to find "often the one and only solution". — [Destructoid review](https://destructoid.com/?p=137044) (via search summary)

**Baba Is You (Arvi Teikari)**
- Teikari designs a level by first thinking of an interesting interaction or set-up that the game's words and rules can produce. Example: "Pull" suggests a level where Keke must drag a key across a lake. — [Amara transcript of a Baba Is You video](https://amara.org/videos/v4T6ECRKBPBx/en/3100617) (via search summary)
- He tries to make almost every level produce "some kind of a 'realization' — or an 'a-ha moment'". — [Game Pilgrim developer interview: Hempuli Oy](https://gamepilgrim.com/2019/04/06/developer-interview-hempuli-oy/) (via search summary)
- After the jam he chose a challenging puzzle game over a sandbox where levels "mostly just showcase cool things of the system". — [MCV: When We Made... Baba Is You](https://mcvuk.com/development-news/when-we-made-baba-is-you/) (via search summary)
- He gave a talk titled "Level design in Baba Is You" (2020) on how the levels were conceived. — [Aalto Games Now: Arvi Teikari](https://gamesnow.aalto.fi/?p=2132)

**Stephen's Sausage Roll (Stephen Lavelle / increpare)**
- There is no tutorial. The only instruction is an early sign covering arrow keys, Z to undo and R to restart. — [setsideb](https://setsideb.com/?p=6737); [Kotaku](https://kotaku.com/puzzle-game-about-cooking-sausages-is-way-harder-than-i-1772038805)
- Unlimited undo and restart make experimentation cheap: try something, watch it fail, revert. — [Destructoid review](https://destructoid.com/reviews/review-stephens-sausage-roll)
- A fan built tutorial levels to test the criticism that the game has no introductory levels. He concluded such an introduction "serves no purpose and would be detrimental". — [itch.io: Stephen's Sausage Roll Tutorial](https://geeveedeevee.itch.io/stephens-sausage-roll-tutorial)
- No first-person Lavelle interview on this choice was found.

**Draknek (Alan Hazelden: A Good Snowman Is Hard to Build, Cosmic Express, A Monster's Expedition)**
- A Good Snowman was prototyped in PuzzleScript before any code was written, to test whether the mechanics allowed interesting puzzles. The PuzzleScript version remained his level editor. — [Game Developer Q&A: A Good Snowman Is Hard to Build](https://gamedeveloper.com/design/q-a-a-good-snowman-is-hard-to-build)
- "Honest puzzle games" (thinky games) use puzzles to communicate interesting ideas, not to pad playtime or hide weak mechanics. A related talk covers how to design an honest puzzle mechanic and mine it for puzzles. — [CESCG: Designing Thinky Games](https://cescg.org/?p=5943)

**The Witness / Braid (Jonathan Blow) and Miegakure (Marc ten Bosch)**
- In "Designing to Reveal the Nature of the Universe" (IndieCade, 7 Oct 2011), Blow and ten Bosch argued for inspecting a system to find its core ideas and expressing them as cleanly as possible. They contrasted this with traditional "combinatoric" design. — [marctenbosch.com](https://marctenbosch.com/news/page/13/); recording: YouTube watch?v=OGSeLSmOALU (as cited by Game Maker's Toolkit)
- In Blow's GDC Europe 2011 "Truth in Game Design", games are algorithmic systems biased toward revealing truth and can work like instruments. — [Game Developer: Jon Blow on the truth in game design](https://www.gamedeveloper.com/design/video-jon-blow-on-the-truth-in-game-design-)
- Blow kept reworking puzzle set-ups so players move from not understanding something to understanding it. He wanted wonder rather than making players feel smart. — [Paris Review](https://www.theparisreview.org/blog/?p=93293) (via search summary)
- Blow calls The Witness's teaching "subtle" and contrasts it with Nintendo games, where a character repeats every obvious thing. — [Edge "Post Script" via PressReader](https://www.pressreader.com/australia/edge/20160210/282170765186464) (via search summary)
- Many Witness puzzles unlock nothing and exist only to teach a concept used later. — [Game Informer](https://gameinformer.com/games/the_witness/b/playstation4/archive/2013/06/14/five-features-that-define-the-game.aspx)

**Portal (Valve)**
- Each test chamber starts from a defined objective: one key aspect of a mechanic and how to teach it while still challenging the player, not random pieces on a whiteboard. Chambers are sketched isometrically on whiteboards first. "Checklisting" breaks a mechanic into the core components players must understand. — [Game Informer: Thinking with Portals](https://gameinformer.com/b/features/archive/2010/03/17/thinking-with-portals-making-a-test-chamber)
- Kim Swift called playtesting "probably the most important thing we did on Portal" and advised watching people play rather than reading reports. Levels are playable in two to five days, ugly at first. — [Game Developer: 10 years of design lessons from Kim Swift](https://gamedeveloper.com/design/10-years-of-design-lessons-from-em-portal-em-s-kim-swift) (via search summary)
- Playtest feedback changed difficulty, pacing and the visibility of key objects. Portal's sterile look reportedly came from testers struggling to spot puzzle elements in cluttered rooms. — [Game Developer: Best of GDC, the secrets of Portal's success](https://www.gamedeveloper.com/pc/best-of-gdc-the-secrets-of-i-portal-i-s-huge-success) (via search summary; the visual-clarity claim is secondary)

**Puzzle anatomy (Game Maker's Toolkit and others)**
- GMTK's "What Makes a Good Puzzle?" is summarised as covering assumptions, catches and revelations. The catch is where two apparently incompatible ideas collide and the solver must reconcile them. — [hamatti notes: puzzle game design](https://notes.hamatti.org/gaming/puzzle-game-design); [GMTK video on Amara](https://amara.org/v/C3BEg/) (secondary summary)
- Designer intent does not decide what a red herring is: anything irrelevant that regularly lures players into treating it as a puzzle is one. Players expect the most eye-catching objects to matter. — [Room Escape Artist: Red herrings](https://roomescapeartist.com/2019/02/10/red-herrings/)

### Inferences
- Chezz should copy Into the Breach and Desktop Dungeons puzzle mode: everything visible, outcomes previewable and deterministic, small authored boards, and a puzzle that has "the one solution". Chezz's existing invariants (pure deterministic `exile.ts`, a single HP snapshot, playback that never changes the outcome) already support this.
- Simultaneous orders mean hidden enemy intent would turn puzzles into guessing games. For puzzles, either telegraph enemy orders (Into the Breach style) or require the key to win against every enemy reply (chess-problem style). Pick one per experiment and say which.
- Build each level from one interaction (Teikari) or one "catch" (GMTK). Candidate Chezz catches: a "simultaneous trade" where both units hit from snapshot HP; a piece moving out of a line as another moves in; walls blocking sliders but not knights; a lethal hit that only works because damage uses starting HP.
- Undo and instant restart are what make no-text teaching workable (Stephen's Sausage Roll). Every Chezz experiment should have them.
- Prototype puzzles before engine work (Draknek with PuzzleScript; Portal on whiteboards). For Chezz that means paper boards or a minimal solver harness on top of `exile.ts`.
- Visual clarity is a puzzle feature (Portal). Remove decorative elements that could be read as rules, because those become red herrings.

### Gaps
- No first-hand Subset Games, Lavelle, Hazelden, Teikari talk transcript was retrieved; GDC Vault content is paywalled. Snakebird (Noumenon Games) designer statements not found. Slay the Spire encounter-design statements were not researched (low relevance).
- No primary source found for Hoplite's level-generation algorithm.

## 3. Difficulty curves and onboarding: introduce, develop, twist, combine

### Takeaway
Nintendo's Koichi Hayashida describes levels as: introduce one core concept, develop it, twist it so it is used in a new way, then conclude. That four-beat (kishōtenketsu) structure, applied per mechanic and per world, plus Witness-style "teaching puzzles" that unlock nothing, is the best-supported way to introduce one idea at a time.

### Cited Findings
- Hayashida said each level should start by presenting a concept, let players develop their skills, then add a third step that "throws them for a loop, and makes them think of using it in a way they haven't really before". Deciding on a core concept is "really important". — [Nintendo Life summarising Hayashida's Gamasutra interview](https://www.nintendolife.com/news/2012/04/super_mario_3d_land_director_shares_level_design_inspirations); [Game Developer: The secret to Mario level design](https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design)
- He directed Super Mario Galaxy 2, Super Mario 3D Land and Super Mario 3D World (with Kenta Motokura). — [Wikipedia: Koichi Hayashida](https://en.wikipedia.org/wiki/Koichi_Hayashida)
- GMTK (as reported by MCV) describes the four-part structure (introduction, development, twist, conclusion) as Kishōtenketsu, citing Hayashida. The coverage centres on 3D World. — [MCV: Nintendo's level design secrets in four steps](https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps)
- 3D Land levels are each dedicated to one gimmick: 2-2 folding panels, 2-4 reverse platforms, 3-4 falling blocks. — [wnhub analysis](https://wnhub.io/news/game-design/item-11856) (secondary analysis)
- Baba Is You's early levels explain the concept thoroughly, then the game lets go of the player's hand. — [Intel Game Access: Baba Is You](https://game.info.intel.com/gaming-access/baba-is-you-a-puzzle-game-about-words-and-rules-is-nothing-short-of-magical) (via search summary)
- Portal: one key aspect of a mechanic per chamber, plus "checklisting" its components. Testers felt they were "in a tutorial rather than the real game", which led to changes about a year in. — [Game Informer](https://gameinformer.com/b/features/archive/2010/03/17/thinking-with-portals-making-a-test-chamber); [Game Developer: Best of GDC](https://www.gamedeveloper.com/pc/best-of-gdc-the-secrets-of-i-portal-i-s-huge-success)
- Witness puzzles that teach a concept for later, and Blow's aim of moving players "from not understanding to understanding" — see section 2 sources.

### Inferences
- Proposed Chezz curve, one new idea per short run of 3–5 puzzles:
  1. Introduce: a board where the new idea is the only way to win, with nothing else to do (1–2 enemy pieces, few or no walls). Making the obvious alternative fail is what teaches.
  2. Develop: the same idea with a small change of geometry or HP, so the player must recognise it instead of repeating the inputs.
  3. Twist: the idea used backwards (e.g., the snapshot-HP rule now protects the enemy, or a wall now helps the enemy slider).
  4. Combine/conclude: pair it with one previously learned idea. Never two new ideas at once.
- Element budget (inference, no source gives a number): introductory puzzles should have roughly 2–4 total units and only the walls needed. Grow by about one unit or one rule per step. Prefer the 4×4 board for introductions and enlarge only when the idea needs space.
- Candidate idea sequence for Chezz (ordering is inference): piece movement → attack = destination square → HP and taking two hits → simultaneous resolution (both hit) → snapshot HP (a dying unit still hits) → dodge by moving out of a line → walls block sliders, knights jump → blocking/body-guarding → forks (one move threatens two) → baiting the enemy into a square.
- Let failure teach. With undo/restart and a clear outcome readout, a failed attempt shows the rule. That replaces text, as in Stephen's Sausage Roll and The Witness.

### Gaps
- No empirical source found on how many new elements per level is optimal; the budget above is a heuristic.
- No direct Hayashida quote in Japanese/English using "kishōtenketsu" for 3D Land was retrieved (the label is attached to 3D World coverage).

## 4. Procedural / solver-assisted puzzle generation and difficulty measurement

### Takeaway
The research standard is generate-and-test (or search-based) generation with a solver as the test: generate candidate boards, solve them exhaustively, and keep only those meeting crisp constraints (solvable, unique key, no shortcut that bypasses the intended concept). Then rank survivors by difficulty proxies such as solution length, tries and search effort, ideally calibrated against human solve times.

### Cited Findings
- Togelius et al. (IEEE TCIAIG 2011) define search-based PCG as a special case of generate-and-test. Generate-and-test discards candidates that fail a test (e.g., "is there a path from entrance to exit?") and regenerates. SBPCG uses a graded fitness instead of pass/fail and mutates earlier candidates. — [Togelius et al., Search-based PCG: A Taxonomy and Survey (PDF)](https://course.ccs.neu.edu/cs5150f13/readings/togelius_sbpcg.pdf); [UCL GP bibliography entry](https://gpbib.cs.ucl.ac.uk/gp-html/Togelius_2011_TCIAIG.html)
- Their taxonomy classifies generators by what content they produce, how it is represented, and how quality/fitness is evaluated. — [Togelius et al.](https://course.ccs.neu.edu/cs5150f13/readings/togelius_sbpcg.pdf)
- Smith and Mateas (IEEE TCIAIG 2011) propose describing the design space explicitly as an answer set program (ASP) and generating with a domain-independent solver. — [Smith & Mateas, ASP for PCG (PDF)](https://course.ccs.neu.edu/cs5150f14/readings/smith_asp4pcg.pdf)
- Smith, Andersen, Mateas and Popović built level tools for the educational puzzle game Refraction. Common generator techniques "lack a way to specify crisp (yes/no) constraints" on validity. Constraint-based generation gave reliable control, even over emergent style properties. — [Answer set level design for Refraction (PDF)](https://homes.cs.washington.edu/~zoran/answer-set-level-design.pdf)
- A 2013 follow-up gave "quality of puzzle" guarantees in Refraction: it rules out puzzles that can be solved by a shortcut bypassing the target concept. It applies to any domain where you can write down what a broken or shortcut solution means for a puzzle-and-solution pair. — [Smith et al. 2013, UW GRAIL (PDF)](https://grail.cs.washington.edu/wp-content/uploads/2015/08/smith2013qop.pdf); [Game Developer: The Saturday Paper, Goldilocks and the three puzzles](https://www.gamedeveloper.com/business/the-saturday-paper-goldilocks-and-the-three-puzzles) (via search summary)
- Open source: infinite-refraction generator tools on GitHub (GPLv3). — [edbutler/infinite-refraction](https://github.com/edbutler/infinite-refraction)
- Compton, Smith and Mateas ("Anza Island") used the off-the-shelf Clingo ASP solver to model gameplay constraints in a prototype. — [PCG workshop 2012 (PDF)](https://pcgworkshop.com/archive/compton2012island.pdf)
- The PCG book chapter by Nelson and Smith covers ASP for content generation, including mazes. — [PCG Book ch. 8 (PDF)](https://www.pcgbook.com/chapter08.pdf)
- Taylor and Parberry (GAMEON-NA 2011) generate Sokoban levels that are guaranteed solvable. Pipeline (secondary description): build an empty room, place goals (brute-force all goal placements), search for the "farthest" state from the goals, and score candidates. — [Parberry Sokoban generator](https://ianparberry.com/research/sokoban/); [LARC-2011-01 tech report (PDF)](https://ianparberry.com/techreports/LARC-2011-01.pdf); pipeline per [Literature Review of PCG (U. Malta)](https://um.edu.mt/library/oar/bitstream/123456789/82026/1/Literature_Review_of_Procedural_Content_Generation_in_2015.pdf)
- Kartal, Sohre and Guy (AIIDE) ran a user study to find cheap features correlated with perceived difficulty. They combined them into an evaluation function for MCTS puzzle generation and guarantee solvability by simulated play. — [AAAI AIIDE paper (PDF)](https://ojs.aaai.org/index.php/AIIDE/article/download/12859/12706/16375)
- Bento, Pereira and Lelis (IJCAI 2019) propose hardness metrics based on pattern-database heuristics, motivated by metrics known to correlate with human solve time. Their generator produced initial states that a specialised solver found harder than expert-designed ones. — [arXiv 1907.02548](https://arxiv.org/pdf/1907.02548)
- Nelson argues game artifacts themselves are a source of metrics without players (e.g., analysing the state space). — [Nelson, Game Metrics Without Players (AIIDE 2011)](https://ojs.aaai.org/index.php/AIIDE/article/view/12479)

### Inferences
- Chezz pipeline (inference, built on the sources above):
  1. Represent: board size, wall cells, player pieces with type and HP, enemy pieces with type, HP and either a telegraphed order or "free" (adversarial), turn limit N.
  2. Generate: random or constraint-seeded (e.g., require the target concept: "the winning line must include a hit by a unit that dies this turn").
  3. Solve: exhaustive minimax over simultaneous order sets using the pure `exile.ts` resolver. On 4×4–6×6 with ≤4 units per side and N ≤ 3, this is likely tractable with memoisation. Simultaneous moves make each ply a matrix game, so "forced win" means a player order set that wins against every enemy order set.
  4. Hard filters (crisp yes/no, Refraction-style): solvable within N; exactly one winning turn-1 order set (no cook); no win in fewer turns; the concept is necessary (remove or disable it and the puzzle becomes unsolvable, which is the shortcut check); every piece and wall is necessary (economy check).
  5. Soft metrics (rank, then calibrate on humans): solution length N; branching factor (legal player order sets per turn); number of tries (turn-1 order sets that survive most enemy replies or fall one HP short); how many attractive or "greedy" moves lose (e.g., the capture-first move fails); solver nodes expanded; how deep the refutation of the best try is.
- Pin a solver test for every handcrafted puzzle too. That matches the repo rule that rule changes are test-first in `tests/exile.test.ts`: puzzles can become regression fixtures that break loudly if a rule change cooks them.
- A full ASP/Clingo pipeline is probably overkill for boards this small. A TypeScript brute-force search reusing the real resolver avoids rule drift between game and solver. That matters because CLAUDE.md requires `exile.ts` to stay the single source of truth.

### Gaps
- Taylor & Parberry's exact difficulty formula was not retrieved. Kartal et al.'s specific features were not retrieved.
- No published work found on puzzle generation for simultaneous-move tactics games specifically. Hoplite's generation method was not found.
- The tractability estimate for exhaustive search is an inference, not measured.

## 5. Playtesting tiny experiments: what to measure, paper prototypes and Wizard-of-Oz

### Takeaway
Watch people play rather than collecting written reports (Valve), use think-aloud with a facilitator acting as "the computer" for paper prototypes, and test with about five people per iteration. For puzzles, combine observed metrics (time to solve, wrong attempts, whether the player can explain why the outcome happened) with solver-side metrics, and treat confusion about rules as a bug, separate from intended difficulty.

### Cited Findings
- Kim Swift: playtesting was "probably the most important thing we did on Portal". Watch people play instead of relying on written reports. Erik Wolpaw described Valve's culture as "Playtest, playtest, playtest." — [Game Developer: Kim Swift lessons](https://gamedeveloper.com/design/10-years-of-design-lessons-from-em-portal-em-s-kim-swift); [Destructoid: Wolpaw at NYU Game Center](https://vip-develop.destructoid.com/?p=105268) (via search summary)
- Paper prototype roles: players, a "computer"/facilitator who simulates the system without revealing what it is "thinking", and observers who take the notes. — [MIT CMS.611 paper prototyping handout (PDF)](https://ocw.mit.edu/courses/cms-611j-creating-video-games-fall-2014/348ee58d265e61e4760d196bd97b1ad1_MITCMS_611JF14_Paper_Prot.pdf)
- A human simulating the backend gives a prototype "high-fidelity in depth at little cost". — [Berkeley i198: Paper prototyping and Wizard of Oz (PDF)](https://blogs.ischool.berkeley.edu/i198-uip-s13/files/2013/01/Paperprototyping_WizofOz_chandrayeebasu.pdf)
- Ask testers to think aloud. Roles: "computer", interviewer, note-taker. About five testers is often enough. — [UWaterloo CS449 Lecture 10 (PDF)](https://student.cs.uwaterloo.ca/~cs449/s17/Lecture%2010%20slides.pdf)
- Think-aloud plus video recording shows reasoning and struggle. — [Loud and Interactive Paper Prototyping (arXiv 1807.07662)](https://arxiv.org/pdf/1807.07662)
- Valve builds a playable rough level in 2–5 days. Playtests drove changes to difficulty, pacing and how visible key objects are. — [Game Informer](https://gameinformer.com/b/features/archive/2010/03/17/thinking-with-portals-making-a-test-chamber); [Game Developer: Best of GDC](https://www.gamedeveloper.com/pc/best-of-gdc-the-secrets-of-i-portal-i-s-huge-success)
- Puzzle difficulty metrics in research are calibrated against human solve time. — [Bento et al. 2019](https://arxiv.org/pdf/1907.02548); [Kartal et al.](https://ojs.aaai.org/index.php/AIIDE/article/download/12859/12706/16375)

### Inferences
- Per-puzzle measures for Chezz experiments: time to first submit; time to solve; number of wrong submissions and resets; the first move tried (did they fall for the intended try?); whether they can predict an outcome before playback (ask "what will happen?", then compare); and a post-solve explanation ("why did that work?"). If they cannot explain the win, the rule was not learned.
- Separate two failure types. Rule confusion (the player is surprised by resolution, e.g., the snapshot-HP trade) means fix the presentation or the curve. Search difficulty (the player understood but missed the key) is the intended challenge.
- Wizard-of-Oz for Chezz: print the board; the tester writes all orders at once; a facilitator resolves them with the rules doc (or runs `exile.ts` hidden from the tester) and announces the outcome. This tests simultaneous-order puzzles before any UI work.
- Log the same metrics in-app (attempt count, time, first order set) so later browser playtests stay comparable with paper ones.

**Checklist: designing and validating one small Chezz puzzle**
1. Idea: write the single concept (the "catch") in one sentence. If it needs "and", split it into two puzzles.
2. Prerequisites: list the previously taught ideas it relies on. At most one new idea.
3. Draft on the smallest board that works (start at 4×4). Use the fewest units, walls and HP that still express the idea.
4. Decide the enemy model: telegraphed fixed orders, or adversarial (must win against every reply). Show telegraphs on screen.
5. Make the obvious move fail. Include at least one attractive try (e.g., a greedy capture) that loses in a way that shows the rule.
6. Solver check: solvable within N turns; no win in fewer than N; exactly one winning turn-1 order set (no cook); note duals on later turns.
7. Concept check: disable or alter the target rule/element and confirm the puzzle becomes unsolvable, so the idea cannot be bypassed.
8. Economy check: remove each unit and wall in turn. Each removal should break the solution or uniqueness, otherwise delete that element.
9. Clarity check: nothing decorative that reads as a rule (red herrings only on purpose). Outcome preview and playback show why the result happened.
10. Undo/restart is instant. Failures resolve quickly and readably.
11. Record solver metrics: N, branching, number of tries, nodes searched.
12. Paper/Wizard-of-Oz test with 3–5 people: record time, wrong attempts, first move tried, and whether they can explain the win.
13. Classify failures as rule confusion (fix teaching) or search difficulty (fine). Revise and re-run steps 6–8 after every edit.
14. Commit the puzzle as a regression test (solver asserts the unique key) so later rule changes cannot silently cook it.
15. Place it in the curve: introduce → develop → twist → combine. Check that the next puzzle adds at most one element.

### Gaps
- Fullerton's *Game Design Workshop* and Schell's *The Art of Game Design* / Koster's *A Theory of Fun* were not retrieved; no citable passages from them are included.
- No source found on target solve-time bands or acceptable wrong-attempt counts for puzzle games; thresholds must be set from Chezz's own playtest data.
