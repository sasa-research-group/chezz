import { describe, expect, it } from "vitest";
import { mirrorT, mirrored, type V3 } from "../src/diorama/sludgeMirror";

// A room that is only a ceiling at height H, a mirror at z0, a camera at C looking down. The flat mirror's image
// shows, where q shows, the point the line from C's mirror image through q meets the ceiling.
const H = 5, z0 = 0, C: V3 = [0, -6, 8];
const Cm = mirrored(C, z0);
const ceiling = (q: V3): V3 | null => {
  const d: V3 = [q[0] - Cm[0], q[1] - Cm[1], q[2] - Cm[2]];
  if (d[2] <= 0) return null;
  const s = (H - Cm[2]) / d[2];
  return [Cm[0] + s * d[0], Cm[1] + s * d[1], H];
};
const unit = (v: V3): V3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };

describe("mirrorT (bending the flat mirror's image by a live normal)", () => {
  it("finds where a tilted reflected ray meets the room", () => {
    const p: V3 = [0.3, 0.2, 0.05];  // a point on a bubble, a little over the still surface
    const d = unit([0.25, 0.4, 1]);   // its reflected ray, turned off the flat one
    const { t, w } = mirrorT(p, d, 12, ceiling, 8);
    expect(p[2] + t * d[2]).toBeCloseTo(H, 2);
    expect(w).toBeGreaterThan(0.95);
  });

  it("is exact at once for the flat surface's own reflection", () => {
    const p: V3 = [0.5, -0.4, 0];
    const v = unit([C[0] - p[0], C[1] - p[1], C[2] - p[2]]);
    const d: V3 = [-v[0], -v[1], v[2]];  // the flat mirror's reflection of the view ray
    const { t } = mirrorT(p, d, 3, ceiling, 1);
    expect(p[2] + t * d[2]).toBeCloseTo(H, 6);
  });

  it("falls back where the image has no answer or the ray points into the ooze", () => {
    expect(mirrorT([0, 0, 0], unit([0.1, 0, 1]), 5, () => null).w).toBe(0);
    expect(mirrorT([0, 0, 0], unit([0.1, 0, -1]), 5, ceiling).w).toBe(0);
  });

  it("distrusts a point that is not on the ray (a stone's edge hiding another)", () => {
    const off = (q: V3): V3 | null => { const h = ceiling(q); return h && [h[0] + 3, h[1], h[2]]; };
    expect(mirrorT([0, 0, 0], unit([0.2, 0.3, 1]), 5, off).w).toBeLessThan(0.1);
  });
});
