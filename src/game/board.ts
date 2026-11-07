/** Pure board geometry shared by the rules (turns.ts) and the abilities under abilities/. It imports
 * nothing from either, so an ability file can use it without an import cycle. Everything here is a
 * function of the run; nothing mutates. */
import type { Encounter, Gate, Kind, Pos, Run, Side, Unit } from "./turns";
import { ENCOUNTERS, PUZZLES } from "./encounters";

export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
/** Chebyshev distance: 1 means the squares touch, diagonals included. */
export const gap = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const adjacent = (a: Pos, b: Pos) => gap(a, b) === 1;
/** The board this run is played on: a puzzle from the Guild, or the next battle on the road. */
export const boardOf = (g: Pick<Run, "encounter" | "puzzle">): Encounter => (g.puzzle !== undefined ? PUZZLES[g.puzzle] : ENCOUNTERS[g.encounter]);
export const coord = (g: Run, p: Pos) => "abcdefgh"[p.x] + (boardOf(g).height - p.y);
export const at = (g: Run, p: Pos) => g.units.find(u => same(u, p));
export const label = (u: Unit) => `${u.side === "white" ? "Your" : "Enemy"} ${u.kind}`;
export const onBoard = (g: Run, p: Pos) => { const e = boardOf(g); return p.x >= 0 && p.y >= 0 && p.x < e.width && p.y < e.height; };
const broken = (g: Run, p: Pos) => !!g.broken?.some(b => same(b, p));
/** The gate on this square, if any (a smashed gate is plain floor and no longer a gate). */
export const gateAt = (g: Run, p: Pos): Gate | undefined => (broken(g, p) ? undefined : boardOf(g).gates?.find(x => same(x.at, p)));
/** Is this gate standing open right now? Gate state lives on the run; `run.gatesOpen` lists the open ones. */
export const gateOpen = (g: Run, gate: Gate) => !!g.gatesOpen?.some(p => same(p, gate.at));
/** A wall stands here: one the encounter drew (unless Brick knocked it down), a shut gate, or one an
 * ability raised (Nobody's empty suit). Off-board squares are not walls. */
export const isWall = (g: Run, p: Pos) => {
  if (!onBoard(g, p)) return false;
  if (g.walls?.some(w => same(w, p))) return true;
  const gate = gateAt(g, p);
  if (gate) return !gateOpen(g, gate);
  return boardOf(g).walls.some(w => same(w, p)) && !broken(g, p);
};
/** A pit: one the encounter dug, or a crumbling tile that has fallen in this battle. Nothing stands here;
 * sliders stop before it, leapers pass over it, anything shoved onto it is lost. */
export const isHole = (g: Run, p: Pos) => !!boardOf(g).holes?.some(h => same(h, p)) || !!g.collapsed?.some(c => same(c, p));
/** A bridge tile that falls away the moment a piece leaves it. */
export const isCrumbling = (g: Run, p: Pos) => !!boardOf(g).crumbling?.some(c => same(c, p)) && !isHole(g, p);
export const isIce = (g: Run, p: Pos) => !!boardOf(g).ice?.some(c => same(c, p));
export const leverAt = (g: Run, p: Pos) => boardOf(g).levers?.find(l => same(l.at, p));
/** The other mouth of a burrow: a piece entering `p` comes out there. Undefined when `p` is no burrow. */
export const portalExit = (g: Run, p: Pos): Pos | undefined => {
  for (const [a, b] of boardOf(g).portals ?? []) { if (same(a, p)) return b; if (same(b, p)) return a; }
  return undefined;
};
/** On the board and a piece may stand here (it may be occupied): not a wall or a pit. A burrow's mouth
 * counts: a piece that came through stands on it (and blocks the tunnel while it does). */
export const passable = (g: Run, p: Pos) => onBoard(g, p) && !isWall(g, p) && !isHole(g, p);
/** Passable and empty. */
export const open = (g: Run, p: Pos) => passable(g, p) && !at(g, p);
/** A piece may be shoved here: on the board, not a wall, nobody on it. A pit counts (the piece falls in). */
export const shoveable = (g: Run, p: Pos) => onBoard(g, p) && !isWall(g, p) && !at(g, p);
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

