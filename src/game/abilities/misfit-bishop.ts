/** Honkington (misfit bishop): HONK. See docs/variants.md.
 * Instead of striking he honks: every enemy on his eight neighbours is shoved one square straight
 * away from him (along the goose-to-enemy vector) if that square is open at that moment, in unit-id
 * order. Shoved pieces drop their brace but keep everything else; a shoved pawn does not promote
 * (only moves crown) and kings may be shoved. No damage, no counter. His peck deals only 1. */
import type { Pos, Unit } from "../turns";
import type { Ability, AltAction } from "../abilities";
import { adjacent, coord, label, note, open } from "../board";

export const HONK_COST = 2;

const adjacentEnemies = (units: Unit[], me: Unit) => units.filter(v => v.side !== me.side && adjacent(v, me)).sort((a, b) => a.id.localeCompare(b.id));

export const honkington: Ability = {
  id: "misfit-bishop", variant: "misfit", kind: "bishop", name: "Honkington", ability: "HONK",
  sentence: "Instead of striking, Honkington honks: every enemy next to him is shoved one square straight away from him if that square is free; his peck deals only 1.",
  damage: () => 1,
  altActions: (g, u) => {
    if (!adjacentEnemies(g.units, u).length) return [];
    const honk: AltAction = {
      id: "honk", label: `HONK (${HONK_COST})`, cost: HONK_COST, targets: [],
      apply: run => {
        const me = run.units.find(x => x.id === u.id) ?? u;
        let units = run.units;
        const shoved: Pos[] = [], lines: string[] = [];
        for (const v of adjacentEnemies(units, me)) {
          const to = { x: v.x + (v.x - me.x), y: v.y + (v.y - me.y) };
          // Judged on the board as it stands now: an earlier shove may have freed or filled the square.
          if (!open({ ...run, units }, to)) { lines.push(`${label(v)} holds its ground.`); continue; }
          units = units.map(w => {
            if (w.id !== v.id) return w;
            const { defending: _braced, ...rest } = w;
            return { ...rest, x: to.x, y: to.y };
          });
          shoved.push(to);
          lines.push(`${label(v)} is shoved to ${coord(run, to)}.`);
        }
        const text = [`${label(me)} honks!`, ...lines].join(" ");
        const next = note({ ...run, units }, text);
        return { run: next, step: { text, units: next.units, focus: shoved.length ? shoved : [{ x: me.x, y: me.y }], damage: [], actor: me.id, kind: "alt", killed: [] } };
      },
    };
    return [honk];
  },
};
