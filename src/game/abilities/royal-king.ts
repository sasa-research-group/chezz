/** King Gilt (royal king): Bodyguards. A blow aimed at him lands instead on a friendly piece standing
 * on one of his 8 neighbours that the striker could also reach from where it stands: the one with the
 * most HP (ties: lowest id). The guard takes the whole hit as if it were the target (its own brace and
 * counter apply, splash and after-strike hooks see the guard as the victim, so a Haystack rolls onto
 * the guard's square). Gilt takes 0 and never counters for it. Burn ticks, hexes and honks are not
 * blows and reach him directly. He himself deals 1 with every strike. See docs/variants.md. */
import type { Ability } from "../abilities";
import { adjacent } from "../board";

export const kingGilt: Ability = {
  id: "royal-king", variant: "royal", kind: "king", name: "King Gilt", ability: "Bodyguards",
  sentence: "A blow aimed at King Gilt lands instead on a Royal standing next to him that the striker could also reach; he himself only ever strikes for 1.",
  intercept: (g, striker, victim, reaches) => {
    const guards = g.units.filter(w => w.side === victim.side && w.id !== victim.id && adjacent(w, victim) && reaches(g, striker, striker, w));
    // filter() gave us a fresh array, so sorting it leaves the run untouched.
    return guards.sort((a, b) => b.hp - a.hp || a.id.localeCompare(b.id))[0];
  },
  damage: () => 1,
};
