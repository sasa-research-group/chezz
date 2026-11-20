// The king's capture, as timing only (no three here, so tests and the 2D board can use it). He walks to a
// stand-off point short of the enemy, then plays the baked jump attack (tools/art/diorama/strike_pose.py,
// king-strike*.webp): the leap carries him `travel` stage units forward, so he lands on the enemy's square, and
// the blade hits on frame `hit`, when the enemy falls.

export type StrikeInfo = { fps: number; frames: number; hit: number; travel: number };

/** The capture's plan: walk `walk` stage units (of the `D` to the enemy), then the strike. Times in seconds of
 * game time, from when he starts walking. A move shorter than the leap is all leap. */
export function strikePlan(D: number, st: StrikeInfo) {
  const walk = Math.max(0, D - st.travel);
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
