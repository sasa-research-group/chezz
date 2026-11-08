/** Escape from Exile, turn-based: you act, then the enemy acts. A piece moves once, then strikes:
 * under chess movement along its chess shape (sliding any distance; striking the next square, or any
 * distance for a ranged kind), under tactics movement by walking a few squares and striking within a
 * distance. A struck piece that survives strikes back if it can reach the attacker. The rules file says
 * how many pieces per side act each turn. Pure and deterministic: no DOM, no randomness, inputs are
 * never mutated. */
import levelsFile from "./levels/levels.json" with { type: "json" };
import rulesFile from "./rules.json" with { type: "json" };
import { ITEMS, actsPerTurn, parseRules } from "./rules";
import type { Item, Rules } from "./rules";
export type { Item, Movement, Reach, Rules, TurnMode } from "./rules";
export type Side = "white" | "black";
export type Kind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Pos = { x: number; y: number };
/** `decoy`: a straw pawn placed by the Decoy item. It never moves, strikes or strikes back. */
export type Unit = Pos & { id: string; side: Side; kind: Kind; hp: number; moved?: boolean; acted?: boolean; decoy?: true };
export type Target = Pos & { id?: string };
/** An enemy on its square: kind, x, y and its starting HP. HP left out means full health; HP above the
 * kind's max (stats retuned since the level was saved) is clamped to the max. */
export type Spawn = [Kind, number, number] | [Kind, number, number, number];
/** What a switch does when pressed. Only spears today; new kinds of switch add a type here. */
export type SwitchType = "spears";
/** A switch on the floor and the trap it springs. "spears": once one of your pieces steps onto it, spears
 * shoot along every listed row (y) from the board's left edge and hit every piece on it, either side. */
export type Trap = Pos & { type: SwitchType; rows: number[]; damage: number };
export type Encounter = { story?: string; reward: number; width: number; height: number; walls: Pos[]; switches?: Trap[]; spawns: Spawn[]; starts: Pos[]; tutorial?: TutorialStop; handout?: Handout };
/** What a level hands the player when it starts. A level that lists items replaces the bag with them
 * (the tutorial uses this so each lesson starts with exactly its items). */
export type Handout = { items?: Item[] };
/** Marks a level as part of the tutorial: the army it deals, exactly as placed. */
export type TutorialStop = { army: Placed[] };
export type Run = {
  version: 2; encounter: number; turn: number;
  /** "deploy": before a battle's first turn, while you rearrange your pieces on the start squares. */
  phase: "deploy" | "player" | "camp" | "victory" | "defeat";
  gold: number; units: Unit[]; log: string[]; history: string[]; nextId: number;
  /** Recruits bought at the hub, waiting in the barracks until you take the road. */
  recruits?: Recruit[];
  /** A tutorial run: the tutorial levels in order, each with its own preset army, no hideout and no gold. Missing: the roguelike. */
  tutorial?: true;
  /** A studio test run's level, played on its own: it replaces the run's battle list and ends the run when won. Never saved. */
  level?: Encounter;
  /** A studio run's unsaved rules, in place of `rules.json`. Never saved. */
  rules?: Rules;
  /** A battle list in place of `levels/levels.json` (tests play fixed battles). Never saved. */
  levels?: Encounter[];
  /** The side whose acting piece fell to a strikeback this turn: the fallen piece still counts toward
   * that side's pieces per turn. */
  fell?: Side;
  /** How many of `fell`'s acting pieces fell this turn (missing: 1). */
  fallen?: number;
  /** Switches (indexes into the level's `switches`) already sprung this battle (missing: none). */
  sprung?: number[];
  /** The team's bag of one-use items (missing: empty). */
  items?: Item[];
  /** An item has been used this turn (one per turn); End turn clears it. */
  itemUsed?: true;
};
/** What a run plays by, when it isn't the shipped files: tests pass fixed data so retuning the files can't move them. */
export type GameData = { rules?: Rules; levels?: Encounter[] };
export type Recruit = "pawn" | "bishop" | "rook";
/** A piece placed on a given square: a studio test army. */
export type Placed = Pos & { kind: Kind };
/** One beat of play for presentation: who acted, how, on whom, and who fell. */
export type Step = { text: string; /** The target's strikeback, as logged, when the strike drew one. */ counter?: string; /** Rows a sprung spear trap swept. */ rows?: number[]; units: Unit[]; focus: Pos[]; damage: { id: string; amount: number }[]; actor: string; kind: "move" | "strike" | "spring" | "item"; target?: string; killed: string[]; /** The item used, for an "item" step. */ item?: Item; /** The squares a bomb blasted. */ area?: Pos[] };

const loaded = parseRules(rulesFile);
if (!loaded.ok) throw new Error(`src/game/rules.json: ${loaded.errors.join("; ")}`);
/** Piece stats and rule switches from `rules.json` (edited in the studio's Mechanics tab; checked by `rules.ts`). */
export const RULES: Rules = loaded.rules;
export const HP = RULES.hp;
export const DAMAGE = RULES.damage;
/** The rules a run plays by: a studio run's own, or the file's. */
export const rulesOf = (g: Run): Rules => g.rules ?? RULES;
/** The run's battles, in order, from `levels/levels.json` (edited in the studio's level designer; checked by `levels.ts`). */
export const ENCOUNTERS = levelsFile.levels as unknown as Encounter[];
/** The run's battle list: its own, or the file's. */
export const levelsOf = (g: Run): Encounter[] => g.levels ?? ENCOUNTERS;
/** The battle this run is fighting: a test run's own level, or the run's current encounter. */
export const levelOf = (g: Run): Encounter => g.level ?? levelsOf(g)[g.encounter];
/** The tutorial's battles, as indexes into the level list: the levels with a `tutorial` block, in order. */
export const tutorialCourse = (levels: Encounter[]): number[] => levels.flatMap((l, i) => (l.tutorial ? [i] : []));
/** The roguelike's battles: the levels outside the tutorial, or every level while there are none. */
export function roguelikeCourse(levels: Encounter[]): number[] {
  const own = levels.flatMap((l, i) => (l.tutorial ? [] : [i]));
  return own.length ? own : levels.map((_, i) => i);
}
/** The battles this run plays, in order. */
export const courseOf = (g: Run): number[] => (g.tutorial ? tutorialCourse : roguelikeCourse)(levelsOf(g));
/** The level index after this run's current battle, or undefined on its last. */
const nextIndex = (g: Run): number | undefined => { const c = courseOf(g); return c[c.indexOf(g.encounter) + 1]; };
/** The HP an enemy spawns with under rules `r`: full when the level leaves it out, never above the kind's max. */
export const spawnHp = (r: Rules, [kind, , , hp]: Spawn): number => Math.max(1, Math.min(r.hp[kind], hp ?? r.hp[kind]));
export type CampChoice = Recruit | "heal";
export const COST: Record<CampChoice, number> = RULES.cost;

