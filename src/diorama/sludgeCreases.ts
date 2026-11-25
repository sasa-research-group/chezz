// Crease shading for the live sludge (src/proof/liveSludge.ts): Cycles darkens the foot of a bubble and the rim
// of a burst because the skin shadows itself there; the live ooze darkens the same places by how far each vertex
// sits below the ooze around it.

export type Neighbours = { start: Uint32Array; list: Uint32Array };

/** Each vertex's neighbours along the triangle edges, packed: list[start[i] .. start[i + 1]). */
export function neighbours(verts: number, tris: Uint32Array): Neighbours {
  const sets: Set<number>[] = Array.from({ length: verts }, () => new Set());
  for (let t = 0; t < tris.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = tris[t + e], b = tris[t + (e + 1) % 3];
      sets[a].add(b); sets[b].add(a);
    }
  const start = new Uint32Array(verts + 1);
  for (let i = 0; i < verts; i++) start[i + 1] = start[i] + sets[i].size;
  const list = new Uint32Array(start[verts]);
  sets.forEach((s, i) => { let k = start[i]; for (const j of s) list[k++] = j; });
  return { start, list };
}

/** How deep in a crease each vertex sits (0..0.6): how far its rise sits below the rise around it, two rings out,
 * times k. The foot of a bubble and the rim of a burst come out dark; a dome's top and flat ooze come out 0. */
export function creases(nb: Neighbours, pos: Float32Array, rest: Float32Array, out: Float32Array, k: number) {
  const n = out.length, d = new Float32Array(n), m = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = pos[i * 3 + 2] - rest[i * 3 + 2];
  const ring = (src: Float32Array, dst: Float32Array) => {
    for (let i = 0; i < n; i++) {
      let s = src[i], c = 1;
      for (let q = nb.start[i]; q < nb.start[i + 1]; q++) { s += src[nb.list[q]]; c++; }
      dst[i] = s / c;
    }
  };
  ring(d, m); const m2 = new Float32Array(n); ring(m, m2);
  for (let i = 0; i < n; i++) out[i] = Math.min(0.6, Math.max(0, (m2[i] - d[i]) * k));
}
