/** Brick (rebel rook): Demolish. See docs/variants.md.
 * Instead of striking, Brick swings at an orthogonally adjacent wall and knocks it down for good:
 * an encounter wall joins `run.broken`, a wall an ability raised (Nobody's suit) leaves `run.walls`.
 * passable() reads both, so the gap is open to either side from then on. */
import type { Ability, AltAction } from "../abilities";
import type { Pos, Run, Unit } from "../turns";
import { boardOf, gateAt, coord, isWall, label, note, same, straightNeighbours } from "../board";

/** Knocks the wall on `p` down, whatever raised it: an ability wall is forgotten and an unbroken
 * encounter wall is marked broken, both in one swing, so isWall() is false afterwards even when a
 * crafted save stacks the two on one square. */
function knockDown(g: Run, p: Pos): Run {
  const walls = g.walls?.filter(w => !same(w, p));
  // What the board drew there (a wall, or a shut gate) is smashed for good: run.broken makes it floor.
  const drawn = (boardOf(g).walls.some(w => same(w, p)) || !!gateAt(g, p)) && !g.broken?.some(b => same(b, p));
  return { ...g, walls: walls?.length ? walls : undefined, broken: drawn ? [...(g.broken ?? []), { x: p.x, y: p.y }] : g.broken };
}

function demolish(g: Run, u: Unit): AltAction[] {
  const targets = straightNeighbours(u).filter(p => isWall(g, p));
  if (!targets.length) return [];
  return [{
    id: "demolish", label: "Demolish (2)", cost: 2, targets,
    apply: (run, target) => {
      const p = target!;
      const text = `${label(u)} demolishes the wall at ${coord(run, p)}.`;
      const next = note(knockDown(run, p), text);
      return { run: next, step: { text, units: next.units, focus: [{ x: p.x, y: p.y }], damage: [], actor: u.id, kind: "alt", killed: [] } };
    },
  }];
}

export const brick: Ability = {
  id: "rebel-rook", variant: "rebel", kind: "rook", name: "Brick", ability: "Demolish",
  sentence: "Brick can swing the sledgehammer at an adjacent wall instead of a piece and knock it down for good.",
  altActions: demolish,
};
