/** Escape from Exile, turn-based: you act, then the enemy acts. Each side
 * spends a per-turn energy pool. Each piece may move once (1 energy per
 * square in its chess shape; a knight's jump costs 2), then strike the next
 * square in its shape (2) or defend (1). Pure and
 * deterministic: no DOM, no randomness, inputs are never mutated. Piece variants and their
 * abilities live in abilities.ts and hook in here. */
import { ABILITIES, VARIANTS, abilityOf, variantOf } from "./abilities";
import type { AltAction, Variant } from "./abilities";
import { expireMods, isDazed, isHexed } from "./status";
import type { Mods } from "./status";
import { ENCOUNTERS, PUZZLES } from "./encounters";
import { DIAGONALS, LEAPS, STRAIGHTS, at, boardOf, coord, energyOf, forward, label, landingOf, lastRank, note, open, passable, portalExit, same, settle, shapeReaches, slides, withUnit } from "./board";
export type { AltAction, Variant } from "./abilities";
export type { Mods } from "./status";
export { ABILITIES, abilityOf, variantOf, ENCOUNTERS, PUZZLES, boardOf, same, coord, at, label, passable };
export type Side = "white" | "black";
export type Kind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Pos = { x: number; y: number };
/** `variant` is which of the three casts the piece belongs to (rebel by default for your side, royal
 * for the patrol; see variantOf). `mods` is flat ability state, such as what a Haystack has eaten. */
export type Unit = Pos & { id: string; side: Side; kind: Kind; hp: number; variant?: Variant; mods?: Mods; moved?: boolean; acted?: boolean; defending?: boolean };
export type Target = Pos & { cost: number; id?: string };
/** A piece to put on the board: kind, x, y, hp and (optionally) which cast it belongs to. */
export type Placement = [Kind, number, number, number, Variant?];
/** A gate is a wall while shut and floor while open; a lever toggles every gate in its group. */
export type Gate = { at: Pos; group: string; open?: boolean };
export type Lever = { at: Pos; group: string };
/** A board. The road's battles place your army on `starts`; a Guild puzzle hands you a fixed `army`
 * instead and may set a turn limit. Tiles are optional: holes (pits), crumbling bridge tiles,
 * burrow pairs (portals), ice, gates and levers. */
export type Encounter = {
  title: string; story: string; reward: number; enemyEnergy: number; width: number; height: number; walls: Pos[]; spawns: Placement[]; starts: Pos[];
  holes?: Pos[]; crumbling?: Pos[]; portals?: [Pos, Pos][]; ice?: Pos[]; gates?: Gate[]; levers?: Lever[];
  army?: Placement[]; turns?: number; goal?: string;
};
export type Run = {
  version: 2; encounter: number; turn: number;
  phase: "player" | "camp" | "victory" | "defeat";
  gold: number; energy: number; units: Unit[]; log: string[]; history: string[]; nextId: number;
  /** Your pawn that reached the far row and is waiting for you to pick its new piece. */
  promoting?: string;
  /** Recruits bought at the hub, waiting in the barracks until you take the road. */
  recruits?: Recruit[];
  /** Walls abilities added this battle (Nobody's empty suit) and encounter walls they removed (Brick). */
  walls?: Pos[]; broken?: Pos[];
  /** Run-level ability state for this battle (King Redcape's one dub). */
  flags?: Record<string, number | boolean>;
  /** Set when this run is a Guild puzzle (an index into PUZZLES) rather than the road. */
  puzzle?: number;
  /** Crumbling tiles that have fallen this battle (pits now), and the gates standing open. */
  collapsed?: Pos[]; gatesOpen?: Pos[];
};
export type RecruitKind = "pawn" | "bishop" | "rook";
export const RECRUIT_KINDS: RecruitKind[] = ["pawn", "bishop", "rook"];
/** A recruit waiting in the barracks: a kind in one of the three casts. */
export type Recruit = { kind: RecruitKind; variant: Variant };
export type PromoteTo = "queen" | "rook" | "bishop" | "knight";
/** One beat of play for presentation: who acted, how, on whom, and who fell. */
export type Step = { text: string; units: Unit[]; focus: Pos[]; damage: { id: string; amount: number }[]; actor: string; kind: "move" | "strike" | "defend" | "promote" | "alt"; target?: string; killed: string[]; from?: Kind };

export const ENERGY = 4;
/** Every strike costs the same, knights included: a knight can jump (2) and strike (2) in one turn. */
export const STRIKE_COST = 2;
export const HP: Record<Kind, number> = { king: 5, queen: 9, rook: 5, bishop: 3, knight: 3, pawn: 1 };
export const DAMAGE: Record<Kind, number> = { king: 2, queen: 3, rook: 3, bishop: 2, knight: 2, pawn: 1 };
/** What the barracks sells: a kind (a rebel), a specific recruit, or a heal. */
export type CampChoice = RecruitKind | Recruit | "heal";
export const COST: Record<RecruitKind | "heal", number> = { pawn: 3, bishop: 6, rook: 8, heal: 4 };
export const recruitOf = (choice: CampChoice): Recruit | null => choice === "heal" ? null : typeof choice === "string" ? { kind: choice, variant: "rebel" } : choice;
export const costOf = (choice: CampChoice) => COST[choice === "heal" ? "heal" : recruitOf(choice)!.kind];

