/** A forced-win solver for Escape from Exile battles. It enumerates every distinct position you can
 * reach in one turn (playerOutcomes), plays the deterministic enemy reply (endTurn) and searches,
 * shortest line first, for a win against this AI (solve). Built for proving puzzle encounters in
 * tests; see docs/solver.md. Pure like turns.ts: no DOM, no randomness, inputs are never mutated. */
import { DAMAGE, ENCOUNTERS, ENERGY, STRIKE_COST, abilityOf, approaches, attack, attackTargets, coord, defend, endTurn, inCheck, move, moveTargets, passable, promote, reaches, walkAndStrike } from "./turns";
import type { Pos, PromoteTo, Run, Step, Target, Unit } from "./turns";

export type Action =
  | { type: "move"; id: string; to: Pos }
  | { type: "attack"; id: string; targetId: string }
  | { type: "defend"; id: string }
  | { type: "promote"; id: string; kind: PromoteTo }
  | { type: "end" };
/** A position you can reach this turn and the actions that get there (no "end": the turn is still open). */
export type Outcome = { run: Run; plan: Action[] };
export type SolveResult =
  | { won: true; turns: number; line: Action[][]; nodes: number; unique: boolean; winningFirstMoves: number }
  | { won: false; reason: "no-win-within" | "budget"; nodes: number };

const PROMOTIONS: PromoteTo[] = ["queen", "rook", "bishop", "knight"];
const END: Action = { type: "end" };
/** The battle is won: the road is clear (camp) or the run is over (victory). */
export const isWin = (g: Run) => g.phase === "camp" || g.phase === "victory";

const modsKey = (u: Unit) => (u.mods ? Object.keys(u.mods).sort().map(k => `${k}=${String(u.mods![k])}`).join(",") : "");
/** Everything the rules care about in a position, so equal keys play out identically: each unit's id,
 * kind, square, hp, turn flags and ability state, plus the pool, a pending promotion and the phase.
 * Unit order, log, history, gold and the turn number (ability timers carry absolute turns) are left out. */
export function boardKey(g: Run): string {
  const units = g.units.map(u => `${u.id}:${u.kind}@${u.x},${u.y}#${u.hp}${u.moved ? "m" : ""}${u.acted ? "a" : ""}${u.defending ? "d" : ""}{${modsKey(u)}}`).sort();
  return `${g.phase}|${g.energy}|${g.promoting ?? ""}|${units.join("|")}`;
}
/** What the enemy's reply can see: the board without your pool, moved and acted flags, which it ignores. */
const replyKey = (g: Run, defends: boolean) => g.units.map(u => `${u.id}:${u.kind}@${u.x},${u.y}#${u.hp}${defends && u.defending ? "d" : ""}{${modsKey(u)}}`).sort().join("|");

/** Hooks the solver uses to keep the turn's enumeration small. `prune` drops a position and everything
 * after it (only sound when nothing reachable from it can win); `defenders` limits who may defend. */
