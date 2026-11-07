/** Piece variants and their abilities. Every piece kind comes in three variants (Wesley's
 * character-select sheet): rebels, royals and misfits. A variant can hook into the rules at a few
 * points; turns.ts calls the hooks, so each ability stays a small pure function of the run.
 * Hooks never mutate their inputs and must stay deterministic. */
import type { Kind, Pos, Run, Target, Unit } from "./turns";

export type Variant = "rebel" | "royal" | "misfit";
export const VARIANTS: Variant[] = ["rebel", "royal", "misfit"];
/** Ability state that lives on a unit, flat so saves stay simple: strings, numbers, booleans only. */
export type Mods = Record<string, string | number | boolean>;

/** What turns.ts hands a hook: the pieces of the rules it may need, without importing turns.ts back. */
export type HookContext = {
  energy: number;
  /** Move targets the piece would have if it were this kind, from its square, within the energy. */
  shape: (kind: Kind) => Target[];
  open: (p: Pos) => boolean;
};
export type Ability = {
  id: `${Variant}-${Kind}`;
  variant: Variant;
  kind: Kind;
  /** The character's name on the select screen. */
  name: string;
  /** Ability name. */
  ability: string;
  /** One sentence a player can hold in their head. */
  sentence: string;
  /** Extends or filters the empty squares the piece may move to. */
  moveTargets?: (g: Run, u: Unit, base: Target[], ctx: HookContext) => Target[];
  /** Runs on the post-strike run, after damage, deaths and counters. `victim` is the target as it
   * was before the blow; `killed` says whether the blow felled it. Return the run to continue with. */
  afterStrike?: (g: Run, striker: Unit, victim: Unit, killed: boolean) => Run;
};

/** The variant a unit plays as. Saves and tests may omit it: your pieces are rebels, the patrol royals. */
export const variantOf = (u: Pick<Unit, "side" | "variant">): Variant => u.variant ?? (u.side === "white" ? "rebel" : "royal");
export const abilityOf = (u: Pick<Unit, "side" | "variant" | "kind">): Ability | undefined => ABILITIES[`${variantOf(u)}-${u.kind}`];

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

/** Ability state as it should read at the start of the unit's turn number `turn`: timed effects that
 * have run out are dropped. Returns undefined when nothing is left, so saves stay tidy. */
export function expireMods(u: Pick<Unit, "mods">, turn: number): Mods | undefined {
  if (!u.mods) return undefined;
  const mods = { ...u.mods };
  if (typeof mods.absorbedUntil === "number" && turn > mods.absorbedUntil) { delete mods.absorbed; delete mods.absorbedUntil; }
  return Object.keys(mods).length ? mods : undefined;
}

/** Wesley's seed: the haystack strikes by rolling onto what it kills, eating it, and moving like it
 * for two turns. Movement only; it still strikes like a rook. */
const haystack: Ability = {
  id: "misfit-rook", variant: "misfit", kind: "rook", name: "Haystack", ability: "Consume",
  sentence: "When its strike kills, Haystack rolls onto the square, eats the piece and moves like it for the next two turns.",
  moveTargets: (g, u, base, ctx) => {
    const eaten = u.mods?.absorbed as Kind | undefined, until = u.mods?.absorbedUntil as number | undefined;
    if (!eaten || until === undefined || g.turn > until) return base;
    const extra = ctx.shape(eaten).filter(t => !base.some(b => same(b, t)));
    return [...base, ...extra];
  },
  afterStrike: (g, striker, victim, killed) => {
    if (!killed || !g.units.some(u => u.id === striker.id)) return g;
    const mods: Mods = { ...(striker.mods ?? {}), absorbed: victim.kind, absorbedUntil: g.turn + 2 };
    return { ...g, units: g.units.map(u => (u.id === striker.id ? { ...u, x: victim.x, y: victim.y, mods } : u)) };
  },
};

export const ABILITIES: Partial<Record<`${Variant}-${Kind}`, Ability>> = {
  [haystack.id]: haystack,
};
