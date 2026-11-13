/** The dungeon puzzles as data: `puzzles.json` holds them, `engine.ts` plays them, the studio's
 * Puzzles tab edits them. This module checks a puzzle and formats the file so diffs stay readable.
 * Pure: no DOM, no file system. */
import raw from "./puzzles.json";
import { boardOf, inCheck, same, start } from "./engine";
import type { Goal, GoalType, PKind, Pos, Puzzle, Switch, SwitchEffect } from "./engine";

export type PuzzlesFile = { version: 1; puzzles: Puzzle[] };
export type PIssue = { message: string; at?: Pos; warning?: true };
export const EFFECTS: [SwitchEffect["type"], string][] = [["gates", "Flip gates"], ["trapdoors", "Drop trapdoors"], ["wake", "Wake sleepers"], ["sludge", "Flood sludge"]];
export const effectOf = (type: SwitchEffect["type"]): SwitchEffect => (type === "gates" ? { type, gates: [] } : type === "sludge" ? { type, squares: [] } : { type });
export function switchText(w: Switch): string {
  const e = w.effect, verb = w.kind === "lever" ? "Lever" : "Plate";
  switch (e.type) {
    case "gates": return `${verb}: ${w.kind === "lever" ? "flips" : "holds flipped"} ${e.gates.length} gate${e.gates.length === 1 ? "" : "s"}`;
    case "trapdoors": return `${verb}: drops every trapdoor`;
    case "wake": return `${verb}: wakes the sleepers`;
    case "sludge": return `${verb}: floods ${e.squares.length} square${e.squares.length === 1 ? "" : "s"} with sludge`;
  }
}
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
  const blocked = [...pz.holes, ...pz.walls, ...(pz.eyes ?? [])];
  const gates = pz.gates ?? [], switches = pz.switches ?? [];
  for (const g of gates) {
    if (!on(g) || blocked.some(q => same(q, g))) err("Gate off the board or on a block", g);
    if (gates.filter(q => same(q, g)).length > 1) err("Two gates on one square", g);
    if (!switches.some(w => w.effect.type === "gates" && w.effect.gates.some(q => same(q, g)))) out.push({ message: "A gate no switch flips", at: g, warning: true });
  }
  if (gates.length > 30 || switches.length > 30) err("At most 30 gates and 30 switches");
  for (const w of switches) {
    if (!on(w) || blocked.some(q => same(q, w)) || gates.some(q => same(q, w))) err("Switch off the board, on a block or a gate", w);
    if (switches.filter(q => same(q, w)).length > 1) err("Two switches on one square", w);
    if ([...(pz.sludge ?? []), ...(pz.trapdoors ?? []), ...(pz.snares ?? [])].some(q => same(q, w))) err("Switch on sludge or a trap", w);
    const e = w.effect;
    if (e.type === "gates" && !e.gates.length) out.push({ message: "A switch wired to no gate", at: w, warning: true });
    if (e.type === "gates") for (const g of e.gates) if (!gates.some(q => same(q, g))) err("Switch wired to a square with no gate", g);
    if (e.type === "sludge") { if (!e.squares.length) out.push({ message: "A flood switch with no squares", at: w, warning: true }); for (const q of e.squares) if (!on(q) || blocked.some(b => same(b, q))) err("Flood square off the board or on a block", q); }
    if (e.type === "trapdoors" && !pz.trapdoors?.length) out.push({ message: "Drops trapdoors, but there are none", at: w, warning: true });
    if (e.type === "wake" && !pz.pieces.some(p => p[4] === "asleep")) out.push({ message: "Wakes sleepers, but there are none", at: w, warning: true });
  }
  const seen = new Set<string>();
  for (const [kind, side, x, y, z] of pz.pieces) {
    const p = { x, y };
    if ((pz.sludge ?? []).some(q => same(q, p))) err(`${side} ${kind} starts in sludge`, p);
    if (z === "asleep" && side !== "black") err("Only enemies sleep", p);
    if (!on(p)) err(`${side} ${kind} is off the board`, p);
    else if (blocked.some(q => same(q, p))) err(`${side} ${kind} stands on a hole or wall`, p);
    if ((pz.gates ?? []).some(g => same(g, p) && !g.open)) err(`${side} ${kind} stands in a closed gate`, p);
    if (seen.has(`${x},${y}`)) err("Two pieces on one square", p);
    seen.add(`${x},${y}`);
    if (kind === "peasant" && side === "black") err("Peasants are on your side", p);
  }
  const floorTiles = [...(pz.sludge ?? []), ...(pz.trapdoors ?? []), ...(pz.snares ?? [])];
  for (const q of floorTiles) if (floorTiles.filter(t => same(t, q)).length > 1) err("Two floor tiles (sludge, trapdoor, snare) on one square", q);
  for (const q of [...(pz.trapdoors ?? []), ...(pz.snares ?? [])]) if (!on(q) || blocked.some(b => same(b, q))) err("Trap off the board or on a block", q);
  if ((pz.trapdoors ?? []).length > 30) err("At most 30 trapdoors");
  for (const q of pz.sludge ?? []) if (!on(q) || blocked.some(b => same(b, q))) err("Sludge off the board or on a block", q);
  for (const q of goalSquares(pz.goal)) if ((pz.sludge ?? []).some(b => same(b, q))) err("Goal square in sludge", q);
  for (const e of pz.eyes ?? []) if (!on(e) || [...pz.holes, ...pz.walls].some(q => same(q, e)) || (pz.eyes ?? []).filter(q => same(q, e)).length > 1) err("Eye off the board or on another block", e);
  if (pz.pieces.some(p => p[4] === "asleep") && !pz.eyes?.length) out.push({ message: "Sleepers never wake without an eye", warning: true });
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
    if (pz.trapdoors?.length) lines.push(`"trapdoors": ${posStr(pz.trapdoors)}`);
    if (pz.snares?.length) lines.push(`"snares": ${posStr(pz.snares)}`);
    if (pz.sludge?.length) lines.push(`"sludge": ${posStr(pz.sludge)}`);
    if (pz.gates?.length) lines.push(`"gates": [${pz.gates.map(g => `{ "x": ${g.x}, "y": ${g.y}${g.open ? `, "open": true` : ""} }`).join(", ")}]`);
    if (pz.switches?.length) lines.push(`"switches": [\n        ${pz.switches.map(w => {
      const { type, ...rest } = w.effect as SwitchEffect & Record<string, unknown>;
      const extra = Object.entries(rest).map(([k, v]) => `, "${k}": ${posStr(v as Pos[])}`).join("");
      return `{ "x": ${w.x}, "y": ${w.y}, "kind": "${w.kind}", "effect": { "type": "${type}"${extra} } }`;
    }).join(",\n        ")}\n      ]`);
    if (pz.eyes?.length) lines.push(`"eyes": ${posStr(pz.eyes)}`);
    lines.push(`"pieces": [${pz.pieces.map(p => JSON.stringify(p).replace(/,/g, ", ")).join(", ")}]`);
    return `    {\n      ${lines.join(",\n      ")}\n    }`;
  };
  return `{\n  "version": 1,\n  "puzzles": [\n${puzzles.map(one).join(",\n")}\n  ]\n}\n`;
}

