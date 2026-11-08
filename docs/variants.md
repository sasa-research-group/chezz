# Piece variants

Every chess kind comes in three casts, drawn on Wesley's character-select sheet: **rebels** (your
side by default), **royals** (the patrol by default) and **misfits**. A variant keeps its kind's
movement, strike reach, HP and damage unless its ability says otherwise. The rules in
`src/game/turns.ts` call ability hooks (`src/game/abilities.ts`); each ability lives in
`src/game/abilities/<variant>-<kind>.ts` with its tests in `tests/abilities/`.

Shared rules the abilities lean on:

- **Statuses** live in `unit.mods` (flat, save-friendly) and expire by `<status>Until` turn numbers
  (`src/game/status.ts`). Turn numbers tick when your pool refills, so the enemy's turn N follows
  your turn N: a status that should last through the *enemy's* next turn ends at N, one put on
  *your* piece during the enemy's turn N lasts through your turn N + 1 (`nextTurn(g, side)`).
  - *dazed*: no moves of any kind (may still strike, defend, use an alt action).
  - *hexed*: deals 1 less with every blow (min 0).
  - *burning N*: takes 1 at the start of its side's turn, ignoring defend, N turns.
- **Alt actions** replace the strike: they cost energy, mark the piece acted, may be taken after a
  move, and are refused like any move if they would leave your king in check.
- **Run-level tiles**: walls an ability raised (`run.walls`) and encounter walls knocked down
  (`run.broken`); `passable()` reads both. Holes, ice, portals and gates are planned (see Boards).
- **Order of a strike**: bodyguard redirect, splash, damage to every victim, counters from
  survivors, deaths (and death hooks), then the striker's `afterStrike`.
- **Check** (`kingThreat`) prices every enemy action through the hooks: strike cost, damage, reach,
  step-in moves, pending burn ticks.

## The cast


### Pawns

#### Pip — *Heave* (rebel pawn, `rebel-pawn.ts`)

> When Pip's pitchfork hits an enemy that survives, he shoves it one square further along the line of the strike if that square is free.

**Rules.** Trigger: Pip's strike lands (normal pawn reach: diagonal-forward neighbour; cost 2; damage 1, 0 to a defender) and the target survives. Effect: the target is displaced one square along the striker-to-target diagonal if that square is on the board, passable and empty; otherwise it stays. Displacement keeps its flags (defending stays); a shoved pawn on its far row does not promote (it did not move itself). Boards: a shove onto a hole kills (no counter), onto ice keeps sliding, onto a lever pulls it. Timing: damage, counters from where the victim stands, deaths, then the shove (the engine runs afterStrike last): a braced survivor hits back before it is pushed, and a dead Pip heaves nothing. Check: judged on the final board by intoCheck (a shove may open a line onto your own king: refused). Enemy Pip in kingThreat: hit 1, plus a shove that would drop your king into a hole counts as lethal. Promotion: normal; a promoted Pip loses Heave. AI: shove scored +50 if it lands the target in a hole, +10 if it leaves the target out of its allies' reach.

**Downside.** Still 1 damage, and the push can shove an enemy out of your other pieces' reach or onto a square it wanted.

**Puzzle hook.** Mate by heave: the Royal king has 1 HP but hides a knight's jump from everything; Pip's poke only reaches him diagonally, pushes him one square, and he lands where Dobbin's lane was open all along.

#### Sergeant Pike — *Pike* (royal pawn, `royal-pawn.ts`)

> Sergeant Pike thrusts straight ahead instead of diagonally, and reaches two squares forward when the square between is empty.