type Hooks = { prune?: (g: Run) => boolean; defenders?: (g: Run) => Set<string> | null };
/** Within one turn the units array keeps its order (the rules only map and filter it), so the key can skip the sort. */
const turnKey = (g: Run) => `${g.phase}|${g.energy}|${g.promoting ?? ""}|` + g.units.map(u => `${u.id}:${u.kind}@${u.x},${u.y}#${u.hp}${u.moved ? "m" : ""}${u.acted ? "a" : ""}${u.defending ? "d" : ""}{${modsKey(u)}}`).join("|");
function enumerate(start: Run, hooks: Hooks): Outcome[] {
  const seen = new Map<string, Outcome>();
  const visit = (g: Run, plan: Action[]) => {
    const k = turnKey(g);
    if (seen.has(k)) return;
    if (hooks.prune?.(g)) { seen.set(k, { run: g, plan: [] }); return; }
    seen.set(k, { run: g, plan });
    if (g.phase !== "player") return;
    const step = (next: Run, ...actions: Action[]) => { if (next !== g) visit(next, [...plan, ...actions]); };
    if (g.promoting) { for (const kind of PROMOTIONS) step(promote(g, g.promoting, kind).run, { type: "promote", id: g.promoting, kind }); return; }
    const enemies = g.units.filter(u => u.side === "black");
    // A tap can pass through check only while the king is already in check (he may then act freely, and the
    // tap is judged as one move), so that's the one case where a walk the rules allow still needs the tap path.
    const taps = g.energy > STRIKE_COST;
    const check = taps && inCheck(g);
    const defenders = g.energy >= 1 ? hooks.defenders?.(g) ?? null : null;
    for (const u of g.units) {
      if (u.side !== "white") continue;
      const refused: Target[] = [];
      for (const t of moveTargets(g, u)) {
        const next = move(g, u.id, t);
        if (next === g) refused.push(t); else step(next, { type: "move", id: u.id, to: { x: t.x, y: t.y } });
      }
      for (const t of attackTargets(g, u)) step(attack(g, u.id, t.id!).run, { type: "attack", id: u.id, targetId: t.id! });
      if (taps) {
        const ways = check
          ? enemies.flatMap(v => approaches(g, u.id, v.id).map(t => [t, v] as const))
          : refused.flatMap(t => (t.cost + STRIKE_COST > g.energy ? [] : enemies.filter(v => reaches(g, u, t, v)).map(v => [t, v] as const)));
        for (const [t, v] of ways) {
          const tap = walkAndStrike(g, u.id, t, v.id);
          if (tap) step(tap.run, { type: "move", id: u.id, to: { x: t.x, y: t.y } }, { type: "attack", id: u.id, targetId: v.id });
        }
      }
      if (!defenders || defenders.has(u.id)) step(defend(g, u.id), { type: "defend", id: u.id });
    }
  };
  visit(start, []);
  return [...seen.values()].filter(o => !o.run.promoting && (o.plan.length > 0 || o.run === start));
}
/** Every distinct position the player can reach this turn, the "do nothing" position included, each
 * with the actions that reach it. Only what the rules allow: a refused action goes nowhere. A walk the
 * rules refuse on its own (it would expose the king) is still tried as a tap, walk-and-strike in one
 * move, when a strike from that square is affordable. A pending promotion is never an outcome: it has
 * to be resolved (all four kinds are tried) before the turn can end. */
export const playerOutcomes = (start: Run): Outcome[] => enumerate(start, {});

// ---- A lower bound on what clearing the board still costs, to prune hopeless positions. ----
// Optimistic everywhere, so it never prunes a real win: pieces never block, enemies come as close as
// their pool allows, every hit lands at your strongest piece's damage, and a counter costs one defend.
// It leans on three facts about the rules: no move covers more than one square per energy, a piece
// moves once a turn, and the enemy never strikes for 0 (so a pawn never hits a defender).

const STRAIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAGONAL = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const LEAP = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const OFFSETS = [...STRAIGHT, ...DIAGONAL, ...LEAP];
/** What a white piece may strike as: a pawn could promote into anything that reaches further. */
const strikeKinds = (w: Unit): Unit[] => (w.kind === "pawn" ? [{ ...w, kind: "queen" }, { ...w, kind: "knight" }] : [w]);
/** reaches() only looks at the pieces' kinds and sides, so the geometry below needs no run. */
const NO_RUN = null as unknown as Run;
/** Could `w`, defending, survive a hit from `e` and hit back from where `e` would strike? Then every
 * hit on `e` may come from a counter, which costs a defend (1) rather than a strike (2). */
