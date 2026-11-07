/** Dobbin (rebel knight): Giddy-up. See docs/variants.md. */
import type { Ability } from "../abilities";

export const dobbin: Ability = {
  id: "rebel-knight", variant: "rebel", kind: "knight", name: "Dobbin", ability: "Giddy-up",
  sentence: "Dobbin's jump costs 1 instead of 2, but a wooden horse can't fly: for every L, one of its two elbow squares must be empty, for moves and strikes alike.",
  // TODO(build): hooks for Giddy-up go here.
};
