/** Wick (misfit queen): Candlelight. See docs/variants.md. A timer with a queen's reach: at the
 * start of each of her side's turns she loses 1 (turns.ts's startOfTurn removes her at 0, so nobody
 * gets the kill), and any blow of hers that deals at least 1 sets the victim alight: mods.burning,
 * which startOfTurn ticks for 1 a turn (ignoring defend) and counts down. A second hit resets the
 * fire to its full length rather than stacking it; hay burns a turn longer. */
import type { Ability } from "../abilities";
import type { Mods } from "../status";
import { label, note, withUnit } from "../board";

/** How many turns a piece burns once lit: a Haystack is tinder. */
const burnLength = (v: { kind: string; variant?: string }) => (v.variant === "misfit" && v.kind === "rook" ? 3 : 2);

export const wick: Ability = {
  id: "misfit-queen", variant: "misfit", kind: "queen", name: "Wick", ability: "Candlelight",
  sentence: "Wick burns down, losing 1 HP at the start of each of her turns, but her strike sets the target alight: it takes 1 at the start of its next two turns, ignoring defend.",
  startTurn: (g, u) => {
    const hp = u.hp - 1;
    return note({ ...g, units: withUnit(g, u.id, { hp }) }, `${label(u)} ${hp > 0 ? "burns down" : "gutters out"}.`);
  },
  afterStrike: (g, _striker, victim) => {
    const v = g.units.find(u => u.id === victim.id);
    // A blow that dealt nothing (or killed) lights nothing: `victim` is the piece before the blow.
    if (!v || v.hp >= victim.hp) return g;
    const mods: Mods = { ...(v.mods ?? {}), burning: burnLength(v) };
    return note({ ...g, units: withUnit(g, v.id, { mods }) }, `${label(v)} catches fire.`);
  },
};
