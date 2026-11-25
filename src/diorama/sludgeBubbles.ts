// The sludge's bubbling, live: a straight port of the height and tear functions in
// tools/art/diorama/sludge_bubbles.py (the timing from real mudpots; see docs/art/FIGURES.md, "The sludge square").
// The Python picks the schedule and writes it into live.json (tools/art/diorama/live_plate.py); this file only
// answers "how high is the ooze here, now" so the browser can move the ooze over a still Cycles plate.
// tests/sludge-bubbles.test.ts checks it against numbers from the Python.

export type Drop = { x0: number; y0: number; x1: number; y1: number; r: number; apex: number; t0: number; tf: number };
export type BubbleEvent = {
  x: number; y: number; r: number; t0: number; sz: number; bursts: boolean;
  ts: number; tb: number; tz: number; ang: number; stretch: number;
  h1: number; h2: number; s1: number; s2: number; dome: number; drops: Drop[];
};
export type Splat = [number, number, number, number]; // x, y, r, phase

export const MERGE = 0.1, MELT = 0.6;
const FAR = 3.0, FADE = 2.2;

/** Python's modulo: always in [0, m). */
const mod = (a: number, m: number) => ((a % m) + m) % m;
const ease = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const eventLength = (e: BubbleEvent) => e.ts + (e.bursts ? e.tb + e.tz : e.ts * 0.8);

/** The event's height above the surface at (x, y) and time (seconds, any value: it wraps). */
export function eventHeight(e: BubbleEvent, x: number, y: number, time: number, loop: number): number {
  let tau = mod(time - e.t0, loop);
  if (tau >= eventLength(e)) return 0;
  const dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy;
  if (d2 >= (FAR * e.r) ** 2) return 0;
  const w = 1 - ease(clamp01((Math.sqrt(d2) / e.r - FADE) / (FAR - FADE)));
  const ca = Math.cos(e.ang), sa = Math.sin(e.ang);
  const lx = (dx * ca + dy * sa) / e.stretch, ly = -dx * sa + dy * ca;
  const th = Math.atan2(ly, lx);
  const r0 = Math.hypot(lx, ly) / e.r;
  const lump = 1 + (e.h1 * Math.sin(3 * th + e.s1) + e.h2 * Math.sin(5 * th + e.s2)) * Math.min(1, r0 * r0 / 0.36);
  const rho = r0 / lump;
  const H = e.dome * e.r;
  const blister = (g: number) => {
    const d = rho / (0.55 + 0.45 * g);
    return d >= 1 ? 0 : g * H * (1 - d ** 2.5) ** 0.8;
  };
  if (tau < e.ts) {
    const p = tau / e.ts;
    return blister(1 - (1 - p) ** 2);
  }
  tau -= e.ts;
  if (!e.bursts) return blister(1 - ease(tau / (e.ts * 0.8)));
  if (tau < e.tb) {
    const p = tau / e.tb;
    const dome = blister(1) * (1 - p) ** 2;
    const crater = -0.35 * H * ease(p) * Math.exp(-((rho / 0.6) ** 2));
    const flap = 1 + 0.35 * Math.sin(5 * th + e.s2);
    const lr = 1 + 0.3 * p + 0.06 * Math.sin(3 * th + e.s1);
    const lip = 0.4 * H * flap * Math.sin(Math.PI * p) * Math.exp(-(((rho - lr) / 0.28) ** 2));
    return (dome + crater + lip) * w;
  }
  const q = (tau - e.tb) / e.tz;
  const crater = -0.35 * H * (1 - ease(q)) * Math.exp(-((rho / 0.6) ** 2));
  const ring = 0.07 * H * (1 - q) ** 2 * Math.sin(Math.PI * Math.min(1, 4 * q)) ** 0.5
    * Math.exp(-(((rho - (1.2 + 0.6 * q)) / 0.5) ** 2));
  return (crater + ring) * w;
}

/** Where a flung blob is: [x, y, z above the surface, radius], or null before it leaves and once it has sunk in. */
export function dropInAir(d: Drop, time: number, loop: number): [number, number, number, number] | null {
  const tau = mod(time - d.t0, loop);
  if (tau >= d.tf + MERGE) return null;
  if (tau < d.tf) {
    const p = tau / d.tf;
    return [d.x0 + (d.x1 - d.x0) * p, d.y0 + (d.y1 - d.y0) * p, 4 * d.apex * p * (1 - p), d.r * Math.min(1, 0.3 + 0.7 * p / 0.2)];
  }
  const q = (tau - d.tf) / MERGE;
  return [d.x1, d.y1, -0.4 * d.r * q, d.r * (1 - q)];
}

