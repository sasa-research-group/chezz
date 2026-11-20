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
