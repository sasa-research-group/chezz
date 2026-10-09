/** Experiment 1, the Duel: one piece against one, one rule at a time.
 * Pure and deterministic. Single-turn damage mirrors resolveTurn in
 * src/game/exile.ts (tests/duel.test.ts checks this), abstracted to two
 * adjacent pieces that stay engaged. */
export type Choice = "strike" | "guard" | "sidestep" | "advance";
export type Rule = "trade" | "free";
/** current: as exile.ts (Always trade absorbs 1, Free hits absorbs 0, both return a hit).
 * shield: takes no damage and returns a full hit. none: guarding is just standing still. */
export type Guard = "current" | "shield" | "none";
export type Pair<T> = [T, T];
export type Settings = { rule: Rule; guard: Guard; goal: number; canFlee: Pair<boolean>; hp: Pair<number> };
export type State = { hp: Pair<number>; progress: Pair<number> };
export type Turn = { state: State; damage: Pair<number>; text: string[]; winner: 0 | 1 | "draw" | null };
export type Solution = { value: number; options: Pair<Choice[]>; mix: Pair<number[]> };

export const CHOICES: Choice[] = ["strike", "guard", "sidestep", "advance"];
export const MAX_HP = 5;
export const defaultSettings: Settings = { rule: "free", guard: "current", goal: 3, canFlee: [true, true], hp: [3, 3] };
export const stateKey = (s: State) => `${s.hp[0]},${s.hp[1]},${s.progress[0]},${s.progress[1]}`;

export function options(s: Settings, side: 0 | 1): Choice[] {
  return CHOICES.filter(c => (c !== "sidestep" || s.canFlee[side]) && (c !== "advance" || s.goal > 0));
}

const NAME = ["You", "The enemy"];
function absorbs(s: Settings) { return s.guard === "shield" ? Infinity : s.guard === "current" && s.rule === "trade" ? 1 : 0; }

export function winnerOf(s: Settings, st: State): Turn["winner"] {
  const dead = st.hp.map(h => h <= 0);
  if (dead[0] && dead[1]) return "draw";
  if (dead[0]) return 1;
  if (dead[1]) return 0;
  if (s.goal > 0) {
    const done = st.progress.map(p => p >= s.goal);
    if (done[0] && done[1]) return "draw";
    if (done[0]) return 0;
    if (done[1]) return 1;
  }
  return null;
}

export function resolve(s: Settings, st: State, a: Choice, b: Choice): Turn {
  const picks: Pair<Choice> = [a, b], damage: Pair<number> = [0, 0], text: string[] = [];
  const hit = (victim: 0 | 1, amount: number) => { damage[victim] += Math.max(0, amount); return Math.max(0, amount); };
  if (a === "strike" && b === "strike") {
    hit(0, st.hp[1]); hit(1, st.hp[0]);
    text.push(`Both strike. You deal ${st.hp[0]} and take ${st.hp[1]}.`);
  } else for (const side of [0, 1] as const) {
    if (picks[side] !== "strike") continue;
    const other = (1 - side) as 0 | 1, reply = picks[other];
    if (reply === "sidestep") { text.push(`${NAME[side]} strike${side ? "s" : ""} empty air: ${NAME[other].toLowerCase()} sidestep${other ? "s" : ""}.`); continue; }
    const guarded = reply === "guard" && s.guard !== "none";
    const dealt = hit(other, st.hp[side] - (guarded ? absorbs(s) : 0));
    const returns = guarded || s.rule === "trade";
    const back = returns ? hit(side, st.hp[other]) : 0;
    text.push(`${NAME[side]} strike${side ? "s" : ""} for ${dealt}${returns ? ` and take${side ? "s" : ""} ${back} back` : ", no return hit"}${guarded ? " (guarded)" : ""}.`);
  }
  const progress: Pair<number> = [...st.progress];
  for (const side of [0, 1] as const) if (picks[side] === "advance" && s.goal > 0 && st.hp[side] > damage[side]) { progress[side]++; text.push(`${NAME[side]} advance${side ? "s" : ""} toward the gate (${progress[side]}/${s.goal}).`); }
  if (!text.length) text.push("Nobody lands a blow.");
  const state: State = { hp: [Math.max(0, st.hp[0] - damage[0]), Math.max(0, st.hp[1] - damage[1])], progress };
  return { state, damage, text, winner: winnerOf(s, state) };
}

