// Walls on the board (Wesley 2026-11-21): a wall is a thin, low stone wall through the middle of its square (solid
// blocks "look more like short mounds"), and walls next to each other join up into one wall. Its look is style B,
// a ruined castle wall (2026-11-22): two 3D pieces, a short straight stretch and a pillar (pack_wall.py). Thin and about half a
// figure tall, it leaves a piece on the square behind it in view, so walls don't fade (dropped 2026-11-21).

/** Wall height as a share of the set's figure height H (the king is about 1 H). */
export const WALL_H = 0.45;

type At = { x: number; y: number };
const BLOCKS = new Set(["wall", "eye"]);

/** The pieces (tools/art/diorama/pack_wall.py): unit boxes standing on the floor, y up, front facing +z. The
 *  stretch runs along x and fills a square; the half is its left half (the cut end at +x), for runs that meet a
 *  pillar in the middle of the square. */
export const WALL_SEG_GLB = "diorama/wall-seg.glb";
export const WALL_HALF_GLB = "diorama/wall-half.glb";
export const WALL_PIL_GLB = "diorama/wall-pil.glb";
/** Wall thickness, as a share of a square. */
export const WALL_T = 0.2;
/** Pillar width (a share of a square) and height (a share of the wall's). */
export const PILLAR_W = 0.3, PILLAR_H = 1.3;
/** Which way a wall's square runs out from its middle: l/r along the row, b = away from the camera (board y - 1),
 *  f = toward the camera (board y + 1). `open` lists the runs that stop at the square's edge without meeting a wall
 *  or the frame (a lone wall's two ends): they end in a pillar. */
export type Arms = { l: boolean; r: boolean; b: boolean; f: boolean; open?: Side[] };
type Side = "l" | "r" | "b" | "f";
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
    const a: Arms = { l: links(q.x - 1, q.y), r: links(q.x + 1, q.y), b: links(q.x, q.y - 1), f: links(q.x, q.y + 1) };
    if (a.r && q.x === 0) a.l = true;
    if (a.l && q.x === w - 1) a.r = true;
    if (a.f && q.y === 0) a.b = true;
    if (a.b && q.y === h - 1) a.f = true;
    if (!a.l && !a.r && !a.b && !a.f) {
      a.l = a.r = true;
      a.open = (["l", "r"] as Side[]).filter(s => s === "l" ? q.x > 0 : q.x < w - 1);
    }
    out.set(`${q.x},${q.y}`, a);
  }
  return out;
}

/** One piece of a wall: where it stands in its square (x right, y away from the camera, in squares), how it turns
 *  (0: the stretch runs left to right; PI/2: front to back) and whether it is mirrored, for variety. */
export type WallPiece = { kind: "seg" | "half" | "pil"; x: number; y: number; turn: number; mirror: boolean };

/** A small seeded random (mulberry32), so a wall looks the same every time it is drawn. */
function rand(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The pieces of one wall square: a straight run is one whole stretch across the square; where the wall ends, turns
 *  or branches, a pillar stands in the middle with a half stretch out to each side it runs to (the cut end at the
 *  pillar); and a pillar stands at each open end. */
export function wallPieces(a: Arms, seed: number): WallPiece[] {
  const r = rand(seed), out: WallPiece[] = [];
  const across = a.l && a.r && !a.b && !a.f, along = a.b && a.f && !a.l && !a.r;
  if (across || along) out.push({ kind: "seg", x: 0, y: 0, turn: along ? Math.PI / 2 : 0, mirror: r() < 0.5 });
  else {
    // a half's cut end is at its +x: mirror the halves that run right or back so it lands on the pillar
    if (a.l) out.push({ kind: "half", x: -0.25, y: 0, turn: 0, mirror: false });
    if (a.r) out.push({ kind: "half", x: 0.25, y: 0, turn: 0, mirror: true });
    if (a.b) out.push({ kind: "half", x: 0, y: 0.25, turn: Math.PI / 2, mirror: true });
    if (a.f) out.push({ kind: "half", x: 0, y: -0.25, turn: Math.PI / 2, mirror: false });
    out.push({ kind: "pil", x: 0, y: 0, turn: 0, mirror: false });
  }
  const e = 0.5 - PILLAR_W / 2;
  for (const s of a.open ?? []) out.push({ kind: "pil", x: s === "l" ? -e : s === "r" ? e : 0, y: s === "b" ? e : s === "f" ? -e : 0, turn: 0, mirror: false });
  return out;
}
