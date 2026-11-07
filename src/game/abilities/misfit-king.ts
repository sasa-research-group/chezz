/** Marmalade (misfit king): Catnap. See docs/variants.md. */
import type { Ability } from "../abilities";

export const marmalade: Ability = {
  id: "misfit-king", variant: "misfit", kind: "king", name: "Marmalade", ability: "Catnap",
  sentence: "Marmalade sleeps: he cannot move, strike or defend and takes 1 less from every hit. A friend ending a move beside him wakes him for the turn: he gets zoomies and moves like a queen, then naps again when the turn ends.",
  // TODO(build): hooks for Catnap go here.
};