export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
export const coord = (g: Run, p: Pos) => "abcdefgh"[p.x] + (levelOf(g).height - p.y);
export const at = (g: Run, p: Pos) => g.units.find(u => same(u, p));
export const kindName = (k: string) => k[0].toUpperCase() + k.slice(1);
export const label = (u: Unit) => u.decoy ? "Decoy" : u.side === "white" ? kindName(u.kind) : `Enemy ${u.kind}`;
/** A piece's full HP: its kind's, or the Decoy item's for a decoy. */
export const maxHp = (r: Rules, u: Unit) => u.decoy ? r.items.decoy.hp : r.hp[u.kind];
export function passable(g: Run, p: Pos) {
  const e = levelOf(g);
  return p.x >= 0 && p.y >= 0 && p.x < e.width && p.y < e.height && !e.walls.some(w => same(w, p));
}
const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const STRAIGHTS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const LEAPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const slides = (k: Kind) => k === "rook" ? STRAIGHTS : k === "bishop" ? DIAGONALS : k === "queen" ? [...STRAIGHTS, ...DIAGONALS] : null;
const forward = (u: Unit) => u.side === "white" ? -1 : 1;
/** Damage a strike from `a` deals to `v`. */
const hitFor = (g: Run, a: Unit) => rulesOf(g).damage[a.kind];

const tactics = (g: Run) => rulesOf(g).movement === "tactics";
/** How many of a side's pieces have moved or struck this turn, the fallen ones included. */
const actorsUsed = (g: Run, side: Side, except?: string) =>
  g.units.filter(v => v.side === side && v.id !== except && (v.moved || v.acted)).length + (g.fell === side ? g.fallen ?? 1 : 0);
/** The side has already used up its pieces per turn on other pieces, so u can't act. */
export function sidelined(g: Run, u: Unit): boolean {
  return actorsUsed(g, u.side, u.id) >= actsPerTurn(rulesOf(g));
}

/** Empty squares a piece can move to this turn. */
export function moveTargets(g: Run, u: Unit): Target[] {
  if (u.decoy || u.moved || u.acted || sidelined(g, u)) return [];
  const out: Target[] = [];
  const open = (p: Pos) => passable(g, p) && !at(g, p);
  const dirs = slides(u.kind);
  if (tactics(g)) {
    // A walk: up to `move` straight steps, turning freely, through empty squares only.
    const seen = new Set([`${u.x},${u.y}`]);
    let edge: Pos[] = [u];
    for (let n = 0; n < rulesOf(g).tactics.move[u.kind]; n++) {
      edge = edge.flatMap(q => STRAIGHTS.map(([dx, dy]) => ({ x: q.x + dx, y: q.y + dy }))).filter(p => {
        const k = `${p.x},${p.y}`;
        if (seen.has(k) || !open(p)) return false;
        seen.add(k);
        return true;
      });
      out.push(...edge);
    }
  } else if (dirs) {
    for (const [dx, dy] of dirs) for (let n = 1; ; n++) {
      const p = { x: u.x + dx * n, y: u.y + dy * n };
      if (!open(p)) break;
      out.push(p);
    }
  } else if (u.kind === "knight") {
    for (const [dx, dy] of LEAPS) { const p = { x: u.x + dx, y: u.y + dy }; if (open(p)) out.push(p); }
  } else {
    const steps = u.kind === "king" ? [...STRAIGHTS, ...DIAGONALS] : [[0, forward(u)]];
    for (const [dx, dy] of steps) { const p = { x: u.x + dx, y: u.y + dy }; if (open(p)) out.push(p); }
  }
  return out;
}

/** Enemies a piece can strike this turn from where it stands (see `reaches`). */
export function attackTargets(g: Run, u: Unit): Target[] {
  if (u.decoy || u.acted || sidelined(g, u)) return [];
  return g.units.filter(v => v.side !== u.side && reaches(g, u, u, v)).map(v => ({ x: v.x, y: v.y, id: v.id }));
}

/** Squares u could step to and then strike the target from this turn. For your pieces, the walk and
 * strike count as one move: it's allowed if the king is safe once the strike lands. Empty when u can
 * already strike it where it stands (no walk needed). */
export function approaches(g: Run, id: string, targetId: string): Pos[] {
  const u = g.units.find(v => v.id === id), v = g.units.find(w => w.id === targetId);
  if (!u || !v || u.acted || v.side === u.side || attackTargets(g, u).some(t => t.id === v.id)) return [];
  return moveTargets(g, u).filter(t => reaches(g, u, t, v) && (u.side !== "white" || walkAndStrike(g, id, t, targetId) !== null));
}

/** The steps a piece strikes along: its capture shape. */
const strikeSteps = (u: Unit) => u.kind === "pawn" ? [[1, forward(u)], [-1, forward(u)]] : u.kind === "knight" ? LEAPS : slides(u.kind) ?? [...STRAIGHTS, ...DIAGONALS];
/** A strikeback happens only between pieces striking from one step away: a ranged strike never draws one,
 * and a ranged piece never strikes back from afar. */