const isPos = (v: unknown): v is Pos => !!v && typeof v === "object" && Number.isInteger((v as Pos).x) && Number.isInteger((v as Pos).y);
const posList = (v: unknown): v is Pos[] => Array.isArray(v) && v.every(isPos);
const okSwitch = (w: Switch) => (w.kind === "lever" || w.kind === "plate") && !!w.effect && (w.effect.type === "gates" ? posList(w.effect.gates) : w.effect.type === "sludge" ? posList(w.effect.squares) : w.effect.type === "trapdoors" || w.effect.type === "wake");
/** Checks a puzzles file's shape and every puzzle's errors. */
export function parsePuzzles(raw: unknown): { ok: true; puzzles: Puzzle[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const f = raw as PuzzlesFile;
  if (!f || f.version !== 1 || !Array.isArray(f.puzzles)) return { ok: false, errors: ["Not a puzzles file"] };
  f.puzzles.forEach((pz, i) => {
    const name = pz?.name || `Puzzle ${i + 1}`;
    if (!pz || !Number.isInteger(pz.width) || !Number.isInteger(pz.height) || (pz.eyes !== undefined && !posList(pz.eyes)) || (pz.sludge !== undefined && !posList(pz.sludge)) || (pz.trapdoors !== undefined && !posList(pz.trapdoors)) || (pz.gates !== undefined && !posList(pz.gates)) || (pz.switches !== undefined && !(posList(pz.switches) && pz.switches.every(okSwitch))) || (pz.snares !== undefined && !posList(pz.snares)) || !posList(pz.holes) || !posList(pz.walls) || !Array.isArray(pz.pieces) || !pz.goal || !GOALS.some(([t]) => t === pz.goal.type)) { errors.push(`${name}: malformed`); return; }
    if (!pz.pieces.every(p => Array.isArray(p) && P_KINDS.includes(p[0]) && (p[1] === "white" || p[1] === "black") && Number.isInteger(p[2]) && Number.isInteger(p[3]) && (p.length === 4 || (p.length === 5 && p[4] === "asleep")))) { errors.push(`${name}: bad piece`); return; }
    for (const i of puzzleIssues(pz)) if (!i.warning) errors.push(`${name}: ${i.message}`);
  });
  return errors.length ? { ok: false, errors } : { ok: true, puzzles: f.puzzles };
}

export const PUZZLES: Puzzle[] = (raw as unknown as PuzzlesFile).puzzles;
