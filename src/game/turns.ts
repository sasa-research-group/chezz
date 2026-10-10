/** Escape from Exile, turn-based: you act, then the enemy acts. Each side
 * spends a per-turn energy pool. Each piece may move once (1 energy per
 * square in its chess shape; a knight's jump costs 2), then strike the next
 * square in its shape (2; a knight's jump 3) or defend (1). Pure and
 * deterministic: no DOM, no randomness, inputs are never mutated. */
export type Side = "white" | "black";
export type Kind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Pos = { x: number; y: number };
export type Unit = Pos & { id: string; side: Side; kind: Kind; hp: number; moved?: boolean; acted?: boolean; defending?: boolean };
export type Target = Pos & { cost: number; id?: string };
export type Encounter = { title: string; story: string; reward: number; enemyEnergy: number; width: number; height: number; walls: Pos[]; spawns: [Kind, number, number, number][]; starts: Pos[] };
export type Run = {
  version: 2; encounter: number; turn: number;
  phase: "player" | "camp" | "victory" | "defeat";
  gold: number; energy: number; units: Unit[]; log: string[]; history: string[]; nextId: number;
  /** Your pawn that reached the far row and is waiting for you to pick its new piece. */
  promoting?: string;
  /** Recruits bought at the hub, waiting in the barracks until you take the road. */
  recruits?: Recruit[];
};
export type Recruit = "pawn" | "bishop" | "rook";
export type PromoteTo = "queen" | "rook" | "bishop" | "knight";
/** One beat of play for presentation: who acted, how, on whom, and who fell. */
export type Step = { text: string; units: Unit[]; focus: Pos[]; damage: { id: string; amount: number }[]; actor: string; kind: "move" | "strike" | "defend" | "promote"; target?: string; killed: string[]; from?: Kind };

export const ENERGY = 4;
export const HP: Record<Kind, number> = { king: 5, queen: 9, rook: 5, bishop: 3, knight: 3, pawn: 1 };
export const DAMAGE: Record<Kind, number> = { king: 2, queen: 3, rook: 3, bishop: 2, knight: 2, pawn: 1 };
export const ENCOUNTERS: Encounter[] = [
  { title: "The roadside patrol", story: "Two royal lackeys. One very annoyed former king. Clear the road.", reward: 8, enemyEnergy: 2, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 1, 1], ["pawn", 2, 1, 1]], starts: [{ x: 1, y: 3 }] },
  { title: "The first follower", story: "The old toll gate is closed. Find a way around, and bring everyone home.", reward: 8, enemyEnergy: 3, width: 6, height: 4, walls: [{ x: 3, y: 1 }, { x: 3, y: 2 }], spawns: [["pawn", 0, 0, 1], ["pawn", 3, 0, 1], ["pawn", 5, 0, 1]], starts: [{ x: 1, y: 3 }, { x: 0, y: 3 }, { x: 5, y: 3 }] },
  { title: "The narrow crossing", story: "A battered knight holds the bridge. Your little rebellion has somewhere to be.", reward: 0, enemyEnergy: 3, width: 6, height: 6, walls: [2, 3].flatMap(y => [0, 1, 4, 5].map(x => ({ x, y }))), spawns: [["knight", 3, 0, 2], ["pawn", 1, 1, 1], ["pawn", 4, 1, 1]], starts: [{ x: 2, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 }] },
];
export type CampChoice = Recruit | "heal";
export const COST: Record<CampChoice, number> = { pawn: 3, bishop: 6, rook: 8, heal: 4 };

export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
export const coord = (g: Run, p: Pos) => "abcdefgh"[p.x] + (ENCOUNTERS[g.encounter].height - p.y);
export const at = (g: Run, p: Pos) => g.units.find(u => same(u, p));
export const label = (u: Unit) => `${u.side === "white" ? "Your" : "Enemy"} ${u.kind}`;
export function passable(g: Run, p: Pos) {
  const e = ENCOUNTERS[g.encounter];
  return p.x >= 0 && p.y >= 0 && p.x < e.width && p.y < e.height && !e.walls.some(w => same(w, p));
}
const DIAGONALS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const STRAIGHTS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const LEAPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const slides = (k: Kind) => k === "rook" ? STRAIGHTS : k === "bishop" ? DIAGONALS : k === "queen" ? [...STRAIGHTS, ...DIAGONALS] : null;
const forward = (u: Unit) => u.side === "white" ? -1 : 1;
const energyOf = (g: Run, side: Side) => side === "white" ? g.energy : ENCOUNTERS[g.encounter].enemyEnergy;

