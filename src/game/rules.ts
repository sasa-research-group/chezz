/** Piece stats and rule switches as data: `rules.json` holds them, `turns.ts` plays by them, and the
 * studio's Mechanics tab edits them. This module checks a rules file before it is played or written
 * back to the repo, and formats it so diffs stay readable. Pure: no DOM, no file system. */
import type { Kind } from "./turns";

/** How many pieces a side may act with per turn: 1 is chess-style, "all" is every piece. Older files say
 * "one", read as 1. */
export type TurnMode = number | "all";
/** "chess": pieces move and strike in their chess shapes. "tactics": each kind walks up to `tactics.move`
 * squares and strikes anything within `tactics.reach` (docs/turn-based.md, Movement). */
export type Movement = "chess" | "tactics";
/** Tactics movement's numbers per kind: squares walked per move, and strike distance. */
export type Tactics = { move: Record<Kind, number>; reach: Record<Kind, number> };
export type Shop = "pawn" | "bishop" | "rook" | "heal";
/** How far a piece strikes along its capture shape: 1 is the next square; "line" is any distance along
 * those directions, stopped by the first piece or wall. */
export type Reach = 1 | "line";
/** One-use items the team carries in its bag (docs/turn-based.md, Items). */
export type Item = "bomb" | "decoy";
/** Each item's numbers. bomb: damage to every enemy in an area × area square. decoy: the straw pawn's HP. */
export type ItemStats = { bomb: { damage: number; area: number }; decoy: { hp: number } };
export type Rules = {
  version: 1;
  turn: TurnMode;
  movement: Movement;
  hp: Record<Kind, number>;
  damage: Record<Kind, number>;
  range: Record<Kind, Reach>;
  tactics: Tactics;
  /** Strikebacks: whether any piece that survives a hit strikes the attacker back when it can reach it. */
  counter: boolean;
  cost: Record<Shop, number>;
  /** HP the hideout's heal gives back to the king. */
  heal: number;
  /** Gold a new run starts with. */
  gold: number;
  /** How many items the team's bag holds. */
  slots: number;
  items: ItemStats;
};

export const RULE_KINDS: Kind[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];
export const SHOP: Shop[] = ["pawn", "bishop", "rook", "heal"];
/** The moves-per-turn choices the studio offers; a file may hold any count in LIMITS.turn. */
export const TURN_MODES: TurnMode[] = [1, 2, 3, "all"];
export const MOVEMENTS: Movement[] = ["chess", "tactics"];
export const REACHES: Reach[] = [1, "line"];
/** Allowed range for each number, so a typo can't make a piece unkillable or a level unloadable. */
export const LIMITS = { hp: [1, 99], damage: [0, 99], cost: [0, 99], heal: [0, 99], gold: [0, 99], slots: [0, 9], turn: [1, 9], move: [0, 9], reach: [1, 9] } as const;
export const ITEMS: Item[] = ["bomb", "decoy"];
export const ITEM_LIMITS = { bomb: { damage: [0, 99], area: [1, 8] }, decoy: { hp: [1, 99] } } as const;
const KEYS = ["version", "turn", "movement", "hp", "damage", "range", "tactics", "counter", "cost", "heal", "gold", "slots", "items"] as const;
/** Fields added after rules files were already being tuned by hand: a file without them loads with these. */
const ADDED = {
  slots: 3, items: { bomb: { damage: 1, area: 2 }, decoy: { hp: 1 } }, movement: "chess",
  tactics: { move: { king: 2, queen: 4, rook: 3, bishop: 3, knight: 3, pawn: 2 }, reach: { king: 1, queen: 1, rook: 1, bishop: 3, knight: 1, pawn: 1 } },
};
/** Fields of retired rules, still found in older rules files: read past, never written back. */
const RETIRED = ["defend", "defends"];

