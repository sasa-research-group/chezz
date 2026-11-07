/** Bishop Lens (royal bishop): Foresight. See docs/variants.md. */
import type { Ability } from "../abilities";

export const bishopLens: Ability = {
  id: "royal-bishop", variant: "royal", kind: "bishop", name: "Bishop Lens", ability: "Foresight",
  sentence: "Bishop Lens sees every blow coming: he counters any striker he could reach, even without bracing, but he never braces.",
  // TODO(build): hooks for Foresight go here.
};
