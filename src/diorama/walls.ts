// Walls on the board (Wesley 2026-11-21, "low plus fade"): the play camera looks down at an angle, so a block hides
// the foot of the square behind it. Walls stand about half a figure tall, and a wall goes see-through while a piece
// stands on the square right behind it (y - 1: y = 0 is the back row; the camera looks square-on, so no other
// square hides behind it).

/** Wall height as a share of the set's figure height H (the king is about 1 H). */
export const WALL_H = 0.45;
/** Opacity of a wall with a piece right behind it. */
export const WALL_FADE = 0.3;
/** Seconds to fade in or out. */
export const WALL_FADE_S = 0.25;

type At = { x: number; y: number };
const BLOCKS = new Set(["wall", "eye"]);

/** The wall squares ("x,y") that should be see-through: a piece stands on the square right behind them. */
export function fadedWalls(squares: (At & { kind?: string })[], pieces: At[]): Set<string> {
  const taken = new Set(pieces.map(p => `${p.x},${p.y}`));
  return new Set(squares.filter(q => q.kind && BLOCKS.has(q.kind) && taken.has(`${q.x},${q.y - 1}`)).map(q => `${q.x},${q.y}`));
}

/** One step of a wall's opacity toward its target (1 or WALL_FADE) over `dt` seconds. */
export function fadeStep(now: number, faded: boolean, dt: number): number {
  const want = faded ? WALL_FADE : 1, step = (1 - WALL_FADE) * dt / WALL_FADE_S;
  return now < want ? Math.min(want, now + step) : Math.max(want, now - step);
}
