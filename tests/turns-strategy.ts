import { DAMAGE, attack, attackTargets, defend, move, moveTargets } from "../src/game/turns";
import type { Pos, Run } from "../src/game/turns";

export type Action = { type: "move"; id: string; to: Pos } | { type: "attack"; id: string; targetId: string; to: Pos } | { type: "defend"; id: string };

// A simple greedy player for tests: kill or hit what it can, otherwise walk
// toward the nearest enemy, then brace the king with what's left. It shows the
// run is reachable, not that it's fun.
export function nextAction(g: Run): Action | null {
  if (g.phase !== "player" || g.energy <= 0) return null;
  let best: { score: number; action: Action } | null = null;
  const enemies = g.units.filter(u => u.side === "black");
  const dist = (p: Pos) => Math.min(...enemies.map(v => Math.max(Math.abs(p.x - v.x), Math.abs(p.y - v.y))));
  for (const u of g.units.filter(u => u.side === "white")) {
    for (const t of attackTargets(g, u)) {
      const v = g.units.find(w => w.id === t.id)!;
      const score = 100 + (DAMAGE[u.kind] >= v.hp ? 50 : 0) + DAMAGE[u.kind] * 10 - t.cost;
      if (!best || score > best.score) best = { score, action: { type: "attack", id: u.id, targetId: v.id, to: { x: v.x, y: v.y } } };
    }
    if (u.id === "king" && u.hp <= 2) continue;
    for (const t of moveTargets(g, u)) {
      const gain = dist(u) - dist(t);
      if (gain <= 0) continue;
      const score = gain * 5 - t.cost;
      if (!best || score > best.score) best = { score, action: { type: "move", id: u.id, to: { x: t.x, y: t.y } } };
    }
  }
  if (best) return best.action;
  const king = g.units.find(u => u.id === "king");
  return king && !king.acted ? { type: "defend", id: "king" } : null;
}

export function apply(g: Run, a: Action): Run {
  return a.type === "move" ? move(g, a.id, a.to) : a.type === "attack" ? attack(g, a.id, a.targetId).run : defend(g, a.id);
}

export function playTurn(start: Run): Run {
  let g = start;
  for (let guard = 0; guard < 20; guard++) {
    const a = nextAction(g);
    if (!a) break;
    const next = apply(g, a);
    if (next === g) break;
    g = next;
  }
  return g;
}
