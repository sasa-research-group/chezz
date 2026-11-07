/** King Redcape (rebel king): Dub. Once per battle, for 2 energy, he knights an adjacent friendly
 * pawn on the spot: it becomes a rebel knight (Dobbin, 3 HP) and kneels for the rest of the turn.
 * Not a promotion: no picker, and the pawn's far-row promotion is simply gone. The one dub per battle
 * is remembered in run.flags.dubbed, which spawn() clears. See docs/variants.md. */
import type { Run, Unit } from "../turns";
import type { Ability, AltAction } from "../abilities";
import { at, coord, label, neighbours, note } from "../board";

/** Dobbin's full health. Hard-coded rather than read from HP in turns.ts (a value import would cycle). */
const KNIGHT_HP = 3;

/** The friendly pawns standing on the king's 8 neighbours: what Dub may target. */
const dubbable = (g: Run, u: Unit): Unit[] =>
  neighbours(u).map(p => at(g, p)).filter((v): v is Unit => !!v && v.side === u.side && v.kind === "pawn");

export const kingRedcape: Ability = {
  id: "rebel-king", variant: "rebel", kind: "king", name: "King Redcape", ability: "Dub",
  sentence: "Once per battle, for 2 energy, King Redcape knights an adjacent friendly pawn: it becomes Dobbin (3 HP) on the spot and kneels, unable to act this turn.",
  altActions: (g, u) => {
    if (g.flags?.dubbed === true) return [];
    const pawns = dubbable(g, u);
    // With nobody to knight there is no action to offer (an empty target list would mean "no target needed").
    if (!pawns.length) return [];
    const dub: AltAction = {
      id: "dub", label: "Dub (2)", cost: 2, targets: pawns.map(p => ({ x: p.x, y: p.y })),
      apply: (run, target) => {
        const pawn = target ? at(run, target) : undefined;
        const king = run.units.find(x => x.id === u.id) ?? u;
        if (!pawn || pawn.side !== u.side || pawn.kind !== "pawn") {
          // Unreachable through alt(), which only passes a listed target; keep the run as it was handed over.
          const text = `${label(king)} finds nobody to dub.`;
          return { run, step: { text, units: run.units, focus: [{ x: king.x, y: king.y }], damage: [], actor: u.id, kind: "alt", killed: [] } };
        }
        // Nobody changes square: only kind, cast and health change, and it kneels (moved and acted). Whatever
        // else the pawn carried (a burn, a daze, a hex, its brace) stays with it: the dub is no cure.
        const knight: Unit = { ...pawn, kind: "knight", variant: "rebel", hp: KNIGHT_HP, moved: true, acted: true };
        const text = `${label(king)} dubs ${label(pawn)} at ${coord(run, pawn)}: it rises a knight (${KNIGHT_HP} HP) and kneels for the turn.`;
        const next = note({ ...run, flags: { ...(run.flags ?? {}), dubbed: true }, units: run.units.map(x => (x.id === pawn.id ? knight : x)) }, text);
        return { run: next, step: { text, units: next.units, focus: [{ x: pawn.x, y: pawn.y }], damage: [], actor: u.id, kind: "alt", killed: [], target: pawn.id, from: "pawn" } };
      },
    };
    return [dub];
  },
};
