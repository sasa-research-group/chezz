/** The battles as data: `levels/levels.json` holds them, `turns.ts` plays them, and the studio's
 * level designer edits them. This module checks a level before it is played or written back to the
 * repo, formats the file so diffs stay readable, and picks the army a studio test run fields.
 * Pure: no DOM, no file system. */
import { LIMITS } from "./rules";
import { RULES } from "./turns";
import type { Encounter, Kind, Kit, Placed, Pos, Recruit, Rules, SwitchType, Tile, TileType, Trap } from "./turns";

/** A battle plus designer-only extras: a list name and the army a test run fields. The game ignores both.
 * A tutorial level carries its real army in `tutorial.army` instead of a test army. */
export type Level = Encounter & { name?: string; testArmy?: Placed[] };
export type LevelsFile = { version: 1; levels: Level[] };
/** One problem with a level, tied to the control (and square) it concerns. An error would crash or
 * corrupt the game and blocks Save and Play; a warning breaks a design rule, or notes something the
 * game fixes at load (an enemy's HP above its kind's max), and is only shown. No error depends on the
 * rules file, so retuning stats can never make the levels file unloadable. */
export type Issue = { field: "size" | "walls" | "switches" | "tiles" | "spawns" | "starts" | "reward" | "testArmy" | "name"; message: string; at?: Pos; warning?: true; /** The game fixes this at load (HP clamped to the max). */ clamped?: true };
export const isError = (i: Issue) => !i.warning;

export const KINDS: Kind[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];
/** Kinds of floor switch, with the name the studio shows. */
export const SWITCH_TYPES: [SwitchType, string][] = [["spears", "Spears"]];
/** Floor tiles, with the name the studio and the deploy kit show. */
export const TILE_TYPES: [TileType, string][] = [["ice", "Ice"], ["sludge", "Sludge"]];
/** Most tiles of one type a level's deploy kit can hand out. */
export const MAX_KIT = 9;
/** A new switch as the studio places it: spears along the row just above the middle, for 2. */
export const newSwitch = (l: Pick<Level, "height">, p: Pos): Trap => ({ type: "spears", x: p.x, y: p.y, rows: [Math.max(0, Math.floor((l.height - 1) / 2))], damage: 2 });
/** Board sides: square names run a–h, so 8 is the widest a board can be. */
export const MIN_SIDE = 2, MAX_SIDE = 8;
export const MAX_REWARD = 99;
/** The rules file's own HP ceiling: a spawn above it could never be within any legal stats. */
export const MAX_HP = LIMITS.hp[1];
const KEYS = ["name", "reward", "width", "height", "walls", "switches", "tiles", "kit", "spawns", "starts", "tutorial", "handout", "testArmy", "story"] as const;

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
  for (const k of ["reward", "width", "height"] as const) if (!int(l[k], -999, 999)) return `${where}: ${k} must be a whole number`;
  for (const k of ["walls", "starts"] as const) if (!Array.isArray(l[k]) || !(l[k] as unknown[]).every(isPos)) return `${where}: ${k} must be a list of {x, y}`;
  if (!Array.isArray(l.spawns) || !l.spawns.every(s => Array.isArray(s) && (s.length === 3 || s.length === 4) && isKind(s[0]) && s.slice(1).every(n => int(n, -99, 99)))) return `${where}: spawns must be [kind, x, y] or [kind, x, y, hp]`;
  const isTrap = (t: unknown) => !!t && typeof t === "object" && !Array.isArray(t) && Object.keys(t).length === 5 && SWITCH_TYPES.some(([k]) => k === (t as Trap).type) && int((t as Trap).x, -99, 99) && int((t as Trap).y, -99, 99) && int((t as Trap).damage, -99, 99) && Array.isArray((t as Trap).rows) && (t as Trap).rows.every(r => int(r, -99, 99));
  if (l.switches !== undefined && (!Array.isArray(l.switches) || !l.switches.every(isTrap))) return `${where}: switches must be a list of {type, x, y, rows, damage}`;
  const isTileType = (t: unknown) => TILE_TYPES.some(([k]) => k === t);
  const isTile = (t: unknown) => !!t && typeof t === "object" && !Array.isArray(t) && Object.keys(t).length === 3 && isTileType((t as Tile).type) && int((t as Tile).x, -99, 99) && int((t as Tile).y, -99, 99);
  if (l.tiles !== undefined && (!Array.isArray(l.tiles) || !l.tiles.every(isTile))) return `${where}: tiles must be a list of {type, x, y}`;
  if (l.kit !== undefined && (!l.kit || typeof l.kit !== "object" || Array.isArray(l.kit) || Object.entries(l.kit).some(([k, n]) => !isTileType(k) || !int(n, 0, MAX_KIT)))) return `${where}: kit must be { ice, sludge } counts 0–${MAX_KIT}`;
  const isPlaced = (p: unknown) => !!p && typeof p === "object" && !Array.isArray(p) && Object.keys(p).length === 3 && isKind((p as Placed).kind) && int((p as Placed).x, -99, 99) && int((p as Placed).y, -99, 99);
  if (l.testArmy !== undefined && (!Array.isArray(l.testArmy) || !l.testArmy.every(isPlaced))) return `${where}: testArmy must be a list of {kind, x, y}`;
  if (l.tutorial !== undefined) {
    const t = l.tutorial as Record<string, unknown>;
    if (!t || typeof t !== "object" || Array.isArray(t) || Object.keys(t).some(k => k !== "army")) return `${where}: tutorial must be { army }`;
    if (!Array.isArray(t.army) || !t.army.every(isPlaced)) return `${where}: tutorial army must be a list of {kind, x, y}`;
    if (l.testArmy !== undefined) return `${where}: a tutorial level's army is its tutorial army; drop testArmy`;
  }
  if (l.handout !== undefined) {
    const h = l.handout as Record<string, unknown>;
    if (!h || typeof h !== "object" || Array.isArray(h) || Object.keys(h).some(k => k !== "items")) return `${where}: handout must be { items }`;
    if (h.items !== undefined && (!Array.isArray(h.items) || h.items.length > 20 || !h.items.every(id => typeof id === "string" && id.length > 0 && id.length <= 40))) return `${where}: handout items must be a list of item ids`;
  }
  for (const k of ["name", "story"] as const) if (l[k] !== undefined && (typeof l[k] !== "string" || (l[k] as string).length > 200)) return `${where}: ${k} must be short text`;
  return l as unknown as Level;
}

