/** Honkington (misfit bishop): HONK. See docs/variants.md.
 * Instead of striking he honks: every enemy on his eight neighbours is shoved one square straight
 * away from him (along the goose-to-enemy vector) if that square is open at that moment, in unit-id
 * order. Shoved pieces drop their brace but keep everything else; a shoved pawn does not promote
 * (only moves crown) and kings may be shoved. No damage, no counter. His peck deals only 1. */
import type { Pos, Unit } from "../turns";
import type { Ability, AltAction } from "../abilities";
import { adjacent, coord, label, landingOf, note, settle, shoveable } from "../board";

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
        let now = run;
        const shoved: Pos[] = [], lines: string[] = [];
        for (const v of adjacentEnemies(run.units, me)) {
          const dx = v.x - me.x, dy = v.y - me.y, to = { x: v.x + dx, y: v.y + dy };
          // Judged on the board as it stands now: an earlier shove may have freed or filled the square. A shove
          // is a directed displacement: a pit swallows the piece, a burrow passes it, ice skids it on.
          const dest = shoveable(now, to) ? landingOf(now, to, [dx, dy]) : to;
          if (!shoveable(now, dest)) { lines.push(`${label(v)} holds its ground.`); continue; }
          const units = now.units.map(w => {
            if (w.id !== v.id) return w;
            const { defending: _braced, ...rest } = w;
            return rest;
          });
          now = settle({ ...now, units }, v.id, dest, v);
          shoved.push(dest);
          lines.push(`${label(v)} is shoved to ${coord(run, dest)}.`);
        }
        const text = [`${label(me)} honks!`, ...lines].join(" ");
        const next = note(now, text);
        return { run: next, step: { text, units: next.units, focus: shoved.length ? shoved : [{ x: me.x, y: me.y }], damage: [], actor: me.id, kind: "alt", killed: [] } };
      },
    };
    return [honk];
  },
};
