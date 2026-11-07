/** Her Wigness (royal queen): Beneath Me. See docs/variants.md. Passive, two filters and done:
 * she refuses to strike a pawn (any cast; a promoted pawn is its new kind and fair game at once),
 * a pawn's blow on her lands for 0 after every other modifier, and she never counters a pawn,
 * braced or not. Everything else is a plain queen: 3 damage, 9 HP, adjacent strike, slides. */
import type { Ability } from "../abilities";

export const herWigness: Ability = {
  id: "royal-queen", variant: "royal", kind: "queen", name: "Her Wigness", ability: "Beneath Me",
  sentence: "Pawns are beneath her notice: Her Wigness refuses to strike them, and their strikes against her deal 0.",
  canStrike: (_g, _u, v) => v.kind !== "pawn",
  incoming: (_g, _v, a, base) => (a.kind === "pawn" ? 0 : base),
  counters: (_g, _v, a, base) => base && a.kind !== "pawn",
};