export const strikesBack = (g: Run, attacker: Unit, target: Unit) =>
  rulesOf(g).counter && !target.decoy && reaches(g, attacker, attacker, target, true) && reaches(g, target, target, attacker, true);
/** Could u, standing on `from`, strike `target`? Under chess movement a strike reaches one step in the
 * piece's capture shape, or, for a kind whose range is "line", any number of steps along it as long as
 * every square between is open: the first piece or wall in the way stops it. u's own square never blocks
 * (it may have moved). Under tactics movement it reaches any square within the kind's `reach` in
 * king steps, over pieces and walls. `near`: only from one step away. */
export function reaches(g: Run, u: Unit, from: Pos, target: Pos, near = false): boolean {
  const dx = target.x - from.x, dy = target.y - from.y;
  if (tactics(g)) {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return d >= 1 && d <= (near ? 1 : rulesOf(g).tactics.reach[u.kind]);
  }
  const line = !near && rulesOf(g).range[u.kind] === "line";
  for (const [sx, sy] of strikeSteps(u)) {
    const n = sx ? dx / sx : dy / sy;
    if (!Number.isInteger(n) || n < 1 || dx !== sx * n || dy !== sy * n || (n > 1 && !line)) continue;
    let open = true;
    for (let k = 1; k < n && open; k++) {
      const p = { x: from.x + sx * k, y: from.y + sy * k };
      open = passable(g, p) && !g.units.some(w => w.id !== u.id && same(w, p));
    }
    if (open) return true;
  }
  return false;
}

/** Deals a battle: your army fills the start squares in order (unless `placed`, when each piece
 * already stands on its square), and the battle opens in the deploy phase. */
function spawn(g: Run, army: Unit[], placed = false): Run {
  const e = levelOf(g);
  // A level with fewer starts than the army (allowed, with a warning) loses the extras.
  const whites = placed ? army.map(u => ({ id: u.id, side: u.side, kind: u.kind, hp: u.hp, x: u.x, y: u.y })) : army.slice(0, e.starts.length).map((u, i) => ({ id: u.id, side: u.side, kind: u.kind, hp: u.hp, ...e.starts[i] }));
  const enemies = e.spawns.map((s, i) => ({ id: `enemy-${g.encounter}-${i}`, kind: s[0], side: "black" as const, x: s[1], y: s[2], hp: spawnHp(rulesOf(g), s) }));
  return { ...g, units: [...whites, ...enemies], phase: "deploy", turn: 1, log: [], sprung: undefined, itemUsed: undefined, items: handoutBag(g, e) };
}
/** The bag a battle opens with: a level that hands out items replaces the bag with them (up to the
 * slots). In the tutorial every level replaces it, so a lesson without a hand-out starts empty. */
function handoutBag(g: Run, e: Encounter): Item[] | undefined {
  const given = e.handout?.items;
  if (given?.length) return given.slice(0, rulesOf(g).slots);
  return g.tutorial ? undefined : g.items;
}
/** Deploy phase: move your piece to another start square, swapping places with your piece there. */
export function deploy(g: Run, id: string, to: Pos): Run {
  const u = g.units.find(v => v.id === id);
  if (g.phase !== "deploy" || !u || u.side !== "white" || same(u, to) || !levelOf(g).starts.some(s => same(s, to))) return g;
  const there = at(g, to);
  if (there && there.side !== "white") return g;
  return { ...g, units: g.units.map(v => v.id === u.id ? { ...v, x: to.x, y: to.y } : there && v.id === there.id ? { ...v, x: u.x, y: u.y } : v) };
}
/** Ends the deploy phase: the battle's first turn begins. */
export const begin = (g: Run): Run => g.phase === "deploy" ? { ...g, phase: "player" } : g;
const withData = (g: Run, data?: GameData): Run => ({ ...g, ...(data?.rules && { rules: data.rules }), ...(data?.levels && { levels: data.levels }) });
/** A fresh run at battle 1. `data` plays it by fixed rules and battles instead of the files. */
export function newRun(data?: GameData): Run {
  const r = data?.rules ?? RULES;
  const g = withData({ version: 2, encounter: 0, turn: 1, phase: "player", gold: r.gold, units: [], log: [], history: [], nextId: 1 }, data);
  return spawn({ ...g, encounter: courseOf(g)[0] }, [{ id: "king", side: "white", kind: "king", hp: r.hp.king, x: 0, y: 0 }]);
}
/** Units for an army: kinds fill the start squares in order; placed pieces keep their squares. */
function armyOf(army: (Kind | Placed)[], r: Rules): Unit[] {
  const kinds = army.map(a => (typeof a === "string" ? a : a.kind));
  return army.map((a, i) => ({ id: kinds[i] === "king" && !kinds.slice(0, i).includes("king") ? "king" : `ally-${i}`, side: "white", kind: kinds[i], hp: r.hp[kinds[i]], x: typeof a === "string" ? 0 : a.x, y: typeof a === "string" ? 0 : a.y }));
}
const isPlaced = (army: (Kind | Placed)[]) => army.length > 0 && typeof army[0] !== "string";
/** A studio test run: one level on its own with a given army, shown as battle `index + 1`. Kinds fill
 * the starts in order (king first); placed pieces stand where they're placed. `rules` plays it by the
 * studio's unsaved rules instead of the file's. */
