/** Nobody (misfit knight): Hollow. See docs/variants.md. */
import type { Ability } from "../abilities";

export const nobody: Ability = {
  id: "misfit-knight", variant: "misfit", kind: "knight", name: "Nobody", ability: "Hollow",
  sentence: "There's nobody inside: Nobody has only 2 HP, but when destroyed the empty suit stays standing on its square as a wall for the rest of the battle.",
  // TODO(build): hooks for Hollow go here.
};
