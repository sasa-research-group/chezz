// The search liveSludge.ts's shader runs (mirrorT) to bend Cycles' flat-mirror image of the room by a live normal,
// kept here in TypeScript so it can be tested. Keep the two in step.
//
// The flat mirror at height z0 shows, at each pixel, the room point its mirrored camera ray lands on (mpos_K.exr).
// A point q shows in that image where q mirrored in z0 projects. For the reflected ray p + t d of a tilted normal we
// guess t, look up which room point shows where p + t d does, take its distance along the ray, and repeat.
export type V3 = [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const at = (p: V3, d: V3, t: number): V3 => [p[0] + t * d[0], p[1] + t * d[1], p[2] + t * d[2]];

/** q mirrored in the plane z = z0. */
export const mirrored = (q: V3, z0: number): V3 => [q[0], q[1], 2 * z0 - q[2]];

/**
 * How far along the ray from p along d (unit) the room is. hitShownAt(q) is the room point the flat mirror's image
 * shows where q shows, or null where the image has none (outside the crop, or the ray left the room). guess: the
 * room box's distance. w: how far to trust the answer (0 falls back to the probe).
 */
export function mirrorT(p: V3, d: V3, guess: number, hitShownAt: (q: V3) => V3 | null, iters = 4): { t: number; w: number } {
  let t = Math.max(guess, 0.01);
  if (d[2] <= 0) return { t, w: 0 };
  let hit: V3 | null = null;
  for (let i = 0; i < iters; i++) {
    hit = hitShownAt(at(p, d, t));
    if (!hit) return { t, w: 0 };
    t = Math.max(dot(sub(hit, p), d), 0.01);
  }
  const e = sub(hit!, at(p, d, t)), err = Math.sqrt(dot(e, e)) / t;
  const s = Math.min(1, Math.max(0, (err - 0.05) / 0.2));
  return { t, w: 1 - s * s * (3 - 2 * s) };
}