export function testRun(level: Encounter, army: Kind[] | Placed[], index: number, rules?: Rules): Run {
  return spawn({ ...newRun(), encounter: index, level, nextId: army.length, ...(rules ? { rules, gold: rules.gold } : {}) }, armyOf(army, rules ?? RULES), isPlaced(army));
}
/** A fresh tutorial run at level `index` (by default the tutorial's first), dealt that level's preset army. */
export function tutorialRun(data?: GameData, index?: number): Run {
  const g = withData({ version: 2, tutorial: true, encounter: 0, turn: 1, phase: "player", gold: 0, units: [], log: [], history: [], nextId: 1 }, data);
  const at = index ?? tutorialCourse(levelsOf(g))[0];
  if (!levelsOf(g)[at]?.tutorial) throw new Error(`Level ${at + 1} is not in the tutorial`);
  return dealTutorial({ ...g, encounter: at });
}
const dealTutorial = (g: Run): Run => {
  const army = levelOf(g).tutorial!.army;
  return spawn({ ...g, nextId: army.length }, armyOf(army, rulesOf(g)), true);
};
/** After losing a tutorial battle: the same battle again, dealt fresh. */
export const retry = (g: Run): Run => (g.tutorial && g.phase === "defeat" ? tutorialRun({ rules: g.rules, levels: g.levels }, g.encounter) : g);
/** A fresh run that starts at battle `index` with a given army and gold, then carries on as usual. */
export function startAt(index: number, army: Kind[] | Placed[], gold: number, data?: GameData): Run {
  return spawn({ ...newRun(data), encounter: index, gold, nextId: army.length }, armyOf(army, data?.rules ?? RULES), isPlaced(army));
}

const withUnit = (g: Run, id: string, patch: Partial<Unit>) => g.units.map(u => (u.id === id ? { ...u, ...patch } : u));
function finish(g: Run): Run {
  if (!g.units.some(u => u.id === "king")) return { ...g, phase: "defeat", log: ["King captured", ...g.log] };
  if (!g.units.some(u => u.side === "black")) {
    const last = !!g.level || nextIndex(g) === undefined, reward = g.tutorial ? 0 : levelOf(g).reward;
    // Decoys stay behind on the field they were placed on.
    return { ...g, units: g.units.filter(u => !u.decoy), phase: last ? "victory" : "camp", gold: g.gold + reward, log: [last ? "Victory" : g.tutorial ? "Battle won" : `+${reward} ✦`, ...g.log] };
  }
  return g;
}
const note = (g: Run, text: string): Run => ({ ...g, log: [text, ...g.log].slice(0, 30), history: [...g.history, text] });

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
/** A move that also reports the spear trap it springs, if it ends on an armed switch. */
export function stepOnto(g: Run, id: string, to: Pos): { run: Run; step: Step | null } {
  const result = moveWithTrap(g, id, to);
  return intoCheck(g, result.run) ? { run: g, step: null } : result;
}
const moveUnchecked = (g: Run, id: string, to: Pos): Run => moveWithTrap(g, id, to).run;
function moveWithTrap(g: Run, id: string, to: Pos): { run: Run; step: Step | null } {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || !u || u.side !== "white") return { run: g, step: null };
  const t = moveTargets(g, u).find(t => same(t, to));
  if (!t) return { run: g, step: null };
  const moved = note({ ...g, units: withUnit(g, id, { x: to.x, y: to.y, moved: true }) }, `${label(u)} → ${coord(g, to)}`);
  const trap = armedSwitch(g, to);
  return trap < 0 ? { run: moved, step: null } : spring(moved, trap, id);
}

/** The index of the armed (not yet sprung) switch on square p, or -1. */
export function armedSwitch(g: Run, p: Pos): number {
  return (levelOf(g).switches ?? []).findIndex((s, i) => same(s, p) && !g.sprung?.includes(i));
}
/** Rows the level's armed switches would sweep with spears. */
export const armedRows = (g: Run): number[] => [...new Set((levelOf(g).switches ?? []).flatMap((s, i) => (g.sprung?.includes(i) ? [] : s.rows)))];
/** Springs switch `i`, pressed by piece `by`: spears fly along its rows and hit every piece on them, yours
 * too. Pressing it is the piece's action for the turn. */
function spring(g: Run, i: number, by: string): { run: Run; step: Step } {
  const trap = levelOf(g).switches![i];
  const hit = g.units.filter(u => trap.rows.includes(u.y));
  const damage = hit.map(u => ({ id: u.id, amount: trap.damage }));
  const killed = hit.filter(u => u.hp <= trap.damage).map(u => u.id);
  const units = g.units.flatMap(u => killed.includes(u.id) ? [] : hit.includes(u) ? [{ ...u, hp: u.hp - trap.damage }] : [u]);
  const text = `Spears −${trap.damage}${hit.length ? ` × ${hit.length}` : ""}${killed.length ? ` · ${killed.length} killed` : ""}`;
  const run = finish(note({ ...g, units: units.map(u => (u.id === by ? { ...u, acted: true } : u)), sprung: [...(g.sprung ?? []), i] }, text));
  return { run, step: { text, units: run.units, focus: hit.map(u => ({ x: u.x, y: u.y })), damage, actor: by, kind: "spring", rows: trap.rows, killed } };
}

/** Resolves one strike for either side. A target that survives strikes back with its own damage if it
 * can reach the attacker's square (and strikebacks are on). */
