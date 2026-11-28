// The sludge's bubbling on the GPU: each frame the CPU works out where every live bubble, blob lump and splatter
// lump is in its own life (time only: a few dozen numbers, sludgeBubbles.ts's rules), packs them into a small float
// texture, and the vertex shader shapes the ooze from it (space only). The 41k-vertex loop that took 41 ms of CPU a
// frame (round 9 profile) becomes a few hundred numbers. packedHeight/packedTear are the TS twins of the shader's
// sludgeHeight/sludgeTear; tests/sludge-pack.test.ts holds them to surfaceHeight/tearAt.
import { eventLength, MERGE, MELT, type BubbleEvent, type Splat } from "./sludgeBubbles";

export const ITEM = 16;  // floats an item: four RGBA texels in one row
export const MAX_ITEMS = 256;
export type Pack = { data: Float32Array; nBub: number; nTear: number; nLump: number; nSplat: number; dropped: number };

const FAR = 3.0, FADE = 2.2;
const mod = (a: number, m: number) => ((a % m) + m) % m;
const ease = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Every bubble, tear, lump and splatter alive at `time`, packed for the shader (bubbles, then tears, lumps, splats). */
export function packFrame(events: BubbleEvent[], splat: Splat[], time: number, loop: number, out?: Float32Array): Pack {
  const data = out ?? new Float32Array(ITEM * MAX_ITEMS);
  let n = 0, dropped = 0;
  const put = (...v: number[]) => {
    if (n >= MAX_ITEMS) { dropped++; return; }
    data.fill(0, n * ITEM, (n + 1) * ITEM); data.set(v, n * ITEM); n++;
  };
  for (const e of events) {
    let tau = mod(time - e.t0, loop);
    if (tau >= eventLength(e)) continue;
    let mode: number, a: number;
    if (tau < e.ts) { mode = 0; a = 1 - (1 - tau / e.ts) ** 2; }
    else {
      tau -= e.ts;
      if (!e.bursts) { mode = 0; a = 1 - ease(tau / (e.ts * 0.8)); }
      else if (tau < e.tb) { mode = 1; a = tau / e.tb; }
      else { mode = 2; a = (tau - e.tb) / e.tz; }
    }
    put(e.x, e.y, e.r, e.dome * e.r, Math.cos(e.ang), Math.sin(e.ang), e.stretch, mode, e.h1, e.h2, e.s1, e.s2, a);
  }
  const nBub = n;
  for (const e of events) {
    if (!e.bursts) continue;
    const tau = mod(time - e.t0, loop) - e.ts;
    if (tau <= 0 || tau >= e.tb + 0.5 * e.tz) continue;
    let size: number, dark: number;
    if (tau < e.tb) { size = 0.35 + 0.45 * ease(tau / e.tb); dark = Math.min(1, 4 * tau / e.tb); }
    else { const q = (tau - e.tb) / (0.5 * e.tz); size = 0.8 * (1 - 0.5 * q); dark = 1 - ease(q); }
    put(e.x, e.y, e.r * size, dark, e.s1, e.s2);
  }
  const nTear = n - nBub;
  for (const e of events) for (const d of e.drops) {
    const tau = mod(time - d.t0, loop) - d.tf;
    if (tau <= 0 || tau >= MERGE + MELT) continue;
    let peak: number, spread: number;
    if (tau < MERGE) { peak = 0.7 * d.r * ease(tau / MERGE); spread = 1; }
    else { const q = (tau - MERGE) / MELT; peak = 0.7 * d.r * (1 - ease(q)); spread = 1 + 0.8 * q; }
    put(d.x1, d.y1, d.r * 1.2 * spread, peak);
  }
  const nLump = n - nBub - nTear;
  for (const [sx, sy, r, ph] of splat) put(sx, sy, r, 0.45 * r * (1 + 0.15 * Math.sin(2 * Math.PI * (time / loop + ph))));
  return { data, nBub, nTear, nLump, nSplat: n - nBub - nTear - nLump, dropped };
}