/** Empty squares a piece can move to this turn, priced by distance. */
export function moveTargets(g: Run, u: Unit, energy = g.energy): Target[] {
  if (u.moved || u.acted) return [];
  const out: Target[] = [];
  const open = (p: Pos) => passable(g, p) && !at(g, p);
  const dirs = slides(u.kind);
  if (dirs) {
    for (const [dx, dy] of dirs) for (let n = 1; n <= energy; n++) {
      const p = { x: u.x + dx * n, y: u.y + dy * n };
      if (!open(p)) break;
      out.push({ ...p, cost: n });
    }
  } else if (u.kind === "knight") {
    if (energy >= 2) for (const [dx, dy] of LEAPS) { const p = { x: u.x + dx, y: u.y + dy }; if (open(p)) out.push({ ...p, cost: 2 }); }
  } else if (energy >= 1) {
    const steps = u.kind === "king" ? [...STRAIGHTS, ...DIAGONALS] : [[0, forward(u)]];
    for (const [dx, dy] of steps) { const p = { x: u.x + dx, y: u.y + dy }; if (open(p)) out.push({ ...p, cost: 1 }); }
  }
  return out;
}

/** Enemies a piece can strike this turn: the next square along its capture shape (a knight's jump). */
export function attackTargets(g: Run, u: Unit, energy = energyOf(g, u.side)): Target[] {
  if (u.acted) return [];
  const cost = u.kind === "knight" ? 3 : 2;
  if (cost > energy) return [];
  return g.units.filter(v => v.side !== u.side && reaches(g, u, u, v)).map(v => ({ x: v.x, y: v.y, cost, id: v.id }));
}

/** Squares u could step to and then strike the target from this turn, priced move + strike. Empty when
 * u can already strike it where it stands (no walk needed) or the pool can't cover both. */
export function approaches(g: Run, id: string, targetId: string): Target[] {
  const u = g.units.find(v => v.id === id), v = g.units.find(w => w.id === targetId);
  if (!u || !v || u.acted || v.side === u.side || attackTargets(g, u).some(t => t.id === v.id)) return [];
  const strikeCost = u.kind === "knight" ? 3 : 2;
  return moveTargets(g, u).filter(t => t.cost + strikeCost <= g.energy && reaches(g, u, t, v)).map(t => ({ x: t.x, y: t.y, cost: t.cost + strikeCost }));
}

/** Could u, standing on `from`, strike `target` (ignoring energy)? Strikes reach one step in the piece's shape. */
export function reaches(g: Run, u: Unit, from: Pos, target: Pos): boolean {
  const dx = target.x - from.x, dy = target.y - from.y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (u.kind === "pawn") return ax === 1 && dy === forward(u);
  if (u.kind === "knight") return ax * ay === 2;
  if (Math.max(ax, ay) !== 1) return false;
  const diagonal = ax === 1 && ay === 1;
  return u.kind === "rook" ? !diagonal : u.kind === "bishop" ? diagonal : true;
}

function spawn(g: Run, army: Unit[]): Run {
  const e = ENCOUNTERS[g.encounter];
  const whites = army.map((u, i) => ({ id: u.id, side: u.side, kind: u.kind, hp: u.hp, ...e.starts[i] }));
  const enemies = e.spawns.map(([kind, x, y, hp], i) => ({ id: `enemy-${g.encounter}-${i}`, kind, side: "black" as const, x, y, hp }));
  return { ...g, promoting: undefined, units: [...whites, ...enemies], phase: "player", turn: 1, energy: ENERGY, log: [e.story] };
}
export function newRun(): Run {
  const g: Run = { version: 2, encounter: 0, turn: 1, phase: "player", gold: 2, energy: ENERGY, units: [], log: [], history: [], nextId: 1 };
  return spawn(g, [{ id: "king", side: "white", kind: "king", hp: HP.king, x: 0, y: 0 }]);
}

