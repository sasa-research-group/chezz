// When the 3D king will have finished his move (turn, run, settle), so the dungeon's reply can wait for him.
// Kept apart from the 3D code so the 2D board can ask without loading three.
let until = 0;
/** KingSprite: a move started that ends `seconds` from now. */
export const moving = (seconds: number) => { until = Math.max(until, performance.now() + seconds * 1000); };
/** Milliseconds until the king's move lands; 0 when he is standing. */
export const motionLeft = () => Math.max(0, until - performance.now());
