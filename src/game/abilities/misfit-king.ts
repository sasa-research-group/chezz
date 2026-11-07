/** Marmalade (misfit king): Catnap. He sleeps unless mods.awake is true: no moves, strikes or
 * braces. Every blow on him deals 1 less, asleep or awake (burn ticks skip dealtTo, so they ignore
 * it): the enemy only ever reaches him asleep, and pricing the woken cat the same keeps kingThreat
 * honest during his own turn, so a nudge beside an enemy is never refused as into-check. The one blow
 * that lands on him awake, a counter to his own strike, is softened too. A friendly piece ending a
 * move on one of his 8 neighbours wakes him for the rest of his side's turn: queen moves at 1 per
 * square (king steps included), adjacent strikes, bracing. Being struck never wakes him, so his awake
 * window stays inside his own side's turn; the endTurn hook puts him back to sleep, which is why
 * `awake` carries no Until. See docs/variants.md. */
import type { Unit } from "../turns";
import type { Ability } from "../abilities";
import type { Mods } from "../status";
import { adjacent, label, note, withUnit } from "../board";

/** Zoomies, or still napping? Only an explicit `awake: true` counts. */
export const isAwake = (u: Pick<Unit, "mods">) => u.mods?.awake === true;

export const marmalade: Ability = {
  id: "misfit-king", variant: "misfit", kind: "king", name: "Marmalade", ability: "Catnap",
  sentence: "Marmalade sleeps: he cannot move, strike or defend and takes 1 less from every hit. A friend ending a move beside him wakes him for the turn: he gets zoomies and moves like a queen, then naps again when the turn ends.",
  moveTargets: (_g, u, _base, ctx) => (isAwake(u) ? ctx.shape("queen") : []),
  canStrike: (_g, u) => isAwake(u),
  canDefend: (_g, u) => isAwake(u),
  incoming: (_g, _v, _a, base) => Math.max(0, base - 1),
  onAnyMove: (g, u, mover) => {
    if (isAwake(u) || mover.side !== u.side || mover.id === u.id || !adjacent(mover, u)) return g;
    const mods: Mods = { ...(u.mods ?? {}), awake: true };
    return note({ ...g, units: withUnit(g, u.id, { mods }) }, `${label(u)} wakes up beside ${label(mover)}: zoomies!`);
  },
  endTurn: (g, u) => {
    if (!isAwake(u)) return g;
    const { awake: _awake, ...rest } = u.mods ?? {};
    return note({ ...g, units: withUnit(g, u.id, { mods: Object.keys(rest).length ? rest : undefined }) }, `${label(u)} curls up and naps again.`);
  },
};
