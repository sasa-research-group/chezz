// The stage compositor (stage.py _setup_compositor) and Blender's Standard view, as one screen effect.
// Order as in Blender: [bloom] -> ASC-CDL -> saturation x1.4 (HSV) -> vignette -> grain (overlay) ->
// exposure -> clamp. The concept LUT (grade-concept.cube) runs after this on the display values.
import { Effect } from "postprocessing";
import * as THREE from "three";

const frag = /* glsl */ `
uniform vec3 offset; uniform vec3 power; uniform vec3 slope;
uniform float sat; uniform float vig0; uniform float vig1; uniform float vigMin; uniform float grain; uniform float expo;
vec3 rgb2hsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), d = mx - mn, h = 0.0;
  if (d > 1e-6) {
    if (mx == c.r) h = mod((c.g - c.b) / d, 6.0); else if (mx == c.g) h = (c.b - c.r) / d + 2.0; else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, mx > 1e-6 ? d / mx : 0.0, mx);
}
vec3 hsv2rgb(vec3 c) {
  vec3 k = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), k, c.y);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + fract(time) * 61.0) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = pow(max(inputColor.rgb * slope + offset, 0.0), power);
  vec3 hsv = rgb2hsv(c); hsv.y = clamp(hsv.y * sat, 0.0, 1.0); c = hsv2rgb(hsv);
  vec2 p = (uv * 2.0 - 1.0) * (aspect >= 1.0 ? vec2(1.0, 1.0 / aspect) : vec2(aspect, 1.0));
  c *= mix(1.0, vigMin, clamp((length(p) - vig0) / (vig1 - vig0), 0.0, 1.0));
  float n = hash(floor(uv * resolution));
  vec3 ov = mix(2.0 * c * n, 1.0 - 2.0 * (1.0 - c) * (1.0 - n), step(0.5, c));
  c = mix(c, ov, grain);
  outputColor = vec4(clamp(c * expo, 0.0, 1.0), 1.0);
}`;

export type GradeOptions = { exposure?: number; sat?: number; grain?: number };
export class GradeEffect extends Effect {
  constructor({ exposure = -0.35, sat = 1.4, grain = 0.08 }: GradeOptions = {}) {
    super("GradeEffect", frag, {
      uniforms: new Map<string, THREE.Uniform>([
        ["offset", new THREE.Uniform(new THREE.Vector3(0, 0.003, 0.009))],
        ["power", new THREE.Uniform(new THREE.Vector3(0.97, 0.98, 1.02))],
        ["slope", new THREE.Uniform(new THREE.Vector3(1.04, 1.0, 0.95))],
        ["sat", new THREE.Uniform(sat)],
        ["vig0", new THREE.Uniform(0.55)], ["vig1", new THREE.Uniform(1.25)], ["vigMin", new THREE.Uniform(0.72)],
        ["grain", new THREE.Uniform(grain)],
        ["expo", new THREE.Uniform(Math.pow(2, exposure))],
      ]),
    });
  }
}
