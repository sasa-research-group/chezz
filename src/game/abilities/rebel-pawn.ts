/** Pip (rebel pawn): Heave. A pitchfork hit that doesn't kill shoves the enemy one square further
 * along the line of the strike, if that square is on the board, not a wall and empty. The shove is
 * part of the blow: it keeps the victim's flags (a brace stays up), it is not a move (no promotion),
 * and it happens even when the blow dealt 0. The engine runs afterStrike after counters and deaths,
 * so a braced survivor counters from its original square and is shoved afterwards; the shove lands
 * even if that counter felled Pip (the fork hit first). See docs/variants.md. */
import type { Pos, Run, Unit } from "../turns";
import type { Ability } from "../abilities";
import { coord, label, landingOf, note, settle, shoveable } from "../board";

/** Where the fork would push `live`, struck by `striker`: one square on along the line of the strike,
 * through a burrow and over ice; undefined when that square is taken or off the board. */
function shoveTo(g: Run, striker: Unit, live: Unit): Pos | undefined {
  const dx = Math.sign(live.x - striker.x), dy = Math.sign(live.y - striker.y);
  if (!dx && !dy) return undefined;
  const to = { x: live.x + dx, y: live.y + dy };
  if (!shoveable(g, to)) return undefined;
  const dest = landingOf(g, to, [dx, dy]);
  return shoveable(g, dest) ? dest : undefined;
}

export const pip: Ability = {
  id: "rebel-pawn", variant: "rebel", kind: "pawn", name: "Pip", ability: "Heave",
  sentence: "When Pip's pitchfork hits an enemy that survives, he shoves it one square further along the line of the strike if that square is free.",
  displaces: (g, a, v) => shoveTo(g, a, v),
  afterStrike: (g, striker, victim, killed) => {
    if (killed) return g;
    // `victim` is the pre-blow snapshot; shove the piece as it stands now, if it still stands.
    const live = g.units.find(u => u.id === victim.id);
    if (!live || live.side === striker.side) return g;
    // A shove is a directed displacement: it may drop the piece in a pit, send it through a burrow or skid it over ice.
    const dest = shoveTo(g, striker, live);
    if (!dest) return g;
    return settle(note(g, `${label(live)} is shoved to ${coord(g, dest)}.`), live.id, dest, live);
  },
};
