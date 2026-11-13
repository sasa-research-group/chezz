/** Dungeon puzzles on chess rules. Every piece has one life: a capture removes it, as in chess.
 * The player (white, bottom) moves first and must reach the puzzle's goal within its move limit;
 * the dungeon (black) always answers with its best move (`solve.ts`).
 * Pure and deterministic: no DOM, no randomness, no mutating inputs. Rules: `docs/puzzles.md`. */

export type Side = "white" | "black";
/** The chess six, plus the peasant: steps one square any way, never captures, must not be lost. */
export type PKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn" | "peasant";
export type Pos = { x: number; y: number };
/** A piece as a puzzle file lists it: kind, side, file (x), rank row (y, 0 = top), and "asleep" for a
 * sleeping enemy (can't move, capture or give check until an eye raises the alarm; can be captured). */
export type PieceDef = [PKind, Side, number, number] | [PKind, Side, number, number, "asleep"];

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

/** A gate: a wall that switches can open (or, if it starts open, close). It can't close on a piece. */
export type Gate = Pos & { open?: true };
/** What a switch does when a piece stops on it. */
export type SwitchEffect =
  /** Flip these gates (by square). A lever flips them each time; a plate holds them flipped while pressed. */
  | { type: "gates"; gates: Pos[] }
  /** Drop every trapdoor open. */
  | { type: "trapdoors" }
  /** Wake every sleeping enemy. */
  | { type: "wake" }
  /** Flood these squares with sludge for good; whatever stands there dies. */
  | { type: "sludge"; squares: Pos[] };
export type SwitchKind = "lever" | "plate";
export type Switch = Pos & { kind: SwitchKind; effect: SwitchEffect };

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
  /** Eyes: solid like walls, and watching their row and column. When one sees any of your pieces at
   * the end of a move (either side's), the alarm wakes every sleeping enemy. Walls, eyes and pieces
   * block the view; holes don't. */
  eyes?: Pos[];
  /** Toxic sludge: a piece that ends its move here dies (an enemy counts as captured). Sliders cross it
   * safely; a king may not step in. */
  sludge?: Pos[];
  /** Trapdoors: floor until a piece standing on one moves off; then it falls open into a hole for good. */
  trapdoors?: Pos[];
  /** Snares: a piece that stops on one is caught and never moves again. It still blocks and still
   * attacks (and gives check). */
  snares?: Pos[];
  gates?: Gate[];
  /** Switches: levers and pressure plates, either side can use them. */
  switches?: Switch[];
  pieces: PieceDef[];
  goal: Goal;
  /** Most moves the player may make. */
  moves: number;
};

export type Piece = Pos & { kind: PKind; side: Side; asleep?: true };
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
  /** Trapdoors that have fallen open: bit i is the puzzle's trapdoor i. */
  doors: number;
  /** Gates flipped an odd number of times by levers: bit i is gate i. */
  levers: number;
  /** Sludge switches that have flooded: bit i is switch i. */
  flood: number;
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
export type Board = { width: number; height: number; open: boolean[]; solid: boolean[]; eyes: Pos[]; sludge: boolean[];
  /** Per square: the trapdoor's index, or -1. */ door: number[]; snare: boolean[];
  /** Per square: gate index or -1; switch index or -1; switches that flood it. */ gate: number[]; switchAt: number[]; floodBy: number[][];
  gates: Gate[]; switches: Switch[];
  /** Per gate: plates wired to it. Per gate: lever bit mask is just 1 << gate. */ platesOf: number[][];
  /** Did the puzzle start with an enemy king? Killing it (sludge) wins like mate. */ blackKing: boolean };
