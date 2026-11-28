// The live sludge's facing floor (docs/art/FIGURES.md, live sludge round 7). A bubble's far side, seen edge-on, has
// smoothed normals that lean away from the camera; the tilt table then gives the dark of a sheet seen from behind,
// and every dome gets a black ink outline Cycles never draws. The shading normal is bent towards the viewer until it
// faces it by at least minFace. The GLSL and the TypeScript twin below must stay the same sum.

export const FACE_FLOOR_GLSL = /* glsl */ `
vec3 faceFloor(vec3 n, vec3 v, float minFace) {
  float nv = dot(n, v);
  return nv < minFace ? normalize(n + (minFace - nv) * v) : n;
}`;

export type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

/** n and v unit length: n bent towards v so that it faces v by at least about minFace */
export function faceFloor(n: V3, v: V3, minFace: number): V3 {
  const nv = dot(n, v);
  if (nv >= minFace) return n;
  const k = minFace - nv;
  return norm([n[0] + k * v[0], n[1] + k * v[1], n[2] + k * v[2]]);
}
