/** Sergeant Pike (royal pawn): Pike. See docs/variants.md. */
import type { Ability } from "../abilities";

export const sergeantPike: Ability = {
  id: "royal-pawn", variant: "royal", kind: "pawn", name: "Sergeant Pike", ability: "Pike",
  sentence: "Sergeant Pike thrusts straight ahead instead of diagonally, and reaches two squares forward when the square between is empty.",
  // TODO(build): hooks for Pike go here.
};