function strike(g: Run, a: Unit, t: Target): { run: Run; step: Step } {
  const v = g.units.find(u => u.id === t.id)!;
  const dealt = hitFor(g, a);
  const survives = v.hp > dealt;
  // Strikes land from where the striker stands; it never moves onto the target's square.
  let units = g.units.flatMap(u => u.id === v.id ? (survives ? [{ ...u, hp: u.hp - dealt }] : []) : u.id === a.id ? [{ ...u, acted: true }] : [u]);
  const damage = [{ id: v.id, amount: dealt }];
  const text = `${label(a)} strikes ${label(v).toLowerCase()} −${dealt}${survives ? "" : " · killed"}`;
  let counter: string | undefined;
  if (survives && strikesBack({ ...g, units }, a, v)) {
    const back = rulesOf(g).damage[v.kind], left = a.hp - back;
    units = left > 0 ? units.map(u => (u.id === a.id ? { ...u, hp: left } : u)) : units.filter(u => u.id !== a.id);
    if (left <= 0) g = { ...g, fell: a.side, fallen: (g.fell === a.side ? g.fallen ?? 1 : 0) + 1 };
    damage.push({ id: a.id, amount: back });
    counter = `${label(v)} counters −${back}${left > 0 ? "" : " · killed"}`;
  }
  const struck = note({ ...g, units }, text), run = counter ? note(struck, counter) : struck;
  const killed = g.units.filter(u => !run.units.some(w => w.id === u.id)).map(u => u.id);
  return { run, step: { text, counter, units: run.units, focus: [{ x: v.x, y: v.y }], damage, actor: a.id, kind: "strike", target: v.id, killed } };
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
  if (walked === g) return null;
  const { run, step } = attackUnchecked(walked, id, targetId);
  if (run === walked || !step || intoCheck(g, run)) return null;
  return { walked, run, step };
}
/** Enemies the piece could strike this turn (in place or after a walk-up), but only by leaving its king in check. */
export function unsafeStrikes(g: Run, id: string): string[] {
  const u = g.units.find(v => v.id === id);
  if (!u || u.acted) return [];
  const walks = moveTargets(g, u);
  return g.units.filter(v => v.side !== u.side && (attackTargets(g, u).some(t => t.id === v.id) ? strikeExposesKing(g, id, v.id) : walks.some(t => reaches(g, u, t, v)) && !approaches(g, id, v.id).length)).map(v => v.id);
}
/** Would this strike (through the counter it draws) put your own king in check? */
export function strikeExposesKing(g: Run, id: string, targetId: string): boolean { return intoCheck(g, attackUnchecked(g, id, targetId).run); }
function attackUnchecked(g: Run, id: string, targetId: string): { run: Run; step: Step | null } {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || !u || u.side !== "white") return { run: g, step: null };
  const t = attackTargets(g, u).find(t => t.id === targetId);
  if (!t) return { run: g, step: null };
  const { run, step } = strike(g, u, t);
  return { run: finish(run), step };
}

/** The squares a bomb with its top-left corner on `corner` blasts: an area × area square, cut off at the board's edge. */
export function blastArea(g: Run, corner: Pos): Pos[] {
  const n = rulesOf(g).items.bomb.area, e = levelOf(g);
  return Array.from({ length: n * n }, (_, i) => ({ x: corner.x + (i % n), y: corner.y + Math.floor(i / n) })).filter(p => p.x < e.width && p.y < e.height);
}
/** Where an item could go, before the check guard: a bomb's corner, wherever its square holds an enemy;
 * a decoy, any empty square (not an armed switch) next to one of your pieces. */
function itemSquares(g: Run, item: Item): Pos[] {
  const e = levelOf(g), out: Pos[] = [];
  if (item === "bomb") {
    const n = rulesOf(g).items.bomb.area;
    for (let y = 0; y <= Math.max(0, e.height - n); y++) for (let x = 0; x <= Math.max(0, e.width - n); x++)
      if (blastArea(g, { x, y }).some(p => at(g, p)?.side === "black")) out.push({ x, y });
    return out;
  }
  const next = (p: Pos) => g.units.some(u => u.side === "white" && !u.decoy && Math.max(Math.abs(u.x - p.x), Math.abs(u.y - p.y)) === 1);
  for (let y = 0; y < e.height; y++) for (let x = 0; x < e.width; x++) {
    const p = { x, y };
    if (passable(g, p) && !at(g, p) && armedSwitch(g, p) < 0 && next(p)) out.push(p);
  }
  return out;
}
/** Squares the item can be used on now without putting your king in check (see `itemSquares`). */
export function itemTargets(g: Run, item: Item): Pos[] {
  if (g.phase !== "player" || g.itemUsed || !g.items?.includes(item)) return [];
  return itemSquares(g, item).filter(p => !intoCheck(g, useUnchecked(g, item, p).run));
}
/** Why the item can't be used right now, or "" if it can. */
export function itemReason(g: Run, item: Item): string {
  if (g.phase !== "player") return "Not now";
  if (!g.items?.includes(item)) return "None left";
  if (g.itemUsed) return "One item per turn";
  return itemTargets(g, item).length ? "" : "No target";
}
/** Uses one item from the bag on `target` (a bomb's top-left corner, or a decoy's square). Free: it
 * doesn't use up a piece's move or strike, but only one item a turn, and it can't be taken back. */
export function useItem(g: Run, item: Item, target: Pos): { run: Run; step: Step | null } {
  const result = useUnchecked(g, item, target);
  return intoCheck(g, result.run) ? { run: g, step: null } : result;
}
function useUnchecked(g: Run, item: Item, target: Pos): { run: Run; step: Step | null } {
  if (g.phase !== "player" || g.itemUsed || !g.items?.includes(item) || !itemSquares(g, item).some(p => same(p, target))) return { run: g, step: null };
  const i = g.items.indexOf(item), r = rulesOf(g);
  const spent: Run = { ...g, items: [...g.items.slice(0, i), ...g.items.slice(i + 1)], itemUsed: true };
  if (item === "decoy") {
    const id = `decoy-${g.nextId}`, text = `Decoy → ${coord(g, target)}`;
    const run = note({ ...spent, nextId: g.nextId + 1, units: [...g.units, { id, side: "white", kind: "pawn", hp: r.items.decoy.hp, x: target.x, y: target.y, decoy: true }] }, text);
    return { run, step: { text, units: run.units, focus: [target], damage: [], actor: id, kind: "item", item, killed: [] } };
  }
  const { damage } = r.items.bomb, area = blastArea(g, target);
  const hit = g.units.filter(u => u.side === "black" && area.some(p => same(p, u)));
  const killed = hit.filter(u => u.hp <= damage).map(u => u.id);
  const units = g.units.flatMap(u => killed.includes(u.id) ? [] : hit.includes(u) ? [{ ...u, hp: u.hp - damage }] : [u]);
  const text = `Bomb −${damage} × ${hit.length}${killed.length ? ` · ${killed.length} killed` : ""}`;
  const run = finish(note({ ...spent, units }, text));
  return { run, step: { text, units: run.units, focus: area, damage: hit.map(u => ({ id: u.id, amount: damage })), actor: "bomb", kind: "item", item, area, killed } };
}