function canCounter(e: Unit, w: Unit): boolean {
  const dealt = DAMAGE[e.kind] - 1;
  if (dealt <= 0 || w.hp <= dealt) return false;
  return strikeKinds(w).some(wk => OFFSETS.some(([dx, dy]) => {
    const p = { x: e.x + dx, y: e.y + dy };
    return reaches(NO_RUN, e, e, p) && reaches(NO_RUN, wk, p, e);
  }));
}
/** The least energy and moves for `w` to stand on `q`, ignoring every piece and wall. */
function travel(w: Unit, q: Pos): { energy: number; moves: number } {
  const dx = Math.abs(q.x - w.x), dy = Math.abs(q.y - w.y), cheb = Math.max(dx, dy), lo = Math.min(dx, dy);
  if (cheb === 0) return { energy: 0, moves: 0 };
  const legs = (...lens: number[]) => ({ energy: lens.reduce((s, n) => s + n, 0), moves: lens.reduce((s, n) => s + Math.ceil(n / ENERGY), 0) });
  const kind = abilityOf(w)?.moveTargets ? "any" : w.kind === "pawn" ? "queen" : w.kind;
  switch (kind) {
    case "king": return { energy: cheb, moves: cheb };
    case "knight": { const moves = Math.ceil(cheb / 2); return { energy: 2 * moves, moves }; }
    case "rook": return legs(dx, dy);
    case "bishop": return (dx + dy) % 2 ? { energy: Infinity, moves: Infinity } : legs((cheb + lo) / 2, (cheb - lo) / 2);
    case "queen": return legs(lo, cheb - lo);
    default: return { energy: cheb, moves: Math.ceil(cheb / ENERGY) };
  }
}
/** Squares `b` might stand on after `replies` enemy turns, or null for anywhere. Only pawns are slow enough to pin down. */
function roamOf(g: Run, b: Unit, replies: number): Pos[] | null {
  if (replies === 0) return [b];
  if (b.kind !== "pawn" || abilityOf(b)?.moveTargets) return null;
  const far = ENCOUNTERS[g.encounter].height - 1, out: Pos[] = [b];
  for (let i = 1; i <= replies; i++) {
    const p = { x: b.x, y: b.y + i };
    if (!passable(g, p)) break;
    if (p.y === far) return null;
    out.push(p);
  }
  return out;
}
/** The cheapest way for `w` to stand where it could strike one of `roam`. */
function approach(g: Run, w: Unit, roam: Pos[]): { energy: number; moves: number } {
  let best = { energy: Infinity, moves: Infinity };
  for (const s of roam) for (const [dx, dy] of OFFSETS) {
    const q = { x: s.x + dx, y: s.y + dy };
    if (!passable(g, q) || !strikeKinds(w).some(wk => reaches(g, wk, q, s))) continue;
    const t = travel(w, q);
    if (t.energy < best.energy || (t.energy === best.energy && t.moves < best.moves)) best = t;
  }
  return best;
}
/** The bound, with its geometry memoised for one battle (one encounter, so walls never change).
 * Returns `feasible(g, turns, energy, replies)`: could the player still clear the board within
 * `turns` more turns, with `energy` to spend over them, when the enemy gets `replies` turns before
 * the player's last one? With no turns left only the coming reply can win, by counters alone: every
 * enemy must be one a braced piece would kill on the rebound. */
