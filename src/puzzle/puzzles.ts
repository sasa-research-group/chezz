/** The dungeon puzzles as data: `puzzles.json` holds them, `engine.ts` plays them, the studio's
 * Puzzles tab edits them. This module checks a puzzle and formats the file so diffs stay readable.
 * Pure: no DOM, no file system. */
import raw from "./puzzles.json";
import { boardOf, inCheck, same, start } from "./engine";
import type { Goal, GoalType, PKind, Pos, Puzzle } from "./engine";

export type PuzzlesFile = { version: 1; puzzles: Puzzle[] };
export type PIssue = { message: string; at?: Pos; warning?: true };
export const MIN_SIDE = 2, MAX_SIDE = 8, MAX_MOVES = 12;
export const P_KINDS: PKind[] = ["king", "queen", "rook", "bishop", "knight", "pawn", "peasant"];
export const GOALS: [GoalType, string][] = [["mate", "Checkmate"], ["capture", "Capture pieces"], ["material", "Win material"], ["escort", "Escort peasants"], ["reach", "Reach a square"], ["survive", "Survive"]];
/** A fresh goal of a type, carrying over target squares where it can. */
export function goalOf(type: GoalType, was?: Goal): Goal {
  const squares = was && "exits" in was ? was.exits : was && "squares" in was ? was.squares : [];
  switch (type) {
    case "mate": return { type };
    case "capture": return { type, count: 1 };
    case "material": return { type, points: 5 };
    case "escort": return { type, exits: squares };
    case "reach": return { type, squares };
    case "survive": return { type };
  }
}
/** The goal's target squares (exits or squares to reach), if it has any. */
export const goalSquares = (g: Goal): Pos[] => (g.type === "escort" ? g.exits : g.type === "reach" ? g.squares : []);
export const withGoalSquares = (g: Goal, sq: Pos[]): Goal => (g.type === "escort" ? { ...g, exits: sq } : g.type === "reach" ? { ...g, squares: sq } : g);

export function goalText(g: Goal, moves: number): string {
  const n = `in ${moves} move${moves === 1 ? "" : "s"}`;
  switch (g.type) {
    case "mate": return `Checkmate ${n}`;
    case "capture": return `Capture ${g.count} piece${g.count === 1 ? "" : "s"} ${n}`;
    case "material": return `Win ${g.points} points of material ${n}`;
    case "escort": return `Get every peasant to an exit ${n}`;
    case "reach": return `Reach a marked square${g.kind ? ` with a ${g.kind}` : ""} ${n}`;
    case "survive": return `Survive ${moves} move${moves === 1 ? "" : "s"}`;
  }
}

export function puzzleIssues(pz: Puzzle): PIssue[] {
  const out: PIssue[] = [];
  const err = (message: string, at?: Pos) => out.push({ message, at });
  const on = (p: Pos) => p.x >= 0 && p.y >= 0 && p.x < pz.width && p.y < pz.height;
  if (pz.width < MIN_SIDE || pz.width > MAX_SIDE || pz.height < MIN_SIDE || pz.height > MAX_SIDE) err(`Board must be ${MIN_SIDE}–${MAX_SIDE} a side`);
  if (!Number.isInteger(pz.moves) || pz.moves < 1 || pz.moves > MAX_MOVES) err(`Moves must be 1–${MAX_MOVES}`);
  const blocked = [...pz.holes, ...pz.walls];
  const seen = new Set<string>();
  for (const [kind, side, x, y] of pz.pieces) {
    const p = { x, y };
    if (!on(p)) err(`${side} ${kind} is off the board`, p);
    else if (blocked.some(q => same(q, p))) err(`${side} ${kind} stands on a hole or wall`, p);
    if (seen.has(`${x},${y}`)) err("Two pieces on one square", p);
    seen.add(`${x},${y}`);
    if (kind === "peasant" && side === "black") err("Peasants are on your side", p);
  }
  for (const side of ["white", "black"] as const) if (pz.pieces.filter(p => p[0] === "king" && p[1] === side).length > 1) err(`More than one ${side} king`);
  if (!pz.pieces.some(p => p[1] === "white" && p[0] !== "peasant") && pz.goal.type !== "escort") err("You need at least one piece");
  const g = pz.goal;
  if (g.type === "mate" && !pz.pieces.some(p => p[0] === "king" && p[1] === "black")) err("Checkmate needs an enemy king");
  if (g.type === "escort" && !pz.pieces.some(p => p[0] === "peasant")) err("Escort needs a peasant");
  if ((g.type === "escort" || g.type === "reach") && !goalSquares(g).length) err(g.type === "escort" ? "Escort needs an exit square" : "Reach needs a target square");
  for (const p of goalSquares(g)) if (!on(p) || blocked.some(q => same(q, p))) err("Goal square off the board or on a hole/wall", p);
  if (g.type === "capture" && (g.count < 1 || g.count > pz.pieces.filter(p => p[1] === "black").length)) err("Capture count is more than the enemies on the board");
  if (g.type === "material" && g.points < 1) err("Material must be at least 1");
  if (!out.length && inCheck(boardOf(pz), start(pz), "black")) err("The enemy king starts in check");
  return out;
}

