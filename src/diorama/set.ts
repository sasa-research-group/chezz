// The baked diorama set (tools/art/diorama/bake_set.py): one Cycles render per source size (3, 5, 8) with
// a depth grid, turned back into a 3D mesh so live pieces sort against it. Any board from 2x2 to 8x8 is the
// next source up, cut at grout lines into four quarters that slide together. Coordinates here are
// Blender's (x right, y into the box, z up); the scene rotates them into three.js once at the root.
import * as THREE from "three";

export const SOURCES = [3, 5, 8] as const;
export type SetInfo = {
  n: number; /** a level bake's own size (rectangles); a source set is n x n */ nx?: number; ny?: number; H: number; S: number; W: number;
  res: [number, number]; stride: number; grid: [number, number]; near: number; far: number;
  camera: { matrixWorld: number[][]; lens: number; sensor: number; zoom: number; elevation: number; lookAhead: number };
  exposure: number; glowK: number; bulbs: [number, number, number][];
};
export type SetData = { info: SetInfo; depth: Uint16Array; /** its files, without the extension: "diorama/set5" */ at: string };

/** Which baked set a board is cut from: the smallest one at least as big as its longer side. */
export const sourceFor = (w: number, h: number) => SOURCES.find(n => n >= Math.max(w, h)) ?? SOURCES[SOURCES.length - 1];

/** The kept source columns (or rows) and where they slide for a board `w` wide cut from an `n` source. Low
 * keeps the first `k` source columns, high the last `w - k`; the middle `n - w` go. */
export function cut(n: number, w: number, S: number) {
  if (w >= n) return { lo: Infinity, hi: Infinity, shift: 0 };
  const k = Math.ceil(w / 2);
  return { lo: -n * S / 2 + k * S, hi: n * S / 2 - (w - k) * S, shift: (n - w) * S / 2 };
}

/** World position (Blender axes) of every depth-grid vertex, and its texture coordinate. */
export function gridPoints({ info, depth }: SetData) {
  const [w, h] = info.res, [gw, gh] = info.grid, st = info.stride, c = info.camera;
  const M = c.matrixWorld, f = c.sensor / c.lens;
  const pos = new Float32Array(gw * gh * 3), uv = new Float32Array(gw * gh * 2);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i, px = Math.min(i * st, w - 1) + 0.5, py = Math.min(j * st, h - 1) + 0.5;
    const d = info.near + (depth[k] - 1) / 65534 * (info.far - info.near);
    const xc = (px / w - 0.5) * f * d, yc = (0.5 - py / h) * f * (h / w) * d, zc = -d;
    for (let r = 0; r < 3; r++) pos[k * 3 + r] = M[r][0] * xc + M[r][1] * yc + M[r][2] * zc + M[r][3];
    uv[k * 2] = px / w; uv[k * 2 + 1] = 1 - py / h;
  }
  return { pos, uv, gw, gh };
}

export type Piece = { geometry: THREE.BufferGeometry; shift: [number, number] };
/** The set cut for a `w` x `h` board: up to four meshes sharing one vertex buffer, each with its slide.
 * A grid cell goes to a quarter when any corner lies in that quarter's kept band, so cuts overlap a little
 * instead of leaving a gap. */
export function cutSet(data: SetData, w: number, h: number): Piece[] {
  const { pos, uv, gw, gh } = gridPoints(data);
  const S = data.info.S;
  const cx = cut(data.info.nx ?? data.info.n, w, S), cy = cut(data.info.ny ?? data.info.n, h, S);
  const pa = new THREE.BufferAttribute(pos, 3), ua = new THREE.BufferAttribute(uv, 2);
  // quarter bits: x side 0 = left (low x), 1 = right; y side 0 = front (low y), 1 = back
  const xs = (x: number) => (cx.lo === Infinity ? 1 : (x < cx.lo ? 1 : 0) | (x > cx.hi ? 2 : 0));
  const ys = (y: number) => (cy.lo === Infinity ? 1 : (y < cy.lo ? 1 : 0) | (y > cy.hi ? 2 : 0));
  const lists: number[][] = [[], [], [], []];
  for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
    const a = j * gw + i, b = a + 1, c = a + gw, d = c + 1;
    let mx = 0, my = 0;
    for (const v of [a, b, c, d]) { mx |= xs(pos[v * 3]); my |= ys(pos[v * 3 + 1]); }
    for (let qx = 0; qx < 2; qx++) for (let qy = 0; qy < 2; qy++)
      if (mx & (1 << qx) && my & (1 << qy)) lists[qx * 2 + qy].push(a, c, b, b, c, d);
  }
  return lists.flatMap((idx, q) => {
    if (!idx.length) return [];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", pa); g.setAttribute("uv", ua);
    g.setIndex(idx);
    const sx = cx.lo === Infinity ? 0 : (q >> 1 ? -cx.shift : cx.shift);
    const sy = cy.lo === Infinity ? 0 : (q & 1 ? -cy.shift : cy.shift);
    return [{ geometry: g, shift: [sx, sy] as [number, number] }];
  });
}

