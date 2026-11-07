/** Bishop Lens (royal bishop): Foresight. See docs/variants.md.
 * He counters any striker he survives and could reach (a diagonal neighbour), braced or not, for his
 * full 2 damage; strike() runs the counter before deaths, so a striker he fells never gets its
 * afterStrike. He never braces: defend() refuses him and the enemy AI skips him. Struck from a rank
 * or file (a rook, a king's straight step) he just blinks. Normal bishop otherwise. */
import type { Ability } from "../abilities";
import { shapeReaches } from "../board";

export const bishopLens: Ability = {
  id: "royal-bishop", variant: "royal", kind: "bishop", name: "Bishop Lens", ability: "Foresight",
  sentence: "Bishop Lens sees every blow coming: he counters any striker he could reach, even without bracing, but he never braces.",
  // The kind's own reach, not the rules' `reaches`: his foresight is a bishop's, whatever his mods say.
  counters: (_g, v, a) => shapeReaches(v, v, a),
  canDefend: () => false,
};
