/** Brother Ash (rebel bishop): Hex. See docs/variants.md.
 * Instead of striking he fixes his eyes on the first piece along any clear diagonal; if it is an
 * enemy, it is hexed (deals 1 less, read by dealtTo in turns.ts through isHexed) until his next turn.
 * No damage, no counter. His adjacent peck is an ordinary 2-damage bishop strike. */
import type { Pos } from "../turns";
import type { Ability, AltAction } from "../abilities";
import type { Mods } from "../status";
import { DIAGONALS, at, coord, firstAlong, label, note, withUnit } from "../board";
import { nextTurn } from "../status";

export const HEX_COST = 2;

export const brotherAsh: Ability = {
  id: "rebel-bishop", variant: "rebel", kind: "bishop", name: "Brother Ash", ability: "Hex",
  sentence: "Instead of striking, Brother Ash fixes his glowing eyes on an enemy anywhere along a clear diagonal and hexes it: it deals 1 less damage until his next turn.",
  altActions: (g, u) => {
    // The eyes look along the diagonals only, and stop at the first piece or wall.
    const targets: Pos[] = [];
    for (const [dx, dy] of DIAGONALS) {
      const v = firstAlong(g, u, dx, dy);
      if (v && v.side !== u.side) targets.push({ x: v.x, y: v.y });
    }
    if (!targets.length) return [];
    const hex: AltAction = {
      id: "hex", label: `Hex (${HEX_COST})`, cost: HEX_COST, targets,
      apply: (run, target) => {
        const me = run.units.find(x => x.id === u.id) ?? u;
        const v = target ? at(run, target) : undefined;
        if (!v || v.side === me.side) return { run, step: { text: `${label(me)} finds nothing to hex.`, units: run.units, focus: [{ x: me.x, y: me.y }], damage: [], actor: me.id, kind: "alt", killed: [] } };
        // Lasts through the victim's next turn: expireMods drops it at the start of its turn after that.
        const mods: Mods = { ...(v.mods ?? {}), hexed: true, hexedUntil: nextTurn(run, v.side) };
        const text = `${label(me)} hexes ${label(v)} at ${coord(run, v)}: it deals 1 less through its next turn (${HEX_COST} energy).`;
        const next = note({ ...run, units: withUnit(run, v.id, { mods }) }, text);
        return { run: next, step: { text, units: next.units, focus: [{ x: v.x, y: v.y }], damage: [], actor: me.id, kind: "alt", killed: [], target: v.id } };
      },
    };
    return [hex];
  },
};
