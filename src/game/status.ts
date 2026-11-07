/** Timed statuses and the flat ability-state bag on a unit. No imports of the rules, so abilities
 * can use these without a cycle. */
import type { Run, Side, Unit } from "./turns";

/** Ability state that lives on a unit, flat so saves stay simple: strings, numbers, booleans only. */
export type Mods = Record<string, string | number | boolean>;

/** Timed statuses any ability may put on any piece, read by turns.ts:
 * dazed (can't move until `dazedUntil`), hexed (deals 1 less until `hexedUntil`),
 * burning (takes 1 at the start of its side's turn, `burning` turns left). */
export const isDazed = (u: Pick<Unit, "mods">, turn: number) => u.mods?.dazed === true && typeof u.mods.dazedUntil === "number" && turn <= u.mods.dazedUntil;
export const isHexed = (u: Pick<Unit, "mods">, turn: number) => u.mods?.hexed === true && typeof u.mods.hexedUntil === "number" && turn <= u.mods.hexedUntil;

/** The turn number of `side`'s next turn start, as seen from the current action. Turn numbers tick
 * when the player's pool refills: the enemy's turn N follows the player's turn N. So a status put on
 * an enemy during your turn N that should last through its next turn ends at N; one put on your
 * piece during the enemy's turn N lasts through your turn N + 1. Use it for `<status>Until`. */
export const nextTurn = (g: Pick<Run, "turn">, side: Side) => (side === "white" ? g.turn + 1 : g.turn);

/** Ability state as it should read at the start of the unit's turn number `turn`: every timed effect
 * (`foo` with a numeric `fooUntil`) that has run out is dropped. Returns undefined when nothing is
 * left, so saves stay tidy. */
export function expireMods(u: Pick<Unit, "mods">, turn: number): Mods | undefined {
  if (!u.mods) return undefined;
  const mods = { ...u.mods };
  for (const key of Object.keys(u.mods)) {
    if (!key.endsWith("Until")) continue;
    const until = mods[key];
    if (typeof until === "number" && turn > until) { delete mods[key]; delete mods[key.slice(0, -"Until".length)]; }
  }
  return Object.keys(mods).length ? mods : undefined;
}