/** A piece's full health: its kind's, unless its variant says otherwise. */
export const maxHp = (u: Pick<Unit, "side" | "variant" | "kind">) => abilityOf(u)?.hp ?? HP[u.kind];
/** What this piece's strike costs right now (Sir Lance charges cheaply after a jump). */
export const strikeCostOf = (g: Run, u: Unit) => abilityOf(u)?.strikeCost?.(g, u) ?? STRIKE_COST;
/** Damage `a` deals `v` with one blow: the kind's damage through the attacker's ability and hex,
 * then the defender's block and its own ability. Never below 0. */
export function dealtTo(g: Run, a: Unit, v: Unit): number {
  let d = abilityOf(a)?.damage?.(g, a, v, DAMAGE[a.kind]) ?? DAMAGE[a.kind];
  if (isHexed(a, g.turn)) d -= 1;
  d = Math.max(0, Math.max(0, d) - (v.defending ? 1 : 0));
  return Math.max(0, abilityOf(v)?.incoming?.(g, v, a, d) ?? d);
}

/** Empty squares a piece could move to from its square if it moved like `kind`, priced by distance.
 * Targets are where the piece ends up: a burrow sends it out the other mouth (and a slide carries on
 * from there), ice glides it on for free. The same destination reached two ways keeps the cheaper price. */
function shapeTargets(g: Run, u: Unit, kind: Kind, energy: number): Target[] {
  const out = new Map<string, Target>();
  const add = (dest: Pos, cost: number) => { const k = `${dest.x},${dest.y}`, had = out.get(k); if (!had || had.cost > cost) out.set(k, { x: dest.x, y: dest.y, cost }); };
  /** Enter `p` moving in `dir`: the square to land on (burrow exits, then ice), or undefined when blocked. */
  const enter = (p: Pos, dir?: [number, number]): Pos | undefined => {
    const exit = portalExit(g, p);
    if (exit ? !open(g, exit) : !open(g, p)) return undefined;
    return landingOf(g, p, dir);
  };
  const dirs = slides(kind);
  if (dirs) {
    for (const [dx, dy] of dirs) {
      // `here` is the square the slide continues from: the piece's own, or a burrow's far mouth.
      let here: Pos = u;
      for (let n = 1; n <= energy; n++) {
        const p = { x: here.x + dx, y: here.y + dy };
        const dest = enter(p, [dx, dy]);
        if (!dest) break;
        add(dest, n);
        here = portalExit(g, p) ?? p;
      }
    }
  } else if (kind === "knight") {
    if (energy >= 2) for (const [dx, dy] of LEAPS) { const dest = enter({ x: u.x + dx, y: u.y + dy }); if (dest) add(dest, 2); }
  } else if (energy >= 1) {
    const steps: [number, number][] = kind === "king" ? [...STRAIGHTS, ...DIAGONALS] : [[0, forward(u)]];
    for (const [dx, dy] of steps) { const dest = enter({ x: u.x + dx, y: u.y + dy }, [dx, dy]); if (dest) add(dest, 1); }
  }
  return [...out.values()];
}
/** Empty squares a piece can move to this turn, priced by distance. Its variant's ability may add or remove some. */
export function moveTargets(g: Run, u: Unit, energy = g.energy): Target[] {
  if (u.moved || u.acted || isDazed(u, g.turn)) return [];
  const base = shapeTargets(g, u, u.kind, energy);
  const hook = abilityOf(u)?.moveTargets;
  return hook ? hook(g, u, base, { energy, shape: kind => shapeTargets(g, u, kind, energy), open: p => open(g, p), passable: p => passable(g, p) }) : base;
}

/** Enemies a piece can strike this turn: the next square along its capture shape (a knight's jump). */
export function attackTargets(g: Run, u: Unit, energy = energyOf(g, u.side)): Target[] {
  if (u.acted) return [];
  const cost = strikeCostOf(g, u);
  if (cost > energy) return [];
  const veto = abilityOf(u)?.canStrike;
  return g.units.filter(v => v.side !== u.side && reaches(g, u, u, v) && (!veto || veto(g, u, v))).map(v => ({ x: v.x, y: v.y, cost, id: v.id }));
}

/** Squares u could step to and then strike the target from this turn, priced move + strike. For your
 * pieces, the walk and strike count as one move: it's allowed if the king is safe once the strike lands. Empty when
 * u can already strike it where it stands (no walk needed) or the pool can't cover both. */
