/** The Warden (royal rook): Poleaxe Sweep. See docs/variants.md. */
import type { Ability } from "../abilities";

export const warden: Ability = {
  id: "royal-rook", variant: "royal", kind: "rook", name: "The Warden", ability: "Poleaxe Sweep",
  sentence: "The Warden's strike hits every piece on his four straight neighbours, friend or foe, for 3.",
  // TODO(build): hooks for Poleaxe Sweep go here.
};