/** Moves a point of the source set to where it lands on the cut board (bulbs, lights). */
export function slide(info: SetInfo, w: number, h: number, p: [number, number, number]): [number, number, number] | null {
  const cx = cut(info.nx ?? info.n, w, info.S), cy = cut(info.ny ?? info.n, h, info.S);
  const one = (v: number, c: ReturnType<typeof cut>) => (c.lo === Infinity ? v : v < c.lo ? v + c.shift : v > c.hi ? v - c.shift : null);
  const x = one(p[0], cx), y = one(p[1], cy);
  return x === null || y === null ? null : [x, y, p[2]];
}

/** The locked play camera (stage.build_camera): 35 degrees down, 50 mm, looking +y, framed so the box
 * fills the frame the way the 5x5 hero shot does. Returns position and target in Blender axes and the
 * horizontal field of view. Tall narrow boxes (2x2) back off until the floor and back wall fit. */
export function playCamera(info: SetInfo, w: number, h: number, aspect: number) {
  const H = info.H, S = info.S, el = THREE.MathUtils.degToRad(info.camera.elevation), lens = info.camera.lens;
  const hfov = 2 * Math.atan(18 / lens);
  const fwd = new THREE.Vector3(0, Math.cos(el), -Math.sin(el));
  const at = (zoom: number) => {
    const visW = 2.7 * S / zoom, dist = lens * visW / 36;
    const target = new THREE.Vector3(0, info.camera.lookAhead * S / zoom, 0.42 * H);
    return { pos: target.clone().addScaledVector(fwd, -dist), target };
  };
  // the same zoom rule the bakes use: the hero 0.255 for 5 wide, scaled by the box's outer width
  let zoom = 0.255 * (5 + 1.24) / (Math.max(w, h) + 1.24);
  const X = (w + 1.24) * S / 2, Y = (h + 1.24) * S / 2, top = 4.42 * H;
  const pts = [[-X, -Y, -0.3 * H], [X, -Y, -0.3 * H], [-X, Y, 0], [X, Y, 0], [0, Y - 0.62 * S, top]].map(p => new THREE.Vector3(...p));
  const tanX = Math.tan(hfov / 2), tanY = tanX / aspect;
  for (let i = 0; i < 40; i++) {
    const { pos, target } = at(zoom);
    const z = target.clone().sub(pos).normalize(), x = new THREE.Vector3(1, 0, 0), y = new THREE.Vector3().crossVectors(x, z).negate();
    const fits = pts.every(p => {
      const v = p.clone().sub(pos), d = v.dot(z);
      return Math.abs(v.dot(x) / d) < tanX * 0.99 && Math.abs(v.dot(y) / d) < tanY * 0.99;
    });
    if (fits) break;
    zoom *= 0.97;
  }
  return { ...at(zoom), hfov, zoom };
}

/** The camera a set was baked from (its matrixWorld, lens and sensor), in the same shape as playCamera. A level
 * bake of a rectangle is seen from exactly there: its view is fitted to the whole box at bake time. */
export function bakeCamera(info: SetInfo) {
  const M = info.camera.matrixWorld;
  const pos = new THREE.Vector3(M[0][3], M[1][3], M[2][3]);
  const target = pos.clone().add(new THREE.Vector3(-M[0][2], -M[1][2], -M[2][2]).multiplyScalar(10));
  return { pos, target, hfov: 2 * Math.atan(info.camera.sensor / 2 / info.camera.lens), zoom: info.camera.zoom };
}

/** The view for a board: a rectangle's own bake camera, else the locked play camera. */
export const viewFor = (info: SetInfo, w: number, h: number, aspect: number) =>
  info.nx !== undefined && info.nx !== info.ny ? bakeCamera(info) : playCamera(info, w, h, aspect);

const cache = new Map<string, Promise<SetData>>();
/** Fetches a baked set's json and depth grid (textures load through three): `at` is its files without the
 * extension, a source set ("diorama/set5") or a level's own bake ("diorama/levels/<key>/set"). */
export function loadSetAt(at: string): Promise<SetData> {
  let p = cache.get(at);
  if (!p) {
    p = Promise.all([
      fetch(`${at}.json`).then(r => r.json() as Promise<SetInfo>),
      fetch(`${at}.depth`).then(r => r.arrayBuffer()),
    ]).then(([info, buf]) => ({ info, depth: new Uint16Array(buf), at }));
    cache.set(at, p);
  }
  return p;
}
export const loadSet = (n: number, base = "diorama/") => loadSetAt(`${base}set${n}`);