export function boardOf(p: Puzzle): Board {
  const eyes = p.eyes ?? [];
  const squares = Array.from({ length: p.width * p.height }, (_, i) => ({ x: i % p.width, y: Math.floor(i / p.width) }));
  const solid = squares.map(q => has(p.walls, q) || has(eyes, q));
  const open = squares.map((q, i) => !solid[i] && !has(p.holes, q));
  const sludge = squares.map(q => has(p.sludge ?? [], q));
  const door = squares.map(q => (p.trapdoors ?? []).findIndex(d => same(d, q)));
  const snare = squares.map(q => has(p.snares ?? [], q));
  const gates = p.gates ?? [], switches = p.switches ?? [];
  const gate = squares.map(q => gates.findIndex(g => same(g, q)));
  const switchAt = squares.map(q => switches.findIndex(w => same(w, q)));
  const floodBy = squares.map(q => switches.flatMap((w, i) => (w.effect.type === "sludge" && has(w.effect.squares, q) ? [i] : [])));
  const platesOf = gates.map(g => switches.flatMap((w, i) => (w.kind === "plate" && w.effect.type === "gates" && has(w.effect.gates, g) ? [i] : [])));
  const blackKing = p.pieces.some(q => q[0] === "king" && q[1] === "black");
  return { width: p.width, height: p.height, open, solid, eyes, sludge, door, snare, gate, switchAt, floodBy, gates, switches, platesOf, blackKing };
}
/** Is gate `g` open now? Its start, flipped by levers, flipped by each pressed plate; held open while occupied. */
export function gateOpen(b: Board, s: State, g: number): boolean {
  const at = b.gates[g];
  if (s.pieces.some(q => q.x === at.x && q.y === at.y)) return true;
  let open = !!at.open !== !!(s.levers & (1 << g));
  for (const w of b.platesOf[g]) { const pl = b.switches[w]; if (s.pieces.some(q => q.x === pl.x && q.y === pl.y)) open = !open; }
  return open;
}
/** Is this square toxic now (painted sludge, or flooded by a switch)? */
export const toxic = (b: Board, s: State, i: number) => b.sludge[i] || b.floodBy[i].some(w => !!(s.flood & (1 << w)));
const closedGate = (b: Board, s: State, i: number) => b.gate[i] >= 0 && !gateOpen(b, s, b.gate[i]);
/** Squares the eyes can see: along each eye's row and column, up to and including the first piece,
 * stopped by walls and eyes. */
export function sight(b: Board, s: State): Pos[] {
  const out: Pos[] = [];
  for (const e of b.eyes) for (const [dx, dy] of ROOK) {
    for (let x = e.x + dx, y = e.y + dy; x >= 0 && y >= 0 && x < b.width && y < b.height && !b.solid[y * b.width + x] && !closedGate(b, s, y * b.width + x); x += dx, y += dy) {
      out.push({ x, y });
      if (s.pieces.some(q => q.x === x && q.y === y)) break;
    }
  }
  return out;
}
/** If an eye sees one of your pieces, every sleeper wakes. */
function alarm(b: Board, s: State): State {
  if (!s.pieces.some(q => q.asleep)) return s;
  const seen = sight(b, s);
  if (!s.pieces.some(q => q.side === "white" && has(seen, q))) return s;
  return { ...s, pieces: s.pieces.map(q => (q.asleep ? { kind: q.kind, side: q.side, x: q.x, y: q.y } : q)) };
}
/** Can a piece stand on or slide across this square now? (Fallen trapdoors are holes.) */
const isOpen = (b: Board, x: number, y: number, s: State) => {
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return false;
  const i = y * b.width + x, d = b.door[i];
  return b.open[i] && (d < 0 || !(s.doors & (1 << d))) && !closedGate(b, s, i);
};
export const fallen = (b: Board, s: State, p: Pos) => { const d = b.door[p.y * b.width + p.x]; return d >= 0 && !!(s.doors & (1 << d)); };

export function start(p: Puzzle): State {
  const pieces = p.pieces.map(([kind, side, x, y, z]): Piece => ({ kind, side, x, y, ...(z === "asleep" ? { asleep: true as const } : {}) }));
  return alarm(boardOf(p), { pieces, turn: "white", played: 0, taken: 0, material: 0, saved: 0, lost: false, doors: 0, levers: 0, flood: 0 });
}
export const pieceAt = (s: State, p: Pos) => s.pieces.find(q => same(q, p));