**Rules.** reaches hook: the square directly ahead, or two ahead if the middle square is passable and empty (walls, holes and shut gates block). Never diagonal. Cost 2, damage 1, moves forward 1 as usual, promotes normally (promotion replaces the ability). Defend: a braced Pike counters only strikers it reaches with the pike, so flanking him on the diagonal is safe. Check: kingThreat uses reaches, so a Pike two squares from your king with an empty square between contributes 1, and interposing a piece on that square lifts it. Tap-to-strike and approaches use pike reach. AI: lineUp prefers standing two squares off (outside your pawns' diagonals).

**Downside.** No diagonal strike at all: anything standing on his forward diagonals is untouchable, and his counter is a narrow lane.

**Puzzle hook.** Three Pikes across a row are a comb: every square two ahead of them is a spear tip, but the diagonals between the teeth are safe. Walk the king through the teeth, never the gaps, in exactly the energy you have.

#### Grumble — *Hop* (misfit pawn, `misfit-pawn.ts`)

> Grumble can hop two squares straight forward over anything (a piece, a wall, a hole) for 2 energy, but is far too grumpy to ever defend.

**Rules.** moveTargets hook: adds (x, y + 2*forward) at cost 2 when the landing square is passable and empty, whatever the middle square holds (piece of either side, wall, hole, shut gate). The plain forward step (1) stays. One move per turn, so hop 2 + strike 2 = the whole pool. Strike unchanged (diagonal forward, 1 damage). canDefend hook: false (button hidden; the AI never braces him). Promotion: a hop onto the far row promotes (yours picks; an enemy Grumble becomes a queen). Boards: landing on ice slides, on a lever pulls it, on a crumbling tile is fine (the vaulted tile is untouched). Check: enemy hops come through moveTargets, so a frog two rows out on a 4 pool is a threat; kingThreat sees it. AI: generic; crowning hops score 30.

**Downside.** Never defends, so anything that reaches him kills him, and the hop can carry him past the piece he wanted to poke.

**Puzzle hook.** The far row is behind a wall segment nothing else can cross. Grumble vaults the wall and promotes to a knight; the fresh knight's reach is the check the Royals thought was two turns away.


### Knights

#### Dobbin — *Giddy-up* (rebel knight, `rebel-knight.ts`)

> Dobbin's jump costs 1 instead of 2, but a wooden horse can't fly: for every L, one of its two elbow squares must be empty, for moves and strikes alike.

**Rules.** moveTargets and reaches hooks: a knight offset (dx, dy) is legal only if (x + dx, y) or (x, y + dy) is passable and empty (walls, holes, shut gates and pieces of either side block). Jump cost 1 (needs energy >= 1); strike cost 2, damage 2, same elbow rule; a braced Dobbin counters only strikers he reaches under the rule. Energy: jump 1 + strike 2 = 3, leaving 1 to brace another piece. Check: kingThreat and approaches use the hooked reach, so plugging an elbow removes him as an attacker: blocking is a real defence. Boards: ice does not carry him (he lands). AI: no special scoring; the cheaper cost already raises his move scores. UI: shade blocked landings.

**Downside.** Clogged lanes shut him down: pieces or walls on both elbows of every L leave him no jump and no strike, and your own pieces block him too.

**Puzzle hook.** Smother: an enemy Dobbin can reach your king through one of two Ls next turn. Exactly one square lies on an elbow of both; which pawn step plugs it without stepping onto a Pike's tip?

#### Sir Lance — *Charge* (royal knight, `royal-knight.ts`)

> Sir Lance's lance needs momentum: a strike right after his jump costs 1 and deals 3, but from a standstill it costs 2 and deals only 1.

**Rules.** strikeCost and damage hooks read u.moved: moved this turn → cost 1, damage 3 (jump 2 + charge 1 = 3, exactly an enemy pool of 3); not moved → cost 2, damage 1. Counters while defending deal 1. Knight reach unchanged. Check: kingThreat's step-in branch prices his strike at move + 1 and counts 3; the stand-still branch counts 1, so a Lance parked beside your king is a 1-damage plodder and every landing square that sees your king is the real threat. Tap-to-strike: approaches price jump + 1. AI: lineUp (jump then charge) is his favourite; a standing strike only to finish a 1-HP piece; he jumps away when no charge lane exists.

**Downside.** Deny him landing squares (occupy or wall the knight squares that see your king) and he hits for 1; every charge spends his whole pool.

**Puzzle hook.** Cat and mouse: Sir Lance is the only mate threat. Every move you make must leave no free landing square from which he reaches the king; the solution is a quiet pawn step, not a capture.

#### Nobody — *Hollow* (misfit knight, `misfit-knight.ts`)

> There's nobody inside: Nobody has only 2 HP, but when destroyed the empty suit stays standing on its square as a wall for the rest of the battle.

**Rules.** Stats: HP 2, damage 2, standard knight jump (2) and strike (2), may defend. onDeath hook (any cause: strike, counter, burn tick; a fall into a hole leaves nothing): its square joins run.walls, run-level walls that passable() reads alongside the encounter's. The wall blocks both sides: moves, slides, strikes, Pike reach, sweeps; knights and hops leap it; Brick's Demolish can smash it. Check: a strike that kills Nobody is judged with the new wall (it may block or create a line); kingThreat reads run.walls. AI: killing Nobody scores -20 if the wall would block its own slider's line to your king, +20 if it blocks yours.

**Downside.** Fragile, and the wall he leaves blocks your own lines too: killing him in the wrong square walls off your rook.

**Puzzle hook.** Sacrifice to seal the file: walk Nobody into the Warden's reach and let the sweep kill him; the suit left standing blocks the only lane to your king, and the check never comes.


### Bishops

#### Brother Ash — *Hex* (rebel bishop, `rebel-bishop.ts`)

> Instead of striking, Brother Ash fixes his glowing eyes on an enemy anywhere along a clear diagonal and hexes it: it deals 1 less damage until his next turn.

**Rules.** altAction 'hex': cost 2, counts as acted; he may move first. Target: the first piece along any of his four diagonals with no piece or wall between, any distance, if it is an enemy. Effect: mods.hexed = true, hexedUntil = nextTurn(g, target.side) (status.ts); the damage calculation subtracts 1 (min 0) from everything the target deals (strikes, counters, sweeps, charges; burn is unaffected); it covers the whole of the target's next turn and expireMods clears it when that side's following turn starts. No damage, no counter drawn; stacks with your defend (-1 each). Check: kingThreat.hit reads hexed, so a hex can lift check without touching a piece; '!' marks recompute. His adjacent peck is a normal 2-damage bishop strike. Tap: an enemy on a clear diagonal shows an eye badge (2). AI: enemy Ash hexes your highest-damage piece that could strike one of his next turn; score 15 + damage prevented.

**Downside.** No damage, a hex lasts one turn so holding it costs 2 every turn, and the eyes look only along diagonals: a piece on his file is safe.

**Puzzle hook.** Three attackers add to exactly your king's 5 HP and nothing can block or run. Hex the queen: 3 becomes 2, the sum is 4, and the check evaporates without moving a piece.

#### Bishop Lens — *Foresight* (royal bishop, `royal-bishop.ts`)

> Bishop Lens sees every blow coming: he counters any striker he could reach, even without bracing, but he never braces.

**Rules.** Counter hook in strike(): after any strike he survives, if reaches(Lens, striker) (a diagonal neighbour) the striker takes 2, exactly like a defend-counter; no -1 reduction for Lens himself. canDefend: false (no shield chip; enemyTurn never braces him). Timing: inside strike(), so a killed striker is removed before its own afterStrike. Check: strikeExposesKing already simulates counters, so a king who would die striking him is refused. Tap: the ⚔ badge warns of the counter as it does for defenders. Normal bishop otherwise (3 HP, 2 damage, diagonal slides). AI: he moves to diagonals that cover your approach squares; your attackers subtract his counter as for a defender.

**Downside.** No brace means full hits, and he only sees diagonally: strike him from a rank or file (a rook, a king's straight step) and he just blinks.

**Puzzle hook.** Who kills the bishop? Your own bishop needs two hits and dies to the second counter; your pawn dies to the first; your rook deals 3 from the side with no counter, but its lane opens only after the pawn steps. Order of operations in 4 energy.

#### Honkington — *HONK* (misfit bishop, `misfit-bishop.ts`)

> Instead of striking, Honkington honks: every enemy next to him is shoved one square straight away from him if that square is free; his peck deals only 1.

**Rules.** altAction 'honk': cost 2, counts as acted, may move first; offered when at least one enemy is on his 8 neighbours. For each adjacent enemy, in unit-id order, push it to (x + 2dx, y + 2dy) along the goose-to-enemy vector if that square is passable and empty at that moment; blocked pieces stay. Pushed pieces keep their flags except defending (dropped); a pushed pawn on its far row does not promote. Boards: a push into a hole kills, onto ice slides, onto a lever pulls it. Kings may be honked. No damage, no counter. Check: judged by intoCheck (a honk may open a line onto your king); an enemy honk deals no damage so it never makes check, though the AI uses it to set one up. damage hook: his strike deals 1. AI: honk score = 6 per piece pushed off a square it could strike from + 40 per piece pushed into a hole - 2.

**Downside.** Feeble and loud: a honk scatters the enemy you had lined up for a kill, and a 3-HP goose next to several enemies does not survive the reply.

**Puzzle hook.** Chain shove: honk the two guards apart from King Gilt and the near one off a crumbling plank; with no guard reachable, the next blow finally lands on the crown.


### Rooks

#### Brick — *Demolish* (rebel rook, `rebel-rook.ts`)

> Brick can swing the sledgehammer at an adjacent wall instead of a piece and knock it down for good.

**Rules.** altAction 'demolish': cost 2, counts as acted, may move first. Target: an orthogonally adjacent wall tile: an encounter wall, a shut gate (it becomes plain floor and never shuts again) or Nobody's suit; board edges and holes are not walls. Effect: the tile joins run.brokenWalls, which passable() consults, so turns.ts stays pure and saves replay. His strike is a normal 3-damage rook strike for 2. Check: demolition is judged by intoCheck like any action (opening a wall may expose your king: refused with the red ✕). UI: walls show a hammer badge when Brick stands beside them with 2 energy. AI: enemy Brick demolishes only when the opened square shortens its path to your king (BFS distance drops), score 15 - cost.

**Downside.** Demolishing spends the whole action and the new doorway is open for the enemy too; a rook standing in a fresh gap is a target.

**Puzzle hook.** Toll-gate: the Royal king hides behind walls no line crosses. Pick exactly which wall to break so your lane opens and the enemy sliders' lane does not, then mate through the gap.

#### The Warden — *Poleaxe Sweep* (royal rook, `royal-rook.ts`)

> The Warden's strike hits every piece on his four straight neighbours, friend or foe, for 3.

**Rules.** Strike: cost 2, must name an enemy on a straight neighbour; resolves 3 damage (-1 if the victim defends) on every unit on his four straight neighbours, both sides, simultaneously. Kills are removed together; then each surviving braced victim that reaches him counters, in board order. Friendly fire: a sweep that would kill his own king is refused for the player and never chosen by the AI. Bodyguards redirect applies to a hit on King Gilt inside the sweep. He never moves on a strike. Check: the sweep hits your king even when not the named target, so kingThreat treats every player unit on his straights as hit by one 2-cost action. Tap: the ⚔ badge previews all affected squares. AI: score = sum(enemy damage, kills +50) - 2 x friendly damage - 100 if a friend would die; move scoring -4 for a square with a friend on his straights, +6 for two or more of your pieces on them.

**Downside.** Friendly fire: with his own king or a courtier beside him he cannot swing at all.

**Puzzle hook.** The Warden guards the gate with two Pikes at his sides; he cannot swing without killing them. Park your king right in his face: he must hit his own pawns, or wait while the Haystack rolls up.

#### Haystack — *Consume* (misfit rook, `misfit-rook.ts`)

> Haystack strikes by rolling onto its target's square: if the blow kills, it eats the piece and moves like it for the next two turns.

**Rules.** Wesley's seed, as shipped in abilities.ts. Strike: rook reach (straight neighbour), cost 2, damage 3 (-1 if defending). On a kill, afterStrike moves Haystack onto the victim's square (the only strike that relocates the striker) and sets mods.absorbed = victim.kind, absorbedUntil = turn + 2. While digesting, moveTargets unions rook slides with the eaten shape at its own prices (knight leaps 2, bishop diagonals, queen all, king steps, pawn one step forward: useless, and that's the joke); strikes stay rook-shaped; a newer meal replaces the old; expireMods clears it. Riders: it cannot brace while digesting (too full), and it is hay: Wick's fire burns it one extra tick. If the target survives, Haystack stays put and a braced survivor counters as usual. The roll-on lands exactly on the victim's square and settles there (the tile it left crumbles, a lever it lands on is pulled); it neither glides nor tunnels, and it never rolls into a hole. Check: walk + consume is one move, judged on the final board; an enemy Haystack's digested shapes feed kingThreat through moveTargets. Killing a king ends the battle first. AI: kill score +15 if the landing square reaches your king next turn, +10 for eating a knight, bishop or queen.

**Downside.** The roll is forced: every kill drags it into the enemy's lines, where it cannot brace, and the stolen shape fades after two turns.

**Puzzle hook.** Eat the knight, become the knight: the Royal king hides behind a wall only a knight can cross. Kill Sir Lance on turn 1, leap the wall on turn 2, and strike on the last turn before the straw forgets how.


### Queens

#### Mother Skillet — *Clang* (rebel queen, `rebel-queen.ts`)

> Mother Skillet's frying pan hits for 2 instead of 3, but a piece that survives it is dazed and cannot move on its next turn.

**Rules.** damage hook: 2. afterStrike: if the victim survives, mods.dazed = true, dazedUntil = that side's next turn; a dazed piece's moveTargets are empty (no step, slide, jump, hop or swap; it cannot walk up to strike or promote by moving), while it may still strike, defend or use an alt action from where it stands, and it can still be shoved or carried by ice; expireMods clears it when the following turn starts. Strike cost 2, queen reach, 9 HP, braces normally. Check: kingThreat's step-in branch skips dazed enemies, so dazing the piece that would walk up to your king lifts check; dazed pieces already in reach still count; a dazed enemy king cannot step out of your threats. Counter: a dazed defender still counters. Tap: the badge shows the daze. AI: enemy Skillet dazes pieces that could reach her king next turn, +10 if the target is mobile and undazed, +15 for dazing your king when every escape would be a king move.

**Downside.** Only 2 damage, so she needs two turns for a Royal queen's one, and daze does nothing to a piece that already stands in reach.

**Puzzle hook.** Freeze the runner: an enemy pawn one step from promoting and Sir Lance one jump from charging the king. One swing dazes one piece; daze the right one and the other threat turns out to be covered already.

#### Her Wigness — *Beneath Me* (royal queen, `royal-queen.ts`)

> Pawns are beneath her notice: Her Wigness refuses to strike them, and their strikes against her deal 0.

**Rules.** Passive. attackTargets filter: pawns (any variant; promoted pawns are their new kind) are never valid targets for her strike or her defend-counter. damage hook: a pawn's strike on her always deals 0 (Heave still pushes her; Pike deals 0). Everything else is a normal queen: 3 damage, 9 HP, adjacent strike, slides. Check: unchanged (she threatens your king like any queen). Promotion: a pawn that promotes beside her is instantly fair game. Tap: pawns tapping her show a 0 badge; she shows no badge on pawns. AI: the mover treats a pawn-only blockade as a wall and routes around it instead of lining up on a pawn.

**Downside.** A single 3-gold pawn can stand in her path forever and she cannot do a thing about it, so every lane she needs can be corked.

**Puzzle hook.** Blockade: cork her three lanes with pawns so that the only square she can reach is the one Brick is waiting beside, then let her come.

#### Wick — *Candlelight* (misfit queen, `misfit-queen.ts`)

> Wick burns down, losing 1 HP at the start of each of her turns, but her strike sets the target alight: it takes 1 at the start of its next two turns, ignoring defend.

**Rules.** startTurn hook: at the start of her side's turn Wick takes 1 (at 0 she gutters out: removed, no kill credit). She cannot be healed in battle, but is relit to full for free at camp (candles are cheap). Strike: queen reach, cost 2, damage 3 (-1 if defending); any hit that deals >= 1 sets victim mods.burning = 2 (a second hit resets to 2, never stacks; Haystack gets 3). At the burning piece's side's turn start it takes 1, ignoring defend and Bodyguards, and burning -1; a 1-HP piece dies before it can act. Hex does not reduce burn. Check: kingThreat adds your king's pending tick as unavoidable damage (he takes it before he can act), so a burning king at 1 HP is in check with no attackers and no escape. Promotion: a burning pawn that promotes keeps burning. AI: enemy Wick is a timer: she strikes the highest-HP target she reaches to spread fire, prefers igniting your king (+12), never braces, and goes all-in at <= 2 HP.

**Downside.** A nine-turn fuse that starts on turn 1, fewer once hit: the wrong pick for a long siege, and she dies for nothing if you stall.

**Puzzle hook.** Wick has 2 HP left, two turns of light. Ignite the Warden (5 HP) now so the fire keeps working after she is gone: 3 now, 1, 1, and he dies the turn the candle gutters. Waste one energy and he survives her.


### Kings

#### King Redcape — *Dub* (rebel king, `rebel-king.ts`)

> Once per battle, for 2 energy, King Redcape knights an adjacent friendly pawn: it becomes Dobbin (3 HP) on the spot and kneels, unable to act this turn.

**Rules.** altAction 'dub': cost 2, counts as acted; he may move first, not after. Once per battle (run.dubbed, reset by spawn). Target: a friendly pawn on one of his 8 neighbours, moved or not. Effect: it becomes kind knight, variant rebel (so it gains Giddy-up), hp 3, moved = true, acted = true. Not a promotion (no picker; the pawn's far-row promotion is simply gone). Timing: immediate, so the new knight's reach counts at once against the enemy king (dubbing can give check) and for its counters next enemy turn. Check: judged by intoCheck (nobody changes square; only reach and HP change). Tap: select the king, tap an adjacent pawn: Dub (2). AI: an enemy Redcape dubs when the new knight reaches your king or a 3-HP piece, score 25. Economy: a 3-gold pawn becomes a 3-HP knight, which is why the cap matters.

**Downside.** Once per battle, 2 energy, and the king must walk into the front line to stand beside the pawn.

**Puzzle hook.** You need a knight's reach for the square behind the wall and you own no knight. The king walks up to Pip, draws his sword, and makes one; the new knight's reach is already check.

#### King Gilt — *Bodyguards* (royal king, `royal-king.ts`)

> A blow aimed at King Gilt lands instead on a Royal standing next to him that the striker could also reach; he himself only ever strikes for 1.

**Rules.** Redirect hook in strike(): if the victim is Gilt and a friendly unit stands on his 8 neighbours within the striker's reach from where it stands, the whole hit (damage plus riders: daze, burn, heave) goes to the guard with the most HP (ties: lowest id); the guard's own defend and counter apply as if it were the target; Gilt takes 0 and never counters for it. Burn ticks, hexes and honks are not blows and reach him directly. Consume: the redirected kill is of the guard, so Haystack rolls onto the guard's square. damage hook: he deals 1 (he doesn't fight); 5 HP, king shape, may brace. Check (if the player ever fields him): kingThreat resolves redirects inside its search: guards absorb blows and die, later blows reach him. Tap: the ⚔ badge on Gilt names the guard that would take it. AI: the mover scores +12 for ending adjacent to Gilt when he has no guard, +3 otherwise; attackers prefer squares from which they reach Gilt but no guard.

**Downside.** His guards die for him, so the AI happily feeds its own pawns, and he deals only 1: a king who cannot fight back.

**Puzzle hook.** Peel the guards: Gilt with two Pikes adjacent, your rook and bishop, 4 energy. Rook kills one pawn, bishop the other, nothing left for the king; unless the bishop's diagonal reaches the king without reaching either pawn, when no redirect applies. Geometry of reach.

#### Marmalade — *Catnap* (misfit king, `misfit-king.ts`)

> Marmalade sleeps: he cannot move, strike or defend and takes 1 less from every hit. A friend ending a move beside him wakes him for the turn: he gets zoomies and moves like a queen, then naps again when the turn ends.

**Rules.** mods.asleep = true at spawn and again at the end of each of his side's turns. Asleep: moveTargets and attackTargets empty, canDefend false, every hit on him deals 1 less (burn ticks ignore it). Wake (afterMove hook): a friendly unit's move ending on his 8 neighbours (steps, slides, hops, honk pushes count) clears asleep until endTurn. Awake: moveTargets = queen shape at 1 per square (a king's step is included), strike adjacent for 2 (cost 2), may brace. Being struck does not wake him (a deep sleeper): this keeps the awake window inside his own side's turn. Check: kingThreat applies the -1 always (he is asleep whenever the enemy acts); canEscape finds 'nudge, then slide' because the nudge is an ordinary move and the woken king then has queen moves. AI: an enemy Marmalade's side nudges him only when he is threatened (+25 for the nudge move), then zooms to the square with the lowest kingThreat.

**Downside.** He never acts on his own: every escape costs a second piece's move first, and a lone Marmalade just lies there in check.

**Puzzle hook.** Wake the cat: king in check, the nudge costs 1, the queen-slide escape costs 2, and the last 1 is a brace. Which ally reaches his side in 1 without standing in the slide lane? The decoy answer walks into a Pike's tip.


## Boards (planned tiles)

Four atypical boards, each a mechanic the cast can play with. Tile data lives on the encounter; state that changes during a battle (collapsed tiles, gate positions) lives on the run so saves replay.


### The Sinkhole Road

> Pits swallow anything knocked into them, and the bridge tiles fall away behind whoever crosses them.

**Rules.** Tiles: hole (O) and crumbling (~). Hole: not passable for steps, slides, strikes and Pike reach (it is a gap, not a wall: sliders stop before it); knights, Dobbin's lanes, Grumble's hop and a Haystack that ate a knight pass over it; nothing may end a move on it; a unit heaved, honked or carried by ice onto it is removed at once (no counter, no promotion); for the player such an action on his own king is refused as self-mate. Crumbling: passable and safe to stand on for any number of turns; the moment a unit leaves it by any means (step, slide, hop, roll-on, shove) it becomes a hole; a slider passing over several crumbling tiles collapses each one behind it. Check: kingThreat treats holes as blocked for step-ins and a heave or honk that would drop your king into one as lethal. Energy unchanged. Data: Encounter gains holes: Pos[] and crumbling: Pos[]; collapsed tiles live on Run so saves replay. AI: moves onto crumbling tiles score -1 (no way back), shoves into holes score as kills, and its king never steps onto a tile that leaves him with no exit.

```
   a b c d e
5  . . k . .     k  King Gilt (Royal king, 5 HP, Bodyguards)
4  O . p . .     O  hole        p  Sergeant Pike (Royal pawn, Pike)
3  . n . . .     n  Sir Lance (Royal knight, Charge, 3 HP)
2  ~ ~ ~ ~ ~     ~  crumbling bridge tile
1  . G K . .     G  Honkington (your goose, HONK)   K  King Redcape (yours)

Legend: uppercase = yours, lowercase = enemy, . = floor
```

**Puzzle hook.** Sir Lance has 3 HP and your goose pecks for 1, but the pit at a4 does not care: Honkington b1-c2 (1) stands diagonal to the knight, HONK (2) shoves him from b3 straight away to a4, and he is gone; the last energy braces the king. Now the bridge: c2 crumbles the moment the goose steps off, Pike's tip reaches two squares down the c-file, and every tile you step off is gone for good, so order the crossing so the king never needs a tile you burned.


### Rabbit Holes

> Two matching burrows are one square: a piece that moves into one pops out of the other, and a slide keeps going out the far side in the same direction.

**Rules.** Encounter data: portals: [Pos, Pos][]. moveTargets: stepping onto burrow A costs as normal and lands on B if B is empty; if B is occupied the move is refused. Slides: a rook, bishop or queen line entering A continues from B in the same direction with cumulative cost, and may also stop on B. Knight leaps and Grumble hops onto A land on B. Pawn direction is unchanged after passing; popping out onto the far row promotes. Strikes never reach through burrows (next-square only, for readability); a piece standing on B strikes B's neighbours. A heave or honk into A lands on B. Check: kingThreat flows through moveTargets, so a rook two squares from A threatens the square beside B. AI: on portal boards replace chebyshev distance with a BFS over moveTargets.

```
   a b c d e
5  . p k . A     p  Sergeant Pike (Royal pawn)   k  King Gilt (Royal king, 3 HP, Bodyguards)
4  . # . # .     #  wall        A/B  paired burrows
3  . . K . .     K  King Redcape (yours)
2  . # . # .
1  B R . . .     R  Brick (your rebel rook, Demolish)

Legend: uppercase = yours, lowercase = enemy, . = floor
```

**Puzzle hook.** The long way round is the short way: Brick slides left from b1 into the burrow at a1, pops out at e5 and carries on to d5 beside the king (2 energy), then strikes c5 for 3 (2 energy), exactly 4. Bodyguards cannot save Gilt: Pike at b5 is beside him but a rook on d5 cannot reach b5, so the blow lands and the wounded king falls. The decoy is Redcape stepping to c4 for 2, which only wakes the Royals up.


### Frozen Lake

> Step onto ice and you keep sliding in that direction until something stops you, and the extra squares are free.

**Rules.** Tile: ice (*). When a unit enters an ice square by a step or slide, it continues in the same direction one square at a time while the next square is ice, empty and passable; it stops on the first non-ice square it reaches if that square is empty (that square is the destination), or on the last ice square before a wall, edge, hole or piece. Cost: only the squares chosen before the first ice square (minimum 1); the slide is free and does not count toward the chess-shape limit. Knights, Dobbin and Grumble land without sliding; heaved and honked units slide; a pawn carried to the far row promotes; a slide into a hole kills. Units standing on ice act normally. Check: moveTargets returns the final squares, so exposesKing, approaches, kingThreat and the AI judge the end square; badges draw on the destination with a dotted trail. Tap-to-strike: the walk's end square must reach the target. Data: Encounter gains ice: Pos[]. AI: nothing beyond moveTargets; -30 for a slide that ends beside two or more of your strikers.

```
   a b c d e
5  . . . . p     p  Sergeant Pike (Royal pawn, the king's guard)
4  . . . . k     k  King Gilt (Royal king, 5 HP, Bodyguards)
3  R * * * .     R  Haystack (your misfit rook, Consume)   *  ice
2  . * * * .
1  . . K . .     K  King Redcape (yours)

Legend: uppercase = yours, lowercase = enemy, . = floor
```

**Puzzle hook.** Mate in two on the lake. Haystack a3-b3 costs 1 and the ice carries it to e3 for free, right under the king; strike for 3 (Pike at e5 is out of a rook's reach from e3, so no redirect) and brace Redcape with the last 1. Gilt has 2 HP and nowhere dry to run: d3 is ice and skids him to b1 beside Redcape; d4 or d5 are reached by Redcape stepping c1-c2, which the ice slides to c4. The trap is the second blow: from e4 the Haystack could also reach Pike, so its strike on d4 would be redirected to the guard; only the king's sword lands.


### The Portcullis

> A lever on the floor opens or shuts the gate across the board, a gate cannot shut on a piece standing in it, and a smashed gate never shuts again.

**Rules.** Tiles: gate (G; shut = wall, open = floor) and lever (L; floor). Trigger: a unit ending any move (step, slide, leap, hop, shove, ice) on a lever toggles every gate in that lever's group; the toggle is part of the move and resolves before strikes and before intoCheck judges it. A gate with a unit on it cannot shut (the others in the group still toggle). Standing on a lever and leaving it does nothing; coming back pulls it again. Brick's Demolish turns a gate into plain floor for the rest of the battle. Shut gates block moves, slides, strikes and Pike reach; knights and hops leap them. Check: kingThreat includes gate state, and an enemy step-in onto a lever applies the toggle inside the simulated search, so a lever pull that opens a file onto your king counts as check. Data: Encounter gains gates: { at, group, open }[] and levers: { at, group }[]; gate state and smashed gates live on Run. AI: a move onto a lever scores +/-8 per line it opens toward your pieces or shuts toward its own king, computed by re-running kingThreat and lineUp on the toggled board; it also values parking a piece on the lever so you cannot pull it.

```
   a b c d e
5  . . k n .     k  King Gilt (Royal king, 3 HP, Bodyguards)   n  Sir Lance (Royal knight, Charge)
4  # # G # #     #  wall        G  gate (starts shut)
3  . . . . L     L  lever (toggles the gate)
2  . . . . .
1  . . R K .     R  Brick (your rebel rook, Demolish)   K  King Redcape (yours)

Legend: uppercase = yours, lowercase = enemy, . = floor
```

**Puzzle hook.** Two keys, one mate. The lever opens the gate, but Sir Lance leaps walls: he can land on e3 to pull it shut again, or on c3 to charge your king for 3. The winning line ignores the lever: Brick c1-c3 (2) and Demolish the gate at c4 (2), so it is floor forever. Lance's reply is a charge on Redcape (5 HP survives), and next turn Brick steps into the doorway (1) and strikes c5 (2): Lance at d5 is a diagonal from c4, so no guard takes the blow, and the wounded king falls before the knight can charge twice.


## How the set was chosen

Picks follow the judges' totals, then two tie-breakers: each kind's three variants must use different verbs, and every ability must fit the existing hook style (small pure functions on Run) so the prototype can be built. Pawns: Heave (push on hit, the best-scored rebel pawn), Pike (straight reach 2, the cleanest pawn anywhere) and Hop (mobility over walls and holes; chosen over Tongue, which scored a point higher on fun but needs king relocation inside kingThreat and would have been a third pawn displacement verb). Knights: Dobbin uses the build's elbow rule (one square to check per L, 1-energy jump), Sir Lance merges the puzzle proposal's charge pricing (jump 2 + charge 1 = an enemy pool of 3, deals 3; 1 from a standstill) with the build's damage-only clarity, and Nobody takes the puzzle proposal's Hollow (dies into a wall), the single highest-scored idea in the batch. Bishops: lean Hex (-1 damage, puzzle 5 from every judge), Foresight for Lens (one condition in strike(), readability 5, and it gives the royal cast an armour-and-formation feel instead of a second reach-2 piece), HONK for the goose with the 1-damage peck. Rooks: Brick gets Demolish rather than Sledge because Heave and HONK already own the shove verb and Demolish gives gates, holes and Nobody's wall a counterpart; the Warden gets Poleaxe Sweep (friendly fire is the richest puzzle lever on the royal side; the build's reach-2 poleaxe duplicated Pike); Haystack is Wesley's Consume exactly as shipped, with the two riders all four proposals wanted (no brace while digesting, hay burns longer). Queens: Clang at 2 damage with daze = empty moveTargets (kingThreat respects it for free), Beneath Me (the highest-scored ability in the set, two filters and done), and the candle merged into Wick with fixed two-tick burns (judges preferred it to snuff-by-defend), unavoidable burn damage counted in check, and a free relight at camp. Kings: Dub (the aha that knighting can give check, once-per-battle keeps the 3g pawn economy honest), Bodyguards with the build's 'striker must reach the guard too' condition (the best redirect variant; it turns bodyguards into reach geometry), and Catnap resolved to the build's nudge-then-zoomies, with the ambiguity closed by ruling that only a friendly nudge wakes him, so the awake window always sits inside his own side's turn. Engine shape implied: hooks moveTargets, reaches, strikeCost, damage (dealt and taken), afterStrike, altAction, canDefend, onDeath, startTurn and afterMove; run-level tiles (holes, smashed walls, gate state) so turns.ts stays pure; and one global check rule: kingThreat counts damage the enemy could land next turn (including reach and pricing hooks, burn ticks, lever pulls and lethal falls) but never multi-piece set-ups such as a honk that merely exposes the king. Boards: the four highest-scored distinct mechanics, each rebuilt around the chosen cast and re-verified square by square: Sinkhole Road (holes + crumbling, now solved with HONK into the pit), Rabbit Holes (portals, the judges' verified 4-energy slide, with a decoy guard that Bodyguards cannot use), Frozen Lake (ice, a mate in two whose second move is chosen by the Bodyguards geometry), and The Portcullis (gates + lever, with the illegal two-step king line replaced by Demolish beating the lever while Sir Lance's wall-leaping charge is the clock). Wrap and river were dropped: both scored lower and touch every geometry helper."

## Open design questions (from the rules-lawyer pass)

The ideation panel's final pass raised these; the prototype ships the simplest reading of each, so they are Wesley's calls:

- ~~Stall clock~~: shipped as specced (Wesley, Nov 8): tiring after 3 quiet turns, retreat after 8; see docs/turn-based.md.
- ~~Grumble's crown~~: shipped (Wesley, Nov 8): he always crowns a knight, either side, no picker; with the cast kept that is Nobody.
- Enemy pawns that crown on cast boards become Her Wigness (your pawns deal her 0 and she ignores them), relying on the stall clock to end corks; or crown a plain queen? Recommended: ship Wigness; it is the one consistent promotion rule and corks now cost both sides.
- Nobody's suit: any piece may topple it for 2 energy (interactive, costs the Royals a swing) versus a suit that crumbles on its own after 3 turns (no new core action)? Recommended: topple; it is a decision for both sides, not a timer.
- Enemy Marmalade: model the friendly nudge inside kingThreat (the one two-piece set-up the search ever credits) or keep him player-only for the prototype? Recommended: model it, because the CHECK tag otherwise lies the first time the Royals field a cat; player-only is the fallback if it slips the build.
