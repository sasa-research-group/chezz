// The trapdoor square, as Cycles drew it (tools/art/diorama/build_trapdoor_cycles.py --bake, Wesley 2026-11-25: oak
// planks, rusty iron straps, a ring pull). When the piece on it steps off, the door swings down into the pit, hits
// the back wall, rocks twice and hangs there for good. The drop's timing is a hinged board falling under gravity
// (trapdoor_geom.fall_curve), baked frame by frame. Pure timing here; TrapdoorSprite.tsx draws it.
//
// The sheets (public/diorama/): trap{i}{j}-drop0.webp (+ -glow) and trap{i}{j}-drop.json, one per square of the
// 5x5 set, because the fixed camera sees each pit's walls differently. i counts squares from the left, j from the
// back (stage y), so board square (x, y) on a 5-row board is i = x, j = 4 - y.

export const TRAP_N = 5;
export const TRAP_FPS = 24;

/** The sheet name for a stage position (square centres at multiples of S, the middle square at 0), or null off the
 * baked 5x5. */
export function trapSquare(pos: readonly [number, number], S: number): string | null {
  const i = Math.round(pos[0] / S + (TRAP_N - 1) / 2), j = Math.round(pos[1] / S + (TRAP_N - 1) / 2);
  return i >= 0 && i < TRAP_N && j >= 0 && j < TRAP_N ? `trap${i}${j}` : null;
}

/** Seconds into the drop; Infinity holds it fallen. */
export type TrapAnim = { open: boolean; t: number };

/** A board that comes up with the door already fallen shows it hanging, without replaying the drop. */
export const trapStart = (open: boolean): TrapAnim => ({ open, t: open ? Infinity : 0 });

/** One frame. Opening starts the drop; shutting again (undo, restart) snaps it shut. */
export function trapTick(s: TrapAnim, open: boolean, dt: number): TrapAnim {
  if (!open) return { open: false, t: 0 };
  if (!s.open) return { open: true, t: 0 };
  return { open: true, t: s.t + dt };
}

/** The frame to show: 0 shut, the last once it has settled. */
export function trapFrame(s: TrapAnim, frames: number): number {
  if (!s.open) return 0;
  return Math.min(frames - 1, Math.floor(s.t * TRAP_FPS));
}
