// Levels baked on save (tools/art/diorama/bake_level.sh): any board gets its own Cycles set and its own
// trapdoor drops, built from the kit for exactly that layout. A bake is named by its layout's key, a hash of
// the board size and the squares the bake draws (never the pieces), so the same layout is never baked twice
// and a level whose squares change simply has no bake until it is baked again. Until then the game shows the
// cut 3/5/8 set (set.ts) with stand-ins: the preview.
import type { Pos, Puzzle } from "../puzzle/engine";

/** Square kinds a bake draws into the set. */
export const BAKED_KINDS = ["hole", "wall", "eye", "sludge", "trapdoor", "snare", "gate", "lever", "plate"] as const;
export type BakedKind = (typeof BAKED_KINDS)[number];

export type Layout = { w: number; h: number; cells: [number, number, BakedKind][] };

function layout(w: number, h: number, cells: [number, number, string][]): Layout {
  const out: [number, number, BakedKind][] = [];
  for (const [x, y, k] of cells) {
    if ((BAKED_KINDS as readonly string[]).includes(k)) out.push([x, y, k as BakedKind]);
  }
  out.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2].localeCompare(b[2]));
  return { w, h, cells: out };
}

/** The layout of a puzzle as written in puzzles.json: what it starts with (sludge a switch floods in later
 * is drawn live), so the key stays the same all through play. */
export function layoutOfPuzzle(pz: Puzzle): Layout {
  const c: [number, number, string][] = [];
  const add = (ps: Pos[] | undefined, k: string) => ps?.forEach(p => c.push([p.x, p.y, k]));
  add(pz.holes, "hole"); add(pz.walls, "wall"); add(pz.eyes, "eye"); add(pz.sludge, "sludge");
  add(pz.trapdoors, "trapdoor"); add(pz.snares, "snare"); add(pz.gates, "gate");
  pz.switches?.forEach(s => c.push([s.x, s.y, s.kind]));
  return layout(pz.width, pz.height, c);
}

/** FNV-1a over the layout written out in a fixed order: 8 hex digits. */
export function layoutKey(l: Layout): string {
  const s = `${l.w}x${l.h}|` + l.cells.map(c => c.join(",")).join(";");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

/** One baked level as levels/index.json lists it. A board past one view also has its panning stops (pan.ts):
 * the window each shows, where each centres, and for each trapdoor (in `trapdoors` order) the stops that baked it;
 * the same for its snares. */
export type LevelBake = { w: number; h: number; trapdoors: [number, number][]; snares?: [number, number][]; window?: [number, number]; stops?: [number, number][]; trapStops?: number[][]; snareStops?: number[][] };
export type BakeIndex = Record<string, LevelBake>;

/** Where a bake's files live, under the diorama folder. */
export const bakeDir = (key: string) => `levels/${key}/`;
/** A baked trapdoor's sheet name (TrapdoorSprite loads `${name}-drop.json` and its pictures); `stop`: the panning
 * stop it was baked from, on a level that pans. */
export const bakedTrap = (key: string, x: number, y: number, stop: number | null = null) =>
  `${bakeDir(key)}trap-${x}-${y}${stop === null ? "" : `-s${stop}`}`;
/** A baked snare's sheet name (SnareSprite loads `${name}-spring.json`, `${name}-front.json` and their pictures). */
export const bakedSnare = (key: string, x: number, y: number, stop: number | null = null) =>
  `${bakeDir(key)}snare-${x}-${y}${stop === null ? "" : `-s${stop}`}`;
/** A panning level's set as seen from stop `k` (set.ts loadSetAt). */
export const stopSet = (key: string, k: number) => `${bakeDir(key)}set-s${k}`;

/** The bake for this layout, if there is one; null means preview (cut set, stand-ins). */
export function bakeFor(index: BakeIndex, l: Layout): { key: string; bake: LevelBake } | null {
  const key = layoutKey(l), bake = index[key];
  return bake && bake.w === l.w && bake.h === l.h ? { key, bake } : null;
}

let indexP: Promise<BakeIndex> | null = null;
/** levels/index.json; an empty list if it is missing or isn't a list (a dev server answers a missing file with
 * its index.html, and a 3D view that throws on that falls back to 2D for every puzzle). */
export function loadBakeIndex(base: string): Promise<BakeIndex> {
  return indexP ??= fetch(`${base}levels/index.json`)
    .then(r => (r.ok ? r.json() : {}))
    .then(j => (j && typeof j === "object" && !Array.isArray(j) ? j : {}), () => ({})) as Promise<BakeIndex>;
}
/** Forget the cached list (tests). */
export const resetBakeIndex = () => { indexP = null; };

/** Biggest board the cut 3/5/8 sets can preview; past it only a level's own bake can draw it. */
export const PREVIEW_MAX = 8;
/** A board past the preview's reach with no bake yet: the 3D view asks for a bake instead of drawing a box
 * that doesn't fit. null while the list is loading. */
export function needsBake(index: BakeIndex | null, l: Layout): boolean | null {
  if (Math.max(l.w, l.h) <= PREVIEW_MAX) return false;
  return index ? !bakeFor(index, l) : null;
}