export function approaches(g: Run, id: string, targetId: string): Target[] {
  const u = g.units.find(v => v.id === id), v = g.units.find(w => w.id === targetId);
  if (!u || !v || u.acted || v.side === u.side || attackTargets(g, u).some(t => t.id === v.id)) return [];
  const energy = energyOf(g, u.side);
  const strikeCost = strikeCostOf(g, { ...u, moved: true });
  return moveTargets(g, u, energy).filter(t => t.cost + strikeCost <= energy && reaches(g, u, t, v) && (u.side !== "white" || walkAndStrike(g, id, t, targetId) !== null)).map(t => ({ x: t.x, y: t.y, cost: t.cost + strikeCost }));
}

/** Could u, standing on `from`, strike `target` (ignoring energy)? Strikes reach one step in the piece's shape. */
export function reaches(g: Run, u: Unit, from: Pos, target: Pos): boolean {
  const hook = abilityOf(u)?.reaches;
  return hook ? hook(g, u, from, target, shapeReaches(u, from, target)) : shapeReaches(u, from, target);
}

function spawn(g: Run, army: Unit[]): Run {
  const e = boardOf(g);
  // Battle state (moves, braces, meals) doesn't carry over; the piece and its cast do.
  const whites = army.map((u, i): Unit => ({ id: u.id, side: u.side, kind: u.kind, variant: variantOf(u), hp: u.hp, ...e.starts[i] }));
  // An enemy spawn without a named cast is a plain piece (royal costume, no ability): the road's patrol.
  const enemies = e.spawns.map(([kind, x, y, hp, variant], i): Unit => ({ id: `enemy-${g.encounter}-${i}`, kind, side: "black", variant, x, y, hp }));
  const gatesOpen = e.gates?.filter(x => x.open).map(x => x.at);
  return { ...g, promoting: undefined, walls: undefined, broken: undefined, flags: undefined, collapsed: undefined, gatesOpen: gatesOpen?.length ? gatesOpen : undefined, units: [...whites, ...enemies], phase: "player", turn: 1, energy: ENERGY, log: [e.story] };
}
export function newRun(): Run {
  const g: Run = { version: 2, encounter: 0, turn: 1, phase: "player", gold: 2, energy: ENERGY, units: [], log: [], history: [], nextId: 1 };
  return spawn(g, [{ id: "king", side: "white", kind: "king", variant: "rebel", hp: HP.king, x: 0, y: 0 }]);
}
/** A Guild puzzle: a fixed army on a fixed board, no gold, no road. Solve it or lose it; the campaign run is untouched. */
export function startPuzzle(i: number): Run {
  const e = PUZZLES[i];
  const g: Run = { version: 2, encounter: 0, puzzle: i, turn: 1, phase: "player", gold: 0, energy: ENERGY, units: [], log: [], history: [`Puzzle: ${e.title}`], nextId: 1 };
  const army = (e.army ?? []).map(([kind, x, y, hp, variant], n): Unit => ({ id: kind === "king" ? "king" : `ally-${n}`, side: "white", kind, variant: variant ?? "rebel", hp, x, y }));
  const spawned = spawn({ ...g, units: army }, army);
  // Puzzle armies stand where the puzzle puts them, not on the road's starts.
  return { ...spawned, units: [...army, ...spawned.units.filter(u => u.side === "black")] };
}

function finish(g: Run): Run {
  if (!g.units.some(u => u.id === "king")) return { ...g, phase: "defeat", log: ["The crown fell. Your rebellion ends here.", ...g.log] };
  if (!g.units.some(u => u.side === "black")) {
    if (g.puzzle !== undefined) return { ...g, phase: "victory", log: ["Solved! The Grandmaster nods.", ...g.log] };
    const last = g.encounter === ENCOUNTERS.length - 1, reward = boardOf(g).reward;
    return { ...g, phase: last ? "victory" : "camp", gold: g.gold + reward, log: [last ? "Across the bridge. Your rebellion has begun." : `Road cleared. +${reward} gold.`, ...g.log] };
  }
  return g;
}

/** True when an action would take your king from safe to in check, which the rules forbid. Once
 * he's already in check you may act freely; he just has to be safe before the turn ends. Getting him
 * killed outright (a counter) counts too. */
