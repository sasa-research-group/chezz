// When the 3D king will have finished his move (turn, run, settle), so the dungeon's reply can wait for him.
// Kept apart from the 3D code so the 2D board can ask without loading three.
let until = 0;
// Game speed: 1 (normal) or 2 (fast-forward, the player's toggle). Pieces move and the dungeon answers this
// much faster; his feet stay planted because the gait frame follows the distance covered. Kept per device.
const SPEED_KEY = "chezz.speed";
const readSpeed = (): 1 | 2 => { try { return globalThis.localStorage?.getItem(SPEED_KEY) === "2" ? 2 : 1; } catch { return 1; } };
let speed: 1 | 2 = readSpeed();
/** The current game speed multiplier. */
export const gameSpeed = () => speed;
/** Set the game speed and remember it on this device. A move under way keeps its old end time. */
export const setGameSpeed = (v: 1 | 2) => {
  speed = v;
  try { globalThis.localStorage?.setItem(SPEED_KEY, String(v)); } catch { /* private mode: this session only */ }
};
/** KingSprite: a move started that ends `seconds` from now. */
export const moving = (seconds: number) => { until = Math.max(until, performance.now() + seconds * 1000); };
/** Milliseconds until the king's move lands; 0 when he is standing. */
export const motionLeft = () => Math.max(0, until - performance.now());

// When the king's blade lands on a square (stage coordinates), so the piece he takes falls on the hit.
const hits = new Map<string, { set: number; at: number }>();
const hitKey = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
/** KingSprite: his blow lands on the square at stage (x, y) `seconds` from now. */
export const willHit = (x: number, y: number, seconds: number) => {
  const now = performance.now();
  hits.set(hitKey(x, y), { set: now, at: now + seconds * 1000 });
};
/** When (performance.now() time) the blow announced at or after `since` lands on (x, y); null when none is. */
export const hitTime = (x: number, y: number, since: number) => {
  const h = hits.get(hitKey(x, y));
  return h && h.set >= since ? h.at : null;
};

// When a taken piece has finished dying and starts to sink away, so its taker can step onto the square.
const clears = new Map<string, { set: number; at: number }>();
/** Falling: the piece at stage (x, y) is out of the way at `at` (performance.now() time). */
export const willClear = (x: number, y: number, at: number) => { clears.set(hitKey(x, y), { set: performance.now(), at }); };
/** When the square at (x, y) clears, as announced at or after `since`; null when not yet announced. */
export const clearTime = (x: number, y: number, since: number) => {
  const c = clears.get(hitKey(x, y));
  return c && c.set >= since ? c.at : null;
};
