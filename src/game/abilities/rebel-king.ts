/** King Redcape (rebel king): Dub. See docs/variants.md. */
import type { Ability } from "../abilities";

export const kingRedcape: Ability = {
  id: "rebel-king", variant: "rebel", kind: "king", name: "King Redcape", ability: "Dub",
  sentence: "Once per battle, for 2 energy, King Redcape knights an adjacent friendly pawn: it becomes Dobbin (3 HP) on the spot and kneels, unable to act this turn.",
  // TODO(build): hooks for Dub go here.
};