const intoCheck = (before: Run, after: Run) => after !== before && !inCheck(before) && (inCheck(after) || (after.phase === "defeat" && before.phase !== "defeat"));
export function move(g: Run, id: string, to: Pos): Run {
  const next = moveUnchecked(g, id, to);
  return intoCheck(g, next) ? g : next;
}
/** Would this move put your own king in check? */
export function exposesKing(g: Run, id: string, to: Pos): boolean { return intoCheck(g, moveUnchecked(g, id, to)); }
function moveUnchecked(g: Run, id: string, to: Pos): Run {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white") return g;
  const t = moveTargets(g, u).find(t => same(t, to));
  if (!t) return g;
  const next = afterMove(settle(note({ ...g, energy: g.energy - t.cost, units: withUnit(g, id, { moved: true }) }, `${label(u)} moves to ${coord(g, to)} (${t.cost} energy).`), id, to, u), id, u);
  // A pawn on the far row waits for you to choose what it becomes.
  return u.kind === "pawn" && to.y === lastRank(g, u) && next.units.some(w => w.id === id) ? { ...next, promoting: id } : next;
}
/** Lets every piece with an onAnyMove hook react to `id` having moved from `from`. */
function afterMove(g: Run, id: string, from: Pos): Run {
  let run = g;
  for (const w of g.units) {
    const hook = abilityOf(w)?.onAnyMove;
    const mover = run.units.find(u => u.id === id), watcher = run.units.find(u => u.id === w.id);
    if (hook && mover && watcher) run = hook(run, watcher, mover, from);
  }
  return run;
}
/** Removes pieces at 0 HP and lets their abilities react (Nobody leaves a wall). */
function removeDead(g: Run): Run {
  const dead = g.units.filter(u => u.hp <= 0);
  if (!dead.length) return g;
  let run = { ...g, units: g.units.filter(u => u.hp > 0) };
  for (const d of dead) run = abilityOf(d)?.onDeath?.(run, d) ?? run;
  return run;
}
function promoted(g: Run, u: Unit, kind: PromoteTo): { run: Run; step: Step } {
  const text = `${label(u)} reaches the far row and becomes a ${kind}!`;
  const run = note({ ...g, units: withUnit(g, u.id, { kind, hp: maxHp({ ...u, kind }) }) }, text);
  return { run, step: { text, units: run.units, focus: [{ x: u.x, y: u.y }], damage: [], actor: u.id, kind: "promote", killed: [], from: u.kind } };
}
/** Completes your pending promotion. The new piece keeps its turn: it has moved, but can still strike or defend. */
export function promote(g: Run, id: string, kind: PromoteTo): { run: Run; step: Step | null } {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || g.promoting !== id || !u || !["queen", "rook", "bishop", "knight"].includes(kind)) return { run: g, step: null };
  const { run, step } = promoted({ ...g, promoting: undefined }, u, kind);
  return { run, step };
}

export function defend(g: Run, id: string): Run {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white" || u.acted || g.energy < 1 || !canDefend(g, u)) return g;
  return note({ ...g, energy: g.energy - 1, units: withUnit(g, id, { acted: true, defending: true }) }, `${label(u)} defends (1 energy).`);
}
export const canDefend = (g: Run, u: Unit) => abilityOf(u)?.canDefend?.(g, u) ?? true;
/** Actions the piece may take instead of striking, affordable now. */
export function altActions(g: Run, u: Unit, energy = energyOf(g, u.side)): AltAction[] {
  if (u.acted) return [];
  return (abilityOf(u)?.altActions?.(g, u) ?? []).filter(a => a.cost <= energy);
}
/** Takes an alternative action (hex, honk, demolish, dub...). Refused like a move if it would put your king in check. */
export function alt(g: Run, id: string, actionId: string, target?: Pos): { run: Run; step: Step | null } {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white") return { run: g, step: null };
  const action = altActions(g, u, g.energy).find(a => a.id === actionId);
  if (!action || (action.targets.length > 0 && !(target && action.targets.some(t => same(t, target))))) return { run: g, step: null };
  const { run, step } = action.apply({ ...g, energy: g.energy - action.cost, units: withUnit(g, id, { acted: true }) }, target);
  const done = finish(removeDead(run));
  const killed = g.units.filter(w => !done.units.some(x => x.id === w.id)).map(w => w.id);
  return intoCheck(g, done) ? { run: g, step: null } : { run: done, step: { ...step, units: done.units, killed } };
}

/** Resolves one strike for either side. The named target may hand the blow to a bodyguard, the
 * striker's ability may splash it onto neighbours, every surviving victim that counters hits back,
 * then deaths and the striker's after-strike hook resolve. */
function strike(g: Run, a: Unit, t: Target): { run: Run; step: Step } {
  const named = g.units.find(u => u.id === t.id)!;
  const v = abilityOf(named)?.intercept?.(g, a, named, reaches) ?? named;
  const victims = [v, ...(abilityOf(a)?.splash?.(g, a, v) ?? [])].filter((x, i, all) => x.id !== a.id && all.findIndex(y => y.id === x.id) === i);
  const dealt = new Map(victims.map(x => [x.id, dealtTo(g, a, x)]));
  // Strikes land from where the striker stands; it never moves onto the target's square.
  let units = g.units.map(u => (dealt.has(u.id) ? { ...u, hp: u.hp - dealt.get(u.id)! } : u.id === a.id ? { ...u, acted: true } : u));
  const damage = victims.map(x => ({ id: x.id, amount: dealt.get(x.id)! }));
  const fell = (x: Unit) => units.find(u => u.id === x.id)!.hp <= 0;
  let text = `${label(a)} strikes ${label(v)} for ${dealt.get(v.id)}${fell(v) ? ", defeating it" : ""}.`;
  if (victims.length > 1) text += ` The blow also hits ${victims.slice(1).map(x => `${label(x)} for ${dealt.get(x.id)}${fell(x) ? " (defeated)" : ""}`).join(", ")}.`;
  if (v.id !== named.id) text = `${label(v)} takes the blow meant for ${label(named)}. ` + text;
  // Survivors hit back: a braced piece that can reach the striker, or one whose ability says so.
  for (const x of victims) {
    const me = units.find(u => u.id === x.id), striker = units.find(u => u.id === a.id);
    if (!me || me.hp <= 0 || !striker || striker.hp <= 0) continue;
    const base = !!me.defending && reaches({ ...g, units }, me, me, striker);
    if (!(abilityOf(me)?.counters?.({ ...g, units }, me, striker, base) ?? base)) continue;
    const back = dealtTo({ ...g, units }, me, striker), left = striker.hp - back;
    units = units.map(u => (u.id === a.id ? { ...u, hp: left } : u));
    damage.push({ id: a.id, amount: back });
    text += ` ${label(me)} counters for ${back}${left > 0 ? "" : ", defeating it"}.`;
  }
  let run = removeDead(note({ ...g, units }, text));
  // The striker's ability may act on the result: a Haystack rolls onto what it kills.
  const after = abilityOf(a)?.afterStrike;
  if (after) run = after(run, a, v, fell(v));
  const killed = g.units.filter(u => !run.units.some(w => w.id === u.id)).map(u => u.id);
  return { run, step: { text, units: run.units, focus: [{ x: v.x, y: v.y }], damage, actor: a.id, kind: "strike", target: v.id, killed } };
}