export function makeBound() {
  const approaches = new Map<string, { energy: number; moves: number }>(), counters = new Map<string, boolean>();
  const counter = (e: Unit, w: Unit) => {
    const k = `${e.kind}${e.side}${e.hp}|${w.kind}${w.side}${w.hp}`;
    let v = counters.get(k);
    if (v === undefined) { v = canCounter(e, w); counters.set(k, v); }
    return v;
  };
  const cost = (g: Run, w: Unit, b: Unit, replies: number) => {
    const k = `${w.kind}${w.side}${w.mods ? "+" : ""}@${w.x},${w.y}|${b.kind}${b.side}${b.mods ? "+" : ""}@${b.x},${b.y}|${replies}`;
    let v = approaches.get(k);
    if (v === undefined) { const roam = roamOf(g, b, replies); v = roam ? approach(g, w, roam) : { energy: 0, moves: 0 }; approaches.set(k, v); }
    return v;
  };
  /** Energy and turns the player must still spend to clear the board, at the least, when the enemy
   * gets `replies` turns before the player's last one. Enemies a counter could hit are the cheap case:
   * one defend (shared by all of them, since one braced piece counters every attacker) and one turn. */
  const needs = (g: Run, replies: number): { energy: number; turns: number } => {
    const whites = g.units.filter(u => u.side === "white");
    if (!whites.length) return { energy: Infinity, turns: Infinity };
    const maxDmg = Math.max(...whites.map(w => DAMAGE[w.kind === "pawn" ? "queen" : w.kind]));
    const strikers = Math.min(whites.length, Math.floor(ENERGY / STRIKE_COST));
    let energy = 0, turns = 0, hits = 0, needDefend = false;
    for (const b of g.units) {
      if (b.side !== "black") continue;
      // A counter needs a braced piece: one defend covers every counter, and a brace already up is paid for.
      if (whites.some(w => counter(b, w))) { turns = Math.max(turns, 1); if (!whites.some(w => w.defending && counter(b, w))) needDefend = true; continue; }
      const h = Math.ceil(b.hp / maxDmg);
      hits += h;
      let least = Infinity, soonest = Infinity;
      for (const w of whites) {
        const t = cost(g, w, b, replies);
        least = Math.min(least, t.energy);
        soonest = Math.min(soonest, Math.max(t.moves, Math.ceil((t.energy + STRIKE_COST) / ENERGY)));
      }
      energy += least + STRIKE_COST * h;
      turns = Math.max(turns, soonest);
    }
    return { energy: energy + (needDefend ? 1 : 0), turns: Math.max(turns, Math.ceil(hits / strikers)) };
  };
  return (g: Run, turns: number, energy: number, replies: number): boolean => {
    if (turns <= 0) return g.units.every(b => b.side !== "black" || g.units.some(w => w.side === "white" && w.defending && DAMAGE[w.kind] >= b.hp && counter(b, w)));
    const n = needs(g, replies);
    return n.turns <= turns && n.energy <= energy;
  };
}

/** Candidate order, best first: a win, then kills, then damage, then closing the distance to the
 * enemy. Ties go to the shorter plan, so a direct blow is preferred to a stroll and a blow. */
function rank(before: Run, o: Outcome): number {
  const g = o.run;
  if (isWin(g)) return 1e9 - o.plan.length;
  let kills = 0, hurt = 0;
  for (const e of before.units) {
    if (e.side !== "black") continue;
    const now = g.units.find(u => u.id === e.id);
    if (!now) kills++; else hurt += e.hp - now.hp;
  }
  const whites = g.units.filter(u => u.side === "white");
  const gap = g.units.filter(u => u.side === "black").reduce((s, b) => s + Math.min(...whites.map(w => Math.max(Math.abs(w.x - b.x), Math.abs(w.y - b.y)))), 0);
  return kills * 1000 + hurt * 100 - gap * 10 - o.plan.length;
}

/** Your pieces some enemy could strike in its reply: from where it stands, or after a step its pool can
 * pay for alongside the strike (a pawn reaching the far row strikes as a queen). Each enemy is tried on
 * a board holding only it and its target, so nothing another piece might clear out of the way is missed.
 * The reply ignores a defend on any other piece. */
function exposed(g: Run): Set<string> {
  const e = ENCOUNTERS[g.encounter], whites = g.units.filter(u => u.side === "white"), out = new Set<string>();
  for (const b of g.units) {
    if (b.side !== "black") continue;
    const fresh: Unit = { ...b, moved: false, acted: false, defending: false };
    for (const w of whites) {
      if (reaches(g, fresh, fresh, w)) { out.add(w.id); continue; }
      if (e.enemyEnergy < STRIKE_COST + 1) continue;
      const clear: Run = { ...g, units: [fresh, w] };
      for (const t of moveTargets(clear, fresh, e.enemyEnergy - STRIKE_COST)) {
        const moved: Unit = b.kind === "pawn" && t.y === e.height - 1 ? { ...fresh, kind: "queen" } : fresh;
        if (reaches(g, moved, t, w)) { out.add(w.id); break; }
      }
    }
  }
  return out;
}
/** The enemy's reply to each outcome, computed once per board the reply can tell apart: outcomes that
 * differ only by defends on pieces no enemy can reach (and your pool, which the reply ignores) share
 * one reply. Null when the rules refuse the ending (check with a way out) or the reply loses. */
