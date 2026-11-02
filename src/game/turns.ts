/** Escape from Exile, turn-based: you act, then the enemy acts. Every piece on
 * a side may act each turn: move once in its chess shape (sliding any
 * distance), then strike the next square in its shape or defend. Pure and
 * deterministic: no DOM, no randomness, inputs are never mutated. */
import levelsFile from "./levels/levels.json" with { type: "json" };
export type Side = "white" | "black";
export type Kind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Pos = { x: number; y: number };
export type Unit = Pos & { id: string; side: Side; kind: Kind; hp: number; moved?: boolean; acted?: boolean; defending?: boolean };
export type Target = Pos & { id?: string };
export type Encounter = { story?: string; reward: number; width: number; height: number; walls: Pos[]; spawns: [Kind, number, number, number][]; starts: Pos[] };
export type Run = {
  version: 2; encounter: number; turn: number;
  phase: "player" | "camp" | "victory" | "defeat";
  gold: number; units: Unit[]; log: string[]; history: string[]; nextId: number;
  /** Your pawn that reached the far row and is waiting for you to pick its new piece. */
  promoting?: string;
  /** Recruits bought at the hub, waiting in the barracks until you take the road. */
  recruits?: Recruit[];
  /** A studio test run's level, played on its own: it replaces the run's battle list and ends the run when won. Never saved. */
  level?: Encounter;
};
export type Recruit = "pawn" | "bishop" | "rook";
export type PromoteTo = "queen" | "rook" | "bishop" | "knight";
/** One beat of play for presentation: who acted, how, on whom, and who fell. */
export type Step = { text: string; units: Unit[]; focus: Pos[]; damage: { id: string; amount: number }[]; actor: string; kind: "move" | "strike" | "defend" | "promote"; target?: string; killed: string[]; from?: Kind };

export const HP: Record<Kind, number> = { king: 5, queen: 9, rook: 5, bishop: 3, knight: 3, pawn: 1 };
export const DAMAGE: Record<Kind, number> = { king: 2, queen: 3, rook: 3, bishop: 2, knight: 2, pawn: 1 };
/** The run's battles, in order, from `levels/levels.json` (edited in the studio's level designer; checked by `levels.ts`). */
export const ENCOUNTERS = levelsFile.levels as unknown as Encounter[];
/** The battle this run is fighting: a test run's own level, or the run's current encounter. */
export const levelOf = (g: Run): Encounter => g.level ?? ENCOUNTERS[g.encounter];
export type CampChoice = Recruit | "heal";
export const COST: Record<CampChoice, number> = { pawn: 3, bishop: 6, rook: 8, heal: 4 };

export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
export const coord = (g: Run, p: Pos) => "abcdefgh"[p.x] + (levelOf(g).height - p.y);
export const at = (g: Run, p: Pos) => g.units.find(u => same(u, p));
export const kindName = (k: string) => k[0].toUpperCase() + k.slice(1);
export const label = (u: Unit) => u.side === "white" ? kindName(u.kind) : `Enemy ${u.kind}`;
export function passable(g: Run, p: Pos) {
  const e = levelOf(g);
  return p.x >= 0 && p.y >= 0 && p.x < e.width && p.y < e.height && !e.walls.some(w => same(w, p));
}
const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const STRAIGHTS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const LEAPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const slides = (k: Kind) => k === "rook" ? STRAIGHTS : k === "bishop" ? DIAGONALS : k === "queen" ? [...STRAIGHTS, ...DIAGONALS] : null;
const forward = (u: Unit) => u.side === "white" ? -1 : 1;

