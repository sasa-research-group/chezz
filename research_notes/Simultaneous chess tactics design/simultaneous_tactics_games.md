# Simultaneous-turn and intent-telegraphing tactics games: design precedents for Chezz

Method note (2026-10-09): direct page fetches (WebFetch and curl) were blocked by the container proxy (DNS failures and 403s), so these notes rely on search-engine result summaries of the cited pages, not full readings of them. Treat quoted phrasing as near-verbatim snippets. Anything I couldn't tie to a source is in Gaps. Most source pages don't show a date in the snippets; where one appeared, it's noted.

## 1. How each game resolves simultaneous orders (collisions, swaps, priority, intent visibility, determinism)

### Takeaway
The closest precedents fall into three families. (a) True simultaneous resolution with symmetric "bounce" rules: Diplomacy, synchronous chess. Equal-strength contests bounce, swaps fail, and support or strength breaks ties. (b) Simultaneous planning with sequential execution by a fixed priority: Robo Rally's antenna, Mechs vs Minions' left-to-right. Readable, but plans collide in chaotic ways. (c) Deterministic continuous-time simulation: Frozen Synapse, Laser Squad Nemesis, Combat Mission. Outcomes follow fixed rules such as stillness beats moving and aim or cover advantage. Into the Breach and Hoplite are the main intent-telegraphing references. They are not simultaneous: the enemy's next action is shown in advance, combat is deterministic, and randomness is limited to level generation.

### Cited Findings