/** Squares a piece attacks or could move to, ignoring check. Pawns: forward moves and diagonal captures. */
function reach(b: Board, s: State, pc: Piece, capturesOnly = false): Pos[] {
  const out: Pos[] = [];
  // Asleep: does nothing. Snared: can't move, but still attacks.
  if (pc.asleep || (!capturesOnly && b.snare[pc.y * b.width + pc.x])) return out;
  const at = (x: number, y: number) => s.pieces.find(q => q.x === x && q.y === y);
  const add = (x: number, y: number, mayCapture = true, mayMove = true) => {
    if (!isOpen(b, x, y, s)) return false;
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
        if (capturesOnly) { if (isOpen(b, pc.x + dx, pc.y + dy, s)) out.push({ x: pc.x + dx, y: pc.y + dy }); }
        else { const t = at(pc.x + dx, pc.y + dy); if (t && t.side !== pc.side) out.push({ x: t.x, y: t.y }); }
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
  const guarded = s.pieces.some(q => q.kind === "king" && q.side === pc.side);
  return reach(b, s, pc)
    .map(to => ({ from: { x: pc.x, y: pc.y }, to, ...(pc.kind === "pawn" && to.y === last ? { promo: "queen" as const } : {}) }))
    .filter(m => !(pc.kind === "king" && toxic(b, s, m.to.y * b.width + m.to.x)) && (!guarded || !inCheck(b, apply(pz, s, m), pc.side)));
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
  const b = boardFor(pz);
  let { doors, levers, flood } = s;
  // Leaving a trapdoor drops it open behind you.
  const d = b.door[m.from.y * b.width + m.from.x];
  if (d >= 0) doors |= 1 << d;
  const kill = (q: Piece) => {
    if (q.side === "black") { taken++; material += VALUE[q.kind]; }
    else if (q.kind === "king" || q.kind === "peasant") lost = true;
  };
  if (toxic(b, s, moved.y * b.width + moved.x)) {
    // Stopped in the sludge: gone.
    kill(moved);
  } else if (moved.kind === "peasant" && moved.side === "white" && has(exits, moved)) saved++;
  else {
    pieces = [...pieces, moved];
    // Stopped on a switch: it fires.
    const w = b.switchAt[moved.y * b.width + moved.x];
    if (w >= 0) {
      const e = b.switches[w].effect;
      if (e.type === "gates" && b.switches[w].kind === "lever") for (const g of e.gates) { const i = b.gates.findIndex(q => same(q, g)); if (i >= 0) levers ^= 1 << i; }
      if (e.type === "trapdoors") doors = (1 << b.door.filter(x => x >= 0).length) - 1;
      if (e.type === "wake") pieces = pieces.map(q => (q.asleep ? { kind: q.kind, side: q.side, x: q.x, y: q.y } : q));
      if (e.type === "sludge" && !(flood & (1 << w))) {
        flood |= 1 << w;
        for (const q of pieces) if (has(e.squares, q)) kill(q);
        pieces = pieces.filter(q => !has(e.squares, q));
      }
    }
  }
  return alarm(b, { pieces, turn: other(s.turn), played: s.played + (s.turn === "white" ? 1 : 0), taken, material, saved, lost, doors, levers, flood });
}
const boards = new WeakMap<Puzzle, Board>();
const boardFor = (pz: Puzzle) => boards.get(pz) ?? boards.set(pz, boardOf(pz)).get(pz)!;
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
export function outcome(pz: Puzzle, b: Board, s: State, moves?: Move[]): Outcome {
  if (s.lost) return "lose";
  if (goalMet(pz, s)) return "win";
  const b0 = boardFor(pz);
  if (b0.blackKing && !s.pieces.some(q => q.kind === "king" && q.side === "black")) return "win";
  if (s.turn === "white") {
    // The dungeon has just replied.
    if (s.played >= pz.moves) return pz.goal.type === "survive" ? "win" : "lose";
  }
  const hasKing = s.pieces.some(q => q.kind === "king" && q.side === s.turn);
  if (!hasKing) return null;
  const stuck = (moves ?? legalMoves(pz, b, s)).length === 0;
  if (!stuck) return null;
  // Mate or stalemate. Stalemating the enemy is a draw, and a draw is a fail.
  return s.turn === "black" && inCheck(b, s, "black") ? "win" : "lose";
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
  const ps = s.pieces.map(q => `${q.kind[0]}${q.kind === "king" ? "K" : ""}${q.side[0]}${q.x}${q.y}${q.asleep ? "z" : ""}`).sort().join("");
  return `${s.turn[0]}${s.doors},${s.levers},${s.flood},${s.taken},${s.material},${s.saved},${s.lost ? 1 : 0}|${ps}`;
}