/** Empty squares a piece can move to this turn. */
export function moveTargets(g: Run, u: Unit): Target[] {
  if (u.moved || u.acted) return [];
  const out: Target[] = [];
  const open = (p: Pos) => passable(g, p) && !at(g, p);
  const dirs = slides(u.kind);
  if (dirs) {
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

/** Enemies a piece can strike this turn: the next square along its capture shape (a knight's jump). */
export function attackTargets(g: Run, u: Unit): Target[] {
  if (u.acted) return [];
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

/** Could u, standing on `from`, strike `target`? Strikes reach one step in the piece's shape. */
export function reaches(g: Run, u: Unit, from: Pos, target: Pos): boolean {
  const dx = target.x - from.x, dy = target.y - from.y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (u.kind === "pawn") return ax === 1 && dy === forward(u);
  if (u.kind === "knight") return ax * ay === 2;
  if (Math.max(ax, ay) !== 1) return false;
  const diagonal = ax === 1 && ay === 1;
  return u.kind === "rook" ? !diagonal : u.kind === "bishop" ? diagonal : true;
}

function spawn(g: Run, army: Unit[]): Run {
  const e = levelOf(g);
  const whites = army.map((u, i) => ({ id: u.id, side: u.side, kind: u.kind, hp: u.hp, ...e.starts[i] }));
  const enemies = e.spawns.map(([kind, x, y, hp], i) => ({ id: `enemy-${g.encounter}-${i}`, kind, side: "black" as const, x, y, hp }));
  return { ...g, promoting: undefined, units: [...whites, ...enemies], phase: "player", turn: 1, log: [] };
}
export function newRun(): Run {
  const g: Run = { version: 2, encounter: 0, turn: 1, phase: "player", gold: 2, units: [], log: [], history: [], nextId: 1 };
  return spawn(g, [{ id: "king", side: "white", kind: "king", hp: HP.king, x: 0, y: 0 }]);
}
const armyOf = (army: Kind[]): Unit[] => army.map((kind, i) => ({ id: kind === "king" && !army.slice(0, i).includes("king") ? "king" : `ally-${i}`, side: "white", kind, hp: HP[kind], x: 0, y: 0 }));
/** A studio test run: one level on its own with a given army (king first), shown as battle `index + 1`. */
export function testRun(level: Encounter, army: Kind[], index: number): Run {
  return spawn({ ...newRun(), encounter: index, level, nextId: army.length }, armyOf(army));
}
/** A fresh run that starts at battle `index` with a given army (king first) and gold, then carries on as usual. */
export function startAt(index: number, army: Kind[], gold: number): Run {
  return spawn({ ...newRun(), encounter: index, gold, nextId: army.length }, armyOf(army));
}

const withUnit = (g: Run, id: string, patch: Partial<Unit>) => g.units.map(u => (u.id === id ? { ...u, ...patch } : u));
function finish(g: Run): Run {
  if (!g.units.some(u => u.id === "king")) return { ...g, phase: "defeat", log: ["King captured", ...g.log] };
  if (!g.units.some(u => u.side === "black")) {
    const last = !!g.level || g.encounter === ENCOUNTERS.length - 1, reward = levelOf(g).reward;
    return { ...g, phase: last ? "victory" : "camp", gold: g.gold + reward, log: [last ? "Victory" : `+${reward} ✦`, ...g.log] };
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
function moveUnchecked(g: Run, id: string, to: Pos): Run {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white") return g;
  const t = moveTargets(g, u).find(t => same(t, to));
  if (!t) return g;
  const next = note({ ...g, units: withUnit(g, id, { x: to.x, y: to.y, moved: true }) }, `${label(u)} → ${coord(g, to)}`);
  // A pawn on the far row waits for you to choose what it becomes.
  return u.kind === "pawn" && to.y === lastRank(g, u) ? { ...next, promoting: id } : next;
}
const lastRank = (g: Run, u: Unit) => (u.side === "white" ? 0 : levelOf(g).height - 1);
function promoted(g: Run, u: Unit, kind: PromoteTo): { run: Run; step: Step } {
  const text = `${label(u)} → ${kind}`;
  const run = note({ ...g, units: withUnit(g, u.id, { kind, hp: HP[kind] }) }, text);
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
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white" || u.acted) return g;
  return note({ ...g, units: withUnit(g, id, { acted: true, defending: true }) }, `${label(u)} defends`);
}

/** Resolves one strike for either side. */
function strike(g: Run, a: Unit, t: Target): { run: Run; step: Step } {
  const v = g.units.find(u => u.id === t.id)!;
  const dealt = Math.max(0, DAMAGE[a.kind] - (v.defending ? 1 : 0));
  const survives = v.hp > dealt;
  // Strikes land from where the striker stands; it never moves onto the target's square.
  let units = g.units.flatMap(u => u.id === v.id ? (survives ? [{ ...u, hp: u.hp - dealt }] : []) : u.id === a.id ? [{ ...u, acted: true }] : [u]);
  const damage = [{ id: v.id, amount: dealt }];
  let text = `${label(a)} strikes ${label(v).toLowerCase()} −${dealt}${survives ? "" : " · killed"}`;
  if (survives && v.defending && reaches({ ...g, units }, v, v, a)) {
    const back = DAMAGE[v.kind], left = a.hp - back;
    units = left > 0 ? units.map(u => (u.id === a.id ? { ...u, hp: left } : u)) : units.filter(u => u.id !== a.id);
    damage.push({ id: a.id, amount: back });
    text += ` · counter −${back}${left > 0 ? "" : " · killed"}`;
  }
  const run = note({ ...g, units }, text);
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
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white") return { run: g, step: null };
  const t = attackTargets(g, u).find(t => t.id === targetId);
  if (!t) return { run: g, step: null };
  const { run, step } = strike(g, u, t);
  return { run: finish(run), step };
}

/** Deterministic enemy policy: every enemy piece may move once, then strike or defend once. The best-scoring
 * action across all pieces goes first, repeated until no piece has anything worth doing. */
function enemyTurn(g: Run): { run: Run; steps: Step[] } {
  let run: Run = { ...g, units: g.units.map(u => (u.side === "black" ? { ...u, moved: false, acted: false, defending: false } : u)) };
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
        const dealt = Math.max(0, DAMAGE[u.kind] - (v.defending ? 1 : 0));
        if (dealt === 0) continue;
        // A surviving defender counters if it can reach the striker's square.
        const countered = v.defending && dealt < v.hp && reaches(run, v, v, u) ? DAMAGE[v.kind] : 0;
        const score = 100 + dealt * 10 + (dealt >= v.hp ? 50 : 0) + (v.id === "king" ? 30 : 0) - countered * 8 - (countered >= u.hp ? 60 : 0);
        choices.push({ score, key: `a${u.id}${t.x}${t.y}`, apply: () => strike(run, u, t) });
      }
      // Close in on the king, or on whichever of your pieces is nearest.
      const whites = run.units.filter(w => w.side === "white");
      const dist = (p: Pos) => Math.min(gap(p, king) - 0.5, ...whites.map(w => gap(p, w)));
      for (const t of moveTargets(run, u)) {
        // Shorter trips break ties.
        const gain = dist(u) - dist(t), travel = gap(u, t) / 10;
        // Pawns keep marching toward pieces still ahead of them, and race for the far row to promote.
        const crowning = u.kind === "pawn" && t.y === lastRank(run, u);
        const ahead = whites.some(w => (w.y - u.y) * forward(u) > 0);
        const march = u.kind === "pawn" && gain <= 0 && ahead ? 1 : 0;
        // Strikes only reach the next square, so a square to strike from is worth a step.
        const lineUp = !u.acted && whites.some(w => reaches(run, u, t, w));
        if (gain <= 0 && !march && !crowning && !lineUp) continue;
        choices.push({ score: crowning ? 30 : lineUp ? 20 - travel : march || gain * 5 - travel, key: `m${u.id}${t.x}${t.y}`, apply: () => {
          const text = `${label(u)} → ${coord(run, t)}`;
          const next = note({ ...run, units: withUnit(run, u.id, { x: t.x, y: t.y, moved: true }) }, text);
          return { run: next, step: { text, units: next.units, focus: [{ x: t.x, y: t.y }], damage: [], actor: u.id, kind: "move", killed: [] } };
        } });
      }
      // Brace only when it matters (a threat it survives only thanks to the block, or one it
      // could hit back), and only when no move is worth making.
      // A threat is one of your pieces that can strike u next turn, stepping in first if need be.
      const threat = (w: Unit) => reaches(run, w, w, u) || moveTargets(run, { ...w, moved: false, acted: false }).some(t => reaches(run, w, t, u));
      const worthIt = whites.some(w => threat(w) && ((DAMAGE[w.kind] >= u.hp && DAMAGE[w.kind] - 1 < u.hp) || reaches(run, u, u, w)));
      if (!u.acted && worthIt) choices.push({ score: 0.4, key: `d${u.id}`, apply: () => {
        const text = `${label(u)} defends`;
        const next = note({ ...run, units: withUnit(run, u.id, { acted: true, defending: true }) }, text);
        return { run: next, step: { text, units: next.units, focus: [{ x: u.x, y: u.y }], damage: [], actor: u.id, kind: "defend", killed: [] } };
      } });
    }
    choices.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    const best = choices[0];
    if (!best || best.score <= 0) break;
    const done = best.apply();
    run = finish(done.run); steps.push(done.step);
    const mover = run.units.find(x => x.id === done.step.actor);
    if (done.step.kind === "move" && mover?.kind === "pawn" && mover.y === lastRank(run, mover)) {
      const p = promoted(run, mover, "queen");
      run = p.run; steps.push(p.step);
    }
  }
  return { run, steps };
}

/** The most damage the enemy's next turn could deal your king: every enemy piece that could strike him,
 * in place or after its one move (a pawn reaching your back row becomes a queen first), hits him once.
 * Each piece is judged on the board as it stands. */
export function kingThreat(g: Run): { damage: number; attackers: string[] } {
  const king = g.units.find(u => u.id === "king");
  if (!king) return { damage: 0, attackers: [] };
  let damage = 0;
  const attackers: string[] = [];
  for (const u of g.units.filter(u => u.side === "black")) {
    const crowned = (t: Pos) => (u.kind === "pawn" && t.y === lastRank(g, u) ? "queen" as const : u.kind);
    const stands = reaches(g, u, u, king) ? [u.kind] : [];
    const steps = moveTargets(g, { ...u, moved: false, acted: false }).map(t => ({ ...u, x: t.x, y: t.y, kind: crowned(t) })).filter(m => reaches(g, m, m, king)).map(m => m.kind);
    const hit = Math.max(0, ...[...stands, ...steps].map(k => DAMAGE[k] - (king.defending ? 1 : 0)));
    if (hit > 0) { damage += hit; attackers.push(u.id); }
  }
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
  const key = (g: Run) => g.units.map(u => `${u.id}${u.kind[0]}${u.x},${u.y}:${u.hp}${u.moved ? "m" : ""}${u.acted ? "a" : ""}${u.defending ? "d" : ""}`).join("|");
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
      if (!u.acted && visit(defend(g, u.id))) return true;
    }
    return false;
  };
  return visit(start);
}
/** Ends the player's turn: the enemy acts, then your pieces are ready again. */
export function endTurn(g: Run): { run: Run; steps: Step[] } {
  if (g.phase !== "player" || g.promoting) return { run: g, steps: [] };
  // In check you must get the king safe first, unless nothing this turn can.
  if (inCheck(g) && canEscape(g)) return { run: g, steps: [] };
  const { run: acted, steps } = enemyTurn(g);
  const run = steps.length ? acted : note(acted, "Enemy waits");
  if (run.phase !== "player") return { run, steps };
  const units = run.units.map(u => (u.side === "white" ? { id: u.id, side: u.side, kind: u.kind, hp: u.hp, x: u.x, y: u.y } : u));
  return { run: { ...run, units, turn: run.turn + 1 }, steps };
}

