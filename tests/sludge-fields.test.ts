import { describe, expect, it } from "vitest";
import { FIELD_W, fitSlope, packVertices, FIELD_A_GLSL, FIELD_B_GLSL, FIELD_C_GLSL } from "../src/diorama/sludgeFields";
import { neighbours } from "../src/diorama/sludgeCreases";

// a small triangle grid: (n+1)^2 vertices, two triangles a cell
function grid(n: number) {
  const rest = new Float32Array((n + 1) * (n + 1) * 3), tris: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) rest.set([i * 0.1, j * 0.1, 0], (j * (n + 1) + i) * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    tris.push(a, b, d, a, d, c);
  }
  return { rest, tris: new Uint32Array(tris) };
}

describe("per-vertex sludge fields", () => {
  it("packs each vertex's rest position and where its neighbours start, past the last one too", () => {
    const { rest, tris } = grid(30), v = rest.length / 3, nb = neighbours(v, tris);
    const p = packVertices(rest, nb);
    expect(p.vtx.length).toBe(FIELD_W * p.rows * 4);
    for (const i of [0, 7, 500, v - 1]) {
      expect(p.vtx[i * 4]).toBeCloseTo(rest[i * 3], 6);
      expect(p.vtx[i * 4 + 3]).toBe(nb.start[i]);
      const s = p.vtx[i * 4 + 3], e = p.vtx[(i + 1) * 4 + 3];
      expect(Array.from(p.list.slice(s, e))).toEqual(Array.from(nb.list.slice(nb.start[i], nb.start[i + 1])));
    }
  });
  it("fits a plane's slope exactly, and a dome's slope near the mesh's", () => {
    const [gx, gy] = fitSlope(0.3, 0.2, 0.5 + 2 * 0.3 - 0.7 * 0.2, [[0.4, 0.2], [0.3, 0.3], [0.2, 0.1], [0.25, 0.3]]
      .map(([x, y]) => [x, y, 0.5 + 2 * x - 0.7 * y] as [number, number, number]));
    expect(gx).toBeCloseTo(2, 6); expect(gy).toBeCloseTo(-0.7, 6);
    const h = (x: number, y: number) => Math.exp(-(x * x + y * y) / 0.05), e = 0.01;
    const ring = Array.from({ length: 6 }, (_, k) => [0.1 + e * Math.cos(k), 0.05 + e * Math.sin(k)]);
    const [dx, dy] = fitSlope(0.1, 0.05, h(0.1, 0.05), ring.map(([x, y]) => [x, y, h(x, y)] as [number, number, number]));
    expect(dx).toBeCloseTo(-2 * 0.1 / 0.05 * h(0.1, 0.05), 1);
    expect(dy).toBeCloseTo(-2 * 0.05 / 0.05 * h(0.1, 0.05), 1);
  });
  it("gives no slope with too few neighbours to fit", () => expect(fitSlope(0, 0, 1, [[1, 0, 2]])).toEqual([0, 0]));
  it("has the three passes", () => {
    expect(FIELD_A_GLSL).toContain("rise(xy)");
    expect(FIELD_B_GLSL).toContain("det");
    expect(FIELD_C_GLSL).toContain("creaseK");
  });
});
