/** Pip (rebel pawn): Heave. See docs/variants.md. */
import type { Ability } from "../abilities";

export const pip: Ability = {
  id: "rebel-pawn", variant: "rebel", kind: "pawn", name: "Pip", ability: "Heave",
  sentence: "When Pip's pitchfork hits an enemy that survives, he shoves it one square further along the line of the strike if that square is free.",
  // TODO(build): hooks for Heave go here.
};