function replies(outs: Outcome[]): (o: Outcome) => Run | null {
  const reply = (g: Run): Run | null => { const after = endTurn(g).run; return after === g || after.phase === "defeat" ? null : after; };
  const bases = new Map<string, Outcome>();
  for (const o of outs) if (!o.run.units.some(u => u.side === "white" && u.defending)) bases.set(replyKey(o.run, false), o);
  const done = new Map<string, Run | null>(), reach = new Map<string, Set<string> | null>();
  return o => {
    const key = replyKey(o.run, true);
    if (done.has(key)) return done.get(key)!;
    let after: Run | null | undefined;
    const base = bases.get(replyKey(o.run, false));
    if (base && base !== o) {
      // In check, whether the ending is refused depends on what's left in the pool, so play it out for real.
      const baseKey = replyKey(base.run, false);
      if (!reach.has(baseKey)) reach.set(baseKey, inCheck(base.run) ? null : exposed(base.run));
      const r = reach.get(baseKey);
      if (r && !o.run.units.some(u => u.side === "white" && u.defending && r.has(u.id))) {
        if (!done.has(baseKey)) done.set(baseKey, reply(base.run));
        after = done.get(baseKey)!;
      }
    }
    if (after === undefined) after = reply(o.run);
    done.set(key, after);
    return after;
  };
}

/** Searches for the shortest forced win (against this deterministic enemy) within `maxTurns` player
 * turns: iterative deepening on the turn count, depth-first within a depth, remembering positions
 * already proven not to win within the turns left, and pruning positions the lower bound (`needs`)
 * says can't be cleared in time. A win is checked right after the player's actions and again after
 * the enemy's reply. `nodes` counts turn-start positions expanded; past `nodeBudget` (default
 * 200000) the search stops with reason "budget". At the winning depth every first-turn outcome is
 * tried, so `winningFirstMoves` counts the distinct ones (by board key; all immediate wins count as
 * one, since how the last blow lands isn't a second solution) and `unique` says it's one.
 * `exhaustive` turns the pruning off (every outcome, every reply): slow, for checking the bound. */