export function campReason(g: Run, choice: CampChoice): string {
  if (g.phase !== "camp") return "Camp is closed";
  if (g.gold < COST[choice]) return "Not enough gold";
  if (choice === "heal" && (g.units.find(u => u.id === "king")?.hp ?? 0) >= HP.king) return "Full HP";
  const army = g.units.filter(u => u.side === "white").length + (g.recruits?.length ?? 0);
  if (choice !== "heal" && army >= (ENCOUNTERS[g.encounter + 1]?.starts.length ?? 0)) return "Army full";
  return "";
}
/** Spend gold at the hub: mend the king now, or add a recruit to the barracks. You can buy as often as gold and room allow. */
export function buy(g: Run, choice: CampChoice): Run {
  if (campReason(g, choice)) return g;
  const paid = { ...g, gold: g.gold - COST[choice], history: [...g.history, `Camp: ${choice}`] };
  if (choice === "heal") return { ...paid, units: g.units.map(u => (u.id === "king" ? { ...u, hp: Math.min(HP.king, u.hp + 2) } : u)) };
  return { ...paid, recruits: [...(g.recruits ?? []), choice] };
}
/** Take the road: the army and any recruits march into the next battle. */
export function leaveCamp(g: Run): Run {
  if (g.phase !== "camp") return g;
  const recruits = g.recruits ?? [];
  const army = [...g.units.filter(u => u.side === "white"), ...recruits.map((kind, i): Unit => ({ id: `ally-${g.nextId + i}`, side: "white", kind, hp: HP[kind], x: 0, y: 0 }))];
  return spawn({ ...g, encounter: g.encounter + 1, nextId: g.nextId + recruits.length, recruits: undefined, history: [...g.history, "Camp: road"] }, army);
}