/** Everything wrong with a level: errors that would make it unplayable, and warnings about design
 * rules. `rules` only adds warnings (HP the game will clamp); no error depends on it. */
export function levelIssues(l: Level, rules: Rules = RULES): Issue[] {
  const out: Issue[] = [];
  if (!int(l.width, MIN_SIDE, MAX_SIDE) || !int(l.height, MIN_SIDE, MAX_SIDE)) out.push({ field: "size", message: `Size ${MIN_SIDE}–${MAX_SIDE}` });
  if (!int(l.reward, 0, MAX_REWARD)) out.push({ field: "reward", message: `Reward 0–${MAX_REWARD}` });
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
  (l.switches ?? []).forEach(t => {
    place("switches", t, "Switch");
    if (!t.rows.length || t.rows.some(r => !int(r, 0, l.height - 1))) out.push({ field: "switches", message: "Spear rows on the board", at: { x: t.x, y: t.y } });
    if (!int(t.damage, 1, MAX_HP)) out.push({ field: "switches", message: `Spear damage 1–${MAX_HP}`, at: { x: t.x, y: t.y } });
  });
  (l.tiles ?? []).forEach(t => place("tiles", t, t.type === "ice" ? "Ice" : "Sludge"));
  l.spawns.forEach(([kind, x, y, hp]) => {
    place("spawns", { x, y }, `Enemy ${kind}`);
    if (hp === undefined) return;
    if (!int(hp, 1, MAX_HP)) out.push({ field: "spawns", message: `Enemy ${kind} HP 1–${MAX_HP}`, at: { x, y } });
    else if (hp > rules.hp[kind]) out.push({ field: "spawns", message: `${kind} HP ${hp} > max ${rules.hp[kind]} → ${rules.hp[kind]}`, at: { x, y }, warning: true, clamped: true });
  });
  l.starts.forEach((s, i) => place("starts", s, i === 0 ? "King start" : `Start ${i + 1}`));
  if (!l.spawns.length) out.push({ field: "spawns", message: "Needs an enemy" });
  if (!l.starts.length) out.push({ field: "starts", message: "Needs a king start" });
  // An enemy the king can't reach may never be beaten.
  if (l.starts.length && inside(l.starts[0]) && !walls.has(key(l.starts[0]))) {
    const reach = new Set([key(l.starts[0])]), queue = [l.starts[0]];
    while (queue.length) {
      const p = queue.pop()!;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (inside(q) && !walls.has(key(q)) && !reach.has(key(q))) { reach.add(key(q)); queue.push(q); }
      }
    }
    for (const [kind, x, y] of l.spawns) if (inside({ x, y }) && !walls.has(key({ x, y })) && !reach.has(key({ x, y }))) out.push({ field: "spawns", message: `Enemy ${kind} cut off`, at: { x, y }, warning: true });
  }
  const army = savedArmy(l);
  if (army) {
    if (army.filter(p => p.kind === "king").length !== 1) out.push({ field: "testArmy", message: "Army needs exactly one king" });
    const taken = new Set<string>();
    for (const p of army) {
      const at = { x: p.x, y: p.y };
      if (!l.starts.some(s => s.x === p.x && s.y === p.y)) out.push({ field: "testArmy", message: `Army ${p.kind} off a start`, at });
      else if (taken.has(key(p))) out.push({ field: "testArmy", message: "Two army pieces on one start", at });
      taken.add(key(p));
    }
  }
  return out;
}

