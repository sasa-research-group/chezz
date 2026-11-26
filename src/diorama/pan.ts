// Panning along a long level (Wesley 2026-11-26: long levels). A board bigger than one view is baked from a few
// "stops" (tools/art/diorama/level_layout.py stops): one camera slid along the board, never turned, each stop
// framing a window of squares. The game rests on the stop nearest the piece in play, and slides to the next one
// when that piece walks out of it (or a swipe asks for it), fading from one stop's picture to the other on the way.
// Pure here; Diorama.tsx draws it.

/** A stop: where its window centres, in squares from the board's middle, stage axes (x right, y toward the back). */
export type Stop = readonly [number, number];

/** How long a slide from one stop to the next takes. */
export const PAN_MS = 650;
/** Squares the piece may stray toward another stop before the camera goes there (so it doesn't flick back and
 * forth on the line between two stops). Under half a STEP, so the piece stays inside the window it rests on. */
export const HYST = 0.75;
/** Pixels a swipe must travel to count as a pan, not a tap. */
export const SWIPE_PX = 40;

/** A board square's centre in stop units (puzzle y = 0 is the back row). */
export const stageOf = (w: number, h: number, x: number, y: number): Stop => [x - (w - 1) / 2, (h - 1) / 2 - y];

const dist = (a: Stop, b: Stop) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The stop to rest on with the piece in play at `p`: the nearest, unless `current` is within HYST of as near. */
export function nearestStop(stops: readonly Stop[], p: Stop, current: number | null = null, hyst = HYST): number {
  let best = 0;
  for (let k = 1; k < stops.length; k++) if (dist(stops[k], p) < dist(stops[best], p)) best = k;
  if (current !== null && current < stops.length && dist(stops[current], p) <= dist(stops[best], p) + hyst) return current;
  return best;
}

/** The stop next over from `current` in direction `dir` (stop units, any length): the nearest one that lies mostly
 * that way (within 45 degrees), else `current`. */
export function stepStop(stops: readonly Stop[], current: number, dir: Stop): number {
  const l = Math.hypot(dir[0], dir[1]);
  if (!l) return current;
  let best = current, bd = Infinity;
  stops.forEach((s, k) => {
    const v: Stop = [s[0] - stops[current][0], s[1] - stops[current][1]], d = Math.hypot(v[0], v[1]);
    if (!d || (v[0] * dir[0] + v[1] * dir[1]) / (d * l) < Math.SQRT1_2) return;
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}

/** A swipe on screen (px, x right, y down) as a pan direction: the board follows the finger, so the camera goes
 * the other way across (left when the finger goes right) and toward the back when the finger pulls down. */
export const swipeDir = (dx: number, dy: number): Stop | null =>
  Math.hypot(dx, dy) < SWIPE_PX ? null : [-dx, dy];

/** Smoothstep: the slide starts and stops gently. */
export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Which stop's sheet a trapdoor shows with the camera on stop `k`: its own from there if one was baked (a stop
 * bakes the doors inside its window), else the one from the nearest stop that has it. `seenFrom` is the list
 * levels/index.json gives for this door; null when it has none. */
export function trapStop(seenFrom: readonly number[] | undefined, stops: readonly Stop[], k: number): number | null {
  if (!seenFrom?.length) return null;
  if (seenFrom.includes(k)) return k;
  return seenFrom.reduce((a, b) => (dist(stops[b], stops[k]) < dist(stops[a], stops[k]) ? b : a));
}
