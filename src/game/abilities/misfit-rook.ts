/** Wesley's seed: the haystack strikes by rolling onto what it kills, eating it, and moving like it
 * for two turns. Movement only; it still strikes like a rook. Riders: too full to brace while
 * digesting; being hay, it burns one tick longer (Wick's ability reads that). */
import type { Kind, Run } from "../turns";
import type { Ability } from "../abilities";
import type { Mods } from "../status";
import { coord, label, note, same } from "../board";

/** What the haystack has eaten, while the meal lasts. */
export const digesting = (u: { mods?: Mods }, turn: number): Kind | undefined => {
  const eaten = u.mods?.absorbed as Kind | undefined, until = u.mods?.absorbedUntil;
  return eaten && typeof until === "number" && turn <= until ? eaten : undefined;
};

export const haystack: Ability = {
  id: "misfit-rook", variant: "misfit", kind: "rook", name: "Haystack", ability: "Consume",
  sentence: "Haystack strikes by rolling onto its target's square: if the blow kills, it eats the piece and moves like it for the next two turns.",
  moveTargets: (g, u, base, ctx) => {
    const eaten = digesting(u, g.turn);
    if (!eaten) return base;
    const extra = ctx.shape(eaten).filter(t => !base.some(b => same(b, t)));
    return [...base, ...extra];
  },
  canDefend: (g, u) => !digesting(u, g.turn),
  afterStrike: (g, striker, victim, killed) => {
    if (!killed || !g.units.some(u => u.id === striker.id)) return g;
    const p = { x: victim.x, y: victim.y };
    const mods: Mods = { ...(striker.mods ?? {}), absorbed: victim.kind, absorbedUntil: g.turn + 2 };
    const rolled: Run = { ...g, units: g.units.map(u => (u.id === striker.id ? { ...u, ...p, mods } : u)) };
    // The victim's death may have raised a wall where it stood (Nobody's empty suit, from onDeath,
    // which runs before this hook). The hay rolls over it: the suit is crushed and the square stays floor.
    if (!g.walls?.some(w => same(w, p))) return rolled;
    const walls = g.walls.filter(w => !same(w, p));
    return note({ ...rolled, walls: walls.length ? walls : undefined }, `${label(striker)} rolls onto ${coord(g, p)} and flattens the wall there.`);
  },
};
