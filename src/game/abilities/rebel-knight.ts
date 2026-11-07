/** Dobbin (rebel knight): Giddy-up. See docs/variants.md.
 * A wooden horse can't fly: every L needs one clear elbow, for the 1-energy jump and the strike alike. */
import type { Pos, Run } from "../turns";
import type { Ability } from "../abilities";
import { LEAPS, open } from "../board";

/** The L from `from` to `target` has a clear elbow: (from.x + dx, from.y) or (from.x, from.y + dy) is
 * passable and empty. Walls, holes, shut gates and pieces of either side block an elbow. */
export const elbowClear = (g: Run, from: Pos, target: Pos) => open(g, { x: target.x, y: from.y }) || open(g, { x: from.x, y: target.y });

export const dobbin: Ability = {
  id: "rebel-knight", variant: "rebel", kind: "knight", name: "Dobbin", ability: "Giddy-up",
  sentence: "Dobbin's jump costs 1 instead of 2, but a wooden horse can't fly: for every L, one of its two elbow squares must be empty, for moves and strikes alike.",
  // Built from the leaps directly: the kind's knight squares cost 2 and need 2 energy; Dobbin's cost 1.
  // So `base`/ctx.shape are bypassed: any tile mechanic shapeTargets learns for knight landings (portals, ice) must be mirrored here.
  moveTargets: (_g, u, _base, ctx) => {
    if (ctx.energy < 1) return [];
    return LEAPS.map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy, cost: 1 })).filter(t => ctx.open(t) && (ctx.open({ x: t.x, y: u.y }) || ctx.open({ x: u.x, y: t.y })));
  },
  // Strikes (and so counters, approaches and kingThreat) keep the knight's reach, under the elbow rule.
  reaches: (g, _u, from, target, base) => base && elbowClear(g, from, target),
};
