/** Pure board geometry shared by the rules (turns.ts) and the abilities under abilities/. It imports
 * nothing from either, so an ability file can use it without an import cycle. Everything here is a
 * function of the run; nothing mutates. */
import type { Kind, Pos, Run, Side, Unit } from "./turns";
import { ENCOUNTERS } from "./encounters";

export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
/** Chebyshev distance: 1 means the squares touch, diagonals included. */
export const gap = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const adjacent = (a: Pos, b: Pos) => gap(a, b) === 1;
export const boardOf = (g: Pick<Run, "encounter">) => ENCOUNTERS[g.encounter];
export const coord = (g: Run, p: Pos) => "abcdefgh"[p.x] + (boardOf(g).height - p.y);
export const at = (g: Run, p: Pos) => g.units.find(u => same(u, p));
export const label = (u: Unit) => `${u.side === "white" ? "Your" : "Enemy"} ${u.kind}`;
export const onBoard = (g: Run, p: Pos) => { const e = boardOf(g); return p.x >= 0 && p.y >= 0 && p.x < e.width && p.y < e.height; };
/** A wall stands here: one the encounter drew (unless Brick knocked it down) or one an ability raised
 * (Nobody's empty suit). Off-board squares are not walls. */
export const isWall = (g: Run, p: Pos) => onBoard(g, p) && (!!g.walls?.some(w => same(w, p)) || boardOf(g).walls.some(w => same(w, p) && !g.broken?.some(b => same(b, p))));
/** On the board and not a wall: a piece may stand here (it may be occupied). */
export const passable = (g: Run, p: Pos) => onBoard(g, p) && !isWall(g, p);
/** Passable and empty. */
export const open = (g: Run, p: Pos) => passable(g, p) && !at(g, p);
export const forward = (u: Pick<Unit, "side">) => (u.side === "white" ? -1 : 1);
export const lastRank = (g: Run, u: Pick<Unit, "side">) => (u.side === "white" ? 0 : boardOf(g).height - 1);
export const energyOf = (g: Run, side: Side) => (side === "white" ? g.energy : boardOf(g).enemyEnergy);

export const DIAGONALS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
export const STRAIGHTS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const LEAPS: [number, number][] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
export const slides = (k: Kind): [number, number][] | null => (k === "rook" ? STRAIGHTS : k === "bishop" ? DIAGONALS : k === "queen" ? [...STRAIGHTS, ...DIAGONALS] : null);
export const neighbours = (p: Pos) => [...STRAIGHTS, ...DIAGONALS].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }));
export const straightNeighbours = (p: Pos) => STRAIGHTS.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }));

/** Could a piece of u's kind, standing on `from`, strike `target`? Strikes reach one step in the
 * piece's capture shape (a pawn's forward diagonals, a knight's jump). This is the kind's answer;
 * turns.ts's `reaches` lets the piece's ability override it. */
export function shapeReaches(u: Pick<Unit, "kind" | "side">, from: Pos, target: Pos): boolean {
  const dx = target.x - from.x, dy = target.y - from.y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (u.kind === "pawn") return ax === 1 && dy === forward(u);
  if (u.kind === "knight") return ax * ay === 2;
  if (Math.max(ax, ay) !== 1) return false;
  const diagonal = ax === 1 && ay === 1;
  return u.kind === "rook" ? !diagonal : u.kind === "bishop" ? diagonal : true;
}
/** The first piece along a ray from `from` (exclusive) in direction (dx, dy), stopping at walls and
 * the board edge. Undefined when the ray runs out. */
export function firstAlong(g: Run, from: Pos, dx: number, dy: number): Unit | undefined {
  for (let p = { x: from.x + dx, y: from.y + dy }; passable(g, p); p = { x: p.x + dx, y: p.y + dy }) {
    const u = at(g, p);
    if (u) return u;
  }
  return undefined;
}

export const withUnit = (g: Run, id: string, patch: Partial<Unit>) => g.units.map(u => (u.id === id ? { ...u, ...patch } : u));
/** Adds a line to the battle log (newest first, capped) and the run's full history. */
export const note = (g: Run, text: string): Run => ({ ...g, log: [text, ...g.log].slice(0, 30), history: [...g.history, text] });
