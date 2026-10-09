# Game Theory and Design Theory of Simultaneous-Move Tactics, Applied to Chezz

Scope: theory to guide Chezz's simultaneous-resolution rules (secret orders: move, attack, defend in place, pawn diagonal hold/ambush; all resolve at once; attacks on a target that leaves miss), with a payoff-matrix comparison of "Always trade" vs "Free hits".

Source note: several primary sites (sirlin.net, keithburgun.net, forums.sirlingames.com, chessvariants.com) failed DNS from this environment and web.archive.org was blocked. Claims about them come from search-result extracts of those pages, not full reads. They are cited to the original URLs and should be spot-checked. The Chezz rules referenced are from `docs/exile-run.md` in this repo.

## 1. Normal-form theory: mixed equilibria, dominance, why RPS feels random, and what makes guessing interesting

### Takeaway
A simultaneous turn is a normal-form game. If one option dominates, the turn is "solved" and there is no real decision. If payoffs are symmetric like pure rock-paper-scissors, the equilibrium is a uniform random mix and the turn feels like a coin flip. Guessing becomes interesting when the payoffs are **unequal** (so the mix is skewed and people's tendencies show) and **unclear but learnable** (so the skill lies in valuing positions, not in computing odds). Sirlin calls these "unequal payoffs" and "valuation", and calls reading the opponent "yomi".

### Cited Findings
- Sirlin: a simple rock-paper-scissors system of direct counters "is a perfectly solid and legitimate basis for a strategy game provided that the rock, paper, and scissors offer unequal risk/rewards. Better still is if those rewards are unclear, meaning that players cannot easily determine the exact values of the rewards." — [Sirlin, Rock, Paper, Scissors in Strategy Games](http://sirlingames.squarespace.com/articles/rock-paper-scissors-in-strategy-games.html)
- Sirlin's $10/$3/$1 example: with unequal payoffs the optimal play is still "a mixed strategy, meaning that it involves randomly choosing your moves, but obeying certain percentages." In Designing Yomi he says you "can't do better than randomly choosing… in a 10:3:1 ratio", but "it's still a lot better than equal payoffs because at least human nature starts to come into play." — [Sirlin, Designing Yomi](https://www.sirlin.net/articles/designing-yomi)
- Sirlin's second "secret sauce" is unclear payoffs. They shift play "from computing a fixed randomization to actually understanding the relative value of the pieces and how they change over time" (valuation). Yomi was built so its exact payoffs can't be calculated, yet it stays simple to play. — [Sirlin, Designing Yomi](https://www.sirlin.net/articles/designing-yomi)
- Yomi layers: once unequal payoffs and valuation are present, "you can start predicting your opponent even in turn based situations." — [Sirlin, Yomi Layer 3](http://sirlingames.squarespace.com/articles/yomi-layer-3-knowing-the-mind-of-the-opponent.html)
- A Yomi community game-theory guide treats each exchange as double-blind RPS where every option has an accessible counter. It notes that hidden hands make payoffs (combo damage, knockdowns, extra cards) hard to pin down, so "valuation" is a separate skill. — [Game theory fundamentals of YOMI (Sirlin Games forum)](https://forums.sirlingames.com/t/strategy-guide-game-theory-fundamentals-of-yomi/650)
- Counterpoint from a reader: what should be unclear is the mental exchange between players, not which option beats which. Players should know the counter-relations; the uncertainty belongs in the read. — [freestepdodge forum on RPS in Dead or Alive](https://www.freestepdodge.com/threads/rock-paper-scissors-rps-in-dead-or-alive.266/)
- Formal point: payoff structure moves the equilibrium. In closest-guess games the two-player version has a pure saddle point (always guess 1/2). With three players the optimal play becomes a mix (uniform on [1/4, 3/4]). — [Guessing Games, arXiv 1401.2493](https://arxiv.org/pdf/1401.2493)
- Engine-search view: in simultaneous-move games "players may need to mix between their strategies". Plain UCT gives exploitable strategies. Regret matching and online outcome sampling approach Nash equilibrium in Goofspiel. — [Lanctot, Lisý, Winands 2013, MCTS in Simultaneous Move Games with Applications to Goofspiel](https://cris.maastrichtuniversity.nl/en/publications/monte-carlo-tree-search-in-simultaneous-move-games-with-applicati/)

### Inferences
- An **information set** in Chezz is "the board as of the start of the turn". Both players decide from the same set, so each turn is one matrix game embedded in a larger game. Every rule should be judged by the matrix it produces on a typical turn. The questions are whether it has a dominant row (solved, boring), a uniform mix (coin flip), or a skewed mix with real stakes (yomi).
- Sirlin's recipe maps onto Chezz directly. The counter-relations (attack beats idle, move-away beats attack, pawn hold beats move-into-diagonal) should be **clear**. The payoffs should be **unequal and state-dependent** (HP, lethality, the king's value, follow-up position), so a good read is rewarded more than a lucky one.

### Gaps
- I could not read Sirlin's full articles directly (DNS failure), so the quotes come from search extracts.

## 2. Design writing on when simultaneous turns feel deep vs random

### Takeaway
Burgun argues that noise between a choice and its result ("output randomness") undermines strategy, while information revealed before the choice ("input randomness") is fine, and that the two sit on a spectrum. An opponent's hidden simultaneous order behaves like output randomness unless the player can infer it from readable state. Costikyan lists "player unpredictability" as a legitimate source of uncertainty, alongside randomness and analytic complexity. The design goal is to make the uncertainty about the opponent's *mind* and keep it out of the *rules*.

### Cited Findings
- Burgun: "noise injected between a player's choice and the result (here referred to as output randomness) does not belong in a strategy game". Input randomness (information shown before deciding) is far less problematic. — [Burgun, Randomness and Game Design (Game Developer)](https://gamedeveloper.com/design/randomness-and-game-design)
- Burgun: input and output randomness "are not binary qualities, but rather exist on a spectrum". A smaller fog-of-war radius moves the uncertainty toward output randomness. — [Burgun, Randomness and Game Design](https://gamedeveloper.com/design/randomness-and-game-design); see also [Burgun, Three types of bad randomness, and one good one](https://keithburgun.net/three-types-of-bad-randomness-and-one-good-one/) (not fetched)
- Another writer recasts the distinction as a single scale of "Information Delay". — [Visited by RNGesus, critpoints.net](https://critpoints.net/2017/01/16/visited-by-rngesus/)
- Costikyan's *Uncertainty in Games* (MIT Press 2013) lists sources of uncertainty: performative, solver's, player unpredictability, randomness, analytic complexity, hidden information and others. He argues uncertainty is necessary to hold interest. — [Liz England review](https://lizengland.com/blog/review-uncertainty-in-games-by-greg-costikyan/); [Jesper Juul on the book](https://www.jesperjuul.net/ludologist/2013/05/30/greg-costikyan-uncertainty-in-games/)
- Engelstein and Shalev's *Building Blocks of Tabletop Game Design* has a dedicated mechanism entry, "Simultaneous Action Selection" (TRN-09 in the first edition). I found only the table of contents, not the text. — [vdoc.pub listing](https://vdoc.pub/documents/building-blocks-of-tabletop-game-design-an-encyclopedia-of-mechanisms-5l211bfv7ge0); [review](https://bumblingthroughdungeons.com/building-blocks-tabletop-game-design-book-review/)
- Hansmann, designer of a synchronous chess variant, said earlier synchronous variants "either lack structure, enhance a passive playing strategy, or amount to a pure gamble". These are exactly the failure modes Chezz must avoid. — [Simultaneous Chess, chessvariants.com](https://chessvariants.com/rules/simultaneous-chess) (via search extract)
- Soren Johnson's Designer Notes ep. 92 interviews Paul Kilduff-Taylor about why Frozen Synapse uses simultaneous turns. No transcript was found. — [Designer Notes 92](https://www.podbean.com/ew/dir-xt5ug-29d82f8b)

### Inferences
- In Chezz the opponent's secret order is the only uncertainty, because resolution is deterministic. That is good, provided the player could have *reasoned about* the order. If an outcome depends on an unseeable, unreasonable enemy choice, it reads as output randomness (Burgun). If it depends on a read the player could have made ("the 1-HP pawn was obviously going to flee"), it reads as yomi.
- A test the team can apply after any surprising result: can the player name the enemy order that beat them, and say why that order was plausible from the starting board? This matches the existing playtest prompt "can you explain each hit without the log?"

### Gaps
- I could not find primary text for Koster (*Theory of Fun*), Rosewater, or Engelstein's TRN-09 entry on simultaneous selection. I found no Soren Johnson essay specifically on simultaneous turns.

## 3. Resolution rule design: collisions, contested squares, priority, bounces, phase order

### Takeaway
Simultaneous systems need an explicit, order-independent rule for conflicts. The main families are: bounce/standoff, where equal forces leave nothing moving (Diplomacy); strength comparison with support; restricting moves so conflicts can't arise (Uppsala synchronous chess); priority or initiative tokens; and a random tiebreak (bad: it is output randomness). Diplomacy's experience shows the cost: any rule that makes one unit's success depend on another simultaneous event risks paradoxes and illegibility.

### Cited Findings
- Diplomacy: all moves are simultaneous and the order of reading is irrelevant. Equal forces into the same space produce a "standoff"/"bounce" where neither moves. Support adds strength. An attack on a supporting unit cuts its support, except for the support aimed at the attacker's own province. — [Wikibooks Diplomacy/Rules](https://en.wikibooks.org/wiki/Diplomacy/Rules); [Renegade quick-start rules](https://renegadegamestudios.com/content/File%20Storage%20for%20site/Rulebooks/Diplomacy/DiplomacyRGS_QuickStartRules_lo.pdf)
- Players can deliberately bounce their own units to hold a space (self-standoff), so bounce rules create defensive tactics of their own. — [Wikibooks Diplomacy/Rules](https://en.wikibooks.org/wiki/Diplomacy/Rules)
- "Any rule in Diplomacy that makes the success of one unit's actions contingent on the success of some other event during the same season will kill simultaneity and introduce room for paradox". The convoy paradox has no consistent adjudication without extra precedence rules. — [diplom.org paradox essay](https://diplom.org/Zine/S1997M/Schwarz/Paradox.html); [Kruijswijk, The Math of Adjudication](https://diplom.org/Zine/S2009M/Kruijswijk/DipMath_Chp5.htm)
- Uppsala Synchronous Chess avoids most collisions by allowing a move only to a square you "control" (attacked by strictly more of your pieces than the opponent's). It wins by "freezing" the king, i.e. attacking it with two pieces. — [Synchronous chess, Uppsala](https://user.it.uu.se/~joachim/PSC)
- Kaufman's Simultaneous Randomized Chess: if both moves execute without conflict they both execute. If only one ordering works, that order is used. Otherwise one move is discarded at random. — [jefftk.com](https://jefftk.com/p/simultaneous-randomized-chess)
- Hutnik's Simultaneous Chess uses an initiative token to settle conflicts. It suggests a two-phase reveal: first which piece moves, then its destination. Hansmann's variant adds an intermediate phase for "exchanging blows" on the two destination squares. Hobbyist "bounce back" proposals return colliding pieces to their start squares and freeze them. — [chessvariants.com Simultaneous Chess](https://chessvariants.com/rules/simultaneous-chess) (search extract)
- Frozen Synapse (WeGo): both players plan and "Prime", then 5 seconds resolve simultaneously. There are no HP bars. Fights resolve by cover, stance, stillness and aim, and "a unit that is moving is less likely to win against a stationary one". Players can issue hypothetical orders to enemy units to preview their plans. — [Giant Bomb, Frozen Synapse](https://giantbomb.com/wiki/Games/Frozen_Synapse); [Broken Lines dev diary](https://www.moddb.com/news/broken-lines-developer-diary-1-gameplay-overview)

### Inferences
- Chezz already has the cleanest base. One HP snapshot, destination-only collisions (no path interception), and a target vacating only if it actually leaves are all order-independent, so they avoid Diplomacy-style paradoxes. Keep the rule "no outcome depends on another order's success" as an invariant. Note that "a target vacates only if its move succeeds" is already a one-level dependency, so watch for chains (A moves into B's square, B moves into C's, C is blocked) and keep them resolvable by one fixed-point rule.
- Avoid Kaufman-style random discards. They are pure output randomness.
- Frozen Synapse's "stationary beats moving" is a priority rule that rewards holding ground. It is the same incentive as Free hits (idle pieces are vulnerable) but inverted. Chezz needs to pick which posture the rules favor, on purpose.
- A move-then-attack phase order, where moves resolve first and attacks then hit whoever is in the target square, would turn "attack the square" into a zone-control tool. Chezz's current rule is attack-the-piece, which misses if the piece leaves. That is closer to yomi (you must predict whether it stays), while square-targeting is closer to area denial (the pawn hold already does this). Having both, piece attacks plus pawn square-holds, is a good RPS triangle: the attack beats a piece that stays, a move beats the attack, and a hold beats the move into the held diagonal.

### Gaps
- I found no rigorous comparative study of resolution-rule legibility. The evidence is designer and community experience.

## 4. Information design: telegraphing intent vs hidden intent

### Takeaway
There is a spectrum. At one end, Into the Breach shows exact enemy intent, which turns combat into a deterministic perfect-information puzzle. At the other, fully hidden double-blind orders (Frozen Synapse, Diplomacy) give pure reading. Middle grounds turn hidden orders into partially known ones. Show threat zones (every square a piece *could* hit), reveal some units' intent, use staged reveals (Hutnik's piece-then-destination), or let a player see in advance which unit an opponent commits.

### Cited Findings
- Subset Games: fully telegraphed enemies and deterministic attacks make Into the Breach a puzzle. Forcing adaptation over one-tactic play was a top priority, and difficulty is largely a numbers problem ("a single extra enemy" can swing a fight). — [Road to the IGF: Subset Games (Game Developer)](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)
- Commentators: Into the Breach shows the result of each action before commitment, which makes it closer to chess than to XCOM's hidden enemies. It also gives undo and a once-per-mission reset. — [Prototypr UX analysis](https://blog.prototypr.io/into-the-breachs-ux-makes-you-feel-smart-a9cb03210757); [Into the Spine](https://intothespine.com/2019/05/06/into-the-breach-and-imperfection/)
- Hutnik's two-phase reveal (piece first, then destination) is a documented staged-information middle ground. — [chessvariants.com Simultaneous Chess](https://chessvariants.com/rules/simultaneous-chess)
- Frozen Synapse lets players script hypothetical enemy orders to test their own plan. This is a tool for reasoning about the information set without revealing it. — [Giant Bomb](https://giantbomb.com/wiki/Games/Frozen_Synapse)
- Burgun's spectrum: the further ahead information arrives, the more it behaves like input (good) rather than output randomness. — [Burgun](https://gamedeveloper.com/design/randomness-and-game-design)

### Inferences
- Chezz's AI is deterministic and chooses from the starting board without seeing the player's queue (`docs/exile-run.md`). A deterministic AI is learnable: once players learn it, every turn is effectively telegraphed and the game becomes an Into-the-Breach puzzle with hidden but predictable intent. That is fine for a single-player roguelite, but then the *display* should match. Either telegraph honestly (show intents) or add controlled variety the player can read, such as AI "temperaments" per enemy.
- Practical middle grounds for Chezz, ordered from most to least revealing:
  1. Exact intents for some enemies (e.g. pawns telegraph, officers hidden).
  2. Intent *category* shown ("will attack", "will hold", "will move") with the target hidden.
  3. Threat-zone overlays that show every square each enemy could strike or hold. This is the minimum for legibility.
  4. Fully hidden.
- Options 2 and 3 keep a yomi layer while removing "I didn't know that was possible". Threat zones also make the pawn diagonal hold readable as a known risk rather than a surprise.

### Gaps
- I found no academic study measuring player-perceived fairness across intent-disclosure levels.

## 5. Avoiding dominant strategies; payoff matrices for Always trade vs Free hits

### Takeaway
In a simple one-on-one model, both combat rules collapse to a **pure** (non-guessing) equilibrium when HP is equal. Always trade makes everyone passive: nobody attacks, because equal trades are a wash and idling elsewhere is worth more. Free hits makes everyone aggressive: mutual attack is dominant, because standing idle is heavily punished. Real mixing (guessing with stakes) appears only when HP is **asymmetric**. Under Always trade, Defend is dominated in the modeled cases (absorbing 1 is too weak). Under Free hits, Defend becomes part of the stronger side's mix. Neither rule alone produces yomi. The depth comes from HP asymmetry, a meaningful "elsewhere" alternative, and a defend option worth choosing.

### Cited Findings
- Hansmann's diagnosis of failed synchronous chess variants ("enhance a passive playing strategy, or amount to a pure gamble") names the two collapse modes this model reproduces. — [chessvariants.com](https://chessvariants.com/rules/simultaneous-chess)
- Chezz rules as modeled: damage equals the attacker's current HP, and every hit uses starting HP. **Always trade**: every attack exchanges HP, and Defend absorbs 1 and retaliates. **Free hits**: an idle target takes damage with no return, while Defend, reciprocal attacks and contested destinations exchange. An attack on a target that moves away misses. — `docs/exile-run.md` (this repo)
- Sirlin: guessing is interesting only when payoffs are unequal. With equal payoffs it is pure guessing. — [Sirlin, Designing Yomi](https://www.sirlin.net/articles/designing-yomi)

### Original analysis (my computation, not from a source)
**Model.** Two adjacent pieces X (row) and Y (column). Each secretly chooses:
- **Attack** the other.
- **Defend** in place.
- **Move** away to a safe square.
- **Else**: stay put and do something useful elsewhere, worth v = 1 (e.g. attack a third piece).

The payoff to X is: damage dealt − damage taken (capped at HP) + K = 2 for a kill − K if killed + v if X chose Else − v if Y chose Else. The game is zero-sum. Equilibria were found by regret matching (40k iterations). The script is in the session scratchpad and is easy to recreate.

Assumption: under Free hits, Defend gives a full exchange with no absorb, because the rules doc lists defenders as "exchange HP" without the absorb. If Free-hits Defend also absorbs 1, it gets stronger.

**Equal HP (3 v 3):**

| Always trade | Atk | Def | Move | Else |
|---|---|---|---|---|
| Atk | 0 | −3 | 0 | −1 |
| Def | 3 | 0 | 0 | −1 |
| Move | 0 | 0 | 0 | −1 |
| Else | 1 | 1 | 1 | 0 |

Equilibrium: both play **Else** (pure). Nobody attacks, which is the passive collapse. With v = 0, both play Defend instead: still pure and still passive.

| Free hits | Atk | Def | Move | Else |
|---|---|---|---|---|
| Atk | 0 | 0 | 0 | 4 |
| Def | 0 | 0 | 0 | −1 |
| Move | 0 | 0 | 0 | −1 |
| Else | −4 | 1 | 1 | 0 |

Equilibrium: both play **Attack** (pure, for v = 0, 1 and 2). This is the aggressive collapse: mutual destruction of equal pieces.

**Unequal HP (X 3 v Y 2), v = 1:**
- Always trade: X mixes Attack 50% / Else 50%. Y mixes Move 50% / Else 50%. Value +0.5 to X. **Defend is never played.** For X, Else weakly dominates Defend (row 3,1,1,0 vs 3,0,0,−1).
- Free hits: X mixes Attack 26% / **Defend 24%** / Else 50%. Y mixes Attack 25% / Move 75%. Value +0.5 to X. The weaker side never idles, because idling is punished. The stronger side uses Defend to bait the weaker side's desperation attack.
- With v = 0, both rules give a pure outcome (X attacks, Y flees). With v = 2, Always trade is nearly pure (Y always plays Else, X attacks 10%). Free hits stays richly mixed: X 50/50 Attack/Else, Y 25/50/25 Attack/Move/Else, value +1.0.

**Weak vs strong (X 1 or 2 HP v Y 3):** mirror images. The weak piece mixes Move with Else (Always trade) or Move with occasional Attack (Free hits).

### Inferences
- **Always trade suppresses attacking.** When damage is symmetric and HP equal, an attack only ever converts your HP into theirs one-for-one, and Defend's 1-point absorb is too small to matter. Expect play to collapse into turtling or "do something elsewhere", with attacks happening only when HP clearly favors you. That is also when the defender simply flees, since the attack misses anyway. It is readable but low-yomi: the stronger piece attacks, the weaker piece runs.
- **Free hits rewards initiative** and punishes being idle, so the game has a tempo pulse. Defend gains a real role as the counter to an expected attack, which gives an actual RPS triangle: Attack beats Else, Defend and Move beat Attack, Else beats Defend and Move. That triangle appears in the matrix above: Atk→Else +4, Else→Def/Move +1, Def/Move→Atk 0. Its weakness is that equal-HP standoffs resolve as mutual attack (pure), which reads as "trade everything".
- Things that move either rule toward Sirlin's "unequal but readable" sweet spot:
  1. Make Defend worth something positive against an attack (e.g. absorb more, or a counter that deals bonus damage, or makes the attacker "stuck"). In Free hits that turns Atk-vs-Def from 0 into a loss for the attacker, which completes the triangle.
  2. Ensure a real "Else" alternative exists most turns. The value v is what makes not attacking a choice rather than a default.
  3. Keep HP asymmetry common, since current HP doubles as attack strength. The doc already flags this.
  4. Give Move a cost, such as a positional or tempo cost, or a pawn diagonal hold covering the escape square, so fleeing is not a free answer to every attack. The pawn hold is exactly a counter to Move, and Chezz should lean on it.
- **Recommendation.** Free hits produces the more strategically interesting matrix because idleness has a cost and Defend matters. Always trade is simpler to read and to explain. A hybrid fits the model best: Free hits on idle targets, plus a Defend that wins outright against a lone attacker (e.g. defender takes 0 or −1 and returns full damage). That makes the cycle strict and removes the pure mutual-attack collapse. Validate with playtest telemetry: log the order distribution per turn type and look for one option above roughly 70% (a dominance warning).

### Gaps
- The model is one-on-one and single-turn. It ignores multi-piece support, board position, kill-bonus calibration and the deterministic-AI context. The parameters v and K are arbitrary, so the qualitative patterns matter more than the exact percentages. I found no published payoff analysis of trade vs free-hit rules specifically.

## 6. Academic work on simultaneous-move chess-like games and search

### Takeaway
Simultaneous-move games are a studied class. Each node is a matrix game, and search must compute mixed strategies, using regret matching, Exp3, outcome sampling, or backward induction with an LP at each node. Goofspiel and Tron are the standard benchmarks. Chess-like simultaneous variants exist only as hobbyist designs, and they mostly struggle with collision rules and passivity.

### Cited Findings
- Lanctot, Lisý & Winands (2013): MCTS adapted to simultaneous-move games. Online outcome sampling converges toward Nash. In Goofspiel, regret matching and OOS perform best, and all variants are less exploitable than UCT. Published in CCIS vol. 408, pp. 28–43, DOI 10.1007/978-3-319-05428-5_3. — [Maastricht CRIS record](https://cris.maastrichtuniversity.nl/en/publications/monte-carlo-tree-search-in-simultaneous-move-games-with-applicati/); [IJCAI CGW listing](https://mlanthology.org/ijcai/2013/lanctot2013ijcai-monte)
- Lisý, Kovařík, Lanctot & Bošanský (NIPS 2013): a general MCTS template for simultaneous-move games. If the selection method is ε-Hannan consistent (e.g. regret matching, Exp3) with sufficient exploration, MCTS converges to an approximate Nash equilibrium. — [arXiv 1310.8613](https://arxiv.org/abs/1310.8613v1); [NeurIPS proceedings](https://proceedings.neurips.cc/paper/2013/hash/1579779b98ce9edb98dd85606f2c119d-Abstract.html)
- Hobbyist simultaneous chess variants (Uppsala Synchronous Chess, Kaufman's Simultaneous Randomized Chess, Hutnik's and Hansmann's Simultaneous Chess) differ mainly in how they handle collisions. — [Uppsala](https://user.it.uu.se/~joachim/PSC); [jefftk](https://jefftk.com/p/simultaneous-randomized-chess); [chessvariants.com](https://chessvariants.com/rules/simultaneous-chess)

### Inferences
- If Chezz ever wants a stronger or less exploitable AI, the established route is a per-node matrix solve (regret matching over the joint order set) rather than minimax. A useful side effect is that the AI's mixed strategies would themselves show which options are dominated. That makes the AI a balance-testing tool for the rules as well as an opponent.
- For a deterministic single-player AI (the current design), the research suggests accepting the puzzle framing and telegraphing at least partially (Section 4).

### Gaps
- I did not retrieve specific Tron or Goofspiel equilibrium results beyond the abstracts, and found no academic paper on synchronous chess. I found no "synchronized chess" literature beyond hobbyist pages.
