// The king's death on checkmate, as timing only (no three here, so tests can use it). When your king is mated
// he plays the death once (tools/art/diorama/death_pose.py, king-death*.webp): reels back as the sword slips
// and clatters, totters three steps, teeters, topples backward and lies with X eyes. It holds its last frame.

import type { LoopInfo } from "./check";

/** The death frame `t` seconds after he was mated: at the bake rate, once, then held on the last frame. */
export const deathFrame = (t: number, l: LoopInfo) =>
  Math.min(l.frames - 1, Math.floor(Math.max(0, t) * l.fps));

/** Whether the death shows: mated, not mid-move, and his heading's sheet is in. It wins over the check loop. */
export const showsDeath = (dead: boolean, idle: boolean, haveSheet: boolean) => dead && idle && haveSheet;

/** Whether `side`'s king is checkmated: it is that side's turn, it is in check and it has no legal move. */
export const mated = (inCheck: boolean, toMove: boolean, moves: number) => inCheck && toMove && moves === 0;

/** A taken piece tips over in TIP seconds, then sinks through the floor in SINK (a card, or a figure whose death
 *  sheet isn't in); a figure with a death sheet plays it instead of tipping, lies still LIE, then sinks. */
export const TIP = 0.3, SINK = 0.35, LIE = 0.6;

/** A taken piece `t` seconds after the blow landed (negative: not yet). `death`: its death's length in seconds
 *  when it plays one, else null. tip: 0..1 of the quarter turn over; sink: 0..1 down through the floor. */
export const takenFall = (t: number, death: number | null) => {
  const lie = death === null ? TIP : death + LIE, u = (v: number) => Math.min(1, Math.max(0, v));
  return { tip: death === null ? u(t / TIP) ** 2 : 0, sink: u((t - lie) / SINK), visible: t < lie + SINK };
};

/** The way a taken figure faces while it dies: toward its taker, so it falls back away from the blow. `blow`
 *  is the taker's move direction (from its square to the taken one). */
export const faceTaker = (blow: readonly [number, number]): [number, number] => [-blow[0] || 0, -blow[1] || 0];

/** ms a just-mounted taken figure may stand while its death sheet comes in, before it just tips over. */
export const SHEET_WAIT = 600;
/** Whether a taken piece's fate is settled at `now` (ms): the blow (`hit`, null: not yet announced) has landed and
 *  its death sheet's length is known (`sheet`: seconds, null while loading, undefined for a piece with none) or it
 *  has waited SHEET_WAIT for it. */
export const deathSettles = (now: number, hit: number | null, sheet: number | null | undefined) =>
  hit !== null && now >= hit && (sheet !== null || now - hit > SHEET_WAIT);
