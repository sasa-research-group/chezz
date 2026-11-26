// The snare square, as Cycles drew it (tools/art/diorama/build_snare_cycles.py --bake, Wesley 2026-11-26: "C thorn
// roots"): a ring of dark thorny roots round the square's edge with a faint green glow. A piece that stops on it is
// held there for good (engine.ts: it can still capture); the roots spring shut round its ankles as it arrives
// (snare_geom.root_grips, 20 frames) and let go again, played backward, when the square empties. Pure timing here;
// SnareSprite.tsx draws it.
//
// The sheets (public/diorama/): two layers per square of the 5x5 set, because the fixed camera sees each square from
// its own angle. snare{i}{j}-spring0.webp (+ -glow) and -spring.json: the whole square, drawn under figures.
// snare{i}{j}-front0.webp (+ -glow) and -front.json: only the roots nearer the camera than the legs of the figure on
// it, drawn over that figure. i counts squares from the left, j from the back, as trapdoor.ts.

export const SNARE_N = 5;
export const SNARE_FPS = 24;

/** The sheet name for a stage position (square centres at multiples of S, the middle square at 0), or null off the
 * baked 5x5. */
export function snareSquare(pos: readonly [number, number], S: number): string | null {
  const i = Math.round(pos[0] / S + (SNARE_N - 1) / 2), j = Math.round(pos[1] / S + (SNARE_N - 1) / 2);
  return i >= 0 && i < SNARE_N && j >= 0 && j < SNARE_N ? `snare${i}${j}` : null;
}

/** Who stands on the square: a running figure (KingSprite, it says when it has come to rest there), a flat card
 * (there at once), or nobody. A piece just taken there doesn't count: it is on its way off. */
export type SnareHolds = "figure" | "card" | null;

/** Whether the roots should be shut: a card at once; a figure once it has arrived and until it is struck down. */
export const snareWant = (holds: SnareHolds, figureStanding: boolean) =>
  holds === "card" || (holds === "figure" && figureStanding);

/** Seconds into the spring: 0 open, (frames - 1) / SNARE_FPS shut (the last frame's start, so letting go steps back
 * from it frame by frame). */
export type SnareAnim = { t: number };

/** A board that comes up with a piece already held shows the roots shut, without replaying the spring. */
export const snareStart = (shut: boolean): SnareAnim => ({ t: shut ? Infinity : 0 });

/** One frame: forward toward shut while `want`, else backward to open, at the bake's own speed. */
export function snareTick(s: SnareAnim, want: boolean, dt: number, frames: number): SnareAnim {
  const end = (frames - 1) / SNARE_FPS, t = Math.min(s.t, end);
  return { t: want ? Math.min(end, t + dt) : Math.max(0, t - dt) };
}

/** The frame to show: 0 open, the last once shut. */
export const snareFrame = (s: SnareAnim, frames: number) => Math.max(0, Math.min(frames - 1, Math.floor(s.t * SNARE_FPS + 1e-6)));

/** How far in front of the square's centre (camera depth) the front layer sorts: just nearer than the figure on it,
 * whose quad sits `figureGap` in front of its feet (its sheet's d0 - dq), so the roots draw over its legs but under
 * figures on the squares in front (a row nearer is S * 0.82 = 1.67 nearer). With no figure there, the sheet's own. */
export const SORT_NUDGE = 0.05;
export const frontGap = (figureGap: number | null, ownGap: number) => Math.max(ownGap, figureGap ?? 0) + SORT_NUDGE;
