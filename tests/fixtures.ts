/** Fixed rules and battles for tests. The shipped `rules.json` and `levels.json` are the owner's to
 * retune from the studio at any time, so tests that pin numbers play by these copies instead. */
import levelsFile from "./fixtures/levels.json" with { type: "json" };
import rulesFile from "./fixtures/rules.json" with { type: "json" };
import type { Encounter, GameData, Rules } from "../src/game/turns";

export const FIXED_RULES = rulesFile as Rules;
export const FIXED_LEVELS = levelsFile.levels as unknown as Encounter[];
export const FIXED: Required<GameData> = { rules: FIXED_RULES, levels: FIXED_LEVELS };
/** A run as the game saves it: the data it plays by is never part of the save. */
export const stored = (g: object) => JSON.stringify({ ...g, rules: undefined, levels: undefined });
