// The lever square, as Cycles drew it (tools/art/diorama/build_lever_cycles.py --bake, Wesley 2026-11-26, look A): a
// stout oak handle with an iron ball knob in a slotted, mossy stone block at the back of the square, a rusty chain
// into a crack in the floor. A piece on the square beside it, opposite its lean, pulls it (the engine flips its gates);
// the throw is timed from a real signal-box lever (lever_geom.py: slow unstick, gathering swing, hard stop, small
// rebound). Each pull throws it the other way. The gates it works wait for the throw to end (leversBusy, read by GateSprite). Pure placing and timing
// here; LeverSprite.tsx draws it.
//
// The sheets (public/diorama/): one layer per square of the 5x5 set, because the fixed camera sees each square from its
// own angle and the set's trees shorten some throws. lever{i}{j}-throw0.webp (+ -glow) and -throw.json: the lever and
// its floor, drawn under figures. Its square is solid: a piece beside it pulls it with its turn (engine pullFrom). Frames 0..LEVER_THROW-1 throw it right (from resting left), the next LEVER_THROW
// throw it left. i counts squares from the left, j from the back, as gate.ts.

export const LEVER_N = 5;
export const LEVER_FPS = 24;
/** Frames in one throw (lever_geom.THROW_FRAMES); the sheet holds two, right then left. */
export const LEVER_THROW = 16;
/** As the gate's: the moving figure says when it lands from its own frame, which may run just after the lever's. */
export const LEVER_GRACE_MS = 120;

type Pos = { x: number; y: number };

/** The sheet name for a stage position (square centres at multiples of S, the middle square at 0), or null off the
 *  baked 5x5. */
export function leverSquare(pos: readonly [number, number], S: number): string | null {
  const i = Math.round(pos[0] / S + (LEVER_N - 1) / 2), j = Math.round(pos[1] / S + (LEVER_N - 1) / 2);
  return i >= 0 && i < LEVER_N && j >= 0 && j < LEVER_N ? `lever${i}${j}` : null;
}

/** How many times the lever at `p` has been thrown: every pull (a move aimed at it; a pass is null). Odd: it rests
 *  thrown right. */
export const leverThrows = (moves: readonly ({ to: Pos } | null)[], p: Pos) =>
  moves.reduce((n, m) => n + (m && m.to.x === p.x && m.to.y === p.y ? 1 : 0), 0);

/** `shown`: the throws drawn (at rest, or the one under way starts from it); `t`: seconds into the throw from shown to
 *  shown + 1, or -1 at rest; `want`: the throws the board says, since `since` (ms). */
export type LeverAnim = { shown: number; t: number; want: number; since: number };

/** A board that comes up with the lever already thrown shows it there, without replaying the throw. */
export const leverStart = (throws: number, now: number): LeverAnim => ({ shown: throws, t: -1, want: throws, since: now });

const THROW_S = (LEVER_THROW - 1) / LEVER_FPS;

/** One step: a new throw waits for the move that made it to land (`left`: ms until the figures' moves land, motion.ts
 *  motionLeft), then plays at the bake's speed. Anything but one more throw (an undo, a restart) snaps to rest. */
export function leverTick(s: LeverAnim, throws: number, now: number, left: number, dt: number): LeverAnim {
  if (throws !== s.want) s = { ...s, want: throws, since: now };
  if (s.t >= 0) {
    if (s.want !== s.shown + 1) return { ...s, shown: s.want, t: -1 };
    const t = s.t + dt;
    return t >= THROW_S ? { ...s, shown: s.shown + 1, t: -1 } : { ...s, t };
  }
  if (s.want === s.shown) return s;
  if (s.want === s.shown + 1) return now - s.since >= LEVER_GRACE_MS && left <= 0 ? { ...s, t: 0 } : s;
  return { ...s, shown: s.want };
}

/** The sheet frame: at rest, the first frame of the way it will next be thrown; mid-throw, that throw's frame. */
export function leverFrame(s: LeverAnim): number {
  const base = s.shown % 2 ? LEVER_THROW : 0;
  return s.t < 0 ? base : base + Math.min(LEVER_THROW - 1, Math.floor(s.t * LEVER_FPS + 1e-6));
}

/** Waiting to be thrown or being thrown. */
export const leverMoving = (s: LeverAnim) => s.t >= 0 || s.want !== s.shown;

// Which levers on the stage are moving: the gates wait for them (a gate swings once its lever has been thrown).
const moving = new Set<string>();
/** LeverSprite: whether the lever `id` is moving now (false also when it goes). */
export const setLeverMoving = (id: string, on: boolean) => { if (on) moving.add(id); else moving.delete(id); };
/** Whether any lever is waiting to be thrown or being thrown. */
export const leversBusy = () => moving.size > 0;