/** For every square (indexed y * width + x), how many of u's own moves it takes from there to reach a
 * square it could strike one of `targets` from; Infinity where it can't. Other pieces and walls block;
 * u's own square doesn't. Kings, knights, sliders and tactics walks move the same both ways, so this
 * searches out from the strike squares. Not for chess pawns, which only go forward. */
function movesToStrike(g: Run, u: Unit, targets: Unit[]): number[] {
  const e = levelOf(g), W = e.width, H = e.height;
  const blocked = new Uint8Array(W * H);
  for (const w of e.walls) blocked[w.y * W + w.x] = 1;
  for (const v of g.units) if (v.id !== u.id) blocked[v.y * W + v.x] = 1;
  const dist: number[] = new Array(W * H).fill(Infinity), queue: number[] = [];
  for (let i = 0; i < W * H; i++) if (!blocked[i] && targets.some(w => reaches(g, u, { x: i % W, y: Math.floor(i / W) }, w))) { dist[i] = 0; queue.push(i); }
  const walk = tactics(g), dirs = walk ? STRAIGHTS : slides(u.kind) ?? (u.kind === "knight" ? LEAPS : [...STRAIGHTS, ...DIAGONALS]), slide = !walk && !!slides(u.kind);
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of dirs) for (let n = 1; ; n++) {
      const nx = x + dx * n, ny = y + dy * n, j = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked[j]) break;
      if (dist[j] === Infinity) { dist[j] = dist[i] + 1; queue.push(j); }
      if (!slide) break;
    }
  }
  // A walk counts single steps; a move covers up to `move` of them, so a partial move still counts as progress.
  if (walk) { const per = Math.max(1, rulesOf(g).tactics.move[u.kind]); return dist.map(d => d / per); }
  return dist;
}

/** Deterministic enemy policy: each enemy piece may move once, then strike once (only as many pieces
 * as the pieces per turn allow, the first to act). The best-scoring action across the pieces that may
 * still act goes first, repeated until nothing is worth doing. */
function enemyTurn(g: Run): { run: Run; steps: Step[] } {
  const r = rulesOf(g);
  let run: Run = { ...g, fell: undefined, fallen: undefined, units: g.units.map(u => (u.side === "black" ? { ...u, moved: false, acted: false } : u)) };
  const steps: Step[] = [];
  const gap = (p: Pos, w: Pos) => Math.max(Math.abs(p.x - w.x), Math.abs(p.y - w.y));
  const limit = 2 * run.units.filter(u => u.side === "black").length + 1;
  for (let guard = 0; guard < limit && run.phase === "player"; guard++) {
    const king = run.units.find(u => u.id === "king");
    if (!king) break;
    type Choice = { score: number; key: string; apply: () => { run: Run; step: Step } };
    const choices: Choice[] = [];
    for (const u of run.units.filter(u => u.side === "black")) {
      for (const t of attackTargets(run, u)) {
        const v = run.units.find(w => w.id === t.id)!;
        const dealt = hitFor(run, u);
        if (dealt === 0) continue;
        // A target that survives strikes back, unless either side strikes from range.
        const countered = dealt < v.hp && strikesBack(run, u, v) ? r.damage[v.kind] : 0;
        const score = 100 + dealt * 10 + (dealt >= v.hp ? 50 : 0) + (v.id === "king" ? 30 : 0) - countered * 8 - (countered >= u.hp ? 60 : 0);
        choices.push({ score, key: `a${u.id}${t.x}${t.y}`, apply: () => strike(run, u, t) });
      }
      // Close in on the king, or on whichever of your pieces is nearest: counted in the piece's own
      // moves around walls and pieces, so a slider behind a wall goes round it instead of freezing.
      const whites = run.units.filter(w => w.side === "white");
      const marches = u.kind === "pawn" && !tactics(run);
      const toKing = marches || u.moved || u.acted ? null : movesToStrike(run, u, [king]), toAny = toKing && movesToStrike(run, u, whites);
      const W = levelOf(run).width, routed = !!toAny && Number.isFinite(toAny[u.y * W + u.x]);
      const dist = (p: Pos) => routed ? Math.min(toKing![p.y * W + p.x] - 0.5, toAny![p.y * W + p.x]) : Math.min(gap(p, king) - 0.5, ...whites.map(w => gap(p, w)));
      for (const t of moveTargets(run, u)) {
        // Shorter trips break ties.
        const gain = dist(u) - dist(t), travel = gap(u, t) / 10;
        // Pawns keep marching toward pieces still ahead of them.
        const ahead = whites.some(w => (w.y - u.y) * forward(u) > 0);
        const march = marches && gain <= 0 && ahead ? 1 : 0;
        // A square to strike from is worth a step.
        const lineUp = !u.acted && whites.some(w => reaches(run, u, t, w));
        if (gain <= 0 && !march && !lineUp) continue;
        choices.push({ score: lineUp ? 20 - travel : march || gain * 5 - travel, key: `m${u.id}${t.x}${t.y}`, apply: () => {
          const text = `${label(u)} → ${coord(run, t)}`;
          const next = note({ ...run, units: withUnit(run, u.id, { x: t.x, y: t.y, moved: true }) }, text);
          return { run: next, step: { text, units: next.units, focus: [{ x: t.x, y: t.y }], damage: [], actor: u.id, kind: "move", killed: [] } };
        } });
      }
    }
    choices.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    const best = choices[0];
    if (!best || best.score <= 0) break;
    const done = best.apply();
    run = finish(done.run); steps.push(done.step);
  }
  return { run, steps };
}