export function attack(g: Run, id: string, targetId: string): { run: Run; step: Step | null } {
  const result = attackUnchecked(g, id, targetId);
  return intoCheck(g, result.run) ? { run: g, step: null } : result;
}
/** A tap-to-strike: walk to `to`, then strike. Judged as one move, so the walk may step into danger
 * as long as the king is safe once the strike lands (say, because it kills the attacker). Returns both
 * stages so the walk can play before the blow, or null if the rules refuse it. */
export function walkAndStrike(g: Run, id: string, to: Pos, targetId: string): { walked: Run; run: Run; step: Step } | null {
  const walked = moveUnchecked(g, id, to);
  if (walked === g || walked.promoting) return null;
  const { run, step } = attackUnchecked(walked, id, targetId);
  if (run === walked || !step || intoCheck(g, run)) return null;
  return { walked, run, step };
}
/** Would this strike (through the counter it draws) put your own king in check? */
export function strikeExposesKing(g: Run, id: string, targetId: string): boolean { return intoCheck(g, attackUnchecked(g, id, targetId).run); }
function attackUnchecked(g: Run, id: string, targetId: string): { run: Run; step: Step | null } {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white") return { run: g, step: null };
  const t = attackTargets(g, u).find(t => t.id === targetId);
  if (!t) return { run: g, step: null };
  const { run, step } = strike({ ...g, energy: g.energy - t.cost }, u, t);
  return { run: finish(run), step };
}

/** Deterministic enemy policy: take the best-scoring affordable action until
 * nothing scores above zero or the pool is spent. */