/** One packed bubble's height at (x, y): eventHeight with its time already applied. */
function bubbleHeight(d: Float32Array, o: number, x: number, y: number): number {
  const [ex, ey, r, H, ca, sa, stretch, mode, h1, h2, s1, s2, a] = d.subarray(o, o + 13);
  const dx = x - ex, dy = y - ey, d2 = dx * dx + dy * dy;
  if (d2 >= (FAR * r) ** 2) return 0;
  const w = 1 - ease(clamp01((Math.sqrt(d2) / r - FADE) / (FAR - FADE)));
  const lx = (dx * ca + dy * sa) / stretch, ly = -dx * sa + dy * ca;
  const th = Math.atan2(ly, lx), r0 = Math.hypot(lx, ly) / r;
  const lump = 1 + (h1 * Math.sin(3 * th + s1) + h2 * Math.sin(5 * th + s2)) * Math.min(1, r0 * r0 / 0.36);
  const rho = r0 / lump;
  const blister = (g: number) => { const q = rho / (0.55 + 0.45 * g); return q >= 1 ? 0 : g * H * (1 - q ** 2.5) ** 0.8; };
  if (mode === 0) return blister(a);
  if (mode === 1) {
    const dome = blister(1) * (1 - a) ** 2;
    const crater = -0.35 * H * ease(a) * Math.exp(-((rho / 0.6) ** 2));
    const flap = 1 + 0.35 * Math.sin(5 * th + s2), lr = 1 + 0.3 * a + 0.06 * Math.sin(3 * th + s1);
    const lip = 0.4 * H * flap * Math.sin(Math.PI * a) * Math.exp(-(((rho - lr) / 0.28) ** 2));
    return (dome + crater + lip) * w;
  }
  const crater = -0.35 * H * (1 - ease(a)) * Math.exp(-((rho / 0.6) ** 2));
  const ring = 0.07 * H * (1 - a) ** 2 * Math.sin(Math.PI * Math.min(1, 4 * a)) ** 0.5
    * Math.exp(-(((rho - (1.2 + 0.6 * a)) / 0.5) ** 2));
  return (crater + ring) * w;
}

/** The ooze's rise at (x, y) from everything packed (no swell): surfaceHeight(0, ...) at the packed time. */
export function packedHeight(p: Pack, x: number, y: number): number {
  const d = p.data;
  let z = 0, i = 0;
  for (; i < p.nBub; i++) z += bubbleHeight(d, i * ITEM, x, y);
  i += p.nTear;
  for (const end = i + p.nLump; i < end; i++) {
    const o = i * ITEM, q2 = ((x - d[o]) ** 2 + (y - d[o + 1]) ** 2) / d[o + 2] ** 2;
    if (q2 < 1) z += d[o + 3] * (1 - q2) ** 2;
  }
  for (const end = i + p.nSplat; i < end; i++) {
    const o = i * ITEM, q2 = ((x - d[o]) ** 2 + (y - d[o + 1]) ** 2) / d[o + 2] ** 2;
    if (q2 < 1) z += d[o + 3] * (1 - q2) ** 1.5;
  }
  return z;
}

/** How torn the skin is at (x, y): tearAt at the packed time. */
export function packedTear(p: Pack, x: number, y: number): number {
  const d = p.data;
  let t = 0;
  for (let i = p.nBub; i < p.nBub + p.nTear; i++) {
    const o = i * ITEM, dx = x - d[o], dy = y - d[o + 1], th = Math.atan2(dy, dx);
    const rag = 1 + 0.18 * Math.sin(4 * th + d[o + 4]) + 0.12 * Math.sin(7 * th + d[o + 5]);
    const rho = Math.hypot(dx, dy) / (d[o + 2] * rag);
    t += d[o + 3] * (1 - ease(clamp01((rho - 0.6) / 0.4)));
  }
  return Math.min(1, t);
}

