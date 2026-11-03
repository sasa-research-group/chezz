import { RULES } from "../game/turns";
import type { Rules } from "../game/turns";

/** The Mechanics tab's unsaved rules. They outlive a trip to another studio tab, and the level
 * designer's test runs play by them; a reload drops them. */
let draft: Rules | null = null;
export const draftRules = (): Rules => draft ?? RULES;
export const setDraftRules = (r: Rules) => { draft = r; };
