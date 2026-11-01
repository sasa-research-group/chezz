/** Pure helpers for the studio's Rig area (RigStudio.tsx): reading rig groups
 * out of CSS selectors, resolving pivots and chaining them into bones. No DOM. */

export type Pt = { x: number; y: number };
/** A 2D affine matrix in DOMMatrix order: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = { a: number; b: number; c: number; d: number; e: number; f: number };
export type Box = { x: number; y: number; width: number; height: number };

export const apply = (m: Mat, p: Pt): Pt => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
export const corners = (b: Box): Pt[] => [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }];

/** Groups that only fade or pop an effect in; listed in the table but not bones. */
const FX = /^(fx-|mouth-)|^(sweat|ko-eyes|rig-shadow|bandage)$/;
export const isFx = (name: string) => FX.test(name);

/** Splits a selector list on its top-level commas. */
export function splitList(selectorText: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of selectorText) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Splits a selector into descendant compounds; null for anything but plain descendant chains. */
export function compounds(selector: string): string[] | null {
  const s = selector.trim();
  if (/[>+~]/.test(s.replace(/\[[^\]]*\]|\([^)]*\)/g, ""))) return null;
  return s.split(/\s+(?![^(\[]*[)\]])/).filter(Boolean);
}
/** The plain class names in a compound selector, ignoring anything inside :not() or [..]. */
export const classesOf = (compound: string) => [...compound.replace(/\([^)]*\)|\[[^\]]*\]/g, "").matchAll(/\.([\w-]+)/g)].map(m => m[1]);

/** For a `.rig …` selector, the classes of the element it styles; "rig" when it styles the root. */
export function targetClasses(selector: string): string[] | null {
  const parts = compounds(selector);
  if (!parts || !classesOf(parts[0]).includes("rig")) return null;
  return parts.length === 1 ? ["rig"] : classesOf(parts[parts.length - 1]);
}

/** The first of an element's classes that names a rig group. */
export const groupName = (classList: string[], groups: Set<string>) => classList.find(c => groups.has(c));

/** Where a computed `transform-origin` puts the pivot, in the element's parent space.
 * `fill-box` origins are offsets from the element's own bounding box. */
export function parsePivot(origin: string, transformBox: string, bbox: Box): Pt {
  const [ox = 0, oy = 0] = origin.split(/\s+/).map(v => parseFloat(v) || 0);
  return transformBox === "fill-box" ? { x: bbox.x + ox, y: bbox.y + oy } : { x: ox, y: oy };
}

/** SVG's default origin: the group sets no pivot of its own in this take. */
export const unsetPivot = (origin: string, transformBox: string) => transformBox !== "fill-box" && origin.split(/\s+/).every(v => parseFloat(v) === 0);

/** One rig group sampled at a frame. `parentM` maps its parent's space (where the pivot
 * lives) to the overlay; `m` maps its own space (where `bbox` lives) to the overlay. */
export type Sample = { id: string; name: string; parent: string | null; pivot: Pt; parentM: Mat; m: Mat; bbox: Box; hidden?: boolean; unset?: boolean };
export type Joint = { id: string; name: string; at: Pt; hidden?: boolean };
export type Link = { from: string; to: string; a: Pt; b: Pt };
export type Skeleton = { joints: Joint[]; links: Link[]; boxes: { id: string; pts: Pt[] }[] };

/** Joints at each pivot, a link from every group's parent pivot to its own, and each
 * group's box carried through its transforms. Groups whose parent is missing are roots. */
export function chain(all: Sample[]): Skeleton {
  const samples = all.filter(s => !s.unset);
  const joints = samples.map(s => ({ id: s.id, name: s.name, at: apply(s.parentM, s.pivot), hidden: s.hidden }));
  const at = new Map(joints.map(j => [j.id, j.at]));
  const links = samples.flatMap(s => s.parent && at.has(s.parent) ? [{ from: s.parent, to: s.id, a: at.get(s.parent)!, b: at.get(s.id)! }] : []);
  const boxes = all.filter(s => !s.hidden && s.bbox.width + s.bbox.height > 0).map(s => ({ id: s.id, pts: corners(s.bbox).map(p => apply(s.m, p)) }));
  return { joints, links, boxes };
}

/** Joints closer than `tol` share one label, so stacked pivots (flip, hop, squash) read as one. */
export function labelStacks(joints: Joint[], tol = 1.5): { at: Pt; names: string[] }[] {
  const stacks: { at: Pt; names: string[] }[] = [];
  for (const j of joints) {
    if (j.hidden) continue;
    const s = stacks.find(s => Math.hypot(s.at.x - j.at.x, s.at.y - j.at.y) < tol);
    if (s) { if (!s.names.includes(j.name)) s.names.push(j.name); } else stacks.push({ at: j.at, names: [j.name] });
  }
  return stacks;
}

/** The length of one take: the last finite animation's end, or for loops only, the longest cycle. */
export function takeLength(timings: { delay: number; duration: number; iterations: number }[]): number {
  const ends = timings.filter(t => Number.isFinite(t.iterations)).map(t => t.delay + t.duration * t.iterations);
  const len = ends.length ? Math.max(...ends) : Math.max(0, ...timings.map(t => Math.max(0, t.delay) + t.duration));
  return Math.round(len) || 1000;
}