/** The shader side: the same three functions over the packed texture, plus Perlin (the swell) over PERM. */
export const SLUDGE_PACK_GLSL = /* glsl */ `
uniform highp sampler2D packTex; uniform highp usampler2D permTex;
uniform int nBub; uniform int nTear; uniform int nLump; uniform int nSplat;
vec4 item(int i, int t) { return texelFetch(packTex, ivec2(t, i), 0); }
float easeS(float p) { return p * p * (3.0 - 2.0 * p); }
// two GPU traps the TS doesn't have: atan(0, 0) is undefined (hence + 1e-12), and sin(pi) lands a hair below 0
// in float, so its square root is NaN (hence the max): either one blanked whole domes
float bubbleH(int i, vec2 xy) {
  vec4 a0 = item(i, 0);
  vec2 dd = xy - a0.xy; float d2 = dot(dd, dd), r = a0.z, H = a0.w;
  if (d2 >= 9.0 * r * r) return 0.0;
  vec4 a1 = item(i, 1), a2 = item(i, 2); float a = item(i, 3).x;
  float w = 1.0 - easeS(clamp((sqrt(d2) / r - 2.2) / 0.8, 0.0, 1.0));
  float lx = (dd.x * a1.x + dd.y * a1.y) / a1.z, ly = -dd.x * a1.y + dd.y * a1.x;
  float th = atan(ly, lx + 1e-12), r0 = length(vec2(lx, ly)) / r;
  float lump = 1.0 + (a2.x * sin(3.0 * th + a2.z) + a2.y * sin(5.0 * th + a2.w)) * min(1.0, r0 * r0 / 0.36);
  float rho = r0 / lump;
  int mode = int(a1.w + 0.5);
  float g = mode == 0 ? a : 1.0, q = rho / (0.55 + 0.45 * g);
  float bl = q >= 1.0 ? 0.0 : g * H * pow(1.0 - pow(q, 2.5), 0.8);
  if (mode == 0) return bl;
  if (mode == 1) {
    float dome = bl * (1.0 - a) * (1.0 - a);
    float crater = -0.35 * H * easeS(a) * exp(-(rho / 0.6) * (rho / 0.6));
    float flap = 1.0 + 0.35 * sin(5.0 * th + a2.w), lr = 1.0 + 0.3 * a + 0.06 * sin(3.0 * th + a2.z);
    float lip = 0.4 * H * flap * sin(3.14159265 * a) * exp(-((rho - lr) / 0.28) * ((rho - lr) / 0.28));
    return (dome + crater + lip) * w;
  }
  float crater = -0.35 * H * (1.0 - easeS(a)) * exp(-(rho / 0.6) * (rho / 0.6));
  float rr = (rho - (1.2 + 0.6 * a)) / 0.5;
  float ring = 0.07 * H * (1.0 - a) * (1.0 - a) * sqrt(max(sin(3.14159265 * min(1.0, 4.0 * a)), 0.0)) * exp(-rr * rr);
  return (crater + ring) * w;
}
float sludgeHeight(vec2 xy) {
  float z = 0.0; int i = 0;
  for (; i < nBub; i++) z += bubbleH(i, xy);
  i += nTear;
  for (int e = i + nLump; i < e; i++) {
    vec4 l = item(i, 0); vec2 dd = xy - l.xy; float q2 = dot(dd, dd) / (l.z * l.z);
    if (q2 < 1.0) z += l.w * (1.0 - q2) * (1.0 - q2);
  }
  for (int e = i + nSplat; i < e; i++) {
    vec4 l = item(i, 0); vec2 dd = xy - l.xy; float q2 = dot(dd, dd) / (l.z * l.z);
    if (q2 < 1.0) z += l.w * pow(1.0 - q2, 1.5);
  }
  return z;
}
float sludgeTear(vec2 xy) {
  float t = 0.0;
  for (int i = nBub; i < nBub + nTear; i++) {
    vec4 a0 = item(i, 0), a1 = item(i, 1); vec2 dd = xy - a0.xy; float th = atan(dd.y, dd.x + 1e-12);
    float rag = 1.0 + 0.18 * sin(4.0 * th + a1.x) + 0.12 * sin(7.0 * th + a1.y);
    float rho = length(dd) / (a0.z * rag);
    t += a0.w * (1.0 - easeS(clamp((rho - 0.6) / 0.4, 0.0, 1.0)));
  }
  return min(1.0, t);
}
int pm(int i) { return int(texelFetch(permTex, ivec2(i, 0), 0).r); }
float fadeP(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float gradP(int h, float x, float y, float z) {
  int k = h & 15; float u = k < 8 ? x : y, v = k < 4 ? y : (k == 12 || k == 14 ? x : z);
  return ((k & 1) != 0 ? -u : u) + ((k & 2) != 0 ? -v : v);
}
float perlin3(vec3 p) {
  vec3 f = floor(p); int X = int(f.x) & 255, Y = int(f.y) & 255, Z = int(f.z) & 255;
  float x = p.x - f.x, y = p.y - f.y, z = p.z - f.z, u = fadeP(x), v = fadeP(y), w = fadeP(z);
  int A = pm(X) + Y, AA = pm(A) + Z, AB = pm(A + 1) + Z, B = pm(X + 1) + Y, BA = pm(B) + Z, BB = pm(B + 1) + Z;
  return mix(mix(mix(gradP(pm(AA), x, y, z), gradP(pm(BA), x - 1.0, y, z), u),
                 mix(gradP(pm(AB), x, y - 1.0, z), gradP(pm(BB), x - 1.0, y - 1.0, z), u), v),
             mix(mix(gradP(pm(AA + 1), x, y, z - 1.0), gradP(pm(BA + 1), x - 1.0, y, z - 1.0), u),
                 mix(gradP(pm(AB + 1), x, y - 1.0, z - 1.0), gradP(pm(BB + 1), x - 1.0, y - 1.0, z - 1.0), u), v), w);
}
`;
