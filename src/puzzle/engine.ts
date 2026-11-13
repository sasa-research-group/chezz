/** Dungeon puzzles on chess rules. Every piece has one life: a capture removes it, as in chess.
 * The player (white, bottom) moves first and must reach the puzzle's goal within its move limit;
 * the dungeon (black) always answers with its best move (`solve.ts`).
 * Pure and deterministic: no DOM, no randomness, no mutating inputs. Rules: `docs/puzzles.md`. */

export type Side = "white" | "black";
/** The chess six, plus the peasant: steps one square any way, never captures, must not be lost. */
export type PKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn" | "peasant";
export type Pos = { x: number; y: number };
/** A piece as a puzzle file lists it: kind, side, file (x), rank row (y, 0 = top). */
export type PieceDef = [PKind, Side, number, number];

/** What the player must do. Checkmate always wins, whatever the goal. */
export type Goal =
  | { type: "mate" }
  /** Capture this many enemy pieces. */
  | { type: "capture"; count: number }
  /** Capture this much material (pawn 1, knight 3, bishop 3, rook 5, queen 9). */
  | { type: "material"; points: number }
  /** Get every peasant onto an exit square; a peasant that arrives leaves the board, safe. */
  | { type: "escort"; exits: Pos[] }
  /** Get any one of your pieces (or only `kind`) onto one of these squares. */
  | { type: "reach"; squares: Pos[]; kind?: PKind }
  /** Still standing (king and peasants) when the dungeon has made its last reply. */
  | { type: "survive" };
export type GoalType = Goal["type"];

export type Puzzle = {
  name?: string;
  /** Designer's note; the game doesn't show it. */
  note?: string;
  width: number;
  height: number;
  /** Squares that aren't part of the board: nothing stands on them, nothing slides across them. */
  holes: Pos[];
  /** Solid blocks on the board: nothing stands on them or slides past them; knights leap over. */
  walls: Pos[];
  pieces: PieceDef[];
  goal: Goal;
  /** Most moves the player may make. */
  moves: number;
};

export type Piece = Pos & { kind: PKind; side: Side };
export type State = {
  pieces: Piece[];
  turn: Side;
  /** Moves the player has made. */
  played: number;
  /** Enemy pieces captured, and their material. */
  taken: number;
  material: number;
  /** Peasants that reached an exit. */
  saved: number;
  /** A white king or peasant was lost. */
  lost: boolean;
};
export type Move = { from: Pos; to: Pos; promo?: PKind };
export type Outcome = "win" | "lose" | null;

export const VALUE: Record<PKind, number> = { king: 0, queen: 9, rook: 5, bishop: 3, knight: 3, pawn: 1, peasant: 0 };
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK = AROUND.slice(0, 4), BISHOP = AROUND.slice(4);

export const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
export const other = (s: Side): Side => (s === "white" ? "black" : "white");
const has = (list: Pos[], p: Pos) => list.some(q => same(q, p));

/** The board's fixed geometry, looked up per square. */
export type Board = { width: number; height: number; open: boolean[] };
export function boardOf(p: Puzzle): Board {
  const open = Array.from({ length: p.width * p.height }, (_, i) => {
    const q = { x: i % p.width, y: Math.floor(i / p.width) };
    return !has(p.holes, q) && !has(p.walls, q);
  });
  return { width: p.width, height: p.height, open };
}
const isOpen = (b: Board, x: number, y: number) => x >= 0 && y >= 0 && x < b.width && y < b.height && b.open[y * b.width + x];

export function start(p: Puzzle): State {
  return { pieces: p.pieces.map(([kind, side, x, y]) => ({ kind, side, x, y })), turn: "white", played: 0, taken: 0, material: 0, saved: 0, lost: false };
}
export const pieceAt = (s: State, p: Pos) => s.pieces.find(q => same(q, p));

/** Squares a piece attacks or could move to, ignoring check. Pawns: forward moves and diagonal captures. */
function reach(b: Board, s: State, pc: Piece, capturesOnly = false): Pos[] {
  const out: Pos[] = [];
  const at = (x: number, y: number) => s.pieces.find(q => q.x === x && q.y === y);
  const add = (x: number, y: number, mayCapture = true, mayMove = true) => {
    if (!isOpen(b, x, y)) return false;
    const there = at(x, y);
    if (!there) { if (mayMove) out.push({ x, y }); return true; }
    if (mayCapture && there.side !== pc.side) out.push({ x, y });
    return false;
  };
  const slide = (dirs: number[][]) => { for (const [dx, dy] of dirs) for (let n = 1; add(pc.x + dx * n, pc.y + dy * n); n++); };
  switch (pc.kind) {
    case "queen": slide(AROUND); break;
    case "rook": slide(ROOK); break;
    case "bishop": slide(BISHOP); break;
    case "knight": for (const [dx, dy] of KNIGHT) add(pc.x + dx, pc.y + dy); break;
    case "king": for (const [dx, dy] of AROUND) add(pc.x + dx, pc.y + dy); break;
    case "peasant": if (!capturesOnly) for (const [dx, dy] of AROUND) add(pc.x + dx, pc.y + dy, false); break;
    case "pawn": {
      const dy = pc.side === "white" ? -1 : 1;
      if (!capturesOnly) add(pc.x, pc.y + dy, false);
      for (const dx of [-1, 1]) {
        if (capturesOnly) { if (isOpen(b, pc.x + dx, pc.y + dy)) out.push({ x: pc.x + dx, y: pc.y + dy }); }
        else { const t = at(pc.x + dx, pc.y + dy); if (t && t.side !== pc.side && isOpen(b, t.x, t.y)) out.push({ x: t.x, y: t.y }); }
      }
    }
  }
  return out;
}

