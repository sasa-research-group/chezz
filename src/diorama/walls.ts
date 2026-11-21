// Walls on the board (Wesley 2026-11-21): a wall is a thin, low stone wall through the middle of its square (solid
// blocks "look more like short mounds"), and walls next to each other join up into one wall. Thin and about half a
// figure tall, it leaves a piece on the square behind it in view, so walls don't fade (dropped 2026-11-21).

/** Wall height as a share of the set's figure height H (the king is about 1 H). */
export const WALL_H = 0.45;

type At = { x: number; y: number };
const BLOCKS = new Set(["wall", "eye"]);

/** Wall thickness, as a share of a square. */
export const WALL_T = 0.2;
/** Which way a wall's square runs out from its middle: l/r along the row, b = away from the camera (board y - 1),
 *  f = toward the camera (board y + 1). */
export type Arms = { l: boolean; r: boolean; b: boolean; f: boolean };
/** Squares a wall joins up with: walls, eyes and gates (a gate is the doorway in a wall). */
const LINKS = new Set(["wall", "eye", "gate", "gate-open"]);

/** How each wall square ("x,y") runs: toward every wall, eye or gate next to it. A wall that reaches the board's edge
 *  on one side runs into the frame; a wall with nothing next to it runs across its square, left to right. */
export function wallArms(squares: (At & { kind?: string })[], w: number, h: number): Map<string, Arms> {
  const kind = new Map(squares.map(q => [`${q.x},${q.y}`, q.kind]));
  const links = (x: number, y: number) => LINKS.has(kind.get(`${x},${y}`) ?? "");
  const out = new Map<string, Arms>();
  for (const q of squares) {
    if (!q.kind || !BLOCKS.has(q.kind)) continue;
    const a = { l: links(q.x - 1, q.y), r: links(q.x + 1, q.y), b: links(q.x, q.y - 1), f: links(q.x, q.y + 1) };
    if (a.r && q.x === 0) a.l = true;
    if (a.l && q.x === w - 1) a.r = true;
    if (a.f && q.y === 0) a.b = true;
    if (a.b && q.y === h - 1) a.f = true;
    if (!a.l && !a.r && !a.b && !a.f) a.l = a.r = true;
    out.set(`${q.x},${q.y}`, a);
  }
  return out;
}

/** One stone of a wall: centre and size, x/y in squares (x right, y away from the camera), z in wall heights;
 *  tone is a brightness for the stone; moss marks the cap on top. */
export type Brick = { x: number; y: number; z: number; sx: number; sy: number; sz: number; tone: number; moss?: boolean };

/** A small seeded random (mulberry32), so a wall looks the same every time it is drawn. */
function rand(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const COURSES = 3, BRICK = 0.25, GAP = 0.014, MOSS = 0.12;

/** The stones of one wall square: courses of staggered stones along each run, a squared pier where the wall turns,
 *  branches or ends, and a cap of moss on top. */
export function wallBricks(a: Arms, seed: number): Brick[] {
  const r = rand(seed), out: Brick[] = [];
  const pier = !((a.l && a.r && !a.b && !a.f) || (a.b && a.f && !a.l && !a.r));
  const course = (1 - MOSS) / COURSES;
  // a run along x (or y) from lo to hi, cut into stones on a grid that lines up across squares
  const run = (lo: number, hi: number, alongX: boolean) => {
    if (hi - lo < 1e-6) return;
    for (let c = 0; c < COURSES; c++) {
      const off = (c % 2) * BRICK / 2, cuts = [lo];
      for (let k = Math.ceil((lo - off) / BRICK + 1e-6); off + k * BRICK < hi - 1e-6; k++) cuts.push(off + k * BRICK);
      cuts.push(hi);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const len = cuts[i + 1] - cuts[i] - GAP, mid = (cuts[i] + cuts[i + 1]) / 2;
        if (len < 0.03) continue;
        const t = WALL_T * (0.92 + 0.12 * r()), sz = course * (0.86 + 0.08 * r()), z = (c + 0.5) * course;
        const b = { z, sz, tone: 0.7 + 0.6 * r(), x: 0, y: 0, sx: 0, sy: 0 };
        out.push(alongX ? { ...b, x: mid, sx: len, sy: t } : { ...b, y: mid, sx: t, sy: len });
      }
    }
    const m = { z: 1 - MOSS / 2, sz: MOSS, tone: 0.85 + 0.3 * r(), moss: true };
    out.push(alongX ? { ...m, x: (lo + hi) / 2, y: 0, sx: hi - lo, sy: WALL_T * 1.12 } : { ...m, x: 0, y: (lo + hi) / 2, sx: WALL_T * 1.12, sy: hi - lo });
  };
  const P = pier ? WALL_T * 0.7 : 0; // runs stop at the pier's face
  if (a.l && a.r && !pier) run(-0.5, 0.5, true);
  else { if (a.l) run(-0.5, -P, true); if (a.r) run(P, 0.5, true); }
  if (a.b) run(P, 0.5, false);
  if (a.f) run(-0.5, -P, false);
  if (pier) {
    const pc = (1.08 - MOSS) / COURSES;
    for (let c = 0; c < COURSES; c++) out.push({ x: 0, y: 0, z: (c + 0.5) * pc, sx: 2 * P * (0.95 + 0.06 * r()), sy: 2 * P * (0.95 + 0.06 * r()), sz: pc * 0.9, tone: 0.75 + 0.3 * r() });
    out.push({ x: 0, y: 0, z: 1.08 - MOSS / 2, sx: 2 * P * 1.1, sy: 2 * P * 1.1, sz: MOSS, tone: 0.85 + 0.3 * r(), moss: true });
  }
  return out;
}
