// A capture, as timing only (no three here, so tests and the 2D board can use it). The taker walks to a
// stand-off point short of the enemy, then plays the baked attack (tools/art/diorama/strike_pose.py,
// king-strike*.webp): the leap carries him `travel` stage units forward and the blade hits on frame `hit`, when
// the enemy falls. He lands GAP of a square short of the enemy's centre, not on it, so the two figures never
// overlap while the enemy plays its death (Wesley 2026-11-24); once it sinks away he steps onto the square.

export type StrikeInfo = { fps: number; frames: number; hit: number; travel: number };

/** Share of a square between where a taker stops (after any leap) and the centre of the piece he takes. */
export const GAP = 0.65;
/** How long (seconds of game time) a taker waits at his stand-off point for the piece he took to clear, at most. */
export const HOLD_MAX = 5;

/** The capture's plan: walk `walk` stage units (of the `D` to the enemy), then the strike, which lands him `gap`
 * short of the enemy. Times in seconds of game time, from when he starts walking. A move too short for the walk
 * is all leap. */
export function strikePlan(D: number, st: StrikeInfo, gap = 0) {
  const walk = Math.max(0, D - gap - st.travel);
  return { walk, length: st.frames / st.fps, hitAt: st.hit / st.fps };
}

/** The strike frame `t` seconds into the strike; the last frame once it is over. */
export const strikeFrame = (t: number, st: StrikeInfo) => Math.max(0, Math.min(st.frames - 1, Math.floor(t * st.fps)));

/** How far (0 to 1) his feet have travelled at frame `f`: the leap leaves the floor after the crouch (frame 5)
 * and lands on the hit, and he stays there. Moves his contact shadow along with the baked leap. */
export const strikeTravel = (f: number, st: StrikeInfo) => {
  const lift = Math.min(5, st.hit - 1);
  return Math.max(0, Math.min(1, (f - lift) / (st.hit - lift)));
};