const posStr = (ps: Pos[]) => `[${ps.map(p => `{ "x": ${p.x}, "y": ${p.y} }`).join(", ")}]`;
/** One field per line, short lists inline, so a diff shows what changed. */
export function formatPuzzles(puzzles: Puzzle[]): string {
  const one = (pz: Puzzle) => {
    const lines: string[] = [];
    if (pz.name !== undefined) lines.push(`"name": ${JSON.stringify(pz.name)}`);
    if (pz.note !== undefined) lines.push(`"note": ${JSON.stringify(pz.note)}`);
    lines.push(`"width": ${pz.width}`, `"height": ${pz.height}`, `"moves": ${pz.moves}`);
    const { type, ...rest } = pz.goal as Goal & Record<string, unknown>;
    const extra = Object.entries(rest).map(([k, v]) => `, "${k}": ${Array.isArray(v) ? posStr(v as Pos[]) : JSON.stringify(v)}`).join("");
    lines.push(`"goal": { "type": "${type}"${extra} }`);
    lines.push(`"holes": ${posStr(pz.holes)}`, `"walls": ${posStr(pz.walls)}`);
    lines.push(`"pieces": [${pz.pieces.map(p => JSON.stringify(p).replace(/,/g, ", ")).join(", ")}]`);
    return `    {\n      ${lines.join(",\n      ")}\n    }`;
  };
  return `{\n  "version": 1,\n  "puzzles": [\n${puzzles.map(one).join(",\n")}\n  ]\n}\n`;
}

const isPos = (v: unknown): v is Pos => !!v && typeof v === "object" && Number.isInteger((v as Pos).x) && Number.isInteger((v as Pos).y);
const posList = (v: unknown): v is Pos[] => Array.isArray(v) && v.every(isPos);
/** Checks a puzzles file's shape and every puzzle's errors. */
export function parsePuzzles(raw: unknown): { ok: true; puzzles: Puzzle[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const f = raw as PuzzlesFile;
  if (!f || f.version !== 1 || !Array.isArray(f.puzzles)) return { ok: false, errors: ["Not a puzzles file"] };
  f.puzzles.forEach((pz, i) => {
    const name = pz?.name || `Puzzle ${i + 1}`;
    if (!pz || !Number.isInteger(pz.width) || !Number.isInteger(pz.height) || !posList(pz.holes) || !posList(pz.walls) || !Array.isArray(pz.pieces) || !pz.goal || !GOALS.some(([t]) => t === pz.goal.type)) { errors.push(`${name}: malformed`); return; }
    if (!pz.pieces.every(p => Array.isArray(p) && P_KINDS.includes(p[0]) && (p[1] === "white" || p[1] === "black") && Number.isInteger(p[2]) && Number.isInteger(p[3]))) { errors.push(`${name}: bad piece`); return; }
    for (const i of puzzleIssues(pz)) if (!i.warning) errors.push(`${name}: ${i.message}`);
  });
  return errors.length ? { ok: false, errors } : { ok: true, puzzles: f.puzzles };
}

export const PUZZLES: Puzzle[] = (raw as unknown as PuzzlesFile).puzzles;