/** The lump a landed blob leaves: it rises as the blob sinks in, then spreads and melts flat. */
export function dropHeight(d: Drop, x: number, y: number, time: number, loop: number): number {
  const tau = mod(time - d.t0, loop) - d.tf;
  if (tau <= 0 || tau >= MERGE + MELT) return 0;
  let peak: number, spread: number;
  if (tau < MERGE) { peak = 0.7 * d.r * ease(tau / MERGE); spread = 1; }
  else { const q = (tau - MERGE) / MELT; peak = 0.7 * d.r * (1 - ease(q)); spread = 1 + 0.8 * q; }
  const rr = d.r * 1.2 * spread;
  const d2 = ((x - d.x1) ** 2 + (y - d.y1) ** 2) / (rr * rr);
  return d2 >= 1 ? 0 : peak * (1 - d2) ** 2;
}

export function dropsInAir(events: BubbleEvent[], time: number, loop: number) {
  const out: [number, number, number, number][] = [];
  for (const e of events) for (const d of e.drops) {
    const st = dropInAir(d, time, loop);
    if (st && st[3] > 0) out.push(st);
  }
  return out;
}

/** How dark the ooze is here (0..1): the ragged hole a burst tears in the skin. */
export function tear(e: BubbleEvent, x: number, y: number, time: number, loop: number): number {
  if (!e.bursts) return 0;
  const tau = mod(time - e.t0, loop) - e.ts;
  if (tau <= 0 || tau >= e.tb + 0.5 * e.tz) return 0;
  let size: number, dark: number;
  if (tau < e.tb) { size = 0.35 + 0.45 * ease(tau / e.tb); dark = Math.min(1, 4 * tau / e.tb); }
  else { const q = (tau - e.tb) / (0.5 * e.tz); size = 0.8 * (1 - 0.5 * q); dark = 1 - ease(q); }
  const dx = x - e.x, dy = y - e.y, th = Math.atan2(dy, dx);
  const rag = 1 + 0.18 * Math.sin(4 * th + e.s1) + 0.12 * Math.sin(7 * th + e.s2);
  const rho = Math.hypot(dx, dy) / (e.r * size * rag);
  return dark * (1 - ease(Math.min(1, Math.max(0, (rho - 0.6) / 0.4))));
}

export function tearAt(events: BubbleEvent[], x: number, y: number, time: number, loop: number) {
  let t = 0;
  for (const e of events) t += tear(e, x, y, time, loop);
  return Math.min(1, t);
}

export function splatterHeight([sx, sy, r, ph]: Splat, x: number, y: number, time: number, loop: number) {
  const d2 = ((x - sx) ** 2 + (y - sy) ** 2) / (r * r);
  if (d2 >= 1) return 0;
  const bob = 1 + 0.15 * Math.sin(2 * Math.PI * (time / loop + ph));
  return 0.45 * r * bob * (1 - d2) ** 1.5;
}

/** The ooze's height at (x, y): the base z with every bubble, blob lump and splatter lump added on. */
export function surfaceHeight(z: number, events: BubbleEvent[], splat: Splat[], x: number, y: number, time: number, loop: number) {
  for (const s of splat) z += splatterHeight(s, x, y, time, loop);
  for (const e of events) {
    z += eventHeight(e, x, y, time, loop);
    for (const d of e.drops) z += dropHeight(d, x, y, time, loop);
  }
  return z;
}

/** The slow swell of the whole surface, looping with the bubbles. The Cycles build uses Blender's Perlin noise,
 * which the browser doesn't have; this is a few drifting waves of the same size and scale instead. */
// Ken Perlin's improved noise (2002), the same family as Blender's: the plate holds no swell, so only its look
// (spread, slope, scale) has to match Cycles', not each ripple. PERLIN_SCALE brings its spread to Blender's
// mathutils.noise.noise (sd 0.279, mean |slope| 0.55, measured with Blender 4).
const PERM = (() => {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1234567;
  for (let i = 255; i > 0; i--) { s = (s * 1103515245 + 12345) >>> 0; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  return Uint8Array.from([...p, ...p]);
})();
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (t: number, a: number, b: number) => a + t * (b - a);
function grad(h: number, x: number, y: number, z: number) {
  const k = h & 15, u = k < 8 ? x : y, v = k < 4 ? y : k === 12 || k === 14 ? x : z;
  return ((k & 1) ? -u : u) + ((k & 2) ? -v : v);
}
export function perlin(x: number, y: number, z: number) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z), P = PERM;
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(w, lerp(v, lerp(u, grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z)),
    lerp(u, grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z))),
  lerp(v, lerp(u, grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1)),
    lerp(u, grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1))));
}
export const PERLIN_SCALE = 1.03;  // improved Perlin here: sd 0.270, mean |slope| 0.57

/** The ooze's slow swell at (x, y), as build_sludge_cycles.py makes it: noise at (x, y) * 2.2 / S, its third axis
 * walking a circle once a loop so the swell loops. seed shifts each sheet's noise. */
export function swell(amp: number, S: number, x: number, y: number, time: number, loop: number, seed = 0) {
  const tw = 2 * Math.PI * time / loop;
  return amp * PERLIN_SCALE * perlin(x * 2.2 / S + 0.4 * Math.cos(tw) + 17.3 * seed + 0.5,
    y * 2.2 / S + 0.4 * Math.sin(tw) + 9.1 * seed + 0.5, 0.37 + 5.7 * seed);
}
