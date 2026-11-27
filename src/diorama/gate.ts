// The gate square, as Cycles drew it (tools/art/diorama/build_gate_cycles.py --bake, Wesley 2026-11-26, look
// "Middle 1"): a round mossy stone arch between the wall's posts over two weathered oak doors with iron straps, ring
// pulls and woody vines. Open, the doors swing back against the posts (gate_geom.swing_open, SWING_FRAMES frames at
// 24 fps); shutting plays the same frames backward. Pure placing and timing here; GateSprite.tsx draws it. (A live
// model first looked "GameCube" next to the baked set, so it is baked like the snare.)
//
// The sheets (public/diorama/): two layers per square of the 5x5 set and per way the gate faces, because the fixed
// camera sees each square from its own angle. gate{i}{j}-swing0.webp (+ -glow) and -swing.json: the gate and its
// floor, drawn under figures. gate{i}{j}-front0.webp (+ -glow) and -front.json: the gate's parts nearer the camera
// than a figure standing in the doorway, drawn over it. A "q" after {i}{j} is the quarter-turned gate (a wall running
// front to back). i counts squares from the left, j from the back, as snare.ts. The walls either side stay live
// (Diorama's Wall), so they are in the render but not in the sheets.

export const GATE_N = 5;
export const GATE_FPS = 24;

type At = { x: number; y: number; kind?: string };
const RUNS = new Set(["wall", "eye"]);

/** Which way the gate's doorway lies: 0 when the wall runs left to right through it (a wall or eye beside it on the
 *  row, or none at all), a quarter turn when the wall runs front to back (only above or below it). */
export function gateTurn(squares: At[], x: number, y: number): number {
  const kind = new Map(squares.map(q => [`${q.x},${q.y}`, q.kind]));
  const run = (dx: number, dy: number) => RUNS.has(kind.get(`${x + dx},${y + dy}`) ?? "");
  return !run(-1, 0) && !run(1, 0) && (run(0, -1) || run(0, 1)) ? Math.PI / 2 : 0;
}

/** The sheet name for a stage position (square centres at multiples of S, the middle square at 0) and turn, or null
 *  off the baked 5x5. */
export function gateSquare(pos: readonly [number, number], S: number, turn: number): string | null {
  const i = Math.round(pos[0] / S + (GATE_N - 1) / 2), j = Math.round(pos[1] / S + (GATE_N - 1) / 2);
  return i >= 0 && i < GATE_N && j >= 0 && j < GATE_N ? `gate${i}${j}${turn ? "q" : ""}` : null;
}

/** Seconds into the swing: 0 shut, (frames - 1) / GATE_FPS open (the last frame's start, so shutting steps back from
 *  it frame by frame). */
export type GateAnim = { t: number };

/** A board that comes up with the gate already open shows it open, without replaying the swing. */
export const gateStart = (open: boolean): GateAnim => ({ t: open ? Infinity : 0 });

/** One frame toward open while `open`, else back toward shut, at the bake's own speed. */
export function gateTick(s: GateAnim, open: boolean, dt: number, frames: number): GateAnim {
  const end = (frames - 1) / GATE_FPS, t = Math.min(s.t, end);
  return { t: open ? Math.min(end, t + dt) : Math.max(0, t - dt) };
}

/** The frame to show: 0 shut, the last once open. */
export const gateFrame = (s: GateAnim, frames: number) => Math.max(0, Math.min(frames - 1, Math.floor(s.t * GATE_FPS + 1e-6)));
