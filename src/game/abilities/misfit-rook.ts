/** Wesley's seed: the haystack strikes by rolling onto what it kills, eating it, and moving like it
 * for two turns. Movement only; it still strikes like a rook. Riders: too full to brace while
 * digesting; being hay, it burns one tick longer (Wick's ability reads that). */
import type { Kind } from "../turns";
import type { Ability } from "../abilities";
import type { Mods } from "../status";
import { same } from "../board";

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
    const mods: Mods = { ...(striker.mods ?? {}), absorbed: victim.kind, absorbedUntil: g.turn + 2 };
    return { ...g, units: g.units.map(u => (u.id === striker.id ? { ...u, x: victim.x, y: victim.y, mods } : u)) };
  },
};
