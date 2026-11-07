/** Piece variants and their abilities. Every piece kind comes in three variants (Wesley's
 * character-select sheet): rebels, royals and misfits. A variant can hook into the rules at a few
 * points; turns.ts calls the hooks, so each ability stays a small pure function of the run.
 * Hooks never mutate their inputs and must stay deterministic. Each ability lives in its own file
 * under abilities/ and is registered here. Ability files import runtime values only from ./board and
 * ./status (and types from anywhere), so loading one never cycles back through this registry. */
import type { Kind, Pos, Run, Step, Target, Unit } from "./turns";
import type { Mods } from "./status";
export type { Mods } from "./status";
export { expireMods, isDazed, isHexed, nextTurn } from "./status";
import { pip } from "./abilities/rebel-pawn";
import { sergeantPike } from "./abilities/royal-pawn";
import { grumble } from "./abilities/misfit-pawn";
import { dobbin } from "./abilities/rebel-knight";
import { sirLance } from "./abilities/royal-knight";
import { nobody } from "./abilities/misfit-knight";
import { brotherAsh } from "./abilities/rebel-bishop";
import { bishopLens } from "./abilities/royal-bishop";
import { honkington } from "./abilities/misfit-bishop";
import { brick } from "./abilities/rebel-rook";
import { warden } from "./abilities/royal-rook";
import { haystack } from "./abilities/misfit-rook";
import { motherSkillet } from "./abilities/rebel-queen";
import { herWigness } from "./abilities/royal-queen";
import { wick } from "./abilities/misfit-queen";
import { kingRedcape } from "./abilities/rebel-king";
import { kingGilt } from "./abilities/royal-king";
import { marmalade } from "./abilities/misfit-king";

export type Variant = "rebel" | "royal" | "misfit";
export const VARIANTS: Variant[] = ["rebel", "royal", "misfit"];

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
/** Can `u`, standing on `from`, strike `target`? The rules' answer, abilities included. */
export type Reaches = (g: Run, u: Unit, from: Pos, target: Pos) => boolean;
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
  /** Vetoes a strike target (Her Wigness won't strike pawns; the Warden won't sweep his own king down).
   * `dealt(a, x)` is the rules' damage calculation, abilities and blocks included, for weighing a blow. */
  canStrike?: (g: Run, u: Unit, v: Unit, dealt: (a: Unit, x: Unit) => number) => boolean;
  /** Cost of this piece's strike right now (Sir Lance charges for 1 after jumping). */
  strikeCost?: (g: Run, u: Unit) => number;
  /** Outgoing damage before the defender's block; `base` is the kind's damage. */
  damage?: (g: Run, a: Unit, v: Unit, base: number) => number;
  /** Incoming damage to this piece from `a`, after the attacker's modifiers; `base` includes the defend block. */
  incoming?: (g: Run, v: Unit, a: Unit, base: number) => number;
  /** Damage `v` will take before it can act again because `a`'s blow (dealing `dealt`) landed: Wick's
   * fire ticks at the victim's turn start. Check adds it to the blow. */
  lingering?: (g: Run, a: Unit, v: Unit, dealt: number) => number;
  /** Where `a`'s blow would shove a surviving `v` (Pip's heave), or undefined when it stays put. Check
   * treats a shove into a pit as a kill. */
  displaces?: (g: Run, a: Unit, v: Unit) => Pos | undefined;
  /** Extra pieces a strike on `v` also hits (the Warden's sweep). They take the same damage. */
  splash?: (g: Run, a: Unit, v: Unit) => Unit[];
  /** Another piece takes the blow aimed at this one (King Gilt's bodyguards). `reaches` is the rules'
   * reach test, abilities included, for asking whether the striker could also hit the stand-in. */
  intercept?: (g: Run, striker: Unit, victim: Unit, reaches: Reaches) => Unit | undefined;
  /** Whether this surviving piece hits `a` back; `base` is the rule (defending and reaches). */
  counters?: (g: Run, v: Unit, a: Unit, base: boolean) => boolean;
  /** May this piece defend at all? */
  canDefend?: (g: Run, u: Unit) => boolean;
  /** Runs on the post-strike run, after damage, counters and deaths. `victim` is the target as it
   * was before the blow; `killed` says whether the blow felled it. Return the run to continue with. */
  afterStrike?: (g: Run, striker: Unit, victim: Unit, killed: boolean) => Run;
  /** Runs when this piece is removed from the board (any cause). The run no longer holds it. */
  onDeath?: (g: Run, u: Unit) => Run;
  /** Runs at the start of this piece's side's turn, after timed statuses expire and burns tick. */
  startTurn?: (g: Run, u: Unit) => Run;
  /** Runs at the end of this piece's side's turn, before the other side acts. */
  endTurn?: (g: Run, u: Unit) => Run;
  /** Runs on this surviving piece when your army reaches the hideout (Wick is relit for free); `max` is its full HP. */
  atCamp?: (u: Unit, max: number) => Unit;
  /** Runs after any piece (either side) finishes a move; `mover` is already on its new square. */
  onAnyMove?: (g: Run, u: Unit, mover: Unit, from: Pos) => Run;
  /** Actions this piece may take instead of striking, given the current run. */
  altActions?: (g: Run, u: Unit) => AltAction[];
};

/** The variant a unit plays as. Saves and tests may omit it: your pieces are rebels, the patrol royals. */
export const variantOf = (u: Pick<Unit, "side" | "variant">): Variant => u.variant ?? (u.side === "white" ? "rebel" : "royal");
/** The ability a unit plays with. Only a piece whose cast is named has one: a unit with no `variant`
 * is a plain piece in its side's default costume (the road's old patrol, saves from before variants).
 * New encounters and Guild puzzles name the cast of every spawn to switch its ability on. */
export const abilityOf = (u: Pick<Unit, "side" | "variant" | "kind">): Ability | undefined => (u.variant ? ABILITIES[`${u.variant}-${u.kind}`] : undefined);

export const ABILITIES: Partial<Record<`${Variant}-${Kind}`, Ability>> = {
  [pip.id]: pip,
  [sergeantPike.id]: sergeantPike,
  [grumble.id]: grumble,
  [dobbin.id]: dobbin,
  [sirLance.id]: sirLance,
  [nobody.id]: nobody,
  [brotherAsh.id]: brotherAsh,
  [bishopLens.id]: bishopLens,
  [honkington.id]: honkington,
  [brick.id]: brick,
  [warden.id]: warden,
  [haystack.id]: haystack,
  [motherSkillet.id]: motherSkillet,
  [herWigness.id]: herWigness,
  [wick.id]: wick,
  [kingRedcape.id]: kingRedcape,
  [kingGilt.id]: kingGilt,
  [marmalade.id]: marmalade,
};
