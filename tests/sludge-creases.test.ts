import { describe, expect, it } from "vitest";
import { neighbours, creases } from "../src/diorama/sludgeCreases";

// a 9 x 9 grid of flat ooze, two triangles a cell; heights are set per test
const N = 9, verts = N * N;
const tris: number[] = [];
for (let y = 0; y < N - 1; y++)
  for (let x = 0; x < N - 1; x++) {
    const a = y * N + x;
    tris.push(a, a + 1, a + N, a + 1, a + N + 1, a + N);
  }
const nb = neighbours(verts, new Uint32Array(tris));
const rest = new Float32Array(verts * 3);
for (let i = 0; i < verts; i++) { rest[i * 3] = i % N; rest[i * 3 + 1] = Math.floor(i / N); }
const lifted = (h: (x: number, y: number) => number) => {
  const p = rest.slice();
  for (let i = 0; i < verts; i++) p[i * 3 + 2] += h(i % N, Math.floor(i / N));
  return p;
};
const at = (x: number, y: number) => y * N + x;

describe("live sludge creases", () => {
  it("links each vertex to the ones it shares an edge with", () => {
    const of = (i: number) => Array.from(nb.list.slice(nb.start[i], nb.start[i + 1])).sort((a, b) => a - b);
    expect(of(at(0, 0))).toEqual([at(1, 0), at(0, 1)].sort((a, b) => a - b));
    expect(of(at(4, 4)).length).toBe(6);
  });
  it("leaves flat ooze unshaded", () => {
    const out = new Float32Array(verts);
    creases(nb, lifted(() => 0.3), rest, out, 10);
    expect(Math.max(...out)).toBe(0);
  });
  it("darkens the foot of a bubble, not its top", () => {
    const out = new Float32Array(verts);
    creases(nb, lifted((x, y) => Math.max(0, 1 - Math.hypot(x - 4, y - 4) / 2)), rest, out, 1);
    expect(out[at(4, 4)]).toBe(0);          // the dome's top
    expect(out[at(7, 4)]).toBeGreaterThan(0); // just past its foot
  });
  it("never goes darker than the cap", () => {
    const out = new Float32Array(verts);
    creases(nb, lifted((x, y) => (x === 4 && y === 4 ? -50 : 0)), rest, out, 100);
    expect(out[at(4, 4)]).toBeCloseTo(0.6, 6);
  });
});
