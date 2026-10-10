import { attack, attackTargets, defend, endTurn, move, moveTargets, promote } from "../src/game/turns";
import type { Pos, Run } from "../src/game/turns";

export type Action = { type: "move"; id: string; to: Pos } | { type: "attack"; id: string; targetId: string; to: Pos } | { type: "defend"; id: string } | { type: "promote"; id: string };

// A small search player for tests. Strikes only reach the next square, so
// winning means planning a turn ahead (stepping into a pawn's path before it
// promotes, say). It shows the run is reachable, not that it's fun.

export function apply(g: Run, a: Action): Run {
  return a.type === "move" ? move(g, a.id, a.to) : a.type === "attack" ? attack(g, a.id, a.targetId).run : a.type === "promote" ? promote(g, a.id, "queen").run : defend(g, a.id);
}

const key = (g: Run) => g.units.map(u => `${u.id}${u.kind[0]}${u.x},${u.y}:${u.hp}${u.moved ? "m" : ""}${u.acted ? "a" : ""}${u.defending ? "d" : ""}`).sort().join("|") + g.energy + g.phase + (g.promoting ?? "");

/** Every distinct way the rest of the player's turn can go, with the actions that get there. */
export function turnOutcomes(start: Run): { run: Run; plan: Action[] }[] {
  const seen = new Map<string, { run: Run; plan: Action[] }>();
  const visit = (g: Run, plan: Action[]) => {
    const k = key(g);
    if (seen.has(k)) return;
    seen.set(k, { run: g, plan });
    if (g.phase !== "player") return;
    const step = (a: Action) => { const next = apply(g, a); if (next !== g) visit(next, [...plan, a]); };
    if (g.promoting) return step({ type: "promote", id: g.promoting });
    for (const u of g.units.filter(u => u.side === "white")) {
      if (!u.moved && !u.acted) for (const t of moveTargets(g, u)) step({ type: "move", id: u.id, to: { x: t.x, y: t.y } });
      for (const t of attackTargets(g, u)) step({ type: "attack", id: u.id, targetId: t.id!, to: { x: t.x, y: t.y } });
      if (!u.acted) step({ type: "defend", id: u.id });
    }
  };
  visit(start, []);
  return [...seen.values()].filter(o => !o.run.promoting);
}

/** Higher is better for the player: own health, enemy losses, and enemies kept within reach. */
function evaluate(g: Run): number {
  if (g.phase === "defeat") return -1e6;
  const whites = g.units.filter(u => u.side === "white"), blacks = g.units.filter(u => u.side === "black");
  // Health and pieces carry over, so a costly win scores below a clean one.
  if (g.phase !== "player") return 1e6 + whites.reduce((s, u) => s + u.hp + 3, 0);
  const king = whites.find(u => u.id === "king")!;
  const near = (x: number, y: number) => Math.min(...whites.map(w => Math.max(Math.abs(w.x - x), Math.abs(w.y - y))));
  return king.hp * 4 + whites.reduce((s, u) => s + u.hp + 3, 0)
    - blacks.reduce((s, u) => s + u.hp * 2 + 6 + (u.kind === "queen" ? 20 : 0) + near(u.x, u.y) / 2, 0);
}
const settle = (g: Run) => (g.phase === "player" ? endTurn(g).run : g);

/** The rest of this turn, chosen by looking past the enemy's reply to our best next turn. */
export function planTurn(g: Run, width = 12): Action[] {
  const shortlist = turnOutcomes(g).map(o => ({ ...o, after: settle(o.run) })).map(o => ({ ...o, score: evaluate(o.after) }))
    .sort((a, b) => b.score - a.score).slice(0, width);
  let best = shortlist[0], bestScore = -Infinity;
  for (const c of shortlist) {
    const follow = c.after.phase === "player" ? Math.max(...turnOutcomes(c.after).map(o => evaluate(settle(o.run)))) : c.score;
    if (follow > bestScore) { bestScore = follow; best = c; }
  }
  return best?.plan ?? [];
}

export function nextAction(g: Run): Action | null {
  if (g.phase !== "player") return null;
  return planTurn(g)[0] ?? null;
}

export function playTurn(start: Run): Run {
  return planTurn(start).reduce(apply, start);
}
