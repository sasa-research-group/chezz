/** The Warden (royal rook): Poleaxe Sweep. See docs/variants.md.
 * His strike is a normal rook strike (cost 2, damage 3) that also lands on every other piece standing
 * on his four straight neighbours, friend or foe. strike() in turns.ts does the rest: the same damage
 * to each victim, counters from braced survivors, deaths together. The one veto here: he will not
 * swing when the sweep would fell his own king (refused for the player, never offered to the AI). */
import type { Ability } from "../abilities";
import type { Run, Unit } from "../turns";
import { same, straightNeighbours } from "../board";

/** Every piece beside the Warden, in board order. */
const beside = (g: Run, a: Unit) => g.units.filter(x => straightNeighbours(a).some(p => same(p, x)));

export const warden: Ability = {
  id: "royal-rook", variant: "royal", kind: "rook", name: "The Warden", ability: "Poleaxe Sweep",
  sentence: "The Warden's strike hits every piece on his four straight neighbours, friend or foe, for 3.",
  splash: (g, a, v) => beside(g, a).filter(x => x.id !== v.id && x.id !== a.id),
  canStrike: (g, u, _v, dealt) => !beside(g, u).some(x => x.side === u.side && x.kind === "king" && dealt(u, x) >= x.hp),
};
