/** Wick (misfit queen): Candlelight. See docs/variants.md. */
import type { Ability } from "../abilities";

export const wick: Ability = {
  id: "misfit-queen", variant: "misfit", kind: "queen", name: "Wick", ability: "Candlelight",
  sentence: "Wick burns down, losing 1 HP at the start of each of her turns, but her strike sets the target alight: it takes 1 at the start of its next two turns, ignoring defend.",
  // TODO(build): hooks for Candlelight go here.
};
