/** Piece stats and rule switches as data: `rules.json` holds them, `turns.ts` plays by them, and the
 * studio's Mechanics tab edits them. This module checks a rules file before it is played or written
 * back to the repo, and formats it so diffs stay readable. Pure: no DOM, no file system. */
import type { Kind } from "./turns";

/** "one": each side acts with a single piece per turn, chess-style. "all": every piece acts each turn. */
export type TurnMode = "one" | "all";
export type Shop = "pawn" | "bishop" | "rook" | "heal";
/** How far a piece strikes along its capture shape: 1 is the next square; "line" is any distance along
 * those directions, stopped by the first piece or wall. */
export type Reach = 1 | "line";
export type Rules = {
  version: 1;
  turn: TurnMode;
  hp: Record<Kind, number>;
  damage: Record<Kind, number>;
  range: Record<Kind, Reach>;
  /** Damage a defending piece blocks from each hit; the game shows it as +N. */
  defend: number;
  /** Strikebacks: whether any piece that survives a hit strikes the attacker back when it can reach it. */
  counter: boolean;
  cost: Record<Shop, number>;
  /** HP the hideout's heal gives back to the king. */
  heal: number;
  /** Gold a new run starts with. */
  gold: number;
};

export const RULE_KINDS: Kind[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];
export const SHOP: Shop[] = ["pawn", "bishop", "rook", "heal"];
export const TURN_MODES: TurnMode[] = ["one", "all"];
export const REACHES: Reach[] = [1, "line"];
/** Allowed range for each number, so a typo can't make a piece unkillable or a level unloadable. */
export const LIMITS = { hp: [1, 99], damage: [0, 99], defend: [0, 9], cost: [0, 99], heal: [0, 99], gold: [0, 99] } as const;
const KEYS = ["version", "turn", "hp", "damage", "range", "defend", "counter", "cost", "heal", "gold"] as const;

const int = (v: unknown, [lo, hi]: readonly [number, number]) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Parses and checks a rules file (a POST body, a hand-edited file). Returns every problem, not just the first. */
export function parseRules(raw: unknown): { ok: true; rules: Rules } | { ok: false; errors: string[] } {
  if (!isMap(raw)) return { ok: false, errors: ["Not a rules file"] };
  const errors: string[] = [];
  const extra = Object.keys(raw).filter(k => !(KEYS as readonly string[]).includes(k));
  if (extra.length) errors.push(`Unknown field ${extra.join(", ")}`);
  if (raw.version !== 1) errors.push("Expected version 1");
  if (!(TURN_MODES as unknown[]).includes(raw.turn)) errors.push(`turn must be ${TURN_MODES.map(m => `"${m}"`).join(" or ")}`);
  const table = (field: "hp" | "damage" | "cost", keys: string[]) => {
    const t = raw[field], range = LIMITS[field];
    if (!isMap(t) || Object.keys(t).length !== keys.length || !keys.every(k => k in t)) { errors.push(`${field} needs ${keys.join(", ")}`); return; }
    for (const k of keys) if (!int(t[k], range)) errors.push(`${field} ${k}: ${range[0]}–${range[1]}`);
  };
  table("hp", RULE_KINDS); table("damage", RULE_KINDS); table("cost", SHOP);
  const range = raw.range;
  if (!isMap(range) || Object.keys(range).length !== RULE_KINDS.length || !RULE_KINDS.every(k => k in range)) errors.push(`range needs ${RULE_KINDS.join(", ")}`);
  else for (const k of RULE_KINDS) if (!(REACHES as unknown[]).includes(range[k])) errors.push(`range ${k}: 1 or "line"`);
  for (const k of ["defend", "heal", "gold"] as const) if (!int(raw[k], LIMITS[k])) errors.push(`${k}: ${LIMITS[k][0]}–${LIMITS[k][1]}`);
  if (typeof raw.counter !== "boolean") errors.push("counter must be true or false");
  return errors.length ? { ok: false, errors } : { ok: true, rules: raw as unknown as Rules };
}

/** JSON with one field per line and each table inline, so a changed stat is a one-line diff. */
export function formatRules(r: Rules): string {
  const inline = (keys: string[], t: Record<string, unknown>) => `{ ${keys.map(k => `${JSON.stringify(k)}: ${JSON.stringify(t[k])}`).join(", ")} }`;
  const value = (k: typeof KEYS[number]) => k === "hp" || k === "damage" || k === "range" ? inline(RULE_KINDS, r[k]) : k === "cost" ? inline(SHOP, r.cost) : JSON.stringify(r[k]);
  return `{\n${KEYS.map(k => `  ${JSON.stringify(k)}: ${value(k)}`).join(",\n")}\n}\n`;
}