/** Each level's issues, plus the run's: survivors carry over, so a level with fewer starts than the one before leaves some behind. */
export function listIssues(levels: Level[], rules: Rules = RULES): Issue[][] {
  return levels.map((l, i) => {
    const own = levelIssues(l, rules), prev = levels[i - 1];
    return prev && !l.tutorial && l.starts.length < prev.starts.length ? [...own, { field: "starts" as const, message: `Fewer starts than battle ${i} (${prev.starts.length})`, warning: true as const }] : own;
  });
}

/** Parses and checks a whole levels file. Nothing is accepted while any level has an error; warnings pass. */
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
  listIssues(parsed as Level[]).forEach((issues, i) => issues.filter(isError).forEach(issue => errors.push(`Level ${i + 1}: ${issue.message}${issue.at ? ` (${issue.at.x},${issue.at.y})` : ""}`)));
  return errors.length ? { ok: false, errors } : { ok: true, file: { version: 1, levels: parsed as Level[] } };
}

/** JSON with one field per line and short lists inline, so a moved wall is a one-line diff. */
export function formatLevels(levels: Level[]): string {
  const inline = (v: unknown): string => Array.isArray(v) ? `[${v.map(inline).join(", ")}]`
    : v && typeof v === "object" ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }`
    : JSON.stringify(v);
  const level = (l: Level) => {
    const placed = (army: Placed[]) => army.map(p => ({ kind: p.kind, x: p.x, y: p.y }));
    const tidy = (k: (typeof KEYS)[number]) => k === "walls" || k === "starts" ? l[k].map(p => ({ x: p.x, y: p.y }))
      : k === "switches" ? l.switches!.map(t => ({ type: t.type, x: t.x, y: t.y, rows: t.rows, damage: t.damage }))
      : k === "tiles" ? l.tiles!.map(t => ({ type: t.type, x: t.x, y: t.y }))
      : k === "kit" ? Object.fromEntries(TILE_TYPES.filter(([t]) => l.kit![t] !== undefined).map(([t]) => [t, l.kit![t]]))
      : k === "testArmy" ? placed(l.testArmy!)
      : k === "tutorial" ? { army: placed(l.tutorial!.army) }
      : l[k];
    const fields = KEYS.filter(k => l[k] !== undefined).map(k => `      ${JSON.stringify(k)}: ${inline(tidy(k))}`);
    return `    {\n${fields.join(",\n")}\n    }`;
  };
  return `{\n  "version": 1,\n  "levels": [\n${levels.map(level).join(",\n")}\n  ]\n}\n`;
}

const RECRUITS: Recruit[] = ["rook", "bishop", "pawn"];
/** The army a player plausibly brings to level `index`: the king, plus at each hideout before it the
 * strongest recruit the run's gold so far affords (one per stop, while the next road has room).
 * `rules` gives the prices and starting gold; the studio passes its unsaved ones. */
export function typicalArmy(levels: Level[], index: number, rules: Rules = RULES): Kind[] {
  return typicalStart(levels, index, rules).army;
}
/** The typical army for level `index` and the gold left over after buying it. */
export function typicalStart(levels: Level[], index: number, rules: Rules = RULES): { army: Kind[]; gold: number } {
  const army: Kind[] = ["king"];
  let gold = rules.gold;
  for (let i = 0; i < index; i++) {
    gold += levels[i].reward;
    const pick = RECRUITS.find(r => rules.cost[r] <= gold);
    if (pick && army.length < levels[i + 1].starts.length) { army.push(pick); gold -= rules.cost[pick]; }
  }
  return { army: army.slice(0, Math.max(1, levels[index]?.starts.length ?? 1)), gold };
}
/** Kinds standing on a level's start squares in order, as the game deals a real army. */
export const placeInOrder = (l: Level, kinds: Kind[]): Placed[] => kinds.slice(0, l.starts.length).map((kind, i) => ({ kind, x: l.starts[i].x, y: l.starts[i].y }));
/** The army saved on a level, if any: a tutorial level's preset army, or a roguelike level's test army. */
export const savedArmy = (l: Level): Placed[] | undefined => l.tutorial?.army ?? l.testArmy;
/** Saves `army` on a level: into its tutorial block, or as its test army (undefined: back to typical). */
export function withArmy(l: Level, army: Placed[] | undefined): Level {
  if (l.tutorial) return army ? { ...l, tutorial: { ...l.tutorial, army } } : l;
  const { testArmy: _, ...rest } = l;
  return army ? { ...rest, testArmy: army } : rest;
}
/** Moves a level into the tutorial (keeping `army` as its preset army) or out of it (its preset army becomes its test army). */
export function withTutorial(l: Level, on: boolean, army: Placed[]): Level {
  const { testArmy: _, tutorial, ...rest } = l;
  if (on) return { ...rest, tutorial: { army } };
  return tutorial ? { ...rest, testArmy: tutorial.army } : l;
}
/** The army a studio test run fields, piece by square: the level's saved army, or the typical one in start order. */
export const testArmyOf = (levels: Level[], index: number, rules: Rules = RULES): Placed[] => savedArmy(levels[index]) ?? placeInOrder(levels[index], typicalArmy(levels, index, rules));