function enemyTurn(g: Run): { run: Run; steps: Step[]; spent: number } {
  let run = startOfTurn({ ...g, units: g.units.map(u => (u.side === "black" ? { ...u, moved: false, acted: false, defending: false } : u)) }, "black", g.turn);
  let energy = boardOf(g).enemyEnergy;
  const steps: Step[] = [];
  const pool = energy;
  for (let guard = 0; guard < 20 && energy > 0 && run.phase === "player"; guard++) {
    const king = run.units.find(u => u.id === "king");
    if (!king) break;
    type Choice = { score: number; key: string; apply: () => { run: Run; step: Step; cost: number } };
    const choices: Choice[] = [];
    for (const u of run.units.filter(u => u.side === "black")) {
      for (const t of attackTargets(run, u, energy)) {
        const v = run.units.find(w => w.id === t.id)!;
        const dealt = dealtTo(run, u, v);
        if (dealt === 0) continue;
        // A sweep hits the neighbours too: foes are worth what a strike on them would be, friends count double against.
        const splash = (abilityOf(u)?.splash?.(run, u, v) ?? []).filter(x => x.id !== v.id && x.id !== u.id);
        const worth = (x: Unit) => dealtTo(run, u, x) * 10 + (dealtTo(run, u, x) >= x.hp ? 50 : 0);
        const splashScore = splash.reduce((s, x) => s + (x.side === u.side ? -2 * worth(x) : worth(x)), 0);
        // A surviving defender counters if it can reach the striker's square.
        const counterBase = !!v.defending && reaches(run, v, v, u);
        const countered = dealt < v.hp && (abilityOf(v)?.counters?.(run, v, u, counterBase) ?? counterBase) ? dealtTo(run, v, u) : 0;
        const score = 100 + dealt * 10 + (dealt >= v.hp ? 50 : 0) + (v.id === "king" ? 30 : 0) + splashScore - countered * 8 - (countered >= u.hp ? 60 : 0) - t.cost;
        choices.push({ score, key: `a${u.id}${t.x}${t.y}`, apply: () => ({ ...strike(run, u, t), cost: t.cost }) });
      }
      // Close in on the king, or on whichever of your pieces is nearest.
      const whites = run.units.filter(w => w.side === "white");
      const gap = (p: Pos, w: Pos) => Math.max(Math.abs(p.x - w.x), Math.abs(p.y - w.y));
      const dist = (p: Pos) => Math.min(gap(p, king) - 0.5, ...whites.map(w => gap(p, w)));
      for (const t of moveTargets(run, u, energy)) {
        const gain = dist(u) - dist(t);
        // Pawns keep marching toward pieces still ahead of them, and race for the far row to promote.
        const crowning = u.kind === "pawn" && t.y === lastRank(run, u);
        const ahead = whites.some(w => (w.y - u.y) * forward(u) > 0);
        const march = u.kind === "pawn" && gain <= 0 && ahead ? 1 : 0;
        // Strikes only reach the next square, so a square to strike from is worth a step.
        const strikeCost = strikeCostOf(run, { ...u, moved: true });
        const lineUp = !u.acted && energy - t.cost >= strikeCost && whites.some(w => reaches(run, u, t, w));
        if (gain <= 0 && !march && !crowning && !lineUp) continue;
        choices.push({ score: crowning ? 30 : lineUp ? 20 - t.cost : march || gain * 5 - t.cost, key: `m${u.id}${t.x}${t.y}`, apply: () => {
          const text = `${label(u)} moves to ${coord(run, t)}.`;
          const next = afterMove(settle(note({ ...run, units: withUnit(run, u.id, { moved: true }) }, text), u.id, t, u), u.id, u);
          return { run: next, step: { text, units: next.units, focus: [{ x: t.x, y: t.y }], damage: [], actor: u.id, kind: "move", killed: [] }, cost: t.cost };
        } });
      }
      // Brace only when it matters (a threat it survives only thanks to the block, or one it
      // could hit back), and only when no move is worth making.
      // A threat is one of your pieces that can strike u next turn, stepping in first if its pool allows.
      const threat = (w: Unit) => reaches(run, w, w, u) || moveTargets(run, { ...w, moved: false, acted: false }, ENERGY).some(t => t.cost + strikeCostOf(run, { ...w, moved: true }) <= ENERGY && reaches(run, w, t, u));
      const worthIt = whites.some(w => threat(w) && ((dealtTo(run, w, u) >= u.hp && dealtTo(run, w, { ...u, defending: true }) < u.hp) || reaches(run, u, u, w)));
      if (!u.acted && worthIt && canDefend(run, u)) choices.push({ score: 0.4, key: `d${u.id}`, apply: () => {
        const text = `${label(u)} braces to defend.`;
        const next = note({ ...run, units: withUnit(run, u.id, { acted: true, defending: true }) }, text);
        return { run: next, step: { text, units: next.units, focus: [{ x: u.x, y: u.y }], damage: [], actor: u.id, kind: "defend", killed: [] }, cost: 1 };
      } });
    }
    choices.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    const best = choices[0];
    if (!best || best.score <= 0) break;
    const done = best.apply();
    run = finish(done.run); energy -= done.cost; steps.push(done.step);
    const mover = run.units.find(x => x.id === done.step.actor);
    if (done.step.kind === "move" && mover?.kind === "pawn" && mover.y === lastRank(run, mover)) {
      const p = promoted(run, mover, "queen");
      run = p.run; steps.push(p.step);
    }
  }
  return { run: endOfTurn(run, "black"), steps, spent: pool - energy };
}

/** The most damage the enemy's next turn could deal your king, within its pool: each enemy piece may
 * step in (if it can afford to; a pawn reaching your back row becomes a queen first) and strike him once.
 * Attackers are every piece in a combination that would kill him (or, if none would, deal the most). */
