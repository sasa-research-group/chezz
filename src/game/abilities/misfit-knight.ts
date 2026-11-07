/** Nobody (misfit knight): Hollow. See docs/variants.md.
 * Only 2 HP, but the empty suit stays standing: when Nobody dies by any cause the square joins
 * run.walls, which passable() reads for both sides for the rest of the battle. */
import type { Ability } from "../abilities";
import { at, coord, label, note, same } from "../board";

export const nobody: Ability = {
  id: "misfit-knight", variant: "misfit", kind: "knight", name: "Nobody", ability: "Hollow",
  sentence: "There's nobody inside: Nobody has only 2 HP, but when destroyed the empty suit stays standing on its square as a wall for the rest of the battle.",
  hp: 2,
  // The run no longer holds u. If something already stands on the square (a Haystack that rolled on),
  // there is no room for a suit; otherwise the square becomes a wall, alongside any walls already raised.
  onDeath: (g, u) => {
    const p = { x: u.x, y: u.y };
    if (at(g, p) || g.walls?.some(w => same(w, p))) return g;
    return note({ ...g, walls: [...(g.walls ?? []), p] }, `${label(u)}'s empty suit stands as a wall at ${coord(g, p)}.`);
  },
};