/** The damage the enemy's next turn could deal your king. Each enemy piece that could strike him, in
 * place or after its one move, hits him once, and the hardest hits add up, as many as the pieces per
 * turn (under one move per turn, only the hardest single hit). `attackers` are the pieces whose hit
 * makes up that threat. Each piece is judged on the board as it stands. */
export function kingThreat(g: Run): { damage: number; attackers: string[] } {
  const king = g.units.find(u => u.id === "king");
  if (!king) return { damage: 0, attackers: [] };
  const fresh: Run = { ...g, units: g.units.map(u => (u.side === "black" ? { ...u, moved: false, acted: false } : u)) };
  const hits: { id: string; hit: number }[] = [];
  for (const u of fresh.units.filter(u => u.side === "black")) {
    const can = reaches(fresh, u, u, king) || moveTargets(fresh, u).some(t => reaches(fresh, u, t, king));
    const hit = can ? hitFor(fresh, u) : 0;
    if (hit > 0) hits.push({ id: u.id, hit });
  }
  const n = actsPerTurn(rulesOf(g));
  if (hits.length <= n) return { damage: hits.reduce((s, h) => s + h.hit, 0), attackers: hits.map(h => h.id) };
  const top = hits.map(h => h.hit).sort((a, b) => b - a).slice(0, n);
  // Every piece that could finish him alone is a checker; short of that, the hardest hitters (ties included).
  const bar = Math.min(top[n - 1], king.hp);
  return { damage: top.reduce((s, h) => s + h, 0), attackers: hits.filter(h => h.hit >= bar).map(h => h.id) };
}
/** Check: the enemy's next turn could kill your king. Threats that would only hurt him don't count. */
export function inCheck(g: Run): boolean {
  const king = g.units.find(u => u.id === "king");
  return g.phase === "player" && !!king && kingThreat(g).damage >= king.hp;
}
/** Could anything you still do this turn (moves, strikes and an item) get the king out of check? */
export function canEscape(start: Run): boolean {
  const seen = new Set<string>();
  const key = (g: Run) => g.units.map(u => `${u.id}${u.kind[0]}${u.x},${u.y}:${u.hp}${u.moved ? "m" : ""}${u.acted ? "a" : ""}`).join("|") + (g.fell ?? "") + (g.fallen ?? "") + (g.itemUsed ? "!" : (g.items ?? []).join());
  const visit = (g: Run): boolean => {
    if (g.phase !== "player") return g.phase !== "defeat";
    const k = key(g);
    if (seen.has(k)) return false;
    seen.add(k);
    if (!inCheck(g)) return true;
    for (const u of g.units.filter(u => u.side === "white")) {
      for (const t of moveTargets(g, u)) if (visit(move(g, u.id, t))) return true;
      for (const t of attackTargets(g, u)) if (visit(attack(g, u.id, t.id!).run)) return true;
    }
    for (const item of new Set(g.items ?? [])) for (const p of itemTargets(g, item)) if (visit(useItem(g, item, p).run)) return true;
    return false;
  };
  return visit(start);
}
/** Under a set number of pieces per turn, have your pieces done all they usefully can, so the turn
 * should pass on its own? True once the count is used up (or every piece has acted) and each piece
 * that acted has struck, or has moved and has nothing safe to strike. Always false when every piece acts. */
export function turnSpent(g: Run): boolean {
  const n = actsPerTurn(rulesOf(g));
  if (g.phase !== "player" || !Number.isFinite(n)) return false;
  // An item you could still use waits for End turn: items work before or after the piece acts.
  if ((g.items ?? []).some(item => !itemReason(g, item))) return false;
  const whites = g.units.filter(u => u.side === "white" && !u.decoy), used = whites.filter(u => u.moved || u.acted);
  if (actorsUsed(g, "white") < n && used.length < whites.length) return false;
  return used.every(u => u.acted || !attackTargets(g, u).some(t => !strikeExposesKing(g, u.id, t.id!)));
}
/** Your pieces' moves are spent. */
const handOver = (g: Run): Run => ({ ...g, fell: undefined, fallen: undefined, units: g.units.map(u => (u.side === "white" ? { ...u, moved: false, acted: false } : u)) });
/** What the enemy would do if you ended your turn now, step by step: its turn computed from the board
 * as it stands (a previewed move included). Nothing is changed; only End turn makes it happen. */
export function enemyPlan(g: Run): Step[] {
  // During deploy: what the enemy would do if the battle began as placed.
  return g.phase === "player" || g.phase === "deploy" ? enemyTurn(handOver({ ...g, phase: "player" })).steps : [];
}
/** One enemy piece's part of a plan: where it would move, and whom it would strike and for how much.
 * A piece with neither waits. */
export type Intent = { id: string; from: Pos; to?: Pos; strike?: { target: string; at: Pos; damage: number; kills: boolean } };
export function intentOf(g: Run, plan: Step[], id: string): Intent | null {
  const u = g.units.find(v => v.id === id);
  if (!u || u.side !== "black") return null;
  const intent: Intent = { id, from: { x: u.x, y: u.y } };
  for (const step of plan.filter(st => st.actor === id)) {
    if (step.kind === "move") { const to = step.units.find(v => v.id === id); if (to) intent.to = { x: to.x, y: to.y }; }
    else if (step.target) intent.strike = { target: step.target, at: step.focus[0], damage: step.damage.find(d => d.id === step.target)?.amount ?? 0, kills: step.killed.includes(step.target) };
  }
  return intent;
}
export const intentWaits = (i: Intent) => !i.to && !i.strike;
/** Ends the player's turn: the enemy acts, then your pieces are ready again. */
export function endTurn(g: Run): { run: Run; steps: Step[] } {
  if (g.phase !== "player") return { run: g, steps: [] };
  // In check you must get the king safe first, unless nothing this turn can.
  if (inCheck(g) && canEscape(g)) return { run: g, steps: [] };
  const { run: acted, steps } = enemyTurn(handOver(g));
  const run = steps.length ? acted : note(acted, "Enemy waits");
  if (run.phase !== "player") return { run, steps };
  const units = run.units.map(u => (u.side === "white" ? { id: u.id, side: u.side, kind: u.kind, hp: u.hp, x: u.x, y: u.y, ...(u.decoy && { decoy: true as const }) } : { ...u, moved: false, acted: false }));
  return { run: { ...run, fell: undefined, fallen: undefined, itemUsed: undefined, units, turn: run.turn + 1 }, steps };
}