export function kingThreat(g: Run): { damage: number; attackers: string[] } {
  const king = g.units.find(u => u.id === "king");
  if (!king) return { damage: 0, attackers: [] };
  const hit = (run: Run, u: Unit) => dealtTo(run, u, king);
  const combos: { damage: number; ids: string[] }[] = [];
  const search = (run: Run, pool: number, left: Unit[], damage: number, ids: string[]) => {
    if (damage > 0) combos.push({ damage, ids });
    left.forEach((u, i) => {
      const rest = left.filter((_, j) => j !== i);
      const standing = strikeCostOf(run, u);
      if (pool >= standing && reaches(run, u, u, king) && (abilityOf(u)?.canStrike?.(run, u, king) ?? true)) search(run, pool - standing, rest, damage + hit(run, u), [...ids, u.id]);
      const stepped = strikeCostOf(run, { ...u, moved: true });
      for (const t of moveTargets(run, { ...u, moved: false, acted: false }, pool - stepped)) {
        const crowned = u.kind === "pawn" && t.y === lastRank(run, u);
        const moved: Unit = { ...u, x: t.x, y: t.y, moved: true, kind: crowned ? "queen" : u.kind };
        if (reaches(run, moved, t, king)) search(settle({ ...run, units: withUnit(run, u.id, { kind: moved.kind }) }, u.id, t, u), pool - t.cost - stepped, rest, damage + hit(run, moved), [...ids, u.id]);
      }
    });
  };
  search(g, boardOf(g).enemyEnergy, g.units.filter(u => u.side === "black"), 0, []);
  const damage = Math.max(0, ...combos.map(c => c.damage));
  const bar = Math.min(damage, king.hp);
  const attackers = [...new Set(combos.filter(c => damage > 0 && c.damage >= bar).flatMap(c => c.ids))];
  return { damage, attackers };
}
/** Check: the enemy's next turn could kill your king. Threats that would only hurt him don't count. */
export function inCheck(g: Run): boolean {
  const king = g.units.find(u => u.id === "king");
  return g.phase === "player" && !!king && kingThreat(g).damage >= king.hp;
}
/** Could anything you still do this turn (moves, strikes, defending) get the king out of check? */
export function canEscape(start: Run): boolean {
  const seen = new Set<string>();
  const key = (g: Run) => g.units.map(u => `${u.id}${u.kind[0]}${u.x},${u.y}:${u.hp}${u.moved ? "m" : ""}${u.acted ? "a" : ""}${u.defending ? "d" : ""}${u.mods ? JSON.stringify(u.mods) : ""}`).join("|") + g.energy;
  const visit = (g: Run): boolean => {
    // Try every promotion: a knight's reach might be the only way out.
    if (g.promoting) return (["queen", "rook", "bishop", "knight"] as const).some(kind => visit(promote(g, g.promoting!, kind).run));
    if (g.phase !== "player") return g.phase !== "defeat";
    const k = key(g);
    if (seen.has(k)) return false;
    seen.add(k);
    if (!inCheck(g)) return true;
    for (const u of g.units.filter(u => u.side === "white")) {
      for (const t of moveTargets(g, u)) if (visit(move(g, u.id, t))) return true;
      for (const t of attackTargets(g, u)) if (visit(attack(g, u.id, t.id!).run)) return true;
      for (const a of altActions(g, u, g.energy)) for (const t of a.targets.length ? a.targets : [undefined]) if (visit(alt(g, u.id, a.id, t).run)) return true;
      if (!u.acted && g.energy >= 1 && visit(defend(g, u.id))) return true;
    }
    return false;
  };
  return visit(start);
}
/** Ends the player's turn: the enemy acts, then the player's pool refills. */
export function endTurn(g: Run): { run: Run; steps: Step[]; spent: number } {
  if (g.phase !== "player" || g.promoting) return { run: g, steps: [], spent: 0 };
  // In check you must get the king safe first, unless nothing this turn can.
  if (inCheck(g) && canEscape(g)) return { run: g, steps: [], spent: 0 };
  const { run, steps, spent } = enemyTurn(endOfTurn(g, "white"));
  if (run.phase !== "player") return { run, steps, spent };
  const turn = run.turn + 1;
  const limit = boardOf(run).turns;
  if (limit !== undefined && turn > limit) return { run: { ...run, phase: "defeat", log: ["Out of moves. The Grandmaster resets the board.", ...run.log] }, steps, spent };
  const units = run.units.map((u): Unit => (u.side === "white" ? { id: u.id, side: u.side, kind: u.kind, variant: u.variant, hp: u.hp, x: u.x, y: u.y, mods: u.mods } : u));
  const fresh = finish(startOfTurn({ ...run, units, energy: ENERGY, turn }, "white", turn));
  return { run: fresh, steps, spent };
}
/** The end of `side`'s turn: each of its pieces' endTurn hooks run (Marmalade dozes off again). */
function endOfTurn(g: Run, side: Side): Run {
  let run = g;
  for (const u of g.units.filter(u => u.side === side)) {
    const hook = abilityOf(u)?.endTurn, now = run.units.find(x => x.id === u.id);
    if (hook && now) run = hook(run, now);
  }
  return run;
}
/** The start of `side`'s turn number `turn`: timed statuses expire, burning pieces take 1, and each
 * piece's startTurn hook runs (Wick burns down). Pieces that drop to 0 are removed. */
function startOfTurn(g: Run, side: Side, turn: number): Run {
  let run: Run = { ...g, units: g.units.map(u => (u.side === side ? { ...u, mods: expireMods(u, turn) } : u)) };
  for (const u of g.units.filter(u => u.side === side)) {
    const me = run.units.find(x => x.id === u.id);
    if (!me) continue;
    const burning = typeof me.mods?.burning === "number" ? me.mods.burning : 0;
    if (burning > 0) {
      const mods: Mods = { ...me.mods }; if (burning > 1) mods.burning = burning - 1; else delete mods.burning;
      run = note({ ...run, units: withUnit(run, me.id, { hp: me.hp - 1, mods: Object.keys(mods).length ? mods : undefined }) }, `${label(me)} burns for 1.`);
    }
    const hook = abilityOf(me)?.startTurn;
    const now = run.units.find(x => x.id === u.id);
    if (hook && now && now.hp > 0) run = hook(run, now);
  }
  return removeDead(run);
}

