/** Honkington (misfit bishop): HONK. See docs/variants.md. */
import type { Ability } from "../abilities";

export const honkington: Ability = {
  id: "misfit-bishop", variant: "misfit", kind: "bishop", name: "Honkington", ability: "HONK",
  sentence: "Instead of striking, Honkington honks: every enemy next to him is shoved one square straight away from him if that square is free; his peck deals only 1.",
  // TODO(build): hooks for HONK go here.
};