export function attacked(b: Board, s: State, p: Pos, by: Side): boolean {
  return s.pieces.some(q => q.side === by && reach(b, s, q, true).some(t => same(t, p)));
}
export function inCheck(b: Board, s: State, side: Side): boolean {
  const king = s.pieces.find(q => q.kind === "king" && q.side === side);
  return !!king && attacked(b, s, king, other(side));
}

/** Moves the piece on `p` may legally make: it can't leave its own king in check. */
export function movesFrom(pz: Puzzle, b: Board, s: State, p: Pos): Move[] {
  const pc = pieceAt(s, p);
  if (!pc || pc.side !== s.turn) return [];
  const last = pc.side === "white" ? 0 : b.height - 1;
  return reach(b, s, pc)
    .map(to => ({ from: { x: pc.x, y: pc.y }, to, ...(pc.kind === "pawn" && to.y === last ? { promo: "queen" as const } : {}) }))
    .filter(m => !inCheck(b, apply(pz, s, m), pc.side));
}
export function legalMoves(pz: Puzzle, b: Board, s: State): Move[] {
  return s.pieces.filter(q => q.side === s.turn).flatMap(q => movesFrom(pz, b, s, q));
}

/** Plays a move and hands the turn over. Doesn't check legality. */
export function apply(pz: Puzzle, s: State, m: Move): State {
  const mover = pieceAt(s, m.from)!;
  const victim = pieceAt(s, m.to);
  let pieces = s.pieces.filter(q => q !== victim && q !== mover);
  let { taken, material, saved, lost } = s;
  if (victim) {
    if (victim.side === "black") { taken++; material += VALUE[victim.kind]; }
    else if (victim.kind === "king" || victim.kind === "peasant") lost = true;
  }
  const moved: Piece = { ...mover, x: m.to.x, y: m.to.y, kind: m.promo ?? mover.kind };
  const exits = pz.goal.type === "escort" ? pz.goal.exits : [];
  if (moved.kind === "peasant" && moved.side === "white" && has(exits, moved)) saved++;
  else pieces = [...pieces, moved];
  return { pieces, turn: other(s.turn), played: s.played + (s.turn === "white" ? 1 : 0), taken, material, saved, lost };
}
/** The side to move has nothing to do: the turn passes (only when it has no king; with a king it's mate or stalemate). */
export const pass = (s: State): State => ({ ...s, turn: other(s.turn), played: s.played + (s.turn === "white" ? 1 : 0) });

const peasants = (pz: Puzzle) => pz.pieces.filter(p => p[1] === "white" && p[0] === "peasant").length;

/** Has the goal itself been met? (Checkmate is separate; see `outcome`.) */
export function goalMet(pz: Puzzle, s: State): boolean {
  const g = pz.goal;
  switch (g.type) {
    case "mate": return false;
    case "capture": return s.taken >= g.count;
    case "material": return s.material >= g.points;
    case "escort": return s.saved >= peasants(pz);
    case "reach": return s.pieces.some(q => q.side === "white" && (!g.kind || q.kind === g.kind) && has(g.squares, q));
    case "survive": return false;
  }
}

/** Win, loss, or play on. Checked whenever a move has been made (and at the start). */
export function outcome(pz: Puzzle, b: Board, s: State): Outcome {
  if (s.lost) return "lose";
  if (goalMet(pz, s)) return "win";
  const stuck = legalMoves(pz, b, s).length === 0;
  const hasKing = s.pieces.some(q => q.kind === "king" && q.side === s.turn);
  if (s.turn === "black") {
    if (stuck && hasKing) return inCheck(b, s, "black") ? "win" : "lose"; // mate, or stalemate (a draw is a fail)
    return null;
  }
  // White to move: the dungeon has just replied.
  if (pz.goal.type === "survive" && s.played >= pz.moves) return "win";
  if (s.played >= pz.moves) return "lose";
  if (stuck && hasKing) return "lose";
  return null;
}

/** Algebraic name of a square: files a–h left to right, ranks counted up from the bottom. */
export const squareName = (pz: Pick<Puzzle, "height">, p: Pos) => `${"abcdefgh"[p.x] ?? "?"}${pz.height - p.y}`;
const LETTER: Record<PKind, string> = { king: "K", queen: "Q", rook: "R", bishop: "B", knight: "N", pawn: "", peasant: "P" };
export function moveName(pz: Puzzle, s: State, m: Move): string {
  const pc = pieceAt(s, m.from), cap = pieceAt(s, m.to);
  if (!pc) return "?";
  const from = pc.kind === "pawn" && cap ? squareName(pz, m.from)[0] : "";
  return `${LETTER[pc.kind]}${from}${cap ? "x" : ""}${squareName(pz, m.to)}${m.promo ? "=Q" : ""}`;
}
/** A compact key for a position (who's where, whose turn, progress), for the solver's memo. */
export function keyOf(s: State): string {
  const ps = s.pieces.map(q => `${q.kind[0]}${q.kind === "king" ? "K" : ""}${q.side[0]}${q.x}${q.y}`).sort().join("");
  return `${s.turn[0]}${s.taken},${s.material},${s.saved},${s.lost ? 1 : 0}|${ps}`;
}
