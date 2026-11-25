// The stage's colour grade (stage.py _setup_compositor), for the live sludge: Cycles' frames are graded after the
// render (ASC-CDL colour balance, then a saturation boost), and the baked ooze images carry that grade. Live light
// (the coat's glints) must be added before the grade, not after, or it skips the warm slope and the saturation and
// comes out white and pasted on. So: undo the grade on the baked colour, add the light, grade the sum.
// Scene-linear values, before the view's exposure. The vignette and grain are left out (they cancel on the baked part
// and barely touch the ooze). The GLSL and the TypeScript twin below must stay the same sums.

export type Grade = { slope: number[]; offset: number[]; power: number[]; sat: number };

/** stage.py's grade as the sludge renders use it (base_r78.env: GRADE_SAT=1.4) */
export const STAGE_GRADE: Grade = { slope: [1.04, 1.0, 0.95], offset: [0.0, 0.003, 0.009], power: [0.97, 0.98, 1.02], sat: 1.4 };

export const GRADE_GLSL = /* glsl */ `
uniform vec3 gSlope; uniform vec3 gOffset; uniform vec3 gPower; uniform float gSat;
// Blender's HSV: v = max, s = (max - min) / max; scaling s keeps max and moves every channel away from it
vec3 satBy(vec3 c, float k) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  if (mx <= 0.0 || mx == mn) return c;
  float s = (mx - mn) / mx, s2 = clamp(s * k, 0.0, 1.0);
  return max(mx - (mx - c) * (s2 / s), 0.0);
}
vec3 gradeFwd(vec3 x) { return satBy(pow(max(x * gSlope + gOffset, 0.0), gPower), gSat); }
vec3 gradeInv(vec3 y) { return (pow(max(satBy(y, 1.0 / gSat), 0.0), 1.0 / gPower) - gOffset) / gSlope; }`;

type C = number[];
function satBy(c: C, k: number): C {
  const mx = Math.max(...c), mn = Math.min(...c);
  if (mx <= 0 || mx === mn) return c.slice();
  const s = (mx - mn) / mx, s2 = Math.min(Math.max(s * k, 0), 1);
  return c.map(x => Math.max(mx - (mx - x) * (s2 / s), 0));
}
export function gradeFwd(x: C, g: Grade = STAGE_GRADE): C {
  return satBy(x.map((v, i) => Math.pow(Math.max(v * g.slope[i] + g.offset[i], 0), g.power[i])), g.sat);
}
export function gradeInv(y: C, g: Grade = STAGE_GRADE): C {
  return satBy(y, 1 / g.sat).map((v, i) => (Math.pow(Math.max(v, 0), 1 / g.power[i]) - g.offset[i]) / g.slope[i]);
}