const withUnit = (g: Run, id: string, patch: Partial<Unit>) => g.units.map(u => (u.id === id ? { ...u, ...patch } : u));
function finish(g: Run): Run {
  if (!g.units.some(u => u.id === "king")) return { ...g, phase: "defeat", log: ["The crown fell. Your rebellion ends here.", ...g.log] };
  if (!g.units.some(u => u.side === "black")) {
    const last = g.encounter === ENCOUNTERS.length - 1, reward = ENCOUNTERS[g.encounter].reward;
    return { ...g, phase: last ? "victory" : "camp", gold: g.gold + reward, log: [last ? "Across the bridge. Your rebellion has begun." : `Road cleared. +${reward} gold.`, ...g.log] };
  }
  return g;
}
const note = (g: Run, text: string): Run => ({ ...g, log: [text, ...g.log].slice(0, 30), history: [...g.history, text] });

export function move(g: Run, id: string, to: Pos): Run {
  const u = g.units.find(u => u.id === id);
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white") return g;
  const t = moveTargets(g, u).find(t => same(t, to));
  if (!t) return g;
  const next = note({ ...g, energy: g.energy - t.cost, units: withUnit(g, id, { x: to.x, y: to.y, moved: true }) }, `${label(u)} moves to ${coord(g, to)} (${t.cost} energy).`);
  // A pawn on the far row waits for you to choose what it becomes.
  return u.kind === "pawn" && to.y === lastRank(g, u) ? { ...next, promoting: id } : next;
}
const lastRank = (g: Run, u: Unit) => (u.side === "white" ? 0 : ENCOUNTERS[g.encounter].height - 1);
function promoted(g: Run, u: Unit, kind: PromoteTo): { run: Run; step: Step } {
  const text = `${label(u)} reaches the far row and becomes a ${kind}!`;
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
  if (g.phase !== "player" || g.promoting || !u || u.side !== "white" || u.acted || g.energy < 1) return g;
  return note({ ...g, energy: g.energy - 1, units: withUnit(g, id, { acted: true, defending: true }) }, `${label(u)} defends (1 energy).`);
}

/** Resolves one strike for either side; `energy` is what the striker's side has. */
function strike(g: Run, a: Unit, t: Target): { run: Run; step: Step } {
  const v = g.units.find(u => u.id === t.id)!;
  const dealt = Math.max(0, DAMAGE[a.kind] - (v.defending ? 1 : 0));
  const survives = v.hp > dealt;
  // Strikes land from where the striker stands; it never moves onto the target's square.
  let units = g.units.flatMap(u => u.id === v.id ? (survives ? [{ ...u, hp: u.hp - dealt }] : []) : u.id === a.id ? [{ ...u, acted: true }] : [u]);
  const damage = [{ id: v.id, amount: dealt }];
  let text = `${label(a)} strikes ${label(v)} for ${dealt}${survives ? "" : ", defeating it"}.`;
  if (survives && v.defending && reaches({ ...g, units }, v, v, a)) {
    const back = DAMAGE[v.kind], left = a.hp - back;
    units = left > 0 ? units.map(u => (u.id === a.id ? { ...u, hp: left } : u)) : units.filter(u => u.id !== a.id);
    damage.push({ id: a.id, amount: back });
    text += ` The defender counters for ${back}${left > 0 ? "" : ", defeating it"}.`;
  }
  const run = note({ ...g, units }, text);
  const killed = g.units.filter(u => !run.units.some(w => w.id === u.id)).map(u => u.id);
  return { run, step: { text, units: run.units, focus: [{ x: v.x, y: v.y }], damage, actor: a.id, kind: "strike", target: v.id, killed } };
}

