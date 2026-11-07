/** Sir Lance (royal knight): Charge. See docs/variants.md.
 * Momentum is everything: a strike right after his jump costs 1 and deals 3; from a standstill the
 * kind's usual 2 energy buys only 1 damage. Both hooks read `moved`, which turns.ts sets on the
 * jump and which kingThreat/approaches set on their step-in branch, so the check maths follows.
 * Counters while defending deal 1 even after a jump: a braced piece is never the striker (defend
 * marks it acted; enemyTurn clears defending before acting), so `defending` on the dealer means a
 * counter. kingThreat must hand these hooks a flag-cleared copy of a black Lance (moved, acted and
 * defending linger from its own turn), or a Lance that jumped and braced last turn is mispriced. */
import type { Ability } from "../abilities";

export const sirLance: Ability = {
  id: "royal-knight", variant: "royal", kind: "knight", name: "Sir Lance", ability: "Charge",
  sentence: "Sir Lance's lance needs momentum: a strike right after his jump costs 1 and deals 3, but from a standstill it costs 2 and deals only 1.",
  // 2 is the kind's STRIKE_COST (turns.ts); it can't be imported here without a cycle.
  strikeCost: (_g, u) => (u.moved ? 1 : 2),
  // Outgoing damage only; the defender's block and hex apply on top in dealtTo(). A counter (he is
  // defending) is a standing poke whether or not he jumped first.
  damage: (_g, a) => (a.defending || !a.moved ? 1 : 3),
};
