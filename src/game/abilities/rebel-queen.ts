/** Mother Skillet (rebel queen): Clang. See docs/variants.md. */
import type { Ability } from "../abilities";

export const motherSkillet: Ability = {
  id: "rebel-queen", variant: "rebel", kind: "queen", name: "Mother Skillet", ability: "Clang",
  sentence: "Mother Skillet's frying pan hits for 2 instead of 3, but a piece that survives it is dazed and cannot move on its next turn.",
  // TODO(build): hooks for Clang go here.
};