**Diplomacy (Calhamer, 1959; revised rulebook 1971)**
- Orders are written secretly and revealed together. "The simultaneous movement is one of the most distinctive features of the game." — [Wikipedia: Diplomacy](https://en.wikipedia.org/wiki/Diplomacy_(game))
- No chance devices: "no dice to roll, no pointers to spin, no cards to shuffle". Outcomes are "basically determined by the total strength of the units involved." — [Wikipedia: Diplomacy](https://en.wikipedia.org/wiki/Diplomacy_(game)); [U.S. Intellectual History Blog, 2013](https://s-usih.org/2013/03/allan-calhamer-1931-2013-diplomacy-and-the-intellectual-history-of-boardgames/)
- Contested square: units of equal strength moving into the same province "bounce" back to their origin. Players use this deliberately, ordering two of their own units into one province to create a standoff that blocks it. — [diplom.org Library of Tactics](https://diplom.org/Zine/W1995A/Tactics/section1.htm); [Ewok Diplomacy: Advanced Maneuvers](https://ewokdiplomacy.substack.com/p/advanced-diplomacy-maneuvers)
- Swaps: units ordered into each other's provinces cannot switch places, except by convoy. — [The Alexandrian rules PDF](https://www.thealexandrian.net/creations/diplomacy/diplomacy-alexander-rules.pdf); [Renegade quick-start rules](https://renegadegamestudios.com/content/File%20Storage%20for%20site/Rulebooks/Diplomacy/DiplomacyRGS_QuickStartRules_lo.pdf)
- Support is "cut" if a unit from an adjacent province attacks the supporting unit, except by the unit that the support is aimed against. A stronger supported attack dislodges the weaker unit, which must retreat to an empty province that wasn't the attack's source or the site of a bounce. — [diplom.org Library of Tactics](https://diplom.org/Zine/W1995A/Tactics/section1.htm)
- Edge cases in the rules have needed formal revisions and long debate. The 1971 rulebook was written by a committee working with Calhamer and added rules such as XII.5 ("A Convoyed Attack Does Not Protect the Convoying Fleets"). diplom.org articles still debate rulebook contradictions such as the "beleaguered garrison". — [diplom.org: 1971 Rulebook](https://diplom.org/~diparch/resources/postal/1971_rulebook.htm); [diplom.org: Rulebook Contradiction](https://diplom.org/~diparch/resources/strategy/articles/rulebook.htm)
- What you know of the opponent's intent: nothing mechanical. Tension comes from negotiation, because "players can never be entirely confident their human ally-opponents have acted as anticipated." — [SAGE encyclopedia entry via search](https://sk.sagepub.com/ency/edvol/embed/play/chpt/diplomacy)

**Robo Rally (board game; Wizards 2017 edition, Hasbro 2023 edition)**
- Programming is simultaneous. Each player draws 9 cards, picks 5, and places them face down in 5 ordered registers, on a 30-second sand timer. — [Dized rules: programming phase](https://rules.dized.com/game/-35QGfadQpKOT0xvvgNZnQ/_JLhzYwfRk2UB2WUXvv84A/2-the-programming-phase); [Official Robo Rally Rules](https://officialgamerules.org/game-rules/robo-rally)
- Execution is sequential, one register at a time, in priority order. The robot closest to the priority antenna acts first. Ties are broken by an imaginary beam sweeping clockwise from the antenna. After all robots finish a register, board elements (conveyors, gears) move and every robot fires its laser. Then the next register starts. — [Wizards 2017 rulebook PDF](https://media.wizards.com/2017/rules/roborally_rules.pdf); [The Glass Meeple: Robo Rally Reboot](https://theglassmeeple.com/robo-rally-reboot/)
- Robots push, shoot and block each other, which knocks other players' plans off course. — [Tabletop Gaming review, 2024-02-07](https://tabletopgaming.co.uk/reviews/roborally-review)
- Opponent intent: hidden until each register is revealed. The game is deterministic once the cards are down; randomness comes only from the card draw.

**Mechs vs Minions (Riot, 2016)**
- Each player drafts cards into a command line of slots, then runs them left to right. Card placement fixes the execution order, and a card stacked on a slot can force a different action, such as a rotation instead of a move. This is cooperative against scripted minions, not hidden-information PvP. — [Wikipedia: Mechs vs. Minions](https://en.wikipedia.org/wiki/Mechs_vs._Minions); [Shut Up & Sit Down review](https://www.shutupandsitdown.com/review-mechs-vs-minions)

**Frozen Synapse (Mode 7, 2011) and Frozen Synapse 2 (2018)**
- Each turn, you queue orders for every surviving unit and can preview them. You can even "give orders to enemy units to simulate what [you] think may happen." After both sides "prime", a 5-second turn plays out, and orders can't be changed once primed. — [Giant Bomb: Frozen Synapse](https://www.giantbomb.com/games/3030-26505/)
- Combat principles, in rough order of importance: cover, stance changes, stillness (a moving unit tends to lose to a stationary one), and aiming. Units have no life bars; "if an attacking unit has enough time to get off a killing shot it will." — [Giant Bomb: Frozen Synapse](https://www.giantbomb.com/games/3030-26505/)
- Players describe the combat as having "nothing really randomized," so the same orders give the same result. This is a forum claim; I found no official statement. — [Penny Arcade forum thread](https://forums.penny-arcade.com/discussion/120977/frozen-synapse-rookies-get-brainfreeze-bitches-get-deadfreeze); [Arcen forums: "like Chess with Guns"](https://forums.arcengames.com/off-topic/frozen-synapse-it-s-like-chess-with-guns/)
- Units can be told to wait in small increments, for example 0.3 s. Timing is the main tool for outguessing the opponent. — [PlayStation Country (Vita version)](https://www.playstationcountry.com/?p=5087)
- Opponent intent: hidden, but the board state is fully visible and you can plan against hypothetical enemy moves in the sandbox.

**Laser Squad Nemesis (Codo Technologies / Julian Gollop, 2003)**
- Both players submit orders, which are resolved simultaneously on a central server. The result plays back as a 10-second real-time video with pause, slow motion and rewind. Orders include stance and reaction settings (halt, retreat or continue when an enemy is spotted) and direct, terrain or opportunity fire. — [Wikipedia: Laser Squad Nemesis](https://en.wikipedia.org/wiki/Laser_Squad_Nemesis); [MobyGames](https://www.mobygames.com/game/19122)
- Gollop's earlier Laser Squad (1988) and Rebelstar series were sequential action-point games. The simultaneous model is specific to Nemesis. — [Wikipedia: Laser Squad Nemesis](https://en.wikipedia.org/wiki/Laser_Squad_Nemesis)

**Combat Mission (Battlefront; CMx1 2000 onward, CMx2 2007 onward)**
- The same engine runs both modes. In WeGo mode it stops every 60 seconds for orders. You plan 60 seconds of combat, and the replay can be viewed from any angle. — [Battlefront forum: RT vs WeGo](https://community.battlefront.com/topic/88843-rt-and-wego-same-secnario-different-experiences/); [Steam: CM Shock Force 2](https://store.steampowered.com/app/1369370)
- During execution, units act under "TacAI", so the player cedes moment-to-moment control. Combat Mission includes probabilistic hit and damage modelling, so it is not deterministic. That is general knowledge of the series; the snippets didn't state it explicitly. — [Steam discussion quoting Wargamer](https://steamcommunity.com/app/1369370/discussions/0/2946998508810164701)

**Into the Breach (Subset Games, 2018). Intent telegraphing, not simultaneous**
- Enemies (Vek) show their intended attack before it happens, which makes each turn a puzzle. You are "given all the information as to what is going to happen once your turn is over" and decide how to change that outcome. — [Game Developer: Road to the IGF, Into the Breach](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-); [Nintendo Life review](https://nintendolife.com/reviews/switch-eshop/into_the_breach)
- No fog of war, and attacks have no hit or miss percentages. — [PC Gamer preview](https://pcgamer.com/into-the-breach-preview)
- The order in which enemies act is visible through a timeline: hover the top-right icon or hold Alt. — [Steam community discussion](https://steamcommunity.com/app/590380/discussions/0/3461597549837414830)
- Interactions that leave the telegraphed attack intact: pushing a Vek into another unit causes "bump" damage, and armor and acid don't apply to bumps. Standing on a rumbling spawn tile blocks the spawn, at the cost of damage to the blocking mech. Body-blocking enemy shots with your mechs is a core defense. — [KosGames beginner guide](https://kosgames.com/into-the-breach-beginners-guide-advice-2021-5557/)
- The game's tension also comes from protecting something besides your units. Dodging a hit can mean a building takes it instead. — [Game Developer: Road to the IGF](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)

**Hoplite (Magma Fortress, 2013; began as a 7DRL entry)**
- Turn-based and deterministic, on tiny one-screen hex levels. When you move, "enemies respond in a predictable pattern", and tapping an enemy shows its range. — [TouchArcade review, 2014-01-08](https://toucharcade.com/2014/01/08/hoplite-review/); [Pocket Gamer review](https://www.pocketgamer.com/hoplite/review/)
- Attacks come from movement, not bumping. A stab happens when you move adjacent to an enemy. A lunge happens when you move directly toward an enemy with a spear. Throwing the spear costs you the weapon until you pick it up again. — [IndieRPGs: Old release, Hoplite (2014)](https://indierpgs.com/2014/12/old-release-hoplite/)
- Randomness is limited to board generation and upgrade (altar) choices. Combat rules are fixed. — [IndieRPGs](https://indierpgs.com/2014/12/old-release-hoplite/); [Giant Bomb](https://giantbomb.com/hoplite/3030-45184/)
- Reviewers repeatedly describe it as "somewhere between chess and a dungeon crawler." — [Pocket Gamer review](https://www.pocketgamer.com/hoplite/review/)

**Captain Sonar (2016)**
- Has turn-by-turn and simultaneous modes. In simultaneous play the whole table acts in real time, but the game stops briefly when a captain fires so that the hit can be resolved cleanly. — [Breakout Con library](https://breakoutcon.com/boardgame-library/captain-sonar); [Miami U. tabletop write-up, 2018-04](https://sites.miamioh.edu/tabletop/2018/04/captain-sonar/)

**Neptune's Pride (Iron Helmet, 2010)**
- Runs on a continuous real-time clock over weeks. The 2013 follow-up, Neptune's Pride 2: Triton, added turn-based matches. — [Wikipedia: Neptune's Pride](https://en.wikipedia.org/wiki/Neptune%27s_Pride); [Softpedia: Triton adds turn-based matches](https://games.softpedia.com/blog/Neptune-s-Pride-Triton-Introduces-Turn-Based-Matches-More-Strategy-Options-347436.shtml)

### Inferences
- For a discrete grid with secret simultaneous orders, Diplomacy's rules are the most tested template for contested squares: equal contests bounce, swaps fail, and the stronger side wins. They have also needed decades of edge-case rulings. Chezz should write down its full conflict table, covering same-square entry, swaps, attacking a square someone is leaving, and chained moves, and test every row.
- The Robo Rally model (simultaneous planning, sequential execution by a visible priority) is easier to read and to code than true simultaneity. The cost is that collisions feel arbitrary unless players know the priority rule ahead of time.
- The Into the Breach and Hoplite pattern fits Chezz's existing "one HP snapshot, deterministic" rule: show the enemy's intent, keep resolution deterministic, and put randomness in board generation and drafts.
- A middle option between the two models: show part of the enemy's intent, such as which pieces will act or which squares are threatened, while hiding the exact move. Hutnik's suggestion to reveal the piece first and the destination second (Section 4) is a chess-specific version of this.

### Gaps
- Frozen Synapse's exact tick and reaction-time values, and whether resolution is formally deterministic. I found only forum claims.
- Gladiabots' resolution order and collision rules: no source found.
- Into the Breach's exact enemy sequence (whether a Vek pushed after telegraphing attacks from its new tile, with the same direction): no primary source in the snippets. My understanding is that the attack moves with the Vek and keeps its direction relative to it, but that is unverified.
- Robo Rally's exact push-blocking rules weren't retrieved.
- Highfleet, Dominions, Twilight Imperium and Atomicrops weren't researched. They looked less relevant and were deprioritized under the tool budget.

## 2. What designers said about legibility, randomness vs. outguessing, and pacing

### Takeaway
The designer sources I found point the same way. Subset deliberately moved from FTL's reliance on chance to "more deterministic" moment-to-moment play. Telegraphing turned turns into puzzles and also sped up pacing. Mode 7 framed simultaneous turns as a way to get depth, fast games and "meaningful choices every turn". Sirlin's Yomi shows that simultaneous guessing feels random at first, and becomes readable only when payoffs are unequal and depend on the situation.

### Cited Findings
- Matthew Davis (Subset): "there's often a heavy reliance on random chance and FTL was really reliant on it too. Part of our vision for Into the Breach is a push to be more deterministic in the moment-to-moment gameplay." — [PC Gamer preview (2017)](https://pcgamer.com/into-the-breach-preview)
- Justin Ma (Subset): traditional tactics AI tries to simulate an opponent using the same tactics as you. Subset wanted enemies that would be fun "regardless of the AI", so the Vek are simple and announce their attacks. — [PC Gamer preview](https://pcgamer.com/into-the-breach-preview)
- Telegraphing the Vek's moves also sped up play, alongside the short turn limit per battle. — [Wikipedia: Into the Breach](https://en.wikipedia.org/wiki/Into_the_Breach)
- Davis's GDC 2019 talk, "'Into the Breach' Design Postmortem", covers cutting features, borrowing mechanics from other games, choosing difficulty, and "How much RNG should you use?". The recording is members-only on GDC Vault, and no transcript was available. — [GDC Vault](https://gdcvault.com/play/1025772/-Into-the-Breach-Design); [GDC news](https://www.gdconf.com/news/get-inside-look-making-breach-gdc-2019)
- Ian Hardingham (Mode 7) wanted a deep tactical game that changes every match, moves quickly and gives meaningful choices each turn. He called simultaneous-turn play "a fantastic genre that is criminally under-used." — [IndieDB weekly interview](https://www.indiedb.com/features/weekly-interview-frozen-synapse)
- Paul Taylor (Mode 7, 2010): Frozen Synapse pairs two randomly selected squads and rewards "mental agility" and reacting to the opponent over memorization. The team started from squad tactics and cut what was tedious. — [Bit-tech interview (2010)](https://bit-tech.net/reviews/gaming/pc/frozen-synapse-interview/1/)
- Frozen Synapse began as "Psych-Off", a simultaneous turn-based project that put tactics ahead of strategy and took about four years to become the shipped game. — [Game Developer postmortem](https://www.gamedeveloper.com/audio/postmortem-mode-7-games-i-frozen-synapse-i-)
- Paul Kilduff-Taylor discussed the simultaneous-turn choice on Soren Johnson's Designer Notes podcast, episode 92 (2025). The content wasn't retrieved. — [Designer Notes #92](https://www.designer-notes.com/designer-notes-92-paul-kilduff-taylor/)
- David Sirlin (Yomi): the game tests "Valuation" (judging how the value of moves changes) and "Yomi" (reading the opponent). A reviewer: "While it first seems 'just random,' you soon discover that the unequal and uncertain payoffs in this guessing game allow you really read what the opponent will do." — [Wikipedia: Yomi](https://en.wikipedia.org/wiki/Yomi_(card_game)); [Spielbound](https://www.spielbound.org/node/3924)
- Hardingham's definition of WeGo: each turn, both sides' orders run together and then the results are shown. Generally, WeGo means no input during execution and planning happens at the same time for everyone, "so there is little wait." — [IndieDB interview](https://www.indiedb.com/features/weekly-interview-frozen-synapse); [Giant Bomb: WeGo concept](https://giantbomb.com/wiki/Concepts/WeGo/Images)

### Inferences
- Simultaneous orders will only feel like outguessing, not coin flips, if each option has a different, readable payoff depending on the situation. A dominant safe move or a symmetric rock-paper-scissors would make the reveal feel random.
- Into the Breach's lesson for a single-player roguelike: when the AI is simple, show what it will do and let the puzzle provide the depth. With fully hidden simultaneous AI orders, players can't tell whether they lost to a read or to a coin flip.
- Subset found that telegraphing shortened turns. Showing at least some enemy intent should therefore also help with analysis paralysis.

### Gaps
- No transcript of Subset's GDC talk, and no direct Calhamer quote on why he left out dice. His 1974 Games & Puzzles essay would be the primary source.
- No direct Gollop statement on why Nemesis uses simultaneous turns.
- The text of the Frozen Synapse postmortem's "what went wrong" section wasn't retrieved because of fetch failures.

## 3. Common player complaints about simultaneous-turn games

### Takeaway
Recurring complaints: outcomes that feel like unexpected failure after committing (Frozen Synapse 2), too much fiddly planning or a "frustrating UI", long waits in asynchronous play, the wish to "see the effects of my actions immediately", and loss of control while orders execute (Combat Mission). The replay is often the best-loved part when it can be paused, rewound and viewed from any angle.

### Cited Findings
- Frozen Synapse 2: "Unexpected failure, and occasionally unexpected success is Frozen Synapse 2's bread and butter." The review's cons include "Frustrating UI" and city strategy with "a lot of idling". — [Trusted Reviews: Frozen Synapse 2](https://trustedreviews.com/reviews/frozen-synapse-2)
- Frozen Synapse Prime: a unit set to wait for the enemy still got shot. Campaign missions "can sometimes be more frustrating than fun", and asynchronous play meant waiting "ten hours between turn 1 and turn 2." — [Gamecritics: Frozen Synapse Prime review](https://gamecritics.com/brad-gallaway/frozen-synapse-prime-review/)
- Original Frozen Synapse: "the fiddling about was just a bit too much unless you had the time to really play the game and learn all the tactical nuances." — [TouchArcade](https://toucharcade.com/?p=178244)
- Counterpoint: Pocket Gamer counts the replay system as a strength, since replays show your one successful attempt alongside your many failures. — [Pocket Gamer: Frozen Synapse Prime](https://www.pocketgamer.com/frozen-synapse-prime/review/)
- WeGo vs. immediate turn-based: "I prefer TTBC to WEGO, because I want to see the effects of my actions immediately." In large battles, the number of orders to give per turn overwhelms players. — [Sorcerer King / Stardock forums: "A better combat system: WE-GO"](https://forums.sorcererking.com/383074/a-better-combat-system-we-go)
- Combat Mission WeGo fans call the replay "the most 'fun' part" and value the extra planning. Real-time fans want to "make decisions on the fly rather than committing a full minute". Some see the 60-second commitment as handing control to the TacAI. — [Steam CMSF2 discussion](https://steamcommunity.com/app/1369370/discussions/0/2946998508810164701); [Battlefront forum](https://community.battlefront.com/topic/82655-multiplayer-real-time-or-wego/)
- The designer tested Combat Mission in real time while many players use WeGo, so "the experience, and thus expectation, of the designer can be [different] from the player." — [Battlefront forum](https://community.battlefront.com/topic/88843-rt-and-wego-same-secnario-different-experiences/)
- Captain Sonar's simultaneous mode: "difficult to find a strategy that worked well the first time" because a role had "no idea where the other team was." — [Miami U. tabletop write-up, 2018](https://sites.miamioh.edu/tabletop/2018/04/captain-sonar/)
- Ralf Hansmann (synchronous chess): earlier synchronous variants "either lack structure, or enhance a passive playing strategy, or represent a pure gamble." — [Synchronous Chess page, Uppsala University (via search)](https://user.it.uu.se/~joachim/PSC)

### Inferences
- Chezz's playback can't change outcomes (CLAUDE.md invariant), but it must explain them. Step-by-step playback with pause and rewind that labels why each conflict resolved the way it did addresses the "unexpected failure" complaint directly.
- Keep turns small. Small boards and few pieces avoid the "too many orders per turn" overload. Chezz's small boards are an advantage here.
- Look out for a passive dominant strategy: waiting or defending when the opponent's move is unknown. Hansmann names this as a known failure of synchronous chess.

### Gaps
- No systematic Steam review mining or Reddit thread analysis was possible. Fetches were blocked, and search snippets cover mostly professional reviews and forum posts.

## 4. Existing games that combine simultaneous or real-time turns with chess pieces

### Takeaway
Several attempts exist, and each needed a dedicated conflict rule. Kung-Fu Chess (real time, "first mover wins", knights can't collide) won the IGF 2002 Audience Choice award, closed around 2007–2008, and has fan revivals. Simultaneous Randomized Chess runs both moves if they don't interact, uses the only order that works if there is one, and otherwise discards one move at random. Hutnik's Simultaneous Chess uses an initiative token. Hansmann's Synchronous Chess avoids conflicts by allowing moves only to squares you control. Name clash: a mobile game called "Chezz: Play Fast Chess" by Appside already exists, a Kung-Fu Chess derivative with an upgrade-based adventure mode.

### Cited Findings
- Kung-Fu Chess (Shizmoo Games; Dan and Joshua Goldstein; about 2001): no turns, any piece can move at any time with a per-piece cooldown (10 s recharge at 1 square/s in standard mode; 2 s at 5 squares/s in Lightning). There are no check or pin rules, and the game ends when a king is captured. It won the 2002 IGF Audience Choice award, was added to ICQ in 2005, and shut down in 2008 (Wikipedia) or around 2007 (kungfuchess.org FAQ). The Wikipedia origin details are flagged "citation needed". — [Wikipedia: Kung-Fu Chess](https://en.wikipedia.org/wiki/Kung-Fu_Chess); [kungfuchess.org FAQ](https://kungfuchess.org/faq)
- Kung-Fu Chess collisions: when enemy pieces collide, the piece that moved first captures the other and keeps going. For friendly collisions, the official FAQ says the piece closer to the shared square goes first and the other resumes after it passes. The "about" page instead says the piece moving into an occupied square stops, and that the original site let pieces pass through each other. Knights can't collide. These sources contradict each other on friendly collisions. — [kungfuchess.org FAQ](https://kungfuchess.org/faq); [kungfuchess.org about](https://kungfuchess.org/about); [Chess Wiki](https://chess.fandom.com/wiki/Kung_Fu_Chess)
- Revivals: kungfuchess.org (fan remake), a Kung Fu Chess mode in Chess Kingdom by Pinch Games, and Petter Strandmark's open-source "Real-time Chess" (GPL-3.0). — [Wikipedia](https://en.wikipedia.org/wiki/Kung-Fu_Chess); [Gamespress: Chess Kingdom](https://www.gamespress.com/Packed-With-Content-Chess-Kingdom-Adds-Kung-Fu-Chess-and-Kung-Fu-Chess); [AlternativeTo: Real-time Chess](https://alternativeto.net/software/real-time-chess/about)
- "Chezz: Play Fast Chess" (Appside SRL, mobile, freemium) is based on Kung-Fu Chess. It has a single-player adventure mode with hundreds of levels, traps, a "King protect" mode, board setups that change per level, and upgrades that make queens, knights and the army "move faster and farther." — [Wikipedia: Kung-Fu Chess](https://en.wikipedia.org/wiki/Kung-Fu_Chess); [TouchArcade listing](https://toucharcade.com/games/chezz-play-fast-chess); [AlternativeTo: Chezz](https://alternativeto.net/software/chezz/about)
- Simultaneous Randomized Chess (Jeff Kaufman and David): both players secretly pick a move. If the moves don't interfere, both execute. If they work in only one order, that order is used. Otherwise one is discarded at random. You may pick a move that only becomes legal after some opponent move, and if it turns out illegal, it doesn't happen. You can't choose a move that leaves your own king in check. A king can be captured. En passant must be attempted simultaneously. Any clock only runs during move selection. The authors say they iterated until it "seems balanced". — [jefftk.com](https://www.jefftk.com/p/simultaneous-randomized-chess); [LessWrong](https://www.lesswrong.com/posts/c3vZFt4qbaHqbhTDp/simultaneous-randomized-chess)
- Hutnik's Simultaneous Chess (Chess Variant Pages): modelled on simultaneous Connect Four. Both players secretly choose moves, reveal them together, and an initiative token breaks conflicts. The author suggests a refinement: reveal the piece to be moved first, then the destination. — [chessvariants.com: Simultaneous Chess](https://chessvariants.com/rules/simultaneous-chess)
- Hansmann's Synchronous Chess: both moves execute together, and a player may move only to a square they "control", meaning attacked by strictly more of their pieces than the opponent's. This rules out most conflicts. Kings may end up in check. — [Synchronous Chess (Uppsala page)](https://user.it.uu.se/~joachim/PSC); [chessvariants link entry](https://www.chessvariants.org/link/SynchronousChess)
- Chess.com forum users like synchronous play because it removes the first-move advantage and makes opening memorization matter less. This is a forum opinion. — [Chess.com forum: Synchronous Chess](https://www.chess.com/forum/view/general/synchronous-chess)

### Inferences
- Every simultaneous chess design needed a tie-breaker for conflicts: timing (Kung-Fu Chess), randomness (Kaufman), initiative (Hutnik) or a legality restriction (Hansmann). Randomness clashes with Chezz's determinism invariant. Initiative and Diplomacy-style bounce rules are the deterministic options. Hansmann's "move only to squares you control" is an interesting deterministic way to avoid conflicts, but he notes it can encourage passive play.
- Chess captures are binary, so simultaneous chess faces many all-or-nothing conflicts. HP-based combat with all hits using starting HP (Chezz's snapshot rule) avoids many of them: two pieces hitting each other both land their hits instead of needing a winner. That puts Chezz closer to Frozen Synapse and Diplomacy-style strength contests than to Kung-Fu Chess.
- The existing Appside "Chezz" is close in name and concept (chess-piece adventure with upgrades). That may matter for naming or discoverability; this is not legal advice.

### Gaps
- No postmortem or player-sentiment source on why Kung-Fu Chess's original site closed, or on how well the simultaneous-chess variants played, beyond the authors' own claims.
- "Chess 2" (Ludeon, Sirlin) is a turn-based variant, not simultaneous. The search turned up nothing tying it to simultaneous play, so it was dropped.
- No sales or player-count data for Appside's Chezz (out of scope anyway).
