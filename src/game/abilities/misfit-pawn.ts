/** Grumble (misfit pawn): Hop. See docs/variants.md. */
import type { Ability } from "../abilities";

export const grumble: Ability = {
  id: "misfit-pawn", variant: "misfit", kind: "pawn", name: "Grumble", ability: "Hop",
  sentence: "Grumble can hop two squares straight forward over anything (a piece, a wall, a hole) for 2 energy, but is far too grumpy to ever defend.",
  // TODO(build): hooks for Hop go here.
};
