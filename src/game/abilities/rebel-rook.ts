/** Brick (rebel rook): Demolish. See docs/variants.md. */
import type { Ability } from "../abilities";

export const brick: Ability = {
  id: "rebel-rook", variant: "rebel", kind: "rook", name: "Brick", ability: "Demolish",
  sentence: "Brick can swing the sledgehammer at an adjacent wall instead of a piece and knock it down for good.",
  // TODO(build): hooks for Demolish go here.
};
