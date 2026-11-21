/** The dungeon never makes a mistake: this exhaustive search finds, for any position, how many more
 * moves the player needs to force the goal against best defence (or that it can't be forced in
 * time). The dungeon's reply in play, and the studio's checks (solvable, unique key, tries, the
 * main line), all come from it. Deterministic: ties break by a fixed order. */
import { VALUE, apply, boardOf, keyOf, legalMoves, moveName, outcome, pass, pieceAt, start } from "./engine";
import type { Board, Move, Puzzle, State } from "./engine";

export const NEVER = Infinity;
export class TooBig extends Error {}

export type Solver = { pz: Puzzle; b: Board; memo: Map<string, number>; nodes: number; budget: number };
export const solver = (pz: Puzzle, budget = 2_000_000): Solver => ({ pz, b: boardOf(pz), memo: new Map(), nodes: 0, budget });

/** Player moves still needed to force a win from `s` (0: already won), or NEVER. */
export function need(sv: Solver, s: State): number {
  const key = `${keyOf(s)}#${s.played}`;
  const hit = sv.memo.get(key);
  if (hit !== undefined) return hit;
  const moves = s.lost ? [] : legalMoves(sv.pz, sv.b, s);
  const o = outcome(sv.pz, sv.b, s, moves);
  if (o) { const v = o === "win" ? 0 : NEVER; sv.memo.set(key, v); return v; }
  if (++sv.nodes > sv.budget) throw new TooBig();
  let v: number;
  if (s.turn === "white") {
    v = NEVER;
    if (!moves.length) v = need(sv, pass(s));
    for (const m of moves) {
      const n = need(sv, apply(sv.pz, s, m));
      if (n !== NEVER && 1 + n < v) v = 1 + n;
      if (v === 1) break;
    }
  } else {
    v = moves.length ? 0 : need(sv, pass(s));
    for (const m of moves) {
      v = Math.max(v, need(sv, apply(sv.pz, s, m)));
      if (v === NEVER) break;
    }
  }
  sv.memo.set(key, v);
  return v;
}
/** Moves needed after the player plays `m` (counting `m`), or NEVER. */
export const after = (sv: Solver, s: State, m: Move) => { const n = need(sv, apply(sv.pz, s, m)); return n === NEVER ? NEVER : 1 + n; };

/** The dungeon's move: the reply that leaves the player furthest from the goal (best of all, out of
 * reach). Ties: take the most material, then the first in board order. Null when it has no move. */
export function bestReply(sv: Solver, s: State): Move | null {
  let best: Move | null = null, bestV = -1, bestGain = -1;
  for (const m of legalMoves(sv.pz, sv.b, s)) {
    const v = need(sv, apply(sv.pz, s, m));
    const victim = pieceAt(s, m.to), gain = victim ? (victim.kind === "peasant" || victim.kind === "king" ? 100 : VALUE[victim.kind]) : 0;
    if (v > bestV || (v === bestV && gain > bestGain)) { best = m; bestV = v; bestGain = gain; }
  }
  return best;
}

export type Line = { move: Move; name: string; side: "white" | "black" }[];
export type Analysis =
  | { ok: false; reason: "too-big"; nodes: number }
  | {
    ok: true;
    /** Fewest moves that force the goal, or NEVER. */
    par: number;
    /** First moves that force the goal within the limit: the puzzle is sound when there's exactly one. */
    keys: string[];
    /** Wrong first moves the dungeon can refute in just one way, and that reply: the good traps. */
    tries: { move: string; refutation: string }[];
    /** Key, best defence, and so on to the win. */
    line: Line;
    nodes: number;
  };

export function analyze(pz: Puzzle, budget?: number): Analysis {
  const sv = solver(pz, budget);
  try {
    const s0 = start(pz);
    const firsts = legalMoves(pz, sv.b, s0);
    const scored = firsts.map(m => ({ m, v: after(sv, s0, m) }));
    const par = Math.min(NEVER, ...scored.map(x => x.v));
    const keys = scored.filter(x => x.v !== NEVER).map(x => moveName(pz, s0, x.m));
    const tries: { move: string; refutation: string }[] = [];
    for (const { m, v } of scored) {
      if (v !== NEVER) continue;
      const s1 = apply(pz, s0, m);
      if (outcome(pz, sv.b, s1)) continue;
      const refs = legalMoves(pz, sv.b, s1).filter(r => need(sv, apply(pz, s1, r)) === NEVER);
      // A try: every other reply loses for the dungeon.
      if (refs.length === 1 && legalMoves(pz, sv.b, s1).length > 1) tries.push({ move: moveName(pz, s0, m), refutation: moveName(pz, s1, refs[0]) });
    }
    return { ok: true, par, keys, tries, line: par === NEVER ? [] : mainLine(sv, s0), nodes: sv.nodes };
  } catch (e) {
    if (e instanceof TooBig) return { ok: false, reason: "too-big", nodes: sv.nodes };
    throw e;
  }
}

/** The fastest win for the player against the dungeon's best defence. */
export function mainLine(sv: Solver, s: State): Line {
  const line: Line = [];
  for (let guard = 0; guard < 64 && !outcome(sv.pz, sv.b, s); guard++) {
    if (s.turn === "white") {
      const target = need(sv, s);
      const m = legalMoves(sv.pz, sv.b, s).find(m => after(sv, s, m) === target);
      if (!m) { s = pass(s); continue; }
      line.push({ move: m, name: moveName(sv.pz, s, m), side: "white" });
      s = apply(sv.pz, s, m);
    } else {
      const m = bestReply(sv, s);
      if (!m) { s = pass(s); continue; }
      line.push({ move: m, name: moveName(sv.pz, s, m), side: "black" });
      s = apply(sv.pz, s, m);
    }
  }
  return line;
}