export function solve(start: Run, opts: { maxTurns: number; nodeBudget?: number; exhaustive?: boolean }): SolveResult {
  const budget = opts.nodeBudget ?? 200000, exhaustive = opts.exhaustive ?? false;
  let nodes = 0;
  if (isWin(start)) return { won: true, turns: 0, line: [], nodes, unique: true, winningFirstMoves: 1 };
  const OUT_OF_BUDGET = Symbol("budget");
  const feasible = makeBound();
  /** Positions proven not to win within this many turns, and positions with a known winning line. */
  const failed = new Map<string, number>(), wins = new Map<string, Action[][]>();
  type Cand = { o: Outcome; reply: () => Run | null };
  /** The turn's outcomes with `depth` turns left (this one included), best first. Mid-turn positions the
   * bound rules out are dropped with everything after them. Off the root, a defend on a piece no enemy
   * can reach is skipped too: the reply ignores it and the flag is gone by the next turn, so the outcome
   * is a duplicate of the same turn without it (reached in another order if the piece gets exposed
   * later in the turn). Not the king's: his defend changes what counts as check, so defending first can
   * allow a move that would be refused after it. The root keeps every defend so winningFirstMoves
   * counts every distinct board. */
  const candidates = (g: Run, depth: number, root = false): Cand[] => {
    if (++nodes > budget) throw OUT_OF_BUDGET;
    const later = ENERGY * (depth - 1);
    const outs = enumerate(g, {
      prune: s => s.phase === "defeat" || (!exhaustive && s.phase === "player" && !feasible(s, depth, s.energy + later, depth - 1)),
      defenders: root || exhaustive ? undefined : s => (inCheck(s) ? null : exposed(s).add("king")),
    });
    const replyOf = replies(outs);
    return outs.map(o => ({ o, score: rank(g, o) })).sort((a, b) => b.score - a.score).map(({ o }) => ({ o, reply: () => replyOf(o) }));
  };
  const search = (g: Run, depth: number): Action[][] | null => {
    if (isWin(g)) return [];
    // With `depth` turns left the enemy replies before all but the last of them.
    if (depth <= 0 || (!exhaustive && !feasible(g, depth, g.energy + ENERGY * (depth - 1), depth - 1))) return null;
    const key = boardKey(g);
    const known = wins.get(key);
    if (known && known.length <= depth) return known;
    if ((failed.get(key) ?? 0) >= depth) return null;
    for (const c of candidates(g, depth)) {
      const line = follow(c, depth);
      if (line) { wins.set(key, line); return line; }
    }
    failed.set(key, depth);
    return null;
  };
  /** The line through one outcome, or null if it can't force a win within `depth` turns (this one included). */
  const follow = (c: Cand, depth: number): Action[][] | null => {
    if (isWin(c.o.run)) return [c.o.plan];
    // What's left in the pool is lost at the turn's end; only the turns after the reply count, and the
    // enemy moves once now and before each of those turns but the last.
    if (!exhaustive && !feasible(c.o.run, depth - 1, ENERGY * (depth - 1), depth - 1)) return null;
    const after = c.reply();
    if (!after) return null;
    if (isWin(after)) return [[...c.o.plan, END]];
    const rest = search(after, depth - 1);
    return rest && [[...c.o.plan, END], ...rest];
  };
  try {
    let first: Cand[] | null = null;
    for (let depth = 1; depth <= opts.maxTurns; depth++) {
      let line: Action[][] | null = null;
      const winners = new Set<string>();
      // The root is enumerated once per depth: the bound prunes more of it as the horizon shrinks, so
      // the cheap early depths are cheap, and the node count stays one per expansion.
      first = candidates(start, depth, true);
      for (const c of first) {
        const found = follow(c, depth);
        if (!found) continue;
        line ??= found;
        winners.add(isWin(c.o.run) ? c.o.run.phase : boardKey(c.o.run));
      }
      if (line) return { won: true, turns: line.length, line, nodes, unique: winners.size === 1, winningFirstMoves: winners.size };
    }
    return { won: false, reason: "no-win-within", nodes };
  } catch (e) {
    if (e === OUT_OF_BUDGET) return { won: false, reason: "budget", nodes };
    throw e;
  }
}

/** Plays the action at `i` with the real rules and says how many actions it used. A move the rules
 * refuse on its own is retried as a tap with the strike that follows it (walkAndStrike), the way the
 * board does. Throws when the rules refuse the action: a line is supposed to be legal. */
function play(g: Run, actions: Action[], i: number): { run: Run; used: 1 | 2; steps?: Step[] } {
  const a = actions[i];
  switch (a.type) {
    case "move": {
      const next = move(g, a.id, a.to);
      if (next !== g) return { run: next, used: 1 };
      const b = actions[i + 1];
      const tap = b?.type === "attack" && b.id === a.id ? walkAndStrike(g, a.id, a.to, b.targetId) : null;
      if (tap) return { run: tap.run, used: 2 };
      break;
    }
    case "attack": { const { run } = attack(g, a.id, a.targetId); if (run !== g) return { run, used: 1 }; break; }
    case "defend": { const run = defend(g, a.id); if (run !== g) return { run, used: 1 }; break; }
    case "promote": { const { run } = promote(g, a.id, a.kind); if (run !== g) return { run, used: 1 }; break; }
    case "end": { const r = endTurn(g); if (r.run !== g) return { run: r.run, used: 1, steps: r.steps }; break; }
  }
  throw new Error(`The rules refuse ${JSON.stringify(a)} on turn ${g.turn}`);
}

