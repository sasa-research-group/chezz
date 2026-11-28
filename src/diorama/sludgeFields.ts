// The live sludge's shape worked out once a vertex a frame, on the GPU (src/proof/liveSludge.ts, ?shape=vtx, the
// default): three passes over a texture holding one texel a vertex. A: each vertex's rise and tear from the packed
// bubbles (sludgePack.ts). B: the mean rise over the vertex and its mesh neighbours, and the slope fitted through
// them (least squares). C: the crease as the CPU's creases() works it (sludgeCreases.ts: two rings of means).
// The ooze's vertex shader then reads two texels by gl_VertexID, where the older tap shader worked the rise out
// 13 times a vertex (the GPU's biggest cost on a phone, 2026-11-25).
import type { Neighbours } from "./sludgeCreases";

/** texels a row in every per-vertex texture */
export const FIELD_W = 256;

export const fieldRows = (verts: number) => Math.max(1, Math.ceil(verts / FIELD_W));

/** One RGBA float texel a vertex: its rest position (x, y, z) and where its neighbour list starts (w). The list
 * texture holds each neighbour's index; the count is the next vertex's start minus this one's, so the start of
 * the vertex past the last is kept in the texel after it. */
export function packVertices(rest: Float32Array, nb: Neighbours) {
  const verts = rest.length / 3, rows = Math.max(1, Math.ceil((verts + 1) / FIELD_W));
  const vtx = new Float32Array(FIELD_W * rows * 4);
  for (let i = 0; i < verts; i++) vtx.set([rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2], nb.start[i]], i * 4);
  vtx[verts * 4 + 3] = nb.start[verts];
  const lrows = Math.max(1, Math.ceil(nb.list.length / FIELD_W));
  const list = new Float32Array(FIELD_W * lrows);
  list.set(nb.list);
  return { vtx, rows, list, lrows };
}

/** The slope (dz/dx, dz/dy) of the plane through a vertex's rise fitted to its neighbours' (least squares), as
 * pass B works it: exact for a plane, and for a bubble's dome the mesh's own slope there. */
export function fitSlope(x: number, y: number, d: number, nbr: [number, number, number][]): [number, number] {
  let a = 0, b = 0, c = 0, p = 0, q = 0;
  for (const [xj, yj, dj] of nbr) {
    const ux = xj - x, uy = yj - y, dd = dj - d;
    a += ux * ux; b += ux * uy; c += uy * uy; p += dd * ux; q += dd * uy;
  }
  const det = a * c - b * b;
  if (Math.abs(det) < 1e-20) return [0, 0];
  return [(c * p - b * q) / det, (a * q - b * p) / det];
}

const HEAD = /* glsl */ `
uniform highp sampler2D vtxTex; uniform highp sampler2D listTex; uniform int nVerts;
ivec2 at(int i) { return ivec2(i % ${FIELD_W}, i / ${FIELD_W}); }
int here() { ivec2 c = ivec2(gl_FragCoord.xy); return c.y * ${FIELD_W} + c.x; }
int nbStart(int i) { return int(texelFetch(vtxTex, at(i), 0).w); }
int nbAt(int q) { return int(texelFetch(listTex, at(q), 0).r); }
out vec4 o;
`;

/** Pass A: (rise, tear). Needs SLUDGE_PACK_GLSL and a rise(xy) before it. */
export const FIELD_A_GLSL = HEAD + /* glsl */ `
void main() {
  int i = here(); if (i >= nVerts) { o = vec4(0.0); return; }
  vec2 xy = texelFetch(vtxTex, at(i), 0).xy;
  o = vec4(rise(xy), sludgeTear(xy), 0.0, 0.0);
}`;

/** Pass B: (mean rise over the vertex and its neighbours, slope x, slope y). */
export const FIELD_B_GLSL = HEAD + /* glsl */ `
uniform highp sampler2D fieldA;
void main() {
  int i = here(); if (i >= nVerts) { o = vec4(0.0); return; }
  vec2 xy = texelFetch(vtxTex, at(i), 0).xy; float d = texelFetch(fieldA, at(i), 0).r;
  int s = nbStart(i), e = nbStart(i + 1);
  float sum = d, a = 0.0, b = 0.0, c = 0.0, p = 0.0, q = 0.0;
  for (int k = s; k < e; k++) {
    int j = nbAt(k);
    vec2 u = texelFetch(vtxTex, at(j), 0).xy - xy; float dj = texelFetch(fieldA, at(j), 0).r;
    sum += dj; a += u.x * u.x; b += u.x * u.y; c += u.y * u.y; p += (dj - d) * u.x; q += (dj - d) * u.y;
  }
  float det = a * c - b * b;
  vec2 g = abs(det) < 1e-20 ? vec2(0.0) : vec2(c * p - b * q, a * q - b * p) / det;
  o = vec4(sum / float(e - s + 1), g, 0.0);
}`;

/** Pass C: (crease, slope x, slope y): the mean of pass B's means, less the rise, times creaseK, as creases(). */
export const FIELD_C_GLSL = HEAD + /* glsl */ `
uniform highp sampler2D fieldA; uniform highp sampler2D fieldB; uniform float creaseK;
void main() {
  int i = here(); if (i >= nVerts) { o = vec4(0.0); return; }
  vec4 bi = texelFetch(fieldB, at(i), 0);
  int s = nbStart(i), e = nbStart(i + 1);
  float sum = bi.r;
  for (int k = s; k < e; k++) sum += texelFetch(fieldB, at(nbAt(k)), 0).r;
  float d = texelFetch(fieldA, at(i), 0).r;
  o = vec4(clamp((sum / float(e - s + 1) - d) * creaseK, 0.0, 0.6), bi.g, bi.b, 0.0);
}`;
