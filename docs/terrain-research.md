# Deploy-phase terrain: research and prototype notes

Nov 8 2026. The idea: make the deploy phase strategic. After seeing the enemy's setup and
terrain, the player lays floor tiles from a small per-level kit. First tiles: ice
(slide, nobody stops on it) and sludge (slows). Rules as built: `docs/turn-based.md`.

## What the research says

**Placement stays interesting when** (a) the budget is scarce, so you can't cover
everything; (b) effects depend on direction and piece type, so the best square changes
with the enemy layout; (c) tiles can backfire on you; (d) some uncertainty remains about
what happens later. With open information and a fixed enemy, (d) has to come from the
enemy's later choices.

- **Open vs hidden setup.** Stratego's secret setup is about bluffing
  ([DeepNash, arXiv 2206.15378](https://arxiv.org/pdf/2206.15378)), and TFT players fake a
  setup and change it at the last second ([Mobalytics](https://mobalytics.gg/blog/tft/tft-how-to-adapt-positioning/)).
  Chezz shows everything, so deploy is a puzzle, not a mind game. Lean into that.
- **Counter-placement.** Mechabellum deploys after seeing the opponent's last board, so
  the right answer depends on their specific layout
  ([finalboss.io](https://finalboss.io/mechabellum-beginner-guide-to-unit-roles-deployment-and),
  [PC Gamer](https://www.pcgamer.com/i-cant-stop-playing-this-autobattling-strategy-masterpiece)).
- **Combos beat single tiles.** Orcs Must Die traps shine at chokepoints and in combos
  (launch into grinder) ([GamingBolt](https://gamingbolt.com/orcs-must-die-deathtrap-review-rogue-lite-orc-estry)).
  For Chezz: ice lanes that feed pieces into a spear rank.
- **The environment as a weapon.** Into the Breach and Hoplite are deterministic,
  telegraph the enemy, and make the environment your weapon
  ([Electron Dance on Hoplite](https://www.electrondance.com/hoplite/),
  [GDC Vault, Into the Breach](https://gdcvault.com/play/1025772/-Into-the-Breach-Design)).
  Into the Breach's tile interactions also produced a long list of "unintuitive oddities"
  ([r/IntoTheBreach](https://www.reddit.com/r/IntoTheBreach/comments/wecm78/list_of_unintuitive_oddities_please_contribute/)),
  so avoid tiles that transform each other.
- **Ice precedents.** In Pokémon, you slide until blocked or until you reach different
  ground ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Ice_tile)). In
  [Ice Chess](https://zacharymorris.itch.io/ice-chess), every moved piece slides on in its
  move direction, there are no captures mid-slide, and **knights don't slide**.
- **Slow ground.** Advance Wars and Fire Emblem use movement costs
  ([AW wiki](https://advancewars.fandom.com/wiki/Terrain), [FE wiki](https://fireemblemwiki.org/wiki/Terrain)).
  Costs don't map onto chess shapes, so "the move ends here" and "one square at most"
  read better. In chess variants, [Sceptre 1027 A.D.](https://chessvariants.org/multiplayer.dir/sceptre1027.html)
  moves rooks one square in ruins, and [Terrain Chess](https://chessvariants.com/diffmove.dir/terrain_chess.html)
  slows or bans pieces in swamps.
- **Piece identity.** Terrain should change where a move ends, never the move's shape.
  Keep one shared rule plus at most one knight exception
  ([Chess 2](https://en.wikipedia.org/wiki/Chess_2:_The_Sequel): "regular chess, except these two things").

## What the prototype does with it

| Question | Built | Why |
|---|---|---|
| Ice slide blocked | The move isn't allowed | Keeps "nobody stands on ice" (Wesley's rule). Ice Chess stops before the blocker instead. |
| Knight onto ice | Can't land there | A leap has no single direction (Ice Chess). |
| Slider over ice | Crosses it, stops only beyond it | Only where a move ends matters. |
| Sludge | Ends any slide; a slider starting in it moves one square | Stop rules beat movement costs. |
| Where you lay tiles | Empty floor, not a start or switch, not on or next to an enemy | No sniping the back line. |
| Kit size | Per level (`kit`), 0–9 each | Research suggests 1–3, scaled by board size. |
| Does the enemy react? | Its intent re-plans from the tiles you lay | Deterministic; the AI uses the same move rules. |

## Open questions for playtest

1. Too strong or too weak? Count how often a laid tile decides the battle.
2. Should laying be limited to your own half? The no-adjacent rule is looser than the
   research's suggestion of your own half plus the neutral middle.
3. Sludge v2: stuck for one turn (any piece, needs a status), or knights can't leave?
4. Preview the whole slide path (dots along the ice), not just the landing square.
5. Should the enemy get a kit (scripted counter-placement)?

## More tile ideas (from the research)

- **Rubble:** blocks sliders and stopping; knights jump it.
- **Spring (directional):** a piece ending here is pushed one square along the arrow.
- **Bramble:** a piece entering takes 1 damage.
- **Watchtower:** +1 strike reach while standing here.
- **Pit:** can't be entered, but strikes pass over it.