/** Replays a line with the real rules: each inner list is one player turn. A turn that doesn't end
 * with "end" is ended for you when more turns follow. Throws on a refused action. */
export function replay(start: Run, line: Action[][]): Run {
  let g = start;
  line.forEach((turn, n) => {
    for (let i = 0; i < turn.length;) { const r = play(g, turn, i); g = r.run; i += r.used; }
    if (n < line.length - 1 && g.phase === "player" && turn[turn.length - 1]?.type !== "end") g = play(g, [END], 0).run;
  });
  return g;
}

const strikeText = (before: Run, after: Run, targetId: string, strikerId: string) => {
  const v = before.units.find(u => u.id === targetId)!, now = after.units.find(u => u.id === targetId), me = after.units.find(u => u.id === strikerId);
  return `strikes ${v.kind} ${coord(before, v)} ${now ? `(${v.hp}→${now.hp})` : "(kill)"}${me ? "" : ", falls to the counter"}`;
};
/** The enemy's reply in a few words, from the steps endTurn played. */
function enemyText(g: Run, steps: Step[]): string {
  let units = g.units;
  const texts = steps.map(s => {
    const actor = units.find(u => u.id === s.actor), target = s.target ? units.find(u => u.id === s.target) : undefined;
    const text = s.kind === "move" ? `${actor?.kind} →${coord(g, s.focus[0])}`
      : s.kind === "strike" ? `${actor?.kind} strikes ${target?.kind} ${coord(g, s.focus[0])}${s.killed.includes(s.target!) ? " (kill)" : ""}${s.killed.includes(s.actor) ? ", falls to the counter" : ""}`
      : s.kind === "defend" ? `${actor?.kind} defends`
      : `${s.from ?? "pawn"} becomes a ${s.units.find(u => u.id === s.actor)?.kind}`;
    units = s.units;
    return text;
  });
  return texts.length ? texts.join(", ") : "waits";
}
/** A readable move list, one string per player turn, with the enemy's reply after a bar:
 * "T1: rook a1→a3, strikes knight b3 (kill) | enemy: pawn →b4". Replays the line, so it throws on an illegal one. */
export function lineToText(start: Run, line: Action[][]): string[] {
  let g = start;
  return line.map(turn => {
    const label = `T${g.turn}`;
    const parts: { id: string; text: string }[] = [];
    let enemy = "";
    const add = (id: string, head: string, tail: string) => {
      const last = parts[parts.length - 1];
      if (last && last.id === id) last.text += `, ${tail}`; else parts.push({ id, text: `${head} ${tail}` });
    };
    for (let i = 0; i < turn.length;) {
      const a = turn[i];
      const { run, used, steps } = play(g, turn, i);
      if (a.type === "end") enemy = enemyText(g, steps ?? []);
      else {
        const u = g.units.find(x => x.id === a.id)!;
        const head = `${u.kind} ${coord(g, u)}`;
        if (a.type === "move") {
          parts.push({ id: a.id, text: `${head}→${coord(g, a.to)}` });
          if (used === 2) add(a.id, head, strikeText(g, run, (turn[i + 1] as { targetId: string }).targetId, a.id));
        } else if (a.type === "attack") add(a.id, head, strikeText(g, run, a.targetId, a.id));
        else if (a.type === "defend") add(a.id, head, "defends");
        else add(a.id, head, `becomes a ${a.kind}`);
      }
      g = run; i += used;
    }
    return `${label}: ${parts.map(p => p.text).join("; ") || "waits"}${enemy ? ` | enemy: ${enemy}` : ""}${isWin(g) ? " — battle won" : ""}`;
  });
}
