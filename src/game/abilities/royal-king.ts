/** King Gilt (royal king): Bodyguards. See docs/variants.md. */
import type { Ability } from "../abilities";

export const kingGilt: Ability = {
  id: "royal-king", variant: "royal", kind: "king", name: "King Gilt", ability: "Bodyguards",
  sentence: "A blow aimed at King Gilt lands instead on a Royal standing next to him that the striker could also reach; he himself only ever strikes for 1.",
  // TODO(build): hooks for Bodyguards go here.
};
