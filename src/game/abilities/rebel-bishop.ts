/** Brother Ash (rebel bishop): Hex. See docs/variants.md. */
import type { Ability } from "../abilities";

export const brotherAsh: Ability = {
  id: "rebel-bishop", variant: "rebel", kind: "bishop", name: "Brother Ash", ability: "Hex",
  sentence: "Instead of striking, Brother Ash fixes his glowing eyes on an enemy anywhere along a clear diagonal and hexes it: it deals 1 less damage until his next turn.",
  // TODO(build): hooks for Hex go here.
};