/** Zero-sum matrix game (row maximises). Uses Shapley–Snow: some optimal
 * pair is supported on a square nonsingular submatrix, so enumerating equal-
 * size supports is exact. Small matrices only (≤ 4×4 here). */
export type MatrixSolution = { value: number; row: number[]; col: number[]; support: [number[], number[]] };
export function solveMatrix(m: number[][], hint?: [number[], number[]]): MatrixSolution {
  const rows = m.length, cols = m[0].length, eps = 1e-9;
  const subsets = (n: number, k: number): number[][] => k === 0 ? [[]] : n < k ? [] : [...subsets(n - 1, k), ...subsets(n - 1, k - 1).map(s => [...s, n - 1])];
  const candidates = function* (): Generator<[number[], number[]]> {
    if (hint) yield hint;
    for (let k = 1; k <= Math.min(rows, cols); k++) for (const I of subsets(rows, k)) for (const J of subsets(cols, k)) yield [I, J];
  };
  for (const [I, J] of candidates()) {
    const k = I.length;
    // x·M[I][J] = v for each j, Σx = 1.  M[I][J]·y = w for each i, Σy = 1.
    const xv = linear([...J.map(j => [...I.map(i => m[i][j]), -1]), [...I.map(() => 1), 0]], [...J.map(() => 0), 1]);
    const yw = linear([...I.map(i => [...J.map(j => m[i][j]), -1]), [...J.map(() => 1), 0]], [...I.map(() => 0), 1]);
    if (!xv || !yw) continue;
    const v = xv[k];
    if (xv.slice(0, k).some(p => p < -eps) || yw.slice(0, k).some(p => p < -eps) || Math.abs(v - yw[k]) > 1e-7) continue;
    const row = Array(rows).fill(0), col = Array(cols).fill(0);
    I.forEach((i, n) => (row[i] = Math.max(0, xv[n]))); J.forEach((j, n) => (col[j] = Math.max(0, yw[n])));
    const colOk = Array.from({ length: cols }, (_, j) => row.reduce((t, p, i) => t + p * m[i][j], 0)).every(x => x >= v - 1e-7);
    const rowOk = m.every(r => r.reduce((t, x, j) => t + x * col[j], 0) <= v + 1e-7);
    if (colOk && rowOk) return { value: v, row, col, support: [I, J] };
  }
  throw new Error("no equilibrium found");
}
function linear(a: number[][], b: number[]): number[] | null {
  const n = b.length, m = a.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
  }
  return m.map((r, i) => r[n] / r[i]);
}

/** Solves every duel state up to MAX_HP by Shapley value iteration. Win = 1,
 * loss = -1, draw = 0, from your side. The discount is close to 1 so a win
 * ten turns away still counts almost fully; it only makes endless stalling
 * worth 0 (a draw). Each state starts from last sweep's support, which keeps
 * the many sweeps this needs fast. Ignores settings.hp: one solve covers
 * every starting HP. */
export function solveDuel(s: Settings, discount = 0.999): Map<string, Solution> {
  const states: State[] = [];
  const goal = Math.max(1, s.goal);
  for (let a = 1; a <= MAX_HP; a++) for (let b = 1; b <= MAX_HP; b++) for (let p = 0; p < goal; p++) for (let q = 0; q < goal; q++) states.push({ hp: [a, b], progress: [p, q] });
  const opts: Pair<Choice[]> = [options(s, 0), options(s, 1)];
  const next = new Map(states.map(st => [stateKey(st), opts[0].map(a => opts[1].map(b => resolve(s, st, a, b)))]));
  const value = new Map(states.map(st => [stateKey(st), 0]));
  const payoff = (t: Turn) => t.winner === 0 ? 1 : t.winner === 1 ? -1 : t.winner === "draw" ? 0 : discount * value.get(stateKey(t.state))!;
  const hints = new Map<string, [number[], number[]]>();
  for (let sweep = 0; sweep < 20000; sweep++) {
    let delta = 0;
    for (const st of states) {
      const key = stateKey(st), r = solveMatrix(next.get(key)!.map(row => row.map(payoff)), hints.get(key));
      hints.set(key, r.support);
      delta = Math.max(delta, Math.abs(r.value - value.get(key)!)); value.set(key, r.value);
    }
    if (delta < 1e-10) break;
  }
  return new Map(states.map(st => {
    const key = stateKey(st), r = solveMatrix(next.get(key)!.map(row => row.map(payoff)), hints.get(key));
    return [key, { value: r.value, options: opts, mix: [r.row, r.col] }];
  }));
}
