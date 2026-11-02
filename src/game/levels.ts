/** The battles as data: `levels/levels.json` holds them, `turns.ts` plays them, and the studio's
 * level designer edits them. This module checks a level before it is played or written back to the
 * repo, formats the file so diffs stay readable, and picks the army a designer playtest fields.
 * Pure: no DOM, no file system. */
import { COST, HP, newRun } from "./turns";
import type { Encounter, Kind, Pos, Recruit } from "./turns";

/** A battle plus designer-only extras: a list name and the army a playtest fields. The game ignores both. */
export type Level = Encounter & { name?: string; testArmy?: Kind[] };
export type LevelsFile = { version: 1; levels: Level[] };
/** One problem with a level, tied to the control (and square) it concerns. */
export type Issue = { field: "size" | "walls" | "spawns" | "starts" | "reward" | "enemyEnergy" | "testArmy" | "name"; message: string; at?: Pos };

export const KINDS: Kind[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];
/** Board sides: square names run a–h, so 8 is the widest a board can be. */
export const MIN_SIDE = 2, MAX_SIDE = 8;
export const MAX_ENEMY_ENERGY = 12, MAX_REWARD = 99;
const KEYS = ["name", "reward", "enemyEnergy", "width", "height", "walls", "spawns", "starts", "testArmy", "story"] as const;

const int = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isPos = (v: unknown): v is Pos => !!v && typeof v === "object" && !Array.isArray(v) && int((v as Pos).x, -99, 99) && int((v as Pos).y, -99, 99) && Object.keys(v).length === 2;
const isKind = (v: unknown): v is Kind => typeof v === "string" && (KINDS as string[]).includes(v);
const key = (p: Pos) => `${p.x},${p.y}`;

/** Checks the shape of untrusted JSON (a POST body, a hand-edited file). Returns the level or why not. */
function shapeOf(v: unknown, i: number): Level | string {
  const where = `Level ${i + 1}`;
  if (!v || typeof v !== "object" || Array.isArray(v)) return `${where}: not an object`;
  const l = v as Record<string, unknown>;
  const extra = Object.keys(l).find(k => !(KEYS as readonly string[]).includes(k));
  if (extra) return `${where}: unknown field ${extra}`;
  for (const k of ["reward", "enemyEnergy", "width", "height"] as const) if (!int(l[k], -999, 999)) return `${where}: ${k} must be a whole number`;
  for (const k of ["walls", "starts"] as const) if (!Array.isArray(l[k]) || !(l[k] as unknown[]).every(isPos)) return `${where}: ${k} must be a list of {x, y}`;
  if (!Array.isArray(l.spawns) || !l.spawns.every(s => Array.isArray(s) && s.length === 4 && isKind(s[0]) && s.slice(1).every(n => int(n, -99, 99)))) return `${where}: spawns must be [kind, x, y, hp]`;
  if (l.testArmy !== undefined && (!Array.isArray(l.testArmy) || !l.testArmy.every(isKind))) return `${where}: testArmy must be a list of piece kinds`;
  for (const k of ["name", "story"] as const) if (l[k] !== undefined && (typeof l[k] !== "string" || (l[k] as string).length > 200)) return `${where}: ${k} must be short text`;
  return l as unknown as Level;
}

/** Everything wrong with a level that would make it unplayable or break the run's rules. */
export function levelIssues(l: Level): Issue[] {
  const out: Issue[] = [];
  if (!int(l.width, MIN_SIDE, MAX_SIDE) || !int(l.height, MIN_SIDE, MAX_SIDE)) out.push({ field: "size", message: `Size ${MIN_SIDE}–${MAX_SIDE}` });
  if (!int(l.reward, 0, MAX_REWARD)) out.push({ field: "reward", message: `Reward 0–${MAX_REWARD}` });
  if (!int(l.enemyEnergy, 0, MAX_ENEMY_ENERGY)) out.push({ field: "enemyEnergy", message: `Enemy energy 0–${MAX_ENEMY_ENERGY}` });
  const inside = (p: Pos) => p.x >= 0 && p.y >= 0 && p.x < l.width && p.y < l.height;
  const walls = new Set(l.walls.map(key));
  const seen = new Map<string, string>();
  const place = (field: Issue["field"], p: Pos, what: string) => {
    if (!inside(p)) out.push({ field, message: `${what} off the board`, at: p });
    else if (field !== "walls" && walls.has(key(p))) out.push({ field, message: `${what} on a wall`, at: p });
    else if (seen.has(key(p))) out.push({ field, message: `${what} overlaps ${seen.get(key(p))}`, at: p });
    seen.set(key(p), what.toLowerCase());
  };
  l.walls.forEach(w => place("walls", w, "Wall"));
  seen.clear();
  l.spawns.forEach(([kind, x, y, hp]) => {
    place("spawns", { x, y }, `Enemy ${kind}`);
    if (!int(hp, 1, HP[kind])) out.push({ field: "spawns", message: `Enemy ${kind} HP 1–${HP[kind]}`, at: { x, y } });
  });
  l.starts.forEach((s, i) => place("starts", s, i === 0 ? "King start" : `Start ${i + 1}`));
  if (!l.spawns.length) out.push({ field: "spawns", message: "Needs an enemy" });
  if (!l.starts.length) out.push({ field: "starts", message: "Needs a king start" });
  // A recruited pawn has to be able to march up and promote from any start square.
  for (const s of l.starts) if (inside(s) && l.walls.some(w => w.x === s.x && w.y < s.y)) out.push({ field: "starts", message: "Wall ahead of start", at: s });
  // Every enemy must be reachable from the king's start, or the battle can never end.
  if (l.starts.length && inside(l.starts[0]) && !walls.has(key(l.starts[0]))) {
    const reach = new Set([key(l.starts[0])]), queue = [l.starts[0]];
    while (queue.length) {
      const p = queue.pop()!;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (inside(q) && !walls.has(key(q)) && !reach.has(key(q))) { reach.add(key(q)); queue.push(q); }
      }
    }
    for (const [kind, x, y] of l.spawns) if (inside({ x, y }) && !walls.has(key({ x, y })) && !reach.has(key({ x, y }))) out.push({ field: "spawns", message: `Enemy ${kind} cut off`, at: { x, y } });
  }
  if (l.testArmy) {
    const kings = l.testArmy.filter(k => k === "king").length;
    if (l.testArmy[0] !== "king" || kings !== 1) out.push({ field: "testArmy", message: "Army needs one king, first" });
    if (l.testArmy.length > l.starts.length) out.push({ field: "testArmy", message: `Army ${l.testArmy.length} > ${l.starts.length} starts` });
  }
  return out;
}

