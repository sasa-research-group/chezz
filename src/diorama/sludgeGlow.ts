// The live sludge's dome glow (docs/art/FIGURES.md, live sludge round 11). Cycles' ooze is a thick translucent
// jelly: a dome's steep sides let the room's light through and come out brighter than the flat pool (green up to
// about 12% in display at 40-60 degrees). The live basis was baked from a thin flat sheet tilted, which has no depth
// to glow through, so steep ooze came out darker than Cycles'. The ooze's own light (the skin, before the coat) is
// raised by k times the square of its tilt from rest over 60 degrees. The GLSL and the TypeScript twin below must
// stay the same sum.

export const DOME_GLOW_GLSL = /* glsl */ `
uniform float domeGlow;
float glowGain(float cosTilt) {
  float t = acos(clamp(cosTilt, -1.0, 1.0)) / 1.04719755;
  return 1.0 + domeGlow * t * t;
}`;

/** the factor the skin's light is raised by at a tilt from rest of acos(cosTilt), with strength k */
export function glowGain(cosTilt: number, k: number): number {
  const t = Math.acos(Math.min(1, Math.max(-1, cosTilt))) / (Math.PI / 3);
  return 1 + k * t * t;
}