const int = (v: unknown, [lo, hi]: readonly [number, number]) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Parses and checks a rules file (a POST body, a hand-edited file). Returns every problem, not just the first. */
export function parseRules(input: unknown): { ok: true; rules: Rules } | { ok: false; errors: string[] } {
  if (!isMap(input)) return { ok: false, errors: ["Not a rules file"] };
  const raw: Record<string, unknown> = { ...ADDED, ...input };
  if (raw.turn === "one") raw.turn = 1;
  const errors: string[] = [];
  const extra = Object.keys(raw).filter(k => !(KEYS as readonly string[]).includes(k) && !RETIRED.includes(k));
  if (extra.length) errors.push(`Unknown field ${extra.join(", ")}`);
  if (raw.version !== 1) errors.push("Expected version 1");
  if (raw.turn !== "all" && !int(raw.turn, LIMITS.turn)) errors.push(`turn must be ${LIMITS.turn[0]}–${LIMITS.turn[1]} or "all"`);
  if (!(MOVEMENTS as unknown[]).includes(raw.movement)) errors.push(`movement must be ${MOVEMENTS.map(m => `"${m}"`).join(" or ")}`);
  const table = (field: "hp" | "damage" | "cost", keys: string[]) => {
    const t = raw[field], range = LIMITS[field];
    if (!isMap(t) || Object.keys(t).length !== keys.length || !keys.every(k => k in t)) { errors.push(`${field} needs ${keys.join(", ")}`); return; }
    for (const k of keys) if (!int(t[k], range)) errors.push(`${field} ${k}: ${range[0]}–${range[1]}`);
  };
  table("hp", RULE_KINDS); table("damage", RULE_KINDS); table("cost", SHOP);
  const range = raw.range;
  if (!isMap(range) || Object.keys(range).length !== RULE_KINDS.length || !RULE_KINDS.every(k => k in range)) errors.push(`range needs ${RULE_KINDS.join(", ")}`);
  else for (const k of RULE_KINDS) if (!(REACHES as unknown[]).includes(range[k])) errors.push(`range ${k}: 1 or "line"`);
  const tactics = raw.tactics;
  if (!isMap(tactics) || Object.keys(tactics).length !== 2) errors.push("tactics needs move, reach");
  else for (const field of ["move", "reach"] as const) {
    const t = tactics[field], range = LIMITS[field];
    if (!isMap(t) || Object.keys(t).length !== RULE_KINDS.length || !RULE_KINDS.every(k => k in t)) { errors.push(`tactics ${field} needs ${RULE_KINDS.join(", ")}`); continue; }
    for (const k of RULE_KINDS) if (!int(t[k], range)) errors.push(`tactics ${field} ${k}: ${range[0]}–${range[1]}`);
  }
  for (const k of ["heal", "gold", "slots"] as const) if (!int(raw[k], LIMITS[k])) errors.push(`${k}: ${LIMITS[k][0]}–${LIMITS[k][1]}`);
  const items = raw.items;
  if (!isMap(items) || Object.keys(items).length !== ITEMS.length || !ITEMS.every(k => isMap(items[k]))) errors.push(`items needs ${ITEMS.join(", ")}`);
  else for (const item of ITEMS) {
    const stats = items[item] as Record<string, unknown>, limits: Record<string, readonly [number, number]> = ITEM_LIMITS[item];
    const keys = Object.keys(limits);
    if (Object.keys(stats).length !== keys.length || !keys.every(k => k in stats)) { errors.push(`items ${item} needs ${keys.join(", ")}`); continue; }
    for (const k of keys) if (!int(stats[k], limits[k])) errors.push(`items ${item} ${k}: ${limits[k][0]}–${limits[k][1]}`);
  }
  if (typeof raw.counter !== "boolean") errors.push("counter must be true or false");
  return errors.length ? { ok: false, errors } : { ok: true, rules: Object.fromEntries(KEYS.map(k => [k, raw[k]])) as unknown as Rules };
}

/** How many pieces a side may act with per turn (Infinity for "all"). */
export const actsPerTurn = (r: Rules): number => (r.turn === "all" ? Infinity : r.turn);

/** JSON with one field per line and each table inline, so a changed stat is a one-line diff. */
export function formatRules(r: Rules): string {
  const inline = (keys: string[], t: Record<string, unknown>) => `{ ${keys.map(k => `${JSON.stringify(k)}: ${JSON.stringify(t[k])}`).join(", ")} }`;
  const value = (k: typeof KEYS[number]) => k === "hp" || k === "damage" || k === "range" ? inline(RULE_KINDS, r[k]) : k === "cost" ? inline(SHOP, r.cost)
    : k === "items" ? `{ ${ITEMS.map(i => `${JSON.stringify(i)}: ${inline(Object.keys(ITEM_LIMITS[i]), r.items[i])}`).join(", ")} }`
    : k === "tactics" ? `{\n    "move": ${inline(RULE_KINDS, r.tactics.move)},\n    "reach": ${inline(RULE_KINDS, r.tactics.reach)}\n  }` : JSON.stringify(r[k]);
  return `{\n${KEYS.map(k => `  ${JSON.stringify(k)}: ${value(k)}`).join(",\n")}\n}\n`;
}
