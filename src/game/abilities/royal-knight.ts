/** Sir Lance (royal knight): Charge. See docs/variants.md. */
import type { Ability } from "../abilities";

export const sirLance: Ability = {
  id: "royal-knight", variant: "royal", kind: "knight", name: "Sir Lance", ability: "Charge",
  sentence: "Sir Lance's lance needs momentum: a strike right after his jump costs 1 and deals 3, but from a standstill it costs 2 and deals only 1.",
  // TODO(build): hooks for Charge go here.
};
