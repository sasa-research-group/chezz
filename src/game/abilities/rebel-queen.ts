/** Mother Skillet (rebel queen): Clang. See docs/variants.md. Her pan hits for 2, not 3, but the
 * clang leaves a survivor dazed: no moves of any kind on its next turn (turns.ts's moveTargets is
 * empty while isDazed), though it may still strike, defend or use an alt action where it stands.
 * The daze lands on whoever took the blow, so a bodyguard that steps in is dazed in Gilt's place,
 * and it lands even when the blow dealt 0 (hexed, braced): it is the noise, not the bruise. */
import type { Ability } from "../abilities";
import type { Mods } from "../status";
import { label, note, withUnit } from "../board";
import { nextTurn } from "../status";

export const motherSkillet: Ability = {
  id: "rebel-queen", variant: "rebel", kind: "queen", name: "Mother Skillet", ability: "Clang",
  sentence: "Mother Skillet's frying pan hits for 2 instead of 3, but a piece that survives it is dazed and cannot move on its next turn.",
  damage: () => 2,
  afterStrike: (g, _striker, victim) => {
    const v = g.units.find(u => u.id === victim.id);
    if (!v) return g;
    const mods: Mods = { ...(v.mods ?? {}), dazed: true, dazedUntil: nextTurn(g, v.side) };
    return note({ ...g, units: withUnit(g, v.id, { mods }) }, `${label(v)} is dazed by the clang.`);
  },
};