export function attack(g: Run, id: string, targetId: string): { run: Run; step: Step | null } {
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
  let run: Run = { ...g, units: g.units.map(u => (u.side === "black" ? { ...u, moved: false, acted: false, defending: false } : u)) };
  let energy = ENCOUNTERS[g.encounter].enemyEnergy;
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
        const dealt = Math.max(0, DAMAGE[u.kind] - (v.defending ? 1 : 0));
        if (dealt === 0) continue;
        // A surviving defender counters if it can reach the striker's square.
        const countered = v.defending && dealt < v.hp && reaches(run, v, v, u) ? DAMAGE[v.kind] : 0;
        const score = 100 + dealt * 10 + (dealt >= v.hp ? 50 : 0) + (v.id === "king" ? 30 : 0) - countered * 8 - (countered >= u.hp ? 60 : 0) - t.cost;
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
        const strikeCost = u.kind === "knight" ? 3 : 2;
        const lineUp = !u.acted && energy - t.cost >= strikeCost && whites.some(w => reaches(run, u, t, w));
        if (gain <= 0 && !march && !crowning && !lineUp) continue;
        choices.push({ score: crowning ? 30 : lineUp ? 20 - t.cost : march || gain * 5 - t.cost, key: `m${u.id}${t.x}${t.y}`, apply: () => {
          const text = `${label(u)} moves to ${coord(run, t)}.`;
          const next = note({ ...run, units: withUnit(run, u.id, { x: t.x, y: t.y, moved: true }) }, text);
          return { run: next, step: { text, units: next.units, focus: [{ x: t.x, y: t.y }], damage: [], actor: u.id, kind: "move", killed: [] }, cost: t.cost };
        } });
      }
      // Brace only when it matters (a threat it survives only thanks to the block, or one it
      // could hit back), and only when no move is worth making.
      // A threat is one of your pieces that can strike u next turn, stepping in first if its pool allows.
      const threat = (w: Unit) => reaches(run, w, w, u) || moveTargets(run, { ...w, moved: false, acted: false }, ENERGY).some(t => t.cost + (w.kind === "knight" ? 3 : 2) <= ENERGY && reaches(run, w, t, u));
      const worthIt = whites.some(w => threat(w) && ((DAMAGE[w.kind] >= u.hp && DAMAGE[w.kind] - 1 < u.hp) || reaches(run, u, u, w)));
      if (!u.acted && worthIt) choices.push({ score: 0.4, key: `d${u.id}`, apply: () => {
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
  return { run, steps, spent: pool - energy };
}

/** Ends the player's turn: the enemy acts, then the player's pool refills. */
export function endTurn(g: Run): { run: Run; steps: Step[]; spent: number } {
  if (g.phase !== "player" || g.promoting) return { run: g, steps: [], spent: 0 };
  const { run, steps, spent } = enemyTurn(g);
  if (run.phase !== "player") return { run, steps, spent };
  const units = run.units.map(u => (u.side === "white" ? { id: u.id, side: u.side, kind: u.kind, hp: u.hp, x: u.x, y: u.y } : u));
  return { run: { ...run, units, energy: ENERGY, turn: run.turn + 1 }, steps, spent };
}

export function campReason(g: Run, choice: CampChoice): string {
  if (g.phase !== "camp") return "Camp is closed";
  if (g.gold < COST[choice]) return "Not enough gold";
  if (choice === "heal" && (g.units.find(u => u.id === "king")?.hp ?? 0) >= HP.king) return "King at full health";
  const army = g.units.filter(u => u.side === "white").length + (g.recruits?.length ?? 0);
  if (choice !== "heal" && army >= (ENCOUNTERS[g.encounter + 1]?.starts.length ?? 0)) return "No room on the next road";
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
    if (!g || g.version !== 2 || !Number.isInteger(g.encounter) || !Number.isInteger(g.turn) || g.turn < 1 || !ENCOUNTERS[g.encounter] || !["player", "camp", "victory", "defeat"].includes(g.phase)) return null;
    if (!Array.isArray(g.units) || !Array.isArray(g.log) || !Array.isArray(g.history) || !Number.isFinite(g.gold) || !Number.isInteger(g.turn) || !Number.isInteger(g.nextId) || !Number.isInteger(g.energy) || g.energy < 0 || g.energy > ENERGY) return null;
    if (g.phase !== "defeat" && !g.units.some(u => u.id === "king" && u.side === "white")) return null;
    if (g.phase === "player" && !g.units.some(u => u.side === "black")) return null;
    if (g.recruits !== undefined && (g.phase !== "camp" || !Array.isArray(g.recruits) || g.recruits.some(k => !["pawn", "bishop", "rook"].includes(k)) || g.units.filter(u => u.side === "white").length + g.recruits.length > (ENCOUNTERS[g.encounter + 1]?.starts.length ?? 0))) return null;
    if (g.promoting !== undefined && (g.phase !== "player" || !g.units.some(u => u.id === g.promoting && u.side === "white" && u.kind === "pawn" && u.y === 0))) return null;
    if (g.units.some(u => typeof u.id !== "string" || !Object.hasOwn(HP, u.kind) || !Number.isInteger(u.x) || !Number.isInteger(u.y) || !["white", "black"].includes(u.side) || !passable(g, u) || !Number.isFinite(u.hp) || u.hp <= 0 || u.hp > HP[u.kind])) return null;
    if (new Set(g.units.map(u => u.id)).size !== g.units.length || new Set(g.units.map(u => `${u.x},${u.y}`)).size !== g.units.length) return null;
    return g;
  } catch { return null; }
}
