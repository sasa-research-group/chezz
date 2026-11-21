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
