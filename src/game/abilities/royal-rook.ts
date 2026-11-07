/** The Warden (royal rook): Poleaxe Sweep. See docs/variants.md.
 * His strike is a normal rook strike (cost 2, damage 3) that also lands on every other piece standing
 * on his four straight neighbours, friend or foe. strike() in turns.ts does the rest: the same damage
 * to each victim, counters from braced survivors, deaths together. The one veto here: he will not
 * swing when the sweep would fell his own king (refused for the player, never offered to the AI). */
import type { Ability } from "../abilities";
import type { Run, Unit } from "../turns";
import { same, straightNeighbours } from "../board";
import { isHexed } from "../status";

const SWEEP_DAMAGE = 3;

/** Every piece beside the Warden, in board order. */
const beside = (g: Run, a: Unit) => g.units.filter(x => straightNeighbours(a).some(p => same(p, x)));
/** A sleeping Marmalade (misfit king) takes 1 less from every blow. This mirrors his `incoming` hook
 * in misfit-king.ts, the only king-side reduction there is: canStrike gets no damage calculator, so
 * the veto has to price the king's own hook by hand to agree with what dealtTo() will deal. */
const kingBlock = (v: Unit) => (v.kind === "king" && v.variant === "misfit" && v.mods?.awake !== true ? 1 : 0);
/** What the sweep deals a piece standing beside him, as dealtTo() would: hex, brace, then the king's own hook. */
const sweepHit = (g: Run, a: Unit, v: Unit) => Math.max(0, Math.max(0, SWEEP_DAMAGE - (isHexed(a, g.turn) ? 1 : 0) - (v.defending ? 1 : 0)) - kingBlock(v));

export const warden: Ability = {
  id: "royal-rook", variant: "royal", kind: "rook", name: "The Warden", ability: "Poleaxe Sweep",
  sentence: "The Warden's strike hits every piece on his four straight neighbours, friend or foe, for 3.",
  splash: (g, a, v) => beside(g, a).filter(x => x.id !== v.id && x.id !== a.id),
  canStrike: (g, u) => !beside(g, u).some(x => x.side === u.side && x.kind === "king" && sweepHit(g, u, x) >= x.hp),
};