/** Each level's issues, plus the run's: survivors carry over, so a level can't have fewer starts than the one before. */
export function listIssues(levels: Level[]): Issue[][] {
  return levels.map((l, i) => {
    const own = levelIssues(l), prev = levels[i - 1];
    return prev && l.starts.length < prev.starts.length ? [...own, { field: "starts" as const, message: `Fewer starts than battle ${i} (${prev.starts.length})` }] : own;
  });
}

/** Parses and checks a whole levels file. Nothing is accepted unless every level is clean. */
export function parseLevels(raw: unknown): { ok: true; file: LevelsFile } | { ok: false; errors: string[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["Not a levels file"] };
  const { version, levels } = raw as Record<string, unknown>;
  if (version !== 1 || !Array.isArray(levels)) return { ok: false, errors: ["Expected { version: 1, levels: [...] }"] };
  if (!levels.length || levels.length > 50) return { ok: false, errors: ["Between 1 and 50 levels"] };
  const errors: string[] = [];
  const parsed = levels.map((v, i) => {
    const l = shapeOf(v, i);
    if (typeof l === "string") errors.push(l);
    return l;
  });
  if (errors.length) return { ok: false, errors };
  listIssues(parsed as Level[]).forEach((issues, i) => issues.forEach(issue => errors.push(`Level ${i + 1}: ${issue.message}${issue.at ? ` (${issue.at.x},${issue.at.y})` : ""}`)));
  return errors.length ? { ok: false, errors } : { ok: true, file: { version: 1, levels: parsed as Level[] } };
}

/** JSON with one field per line and short lists inline, so a moved wall is a one-line diff. */
export function formatLevels(levels: Level[]): string {
  const inline = (v: unknown): string => Array.isArray(v) ? `[${v.map(inline).join(", ")}]`
    : v && typeof v === "object" ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }`
    : JSON.stringify(v);
  const level = (l: Level) => {
    const fields = KEYS.filter(k => l[k] !== undefined).map(k => `      ${JSON.stringify(k)}: ${inline(k === "walls" || k === "starts" ? l[k].map(p => ({ x: p.x, y: p.y })) : l[k])}`);
    return `    {\n${fields.join(",\n")}\n    }`;
  };
  return `{\n  "version": 1,\n  "levels": [\n${levels.map(level).join(",\n")}\n  ]\n}\n`;
}

const RECRUITS: Recruit[] = ["rook", "bishop", "pawn"];
/** The army a player plausibly brings to level `index`: the king, plus at each hideout before it the
 * strongest recruit the run's gold so far affords (one per stop, while the next road has room). */
export function typicalArmy(levels: Level[], index: number): Kind[] {
  const army: Kind[] = ["king"];
  let gold = newRun().gold;
  for (let i = 0; i < index; i++) {
    gold += levels[i].reward;
    const pick = RECRUITS.find(r => COST[r] <= gold);
    if (pick && army.length < levels[i + 1].starts.length) { army.push(pick); gold -= COST[pick]; }
  }
  return army.slice(0, Math.max(1, levels[index]?.starts.length ?? 1));
}
/** The army a designer playtest fields: the level's saved test army, or the typical one. */
export const testArmyOf = (levels: Level[], index: number): Kind[] => levels[index].testArmy ?? typicalArmy(levels, index);