export function campReason(g: Run, choice: CampChoice): string {
  const r = rulesOf(g);
  if (g.phase !== "camp") return "Camp is closed";
  if (g.tutorial) return "No camp in the tutorial";
  if (g.gold < r.cost[choice]) return "Not enough gold";
  if (choice === "heal" && (g.units.find(u => u.id === "king")?.hp ?? 0) >= r.hp.king) return "Full HP";
  const army = g.units.filter(u => u.side === "white").length + (g.recruits?.length ?? 0);
  if (choice !== "heal" && army >= (levelsOf(g)[nextIndex(g) ?? -1]?.starts.length ?? 0)) return "Army full";
  return "";
}
/** Spend gold at the hub: mend the king now, or add a recruit to the barracks. You can buy as often as gold and room allow. */
export function buy(g: Run, choice: CampChoice): Run {
  if (campReason(g, choice)) return g;
  const r = rulesOf(g);
  const paid = { ...g, gold: g.gold - r.cost[choice], history: [...g.history, `Camp: ${choice}`] };
  if (choice === "heal") return { ...paid, units: g.units.map(u => (u.id === "king" ? { ...u, hp: Math.min(r.hp.king, u.hp + r.heal) } : u)) };
  return { ...paid, recruits: [...(g.recruits ?? []), choice] };
}
/** Take the road: the army and any recruits march into the next battle. In the tutorial the next
 * battle deals its own preset army instead. */
export function leaveCamp(g: Run): Run {
  const next = nextIndex(g);
  if (g.phase !== "camp" || next === undefined) return g;
  if (g.tutorial) return dealTutorial({ ...g, encounter: next, history: [...g.history, "Road"] });
  const recruits = g.recruits ?? [];
  const army = [...g.units.filter(u => u.side === "white"), ...recruits.map((kind, i): Unit => ({ id: `ally-${g.nextId + i}`, side: "white", kind, hp: rulesOf(g).hp[kind], x: 0, y: 0 }))];
  return spawn({ ...g, encounter: next, nextId: g.nextId + recruits.length, recruits: undefined, history: [...g.history, "Camp: road"] }, army);
}

/** Reads a saved run, checked against the files (or `data`, which the returned run then plays by).
 * A piece saved above its kind's max HP, because the stats were retuned since, comes back at the max. */
export function readRun(raw: string | null, data?: GameData): Run | null {
  try {
    const saved = JSON.parse(raw ?? "null") as Run | null;
    if (!saved || typeof saved !== "object" || saved.level !== undefined || saved.rules !== undefined || saved.levels !== undefined) return null;
    const g = withData(saved, data), r = rulesOf(g), levels = levelsOf(g);
    if (g.version !== 2 || !Number.isInteger(g.encounter) || !Number.isInteger(g.turn) || g.turn < 1 || !levels[g.encounter] || !["deploy", "player", "camp", "victory", "defeat"].includes(g.phase)) return null;
    if ((g.tutorial !== undefined && g.tutorial !== true) || !courseOf(g).includes(g.encounter) || (g.tutorial && g.recruits !== undefined)) return null;
    if (!Array.isArray(g.units) || !Array.isArray(g.log) || !Array.isArray(g.history) || !Number.isFinite(g.gold) || !Number.isInteger(g.turn) || !Number.isInteger(g.nextId)) return null;
    if (g.phase !== "defeat" && !g.units.some(u => u.id === "king" && u.side === "white")) return null;
    if ((g.phase === "player" || g.phase === "deploy") && !g.units.some(u => u.side === "black")) return null;
    if (g.recruits !== undefined && (g.phase !== "camp" || !Array.isArray(g.recruits) || g.recruits.some(k => !["pawn", "bishop", "rook"].includes(k)) || g.units.filter(u => u.side === "white").length + g.recruits.length > (levels[nextIndex(g) ?? -1]?.starts.length ?? 0))) return null;
    if (g.units.some(u => typeof u.id !== "string" || !Object.hasOwn(r.hp, u.kind) || !Number.isInteger(u.x) || !Number.isInteger(u.y) || !["white", "black"].includes(u.side) || !passable(g, u) || !Number.isFinite(u.hp) || u.hp <= 0)) return null;
    if (g.sprung !== undefined && (!Array.isArray(g.sprung) || g.sprung.some(i => !Number.isInteger(i) || !levelOf(g).switches?.[i]))) return null;
    if (new Set(g.units.map(u => u.id)).size !== g.units.length || new Set(g.units.map(u => `${u.x},${u.y}`)).size !== g.units.length) return null;
    if (g.items !== undefined && (!Array.isArray(g.items) || g.items.some(i => !ITEMS.includes(i)))) return null;
    if ((g.itemUsed !== undefined && g.itemUsed !== true) || g.units.some(u => u.decoy !== undefined && (u.decoy !== true || u.side !== "white"))) return null;
    return g.units.some(u => u.hp > maxHp(r, u)) ? { ...g, units: g.units.map(u => (u.hp > maxHp(r, u) ? { ...u, hp: maxHp(r, u) } : u)) } : g;
  } catch { return null; }
}
