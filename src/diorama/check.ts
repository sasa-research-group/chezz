// The king in check, as timing only (no three here, so tests can use it). While your king stands in check he
// plays the nervous loop (tools/art/diorama/check_pose.py, king-check*.webp): guard up, glancing left and right
// with a grimace and a sweat drop. The loop starts and ends on his guard, so it can start at any moment.

export type LoopInfo = { fps: number; frames: number };

/** The loop frame `t` seconds after he went into check: at the bake rate, round and round. */
export const loopFrame = (t: number, l: LoopInfo) => {
  const i = Math.floor(Math.max(0, t) * l.fps);
  return ((i % l.frames) + l.frames) % l.frames;
};

/** Whether the nervous loop shows: standing still (not mid-move), in check, and his heading's sheet is in. */
export const showsCheck = (check: boolean, idle: boolean, turning: boolean, haveSheet: boolean) =>
  check && idle && !turning && haveSheet;