/** Where a piece that moves onto `p` actually ends up: through a burrow to its exit, then, if it
 * arrived on ice with a direction, gliding on while the next square is ice and empty, stopping on the
 * first dry empty square or on the last ice square before anything else. Leapers pass no direction
 * and don't glide. Returns `p` itself when nothing carries the piece further. The result may be an
 * occupied square or a pit (callers check). */
export function landingOf(g: Run, p: Pos, dir?: [number, number]): Pos {
  let dest = portalExit(g, p) ?? p;
  if (!dir) return dest;
  while (isIce(g, dest)) {
    const next = { x: dest.x + dir[0], y: dest.y + dir[1] };
    if (!open(g, next)) break;
    dest = next;
    if (!isIce(g, dest)) break;
  }
  return dest;
}
/** The unit vector from `from` toward `to` when they share a rank, file or diagonal; otherwise undefined. */
export const dirOf = (from: Pos, to: Pos): [number, number] | undefined => {
  const dx = to.x - from.x, dy = to.y - from.y;
  if ((dx === 0 && dy === 0) || (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy))) return undefined;
  return [Math.sign(dx), Math.sign(dy)];
};
/** Puts unit `id` on `to` (a landing square from landingOf) and resolves what the board does about
 * it: the crumbling tile it left falls (and every crumbling tile a slide crossed), a lever it
 * stops on toggles its gates (a gate with a piece in it can't shut), and a pit swallows it (no
 * death hook: a fall leaves nothing). `from` is where it stood. Every move, shove and roll-on goes
 * through here so tiles behave the same for all of them. */
export function settle(g: Run, id: string, to: Pos, from: Pos): Run {
  const u = g.units.find(x => x.id === id);
  if (!u) return g;
  let run: Run = { ...g, units: g.units.map(x => (x.id === id ? { ...x, x: to.x, y: to.y } : x)) };
  // Collapse the tiles left behind: the origin and, on a slide, every crumbling square crossed.
  const left: Pos[] = [{ x: from.x, y: from.y }];
  const dir = dirOf(from, to);
  if (dir) for (let p = { x: from.x + dir[0], y: from.y + dir[1] }; !same(p, to) && onBoard(g, p); p = { x: p.x + dir[0], y: p.y + dir[1] }) left.push(p);
  const falling = left.filter(p => isCrumbling(run, p) && !at(run, p));
  if (falling.length) run = note({ ...run, collapsed: [...(run.collapsed ?? []), ...falling] }, falling.length === 1 ? `The tile at ${coord(g, falling[0])} crumbles away.` : `The tiles at ${falling.map(p => coord(g, p)).join(", ")} crumble away.`);
  if (isHole(run, to)) return note({ ...run, units: run.units.filter(x => x.id !== id) }, `${label(u)} falls into the pit at ${coord(g, to)}!`);
  const lever = leverAt(run, to);
  if (lever) {
    let opened = run.gatesOpen ?? [];
    const gates = (boardOf(run).gates ?? []).filter(x => x.group === lever.group && gateAt(run, x.at));
    for (const gate of gates) {
      if (gateOpen(run, gate)) { if (!at(run, gate.at)) opened = opened.filter(p => !same(p, gate.at)); }
      else opened = [...opened, gate.at];
    }
    run = note({ ...run, gatesOpen: opened }, `${label(u)} pulls the lever at ${coord(g, to)}.`);
  }
  return run;
}

export const withUnit = (g: Run, id: string, patch: Partial<Unit>) => g.units.map(u => (u.id === id ? { ...u, ...patch } : u));
/** Adds a line to the battle log (newest first, capped) and the run's full history. */
export const note = (g: Run, text: string): Run => ({ ...g, log: [text, ...g.log].slice(0, 30), history: [...g.history, text] });