export function campReason(g: Run, choice: CampChoice): string {
  if (g.phase !== "camp") return "Camp is closed";
  if (g.gold < costOf(choice)) return "Not enough gold";
  if (choice === "heal" && (g.units.find(u => u.id === "king")?.hp ?? 0) >= HP.king) return "King at full health";
  const army = g.units.filter(u => u.side === "white").length + (g.recruits?.length ?? 0);
  if (choice !== "heal" && army >= (ENCOUNTERS[g.encounter + 1]?.starts.length ?? 0)) return "No room on the next road";
  return "";
}
/** Spend gold at the hub: mend the king now, or add a recruit to the barracks. You can buy as often as gold and room allow. */
export function buy(g: Run, choice: CampChoice): Run {
  if (campReason(g, choice)) return g;
  const recruit = recruitOf(choice);
  const paid = { ...g, gold: g.gold - costOf(choice), history: [...g.history, `Camp: ${!recruit ? "heal" : recruit.variant === "rebel" ? recruit.kind : `${recruit.variant} ${recruit.kind}`}`] };
  if (!recruit) return { ...paid, units: g.units.map(u => (u.id === "king" ? { ...u, hp: Math.min(HP.king, u.hp + 2) } : u)) };
  return { ...paid, recruits: [...(g.recruits ?? []), recruit] };
}
/** Take the road: the army and any recruits march into the next battle. */
export function leaveCamp(g: Run): Run {
  if (g.phase !== "camp") return g;
  const recruits = g.recruits ?? [];
  const army = [...g.units.filter(u => u.side === "white"), ...recruits.map((r, i): Unit => ({ id: `ally-${g.nextId + i}`, side: "white", kind: r.kind, variant: r.variant, hp: maxHp({ side: "white", variant: r.variant, kind: r.kind }), x: 0, y: 0 }))];
  return spawn({ ...g, encounter: g.encounter + 1, nextId: g.nextId + recruits.length, recruits: undefined, history: [...g.history, "Camp: road"] }, army);
}

export function readRun(raw: string | null): Run | null {
  try {
    const g = JSON.parse(raw ?? "null") as Run | null;
    if (!g || g.version !== 2 || !Number.isInteger(g.encounter) || !Number.isInteger(g.turn) || g.turn < 1 || !ENCOUNTERS[g.encounter] || !["player", "camp", "victory", "defeat"].includes(g.phase)) return null;
    if (g.puzzle !== undefined && (!Number.isInteger(g.puzzle) || !PUZZLES[g.puzzle] || g.phase === "camp")) return null;
    if (!Array.isArray(g.units) || !Array.isArray(g.log) || !Array.isArray(g.history) || !Number.isFinite(g.gold) || !Number.isInteger(g.turn) || !Number.isInteger(g.nextId) || !Number.isInteger(g.energy) || g.energy < 0 || g.energy > ENERGY) return null;
    if (g.phase !== "defeat" && !g.units.some(u => u.id === "king" && u.side === "white")) return null;
    if (g.phase === "player" && !g.units.some(u => u.side === "black")) return null;
    const isRecruit = (r: unknown): r is Recruit => !!r && typeof r === "object" && RECRUIT_KINDS.includes((r as Recruit).kind) && VARIANTS.includes((r as Recruit).variant);
    if (g.recruits !== undefined && (g.phase !== "camp" || !Array.isArray(g.recruits) || !g.recruits.every(isRecruit) || g.units.filter(u => u.side === "white").length + g.recruits.length > (ENCOUNTERS[g.encounter + 1]?.starts.length ?? 0))) return null;
    if (g.promoting !== undefined && (g.phase !== "player" || !g.units.some(u => u.id === g.promoting && u.side === "white" && u.kind === "pawn" && u.y === 0))) return null;
    const okMods = (m: unknown) => m === undefined || (!!m && typeof m === "object" && !Array.isArray(m) && Object.values(m as object).every(v => ["string", "number", "boolean"].includes(typeof v)));
    if (g.units.some(u => (u.variant !== undefined && !VARIANTS.includes(u.variant)) || !okMods(u.mods))) return null;
    const okPosList = (l: unknown) => l === undefined || (Array.isArray(l) && l.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y)));
    if (!okPosList(g.walls) || !okPosList(g.broken) || !okPosList(g.collapsed) || !okPosList(g.gatesOpen) || !okMods(g.flags)) return null;
    const e = boardOf(g);
    if (g.collapsed?.some(c => !e.crumbling?.some(t => same(t, c))) || g.gatesOpen?.some(p => !e.gates?.some(x => same(x.at, p)))) return null;
    if (g.units.some(u => typeof u.id !== "string" || !Object.hasOwn(HP, u.kind) || !Number.isInteger(u.x) || !Number.isInteger(u.y) || !["white", "black"].includes(u.side) || !passable(g, u) || !Number.isFinite(u.hp) || u.hp <= 0 || u.hp > maxHp(u))) return null;
    if (new Set(g.units.map(u => u.id)).size !== g.units.length || new Set(g.units.map(u => `${u.x},${u.y}`)).size !== g.units.length) return null;
    return g;
  } catch { return null; }
}
