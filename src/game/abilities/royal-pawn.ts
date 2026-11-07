/** Sergeant Pike (royal pawn): Pike. His strike reaches straight ahead instead of diagonally: the
 * square directly in front, or two squares ahead when the square between is passable and empty (a
 * piece of either side or a wall blocks the long thrust). Never diagonal, so his forward diagonals
 * are safe to stand on and a braced Pike only counters along the pike. attackTargets, approaches,
 * counters and kingThreat all ask `reaches`, so the one hook covers them all. Movement, cost, damage
 * and promotion are a pawn's. See docs/variants.md. */
import type { Pos, Run, Unit } from "../turns";
import type { Ability } from "../abilities";
import { forward, open } from "../board";

/** Could a Pike on `from` thrust at `target`? Straight ahead one square, or two over an open square. */
export function pikeReaches(g: Run, u: Pick<Unit, "side">, from: Pos, target: Pos): boolean {
  if (target.x !== from.x) return false;
  const step = forward(u), dy = target.y - from.y;
  return dy === step || (dy === 2 * step && open(g, { x: from.x, y: from.y + step }));
}

export const sergeantPike: Ability = {
  id: "royal-pawn", variant: "royal", kind: "pawn", name: "Sergeant Pike", ability: "Pike",
  sentence: "Sergeant Pike thrusts straight ahead instead of diagonally, and reaches two squares forward when the square between is empty.",
  reaches: (g, u, from, target) => pikeReaches(g, u, from, target),
};
