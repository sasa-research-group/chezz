// The live sludge's torn holes (docs/art/FIGURES.md, live sludge round 13). A hole shows the torn set (the sheet
// baked with its skin open), which is a flat sheet: in Cycles a hole is a dip, a purer, brighter green with a
// cool streak where the room shows in its wet sides. Fitted to Cycles' a6 loop on fully torn pixels:
//  - lift: the torn set's light per channel (more green, less blue), so the hole's median green matches;
//  - coat: the coat's light over the hole, stronger and cooler, so its brightest 3% match (green 123, blue 97).
// Each is blended in by the tear (0 skin, 1 open), so whole skin is unchanged.

export type Rgb = [number, number, number];
export const HOLE_DEFAULTS = { lift: "1.15,1.37,0.6", coat: "2,3.2,4.5" };

/** one number for all three channels, or r,g,b */
export function rgbKnob(s: string): Rgb {
  const h = s.split(",").map(Number);
  if (h.some(v => !Number.isFinite(v))) throw new Error(`not a colour knob: ${s}`);
  return [h[0], h[1] ?? h[0], h[2] ?? h[0]];
}

export function holeKnobs(q: URLSearchParams): { lift: Rgb; coat: Rgb } {
  return { lift: rgbKnob(q.get("hole") ?? HOLE_DEFAULTS.lift), coat: rgbKnob(q.get("holecoat") ?? HOLE_DEFAULTS.coat) };
}

/** the factor the coat's light is scaled by at tear t (the GLSL's mix(vec3(1.0), holeCoat, tear)) */
export function coatFactor(coat: Rgb, tear: number): Rgb {
  return coat.map(c => 1 + (c - 1) * tear) as Rgb;
}
