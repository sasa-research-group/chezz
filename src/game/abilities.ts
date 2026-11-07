/** Piece variants and their abilities. Every piece kind comes in three variants (Wesley's
 * character-select sheet): rebels, royals and misfits. A variant can hook into the rules at a few
 * points; turns.ts calls the hooks, so each ability stays a small pure function of the run.
 * Hooks never mutate their inputs and must stay deterministic. Each ability lives in its own file
 * under abilities/ and registers here. */
import type { Kind, Pos, Run, Step, Target, Unit } from "./turns";

export type Variant = "rebel" | "royal" | "misfit";
export const VARIANTS: Variant[] = ["rebel", "royal", "misfit"];
/** Ability state that lives on a unit, flat so saves stay simple: strings, numbers, booleans only. */
export type Mods = Record<string, string | number | boolean>;

/** What turns.ts hands a hook: the pieces of the rules it may need, without importing turns.ts back. */
export type HookContext = {
  energy: number;
  /** Move targets the piece would have if it were this kind, from its square, within the energy. */
  shape: (kind: Kind) => Target[];
  /** On the board, not a wall or hole, and empty. */
  open: (p: Pos) => boolean;
  /** On the board and not a wall or hole (a piece may stand there). */
  passable: (p: Pos) => boolean;
};
/** An action a piece can take instead of striking (hex, honk, demolish, dub...). `targets` are the
 * squares the player may pick; an empty list means the action needs no target. `apply` resolves it
 * on a run whose energy has already been paid and marks the actor acted. */
export type AltAction = {
  id: string; label: string; cost: number; targets: Pos[];
  apply: (g: Run, target?: Pos) => { run: Run; step: Step };
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
  /** Overrides the kind's starting HP (Nobody has 2). */
  hp?: number;
  /** Extends or filters the empty squares the piece may move to. */
  moveTargets?: (g: Run, u: Unit, base: Target[], ctx: HookContext) => Target[];
  /** Overrides whether u, standing on `from`, could strike `target`; `base` is the kind's answer. */
  reaches?: (g: Run, u: Unit, from: Pos, target: Pos, base: boolean) => boolean;
  /** Vetoes a strike target (Her Wigness won't strike pawns). */
  canStrike?: (g: Run, u: Unit, v: Unit) => boolean;
  /** Cost of this piece's strike right now (Sir Lance charges for 1 after jumping). */
  strikeCost?: (g: Run, u: Unit) => number;
  /** Outgoing damage before the defender's block; `base` is the kind's damage. */
  damage?: (g: Run, a: Unit, v: Unit, base: number) => number;
  /** Incoming damage to this piece from `a`, after the attacker's modifiers; `base` includes the defend block. */
  incoming?: (g: Run, v: Unit, a: Unit, base: number) => number;
  /** Extra pieces a strike on `v` also hits (the Warden's sweep). They take the same damage. */
  splash?: (g: Run, a: Unit, v: Unit) => Unit[];
  /** Another piece takes the blow aimed at this one (King Gilt's bodyguards). */
  intercept?: (g: Run, striker: Unit, victim: Unit) => Unit | undefined;
  /** Whether this surviving piece hits `a` back; `base` is the rule (defending and reaches). */
  counters?: (g: Run, v: Unit, a: Unit, base: boolean) => boolean;
  /** May this piece defend at all? */
  canDefend?: (g: Run, u: Unit) => boolean;
  /** Runs on the post-strike run, after damage, deaths and counters. `victim` is the target as it
   * was before the blow; `killed` says whether the blow felled it. Return the run to continue with. */
  afterStrike?: (g: Run, striker: Unit, victim: Unit, killed: boolean) => Run;
  /** Runs when this piece is removed from the board (any cause). The run no longer holds it. */
  onDeath?: (g: Run, u: Unit) => Run;
  /** Runs at the start of this piece's side's turn, before energy is spent. */
  startTurn?: (g: Run, u: Unit) => Run;
  /** Runs after any piece (either side) finishes a move; `mover` is already on its new square. */
  onAnyMove?: (g: Run, u: Unit, mover: Unit, from: Pos) => Run;
  /** Actions this piece may take instead of striking, given the current run. */
  altActions?: (g: Run, u: Unit) => AltAction[];
};

/** The variant a unit plays as. Saves and tests may omit it: your pieces are rebels, the patrol royals. */
export const variantOf = (u: Pick<Unit, "side" | "variant">): Variant => u.variant ?? (u.side === "white" ? "rebel" : "royal");
export const abilityOf = (u: Pick<Unit, "side" | "variant" | "kind">): Ability | undefined => ABILITIES[`${variantOf(u)}-${u.kind}`];

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

/** Timed statuses any ability may put on any piece, read by turns.ts:
 * dazed (can't move until `dazedUntil`), hexed (deals 1 less until `hexedUntil`),
 * burning (takes 1 at the start of its side's turn, `burning` turns left). */
export const isDazed = (u: Pick<Unit, "mods">, turn: number) => u.mods?.dazed === true && typeof u.mods.dazedUntil === "number" && turn <= u.mods.dazedUntil;
export const isHexed = (u: Pick<Unit, "mods">, turn: number) => u.mods?.hexed === true && typeof u.mods.hexedUntil === "number" && turn <= u.mods.hexedUntil;

/** Ability state as it should read at the start of the unit's turn number `turn`: timed effects that
 * have run out are dropped. Returns undefined when nothing is left, so saves stay tidy. */
export function expireMods(u: Pick<Unit, "mods">, turn: number): Mods | undefined {
  if (!u.mods) return undefined;
  const mods = { ...u.mods };
  for (const key of ["absorbed", "dazed", "hexed"]) {
    const until = mods[`${key}Until`];
    if (typeof until === "number" && turn > until) { delete mods[key]; delete mods[`${key}Until`]; }
  }
  return Object.keys(mods).length ? mods : undefined;
}

/** Wesley's seed: the haystack strikes by rolling onto what it kills, eating it, and moving like it
 * for two turns. Movement only; it still strikes like a rook. */
export const haystack: Ability = {
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