export function readRun(raw: string | null): Run | null {
  try {
    const g = JSON.parse(raw ?? "null") as Run | null;
    if (!g || g.version !== 2 || g.level !== undefined || !Number.isInteger(g.encounter) || !Number.isInteger(g.turn) || g.turn < 1 || !ENCOUNTERS[g.encounter] || !["player", "camp", "victory", "defeat"].includes(g.phase)) return null;
    if (!Array.isArray(g.units) || !Array.isArray(g.log) || !Array.isArray(g.history) || !Number.isFinite(g.gold) || !Number.isInteger(g.turn) || !Number.isInteger(g.nextId)) return null;
    if (g.phase !== "defeat" && !g.units.some(u => u.id === "king" && u.side === "white")) return null;
    if (g.phase === "player" && !g.units.some(u => u.side === "black")) return null;
    if (g.recruits !== undefined && (g.phase !== "camp" || !Array.isArray(g.recruits) || g.recruits.some(k => !["pawn", "bishop", "rook"].includes(k)) || g.units.filter(u => u.side === "white").length + g.recruits.length > (ENCOUNTERS[g.encounter + 1]?.starts.length ?? 0))) return null;
    if (g.promoting !== undefined && (g.phase !== "player" || !g.units.some(u => u.id === g.promoting && u.side === "white" && u.kind === "pawn" && u.y === 0))) return null;
    if (g.units.some(u => typeof u.id !== "string" || !Object.hasOwn(HP, u.kind) || !Number.isInteger(u.x) || !Number.isInteger(u.y) || !["white", "black"].includes(u.side) || !passable(g, u) || !Number.isFinite(u.hp) || u.hp <= 0 || u.hp > HP[u.kind])) return null;
    if (new Set(g.units.map(u => u.id)).size !== g.units.length || new Set(g.units.map(u => `${u.x},${u.y}`)).size !== g.units.length) return null;
    return g;
  } catch { return null; }
}
