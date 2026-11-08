import { describe, expect, it } from "vitest";
import { approaches, attack, attackTargets, begin, deploy, buy, campReason, canEscape, endTurn, enemyPlan, exposesKing, intentOf, intentWaits, inCheck, kingThreat, leaveCamp, move, moveTargets, passable, reaches, sidelined, strikeExposesKing, turnSpent, unsafeStrikes, walkAndStrike } from "../src/game/turns";
import * as turns from "../src/game/turns";
import type { Encounter, Kind, Placed, Rules, Run, TileType, Unit } from "../src/game/turns";
import { playTurn } from "./turns-strategy";
import { FIXED, stored } from "./fixtures";

// Fixed rules and battles, so retuning the shipped files never moves these tests.
const RULES = FIXED.rules, HP = RULES.hp, DAMAGE = RULES.damage, COST = RULES.cost, ENCOUNTERS = FIXED.levels;
const newRun = () => turns.newRun(FIXED);
const startAt = (index: number, army: Kind[], gold: number) => turns.startAt(index, army, gold, FIXED);
const testRun = (level: Encounter, army: Kind[] | Placed[], index: number, rules: Rules = RULES) => turns.testRun(level, army, index, rules);
const readRun = (raw: string | null) => turns.readRun(raw, FIXED);

const king: Unit = { id: "king", side: "white", kind: "king", x: 1, y: 3, hp: 5 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), phase: "player", units, ...extra }; }
const ONE: Rules = { ...RULES, turn: "one" }, ALL: Rules = { ...RULES, turn: "all" };
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);
// Fixed boards, so these rules don't move when the shipped battles are retuned.
const WALLED: Encounter = { reward: 0, width: 6, height: 4, walls: [{ x: 3, y: 1 }, { x: 3, y: 2 }], spawns: [], starts: [] };
const BRIDGE: Encounter = { reward: 0, width: 6, height: 6, walls: [0, 1, 4, 5].flatMap(x => [{ x, y: 2 }, { x, y: 3 }]), spawns: [], starts: [] };

describe("turn-based rules", () => {
  it("opens in the deploy phase, then the player's turn", () => {
    const g = newRun();
    expect(g.phase).toBe("deploy");
    expect(g.units.filter(u => u.side === "white")).toHaveLength(1);
    expect(begin(g).phase).toBe("player");
  });
  it("lets you rearrange your pieces on the start squares before the battle begins", () => {
    const level: Encounter = { reward: 0, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 0, 1]], starts: [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }] };
    const g = testRun(level, ["king", "rook"], 0);
    const where = (r: Run) => r.units.filter(u => u.side === "white").map(u => [u.id, u.x, u.y]);
    // Onto your own piece: the two swap. Onto a spare start: it moves.
    const swapped = deploy(g, "king", { x: 2, y: 3 });
    expect(where(swapped)).toEqual([["king", 2, 3], ["ally-1", 1, 3]]);
    expect(where(deploy(swapped, "ally-1", { x: 3, y: 3 }))).toEqual([["king", 2, 3], ["ally-1", 3, 3]]);
    // Not a start square, not your piece, or not the deploy phase: nothing happens.
    expect(deploy(g, "king", { x: 1, y: 2 })).toBe(g);
    expect(deploy(g, "enemy-0-0", { x: 3, y: 3 })).toBe(g);
    expect(deploy(begin(g), "king", { x: 3, y: 3 })).toEqual(begin(g));
    expect(JSON.stringify(g)).toBe(JSON.stringify(testRun(level, ["king", "rook"], 0)));
    // The enemy's plan is ready to inspect before the battle begins.
    expect(enemyPlan(g)).toEqual(enemyPlan(begin(g)));
    expect(move(g, "king", { x: 1, y: 2 })).toBe(g);
  });
  it("places a test army exactly where the designer put it, empty starts included", () => {
    const level: Encounter = { reward: 0, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 0, 1]], starts: [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }] };
    const g = testRun(level, [{ kind: "rook", x: 1, y: 3 }, { kind: "king", x: 3, y: 3 }], 0);
    expect(g.units.filter(u => u.side === "white").map(u => [u.id, u.kind, u.x, u.y])).toEqual([["ally-0", "rook", 1, 3], ["king", "king", 3, 3]]);
    expect(deploy(g, "king", { x: 2, y: 3 }).units.filter(u => u.side === "white").map(u => [u.x, u.y])).toEqual([[1, 3], [2, 3]]);
  });
  it("saves and restores the deploy phase", () => {
    const g = deploy(startAt(1, ["king", "rook"], 4), "king", ENCOUNTERS[1].starts[2]);
    expect(readRun(stored(g))).toEqual(g);
  });

  it("moves pieces in their chess shape, sliders any distance", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const g = board([king, rook]);
    // Rook from a1 slides up the whole file; the king blocks the row.
    expect(moveTargets(g, rook)).toEqual([{ x: 0, y: 2 }, { x: 0, y: 1 }, { x: 0, y: 0 }]);
    expect(moveTargets({ ...g, rules: ALL }, rook)).toEqual(moveTargets({ ...g, rules: ONE }, rook));
    // Enemy sliders cross the board in one move too: the rook on f2 slides to b2 to strike the king.
    const far: Unit = { id: "e", side: "black", kind: "rook", x: 5, y: 2, hp: 5 };
    expect(endTurn(board([{ ...king, x: 1, y: 3 }, far], { level: { ...WALLED, walls: [] } })).steps[0]).toMatchObject({ kind: "move", focus: [{ x: 1, y: 2 }] });
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 1, y: 3, hp: 3 };
    expect(moveTargets(board([knight]), knight).map(t => `${t.x},${t.y}`).sort()).toEqual(["0,1", "2,1", "3,2"]);
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", x: 2, y: 3, hp: 1 };
    expect(moveTargets(board([pawn]), pawn)).toEqual([{ x: 2, y: 2 }]);
  });

  it("lets each piece move once, then attack", () => {
    const g = board([king, { id: "p", side: "black", kind: "pawn", x: 1, y: 0, hp: 1 }]);
    const moved = move(g, "king", { x: 1, y: 2 });
    expect(unit(moved, "king")).toMatchObject({ x: 1, y: 2, moved: true });
    expect(move(moved, "king", { x: 1, y: 1 })).toBe(moved);
    // After attacking, a piece can't move.
    const near = board([king, { id: "p", side: "black", kind: "pawn", x: 2, y: 2, hp: 5 }]);
    const hit = attack(near, "king", "p").run;
    expect(move(hit, "king", { x: 0, y: 3 })).toBe(hit);
  });

  it("makes pieces strike the next square in their shape, and bishops any distance down an open diagonal", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const foe: Unit = { id: "f", side: "black", kind: "rook", x: 0, y: 0, hp: 5 };
    const far = board([rook, foe, { ...king, x: 3, y: 3 }]);
    // A rook can't strike down the file from across the board; it has to travel first.
    expect(attackTargets(far, rook)).toEqual([]);
    const near = move(far, "r", { x: 0, y: 1 });
    expect(attackTargets(near, unit(near, "r")!)).toEqual([{ x: 0, y: 0, id: "f" }]);
    const { run } = attack(near, "r", "f");
    expect(unit(run, "f")!.hp).toBe(5 - DAMAGE.rook);
    // Strikes land from where the piece stands: the rook doesn't move, and the surviving rook strikes back.
    expect(unit(run, "r")).toMatchObject({ x: 0, y: 1, hp: 5 - DAMAGE.rook });
    // Bishops strike down the diagonal from where they stand, stopped by the first piece or wall.
    const bishop: Unit = { id: "b", side: "white", kind: "bishop", x: 0, y: 3, hp: 3 };
    expect(attackTargets(board([bishop, { ...foe, x: 3, y: 0 }, { ...king, x: 3, y: 3 }]), bishop)).toEqual([{ x: 3, y: 0, id: "f" }]);
    expect(attackTargets(board([bishop, { ...foe, x: 3, y: 0 }, { ...king, x: 2, y: 1 }]), bishop)).toEqual([]);
    expect(attackTargets(board([bishop, { ...foe, x: 3, y: 0 }, { ...king, x: 0, y: 0 }], { level: { ...WALLED, walls: [{ x: 1, y: 2 }] } }), bishop)).toEqual([]);
    // A ranged strike never draws a strikeback, not even from a bishop on the same diagonal.
    const shot = attack(board([bishop, { ...foe, x: 3, y: 0 }, { ...king, x: 3, y: 3 }]), "b", "f");
    expect(shot.step).toMatchObject({ text: `Bishop strikes enemy rook −${DAMAGE.bishop}`, counter: undefined });
    const duel = attack(board([bishop, { ...foe, kind: "bishop", x: 2, y: 1 }, { ...king, x: 3, y: 3 }]), "b", "f");
    expect(duel.step.counter).toBeUndefined();
    expect(unit(duel.run, "b")!.hp).toBe(3);
    // Up close, the struck bishop does strike back.
    const close = attack(board([bishop, { ...foe, kind: "bishop", x: 1, y: 2 }, { ...king, x: 3, y: 3 }]), "b", "f");
    expect(unit(close.run, "b")!.hp).toBe(3 - DAMAGE.bishop);
    // With range 1, bishops strike only the next diagonal square.
    const adjacent = { rules: { ...RULES, range: { ...RULES.range, bishop: 1 as const } } };
    expect(attackTargets(board([bishop, { ...foe, x: 2, y: 1 }, { ...king, x: 3, y: 3 }], adjacent), bishop)).toEqual([]);
    expect(attackTargets(board([bishop, { ...foe, x: 1, y: 2 }, { ...king, x: 3, y: 3 }], adjacent), bishop)).toEqual([{ x: 1, y: 2, id: "f" }]);
  });

  it("lists the squares a piece can step to and strike a target from", () => {
    // A rook down the file has one way in: the square in front of the target.
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const foe: Unit = { id: "f", side: "black", kind: "pawn", x: 0, y: 0, hp: 1 };
    const g = board([rook, foe, { ...king, x: 3, y: 3 }]);
    expect(approaches(g, "r", "f")).toEqual([{ x: 0, y: 1 }]);
    // The king two squares from a pawn can strike it from any of three squares.
    const k = board([{ ...king, x: 1, y: 3 }, { ...foe, x: 1, y: 1 }]);
    expect(approaches(k, "king", "f").map(t => `${t.x},${t.y}`).sort()).toEqual(["0,2", "1,2", "2,2"]);
    // A knight jumps and strikes in one turn. A piece that already moved has no way in.
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 0, y: 3, hp: 3 };
    const kg = board([knight, { ...foe, x: 3, y: 0 }, { ...king, x: 3, y: 3 }]);
    expect(approaches(kg, "n", "f").map(t => `${t.x},${t.y}`).sort()).toEqual(["1,1", "2,2"]);
    expect(approaches({ ...g, units: g.units.map(u => (u.id === "r" ? { ...u, moved: true } : u)) }, "r", "f")).toEqual([]);
    // Already next to it: no walk needed, so no approach squares.
    expect(approaches(board([{ ...king, x: 1, y: 3 }, { ...foe, x: 1, y: 2 }]), "king", "f")).toEqual([]);
  });

  it("keeps the attacker on its own square even when it kills", () => {
    const g = board([king, { id: "p", side: "black", kind: "pawn", x: 2, y: 2, hp: 1 }]);
    const { run } = attack(g, "king", "p");
    expect(unit(run, "p")).toBeUndefined(); expect(unit(run, "king")).toMatchObject({ x: 1, y: 3 });
    expect(run.phase).toBe("camp");
  });

  it("labels each step with its actor, kind, target and casualties for animation", () => {
    const g = board([king, { id: "p", side: "black", kind: "pawn", x: 2, y: 2, hp: 1 }]);
    expect(attack(g, "king", "p").step).toMatchObject({ actor: "king", kind: "strike", target: "p", killed: ["p"] });
    const { steps } = endTurn(board([king, { id: "p", side: "black", kind: "pawn", x: 1, y: 0, hp: 1 }]));
    expect(steps[0]).toMatchObject({ actor: "p", kind: "move", killed: [] });
  });

  it("makes a struck piece counter an attacker it can reach", () => {
    // An enemy bishop strikes the king diagonally for 2, and the king counters for 2.
    const bishop: Unit = { id: "b", side: "black", kind: "bishop", x: 0, y: 2, hp: 3 };
    const { run, steps } = endTurn(board([king, bishop]));
    expect(unit(run, "king")!.hp).toBe(5 - DAMAGE.bishop);
    expect(unit(run, "b")!.hp).toBe(3 - DAMAGE.king);
    // The counter is its own line in the log, and rides on the strike's step for playback.
    expect(run.log.slice(0, 2)).toEqual(["King counters −2", "Enemy bishop strikes king −2"]);
    expect(steps.find(s => s.kind === "strike")).toMatchObject({ text: "Enemy bishop strikes king −2", counter: "King counters −2" });
  });
  it("makes an enemy piece step next to a target it can't strike from where it stands", () => {
    // The rook sits diagonally from the king, so it can't strike; it steps beside the king, then strikes.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 0, y: 2, hp: 5 };
    const { run } = endTurn(board([king, rook], { level: WALLED }));
    const r = unit(run, "r")!;
    expect(reaches(run, r, r, unit(run, "king")!)).toBe(true);
    expect(unit(run, "king")!.hp).toBe(5 - DAMAGE.rook);
  });
  it("strikes only the neighbours a piece's shape allows", () => {
    const foe = (x: number, y: number): Unit => ({ id: `f${x}${y}`, side: "black", kind: "pawn", x, y, hp: 1 });
    const ring = [foe(0, 0), foe(1, 0), foe(2, 0), foe(0, 1), foe(2, 1), foe(0, 2), foe(1, 2), foe(2, 2)];
    const piece = (kind: Unit["kind"]): Unit => ({ id: "w", side: "white", kind, x: 1, y: 1, hp: 3 });
    const hits = (kind: Unit["kind"]) => attackTargets(board([piece(kind), { ...king, x: 3, y: 3 }, ...ring]), piece(kind)).map(t => t.id).sort();
    expect(hits("rook")).toEqual(["f01", "f10", "f12", "f21"]);
    expect(hits("bishop")).toEqual(["f00", "f02", "f20", "f22"]);
    expect(hits("queen")).toHaveLength(8);
    // A knight strikes a knight's jump away.
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 0, y: 3, hp: 3 };
    expect(attackTargets(board([knight, foe(1, 1), { ...king, x: 3, y: 3 }]), knight)).toEqual([{ x: 1, y: 1, id: "f11" }]);
  });
  it("lets a slider counter only an attacker next to it", () => {
    // A black rook strikes a white rook from the next square; the white rook hits back.
    const mine: Unit = { id: "m", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const theirs: Unit = { id: "t", side: "black", kind: "rook", x: 0, y: 1, hp: 5 };
    const { run } = endTurn(board([{ ...king, x: 3, y: 3 }, mine, theirs], { level: WALLED }));
    expect(unit(run, "t")!.y).toBe(2);
    expect(unit(run, "m")!.hp).toBe(5 - DAMAGE.rook);
    expect(unit(run, "t")!.hp).toBe(5 - DAMAGE.rook);
    expect(reaches(run, unit(run, "m")!, { x: 0, y: 3 }, { x: 0, y: 1 })).toBe(false);
  });
  it("makes any struck piece that survives strike back", () => {
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 2, hp: 5 };
    const { run, step } = attack(board([king, rook]), "king", "r");
    expect(unit(run, "r")!.hp).toBe(5 - DAMAGE.king);
    expect(unit(run, "king")!.hp).toBe(5 - DAMAGE.rook);
    expect(step).toMatchObject({ counter: `Enemy rook counters −${DAMAGE.rook}` });
    // Strikebacks off: no hit back.
    expect(unit(attack(board([king, rook], { rules: { ...RULES, counter: false } }), "king", "r").run, "king")!.hp).toBe(5);
  });
  it("ends the turn of a side whose acting piece fell to a strikeback", () => {
    // Under one move per turn: your pawn strikes the queen and dies to her strikeback; the king can't act after it.
    const ally: Unit = { id: "w", side: "white", kind: "pawn", x: 0, y: 3, hp: 1 };
    const fell = attack(board([{ ...king, x: 3, y: 3 }, { id: "q", side: "black", kind: "queen", x: 1, y: 2, hp: 9 }, ally], { rules: ONE }), "w", "q");
    expect(unit(fell.run, "w")).toBeUndefined();
    expect(sidelined(fell.run, unit(fell.run, "king")!)).toBe(true);
    expect(turnSpent(fell.run)).toBe(true);
    expect(endTurn(fell.run).run.fell).toBeUndefined();
  });
  it("doesn't counter an attacker the struck piece can't reach", () => {
    // A black rook strikes a knight from the next square; knights can't hit adjacent squares.
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 0, y: 3, hp: 3 };
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 0, y: 2, hp: 5 };
    const { run } = endTurn(board([{ ...king, x: 3, y: 3 }, knight, rook], { level: WALLED }));
    expect(unit(run, "n")!.hp).toBe(3 - DAMAGE.rook);
    expect(unit(run, "r")!.hp).toBe(5);
  });

  it("puts the king in check only when the enemy's next turn could kill him", () => {
    // The rook can step next to the king and strike for 2.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 1, hp: 5 };
    const weak = board([{ ...king, hp: 2 }, rook], { level: WALLED });
    expect(kingThreat(weak)).toMatchObject({ damage: 2, attackers: ["r"] });
    expect(inCheck(weak)).toBe(true);
    // At full health the same hit only hurts, so it isn't check.
    expect(inCheck(board([king, rook], { level: WALLED }))).toBe(false);
    // No single move puts it next to the king: no threat at all.
    expect(kingThreat(board([{ ...king, hp: 1 }, { ...rook, x: 5, y: 0 }], { level: WALLED })).damage).toBe(0);
  });
  it("judges the threat by one enemy piece under one move per turn, and adds every hit up otherwise", () => {
    // Two pawns could each hit the 2-HP king for 1.
    const pawn = (id: string, x: number): Unit => ({ id, side: "black", kind: "pawn", x, y: 2, hp: 1 });
    const units = [{ ...king, hp: 2 }, pawn("a", 0), pawn("b", 2)];
    expect(kingThreat(board(units, { rules: ONE }))).toEqual({ damage: 1, attackers: ["a", "b"] });
    expect(inCheck(board(units, { rules: ONE }))).toBe(false);
    expect(kingThreat(board(units, { rules: ALL }))).toEqual({ damage: 2, attackers: ["a", "b"] });
    expect(inCheck(board(units, { rules: ALL }))).toBe(true);
  });
  it("marks every piece that could finish the king on its own", () => {
    const pawn = (id: string, x: number): Unit => ({ id, side: "black", kind: "pawn", x, y: 2, hp: 1 });
    const g = board([{ ...king, hp: 1 }, pawn("a", 0), pawn("b", 2)]);
    expect(kingThreat(g).attackers.sort()).toEqual(["a", "b"]);
  });
  it("lets blocking get the king out of check", () => {
    // With a piece in the way, the rook two squares off can't get next to him this turn.
    const far = board([{ ...king, hp: 2 }, { id: "r", side: "black", kind: "rook", x: 1, y: 1, hp: 5 }], { level: WALLED });
    expect(inCheck(far)).toBe(true);
    expect(inCheck({ ...far, units: [...far.units, { id: "w", side: "white", kind: "pawn", x: 1, y: 2, hp: 1 }] })).toBe(false);
    // A rook of yours beside the gap can slide in to block.
    expect(canEscape({ ...far, units: [...far.units, { id: "w", side: "white", kind: "rook", x: 0, y: 2, hp: 5 }] })).toBe(true);
  });
  it("won't let a move put your own king in check", () => {
    // The pawn can't reach the king on b1 this turn, but on b2 it could strike him from c4.
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 2, y: 0, hp: 1 };
    const g = board([{ ...king, hp: 1 }, pawn]);
    expect(inCheck(g)).toBe(false);
    expect(exposesKing(g, "king", { x: 1, y: 2 })).toBe(true);
    expect(move(g, "king", { x: 1, y: 2 })).toBe(g);
    expect(exposesKing(g, "king", { x: 0, y: 3 })).toBe(false);
    expect(move(g, "king", { x: 0, y: 3 })).not.toBe(g);
  });
  it("won't let a strike whose counter would leave the king in check", () => {
    // Striking the rook: it survives and counters for 2, leaving a 2-HP king it could finish next turn.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 2, hp: 5 };
    const g = board([{ ...king, hp: 4 }, rook]);
    expect(inCheck(g)).toBe(false);
    expect(strikeExposesKing(g, "king", "r")).toBe(true);
    expect(attack(g, "king", "r").run).toBe(g);
    expect(unsafeStrikes(g, "king")).toEqual(["r"]);
    // A healthier king can take it.
    expect(unsafeStrikes(board([{ ...king, hp: 5 }, rook]), "king")).toEqual([]);
  });
  it("flags an enemy whose only walk-up strikes would leave the king in check", () => {
    // The queen counters any next square for 3, leaving the 4-HP king in check from every square he could strike from.
    const queen: Unit = { id: "q", side: "black", kind: "queen", x: 1, y: 1, hp: 9 };
    const g = board([{ ...king, hp: 4 }, queen]);
    expect(inCheck(g)).toBe(false);
    expect(approaches(g, "king", "q")).toEqual([]);
    expect(unsafeStrikes(g, "king")).toEqual(["q"]);
  });
  it("doesn't offer a walk-up strike whose counter would leave the king in check", () => {
    // From b2 the rook on b3 would counter for 2, leaving the king at 2 HP and in check. From a2 or c2
    // the king strikes diagonally, where a rook can't hit back, so those stay on offer.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 1, hp: 5 };
    const g = board([{ ...king, hp: 4 }, rook]);
    expect(inCheck(g)).toBe(false);
    expect(approaches(g, "king", "r").map(t => `${t.x},${t.y}`).sort()).toEqual(["0,2", "2,2"]);
  });
  it("judges a walk-up strike as one move: it may step into danger if the strike removes it", () => {
    // Stepping to b3 in front of the pawn alone would put the 1-HP king in check, but the strike kills the pawn.
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 2, y: 0, hp: 1 };
    const g = board([{ ...king, x: 0, y: 0, hp: 1 }, pawn]);
    expect(inCheck(g)).toBe(false);
    expect(exposesKing(g, "king", { x: 1, y: 1 })).toBe(true);
    expect(approaches(g, "king", "p")).toContainEqual({ x: 1, y: 1 });
    const done = walkAndStrike(g, "king", { x: 1, y: 1 }, "p")!;
    expect(unit(done.walked, "king")).toMatchObject({ x: 1, y: 1 });
    expect(unit(done.run, "p")).toBeUndefined();
    // A plain move there is still refused: on its own it puts the king in check.
    expect(move(g, "king", { x: 1, y: 1 })).toBe(g);
    // But never a walk-up whose counter leaves the king in check.
    const tough: Unit = { id: "r", side: "black", kind: "rook", x: 2, y: 1, hp: 5 };
    expect(walkAndStrike(board([{ ...king, x: 0, y: 0, hp: 4 }, tough]), "king", { x: 1, y: 1 }, "r")).toBeNull();
  });
  it("still lets you act while already in check, so an escape can take several steps", () => {
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 2, hp: 5 };
    const ally: Unit = { id: "w", side: "white", kind: "pawn", x: 4, y: 3, hp: 1 };
    const g = board([{ ...king, hp: 2 }, rook, ally], { level: WALLED });
    expect(inCheck(g)).toBe(true);
    expect(move(g, "w", { x: 4, y: 2 })).not.toBe(g);
  });
  it("won't end your turn in check while there's still a way out", () => {
    // Your rook can slide in front of the king to block the enemy rook's way in.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 1, hp: 5 };
    const blocker: Unit = { id: "w", side: "white", kind: "rook", x: 0, y: 2, hp: 5 };
    const g = board([{ ...king, hp: 2 }, rook, blocker], { level: WALLED });
    expect(inCheck(g)).toBe(true);
    expect(endTurn(g).run).toBe(g);
    // Every piece has already acted and he's still in check: no way out, so the turn can end and the enemy may land the blow.
    const stuck = { ...g, units: g.units.map(u => (u.side === "white" ? { ...u, moved: true, acted: true } : u)) };
    expect(canEscape(stuck)).toBe(false);
    expect(endTurn(stuck).run).not.toBe(stuck);
  });

  it("runs a deterministic enemy turn, then readies the player's pieces", () => {
    const g = move(begin(newRun()), "king", { x: 1, y: 2 });
    const a = endTurn(g), b = endTurn(g);
    expect(a).toEqual(b);
    expect(a.run.phase).toBe("player"); expect(a.run.turn).toBe(2);
    expect(a.run.units.filter(u => u.side === "white").every(u => !u.moved && !u.acted)).toBe(true);
  });

  it("keeps stuck enemy pawns busy when they can do something useful", () => {
    // King steps to a2: the pawn on a3 is blocked, so it waits; the c-pawn marches.
    const level: Encounter = { reward: 0, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 1, 1], ["pawn", 2, 1, 1]], starts: [{ x: 1, y: 3 }] };
    const { run, steps } = endTurn(move(begin(testRun(level, ["king"], 0)), "king", { x: 0, y: 2 }));
    expect(unit(run, "enemy-0-0")).toMatchObject({ x: 0, y: 1 });
    expect(unit(run, "enemy-0-1")).toMatchObject({ x: 2, y: 2 });
    expect(steps.map(s => s.kind)).toEqual(["move"]);
  });
  it("doesn't march pawns away from every target", () => {
    // King behind the pawn's line on the 6×6 bridge: nothing ahead to chase, and the far row is too far.
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 };
    const { run } = endTurn(board([{ ...king, x: 0, y: 0 }, pawn], { level: BRIDGE }));
    expect(unit(run, "p")).toMatchObject({ x: 2, y: 1 });
  });
  it("ends the run when the king falls", () => {
    // The king has already acted, so there's no way out of check: the turn ends and the pawn lands the blow.
    const g = board([{ ...king, hp: 1, moved: true, acted: true }, { id: "p", side: "black", kind: "pawn", x: 0, y: 2, hp: 1 }]);
    expect(endTurn(g).run.phase).toBe("defeat");
  });

  it("keeps a pawn on the far row a pawn, with nowhere further to step", () => {
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", x: 0, y: 1, hp: 2 };
    const reached = move(board([{ ...king, x: 3, y: 3 }, pawn]), "p", { x: 0, y: 0 });
    expect(unit(reached, "p")).toMatchObject({ kind: "pawn", x: 0, y: 0 });
    const next = endTurn(reached).run;
    expect(moveTargets(next, unit(next, "p")!)).toEqual([]);
    // An enemy pawn that reaches your end stays a pawn too.
    const { run, steps } = endTurn(board([{ ...king, x: 0, y: 3 }, { id: "e", side: "black", kind: "pawn", x: 3, y: 2, hp: 1 }]));
    expect(unit(run, "e")).toMatchObject({ kind: "pawn", x: 3, y: 3 });
    expect(steps.map(s => s.kind)).toEqual(["move"]);
  });
  it("offers a cheap pawn recruit at camp", () => {
    const g = { ...newRun(), phase: "camp" as const, gold: COST.pawn };
    expect(campReason(g, "pawn")).toBe("");
    const next = leaveCamp(buy(g, "pawn"));
    expect(next.units.filter(u => u.side === "white" && u.kind === "pawn")).toHaveLength(1);
    expect(next.gold).toBe(0);
  });
  it("lets you shop more than once at the hub, then take the road", () => {
    const hurt = { ...newRun(), phase: "camp" as const, gold: 20, units: [{ ...king, hp: 2 }] };
    const healed = buy(hurt, "heal");
    expect(unit(healed, "king")!.hp).toBe(4);
    const shopped = buy(buy(healed, "pawn"), "bishop");
    expect(shopped.gold).toBe(20 - COST.heal - COST.pawn - COST.bishop);
    expect(shopped.recruits).toEqual(["pawn", "bishop"]);
    // Recruits wait in the barracks (off the board) until you leave, so saves stay valid.
    expect(readRun(stored(shopped))).toEqual(shopped);
    expect(readRun(stored({ ...shopped, recruits: ["queen"] }))).toBeNull();
    expect(readRun(stored({ ...newRun(), recruits: ["pawn"] }))).toBeNull();
    // More recruits than the next road has squares for would leave pieces with nowhere to stand.
    expect(readRun(stored({ ...shopped, recruits: ["pawn", "pawn", "pawn"] }))).toBeNull();
    const next = leaveCamp(shopped);
    expect(next).toMatchObject({ phase: "deploy", encounter: 1, recruits: undefined });
    expect(next.history.slice(-3)).toEqual(["Camp: pawn", "Camp: bishop", "Camp: road"]);
    expect(next.units.filter(u => u.side === "white").map(u => [u.kind, u.hp])).toEqual([["king", 4], ["pawn", HP.pawn], ["bishop", HP.bishop]]);
  });
  it("refuses recruits once the next road has no room for them", () => {
    // The next battle has three start squares: king + two recruits fill them.
    const g = { ...newRun(), phase: "camp" as const, gold: 99, units: [king] };
    const full = buy(buy(g, "pawn"), "pawn");
    expect(campReason(full, "rook")).toBe("Army full");
    expect(buy(full, "rook")).toBe(full);
    expect(buy({ ...g, gold: 1 }, "pawn").gold).toBe(1);
  });
  it("restores valid saves and rejects broken ones", () => {
    const g = newRun(); expect(readRun(stored(g))).toEqual(g);
    expect(readRun(stored({ ...g, units: [...g.units, { ...g.units[0], id: "dup" }] }))).toBeNull();
    expect(readRun("{")).toBeNull();
    // A studio run's unsaved rules never come back as a saved run.
    expect(readRun(JSON.stringify({ ...g, rules: RULES }))).toBeNull();
    expect(readRun(stored({ ...g, units: g.units.filter(u => u.side === "white") }))).toBeNull();
    expect(readRun(stored({ ...g, units: [...g.units, { id: "x", side: "black", kind: "constructor", x: 3, y: 0, hp: 1 }] }))).toBeNull();
    expect(readRun(stored({ ...g, turn: 0 }))).toBeNull();
    // Saves from when pieces could defend still load; the old fields mean nothing now.
    const old = { ...g, defended: { white: 2, black: 1 }, units: g.units.map(u => ({ ...u, defending: true })) };
    expect(readRun(stored(old))).not.toBeNull();
  });
  it("fits HP to the rules: a spawn without HP is full, one above the max and an old save come back at the max", () => {
    const level: Encounter = { reward: 0, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 0], ["rook", 2, 0, 9], ["knight", 3, 0, 1]], starts: [{ x: 1, y: 3 }] };
    const weak: Rules = { ...RULES, hp: { ...RULES.hp, pawn: 1, rook: 2, king: 3 } };
    expect(testRun(level, ["king"], 0, weak).units.map(u => [u.kind, u.hp])).toEqual([["king", 3], ["pawn", 1], ["rook", 2], ["knight", 1]]);
    expect(testRun(level, ["king"], 0).units.map(u => u.hp)).toEqual([HP.king, HP.pawn, HP.rook, 1]);
    const strong = newRun();
    expect(turns.readRun(stored(strong), { ...FIXED, rules: weak })!.units.map(u => u.hp)).toEqual([3, 1, 1]);
  });

  it("plays a single level on its own in a test run, ending in victory with no hideout", () => {
    const level: Encounter = { reward: 5, width: 5, height: 3, walls: [{ x: 4, y: 0 }], spawns: [["pawn", 1, 1, 1]], starts: [{ x: 0, y: 2 }, { x: 2, y: 2 }] };
    const g = begin(testRun(level, ["king", "rook"], 1));
    expect(g.encounter).toBe(1);
    expect(g.units.map(u => [u.kind, u.side, u.x, u.y, u.hp])).toEqual([["king", "white", 0, 2, HP.king], ["rook", "white", 2, 2, HP.rook], ["pawn", "black", 1, 1, 1]]);
    // The board is the level's, not the real battle 2's.
    expect(passable(g, { x: 4, y: 1 })).toBe(true);
    expect(passable(g, { x: 4, y: 0 })).toBe(false);
    expect(passable(g, { x: 5, y: 1 })).toBe(false);
    const won = attack(g, "king", g.units[2].id).run;
    expect(won.phase).toBe("victory");
    expect(won.gold).toBe(g.gold + 5);
  });
  it("lets every enemy piece act each turn when every piece acts", () => {
    const level: Encounter = { reward: 0, width: 4, height: 6, walls: [], spawns: [["pawn", 0, 0, 1], ["pawn", 3, 0, 1], ["rook", 1, 0, 5]], starts: [{ x: 1, y: 5 }] };
    const { steps } = endTurn(begin(testRun(level, ["king"], 0, ALL)));
    expect(new Set(steps.map(s => s.actor))).toEqual(new Set(["enemy-0-0", "enemy-0-1", "enemy-0-2"]));
    // Each piece moves at most once and strikes at most once.
    for (const id of ["enemy-0-0", "enemy-0-1", "enemy-0-2"]) {
      expect(steps.filter(s => s.actor === id && s.kind === "move").length).toBeLessThanOrEqual(1);
      expect(steps.filter(s => s.actor === id && s.kind === "strike").length).toBeLessThanOrEqual(1);
    }
  });
  it("lets every one of your pieces move and strike in the same turn when every piece acts", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const bishop: Unit = { id: "b", side: "white", kind: "bishop", x: 3, y: 2, hp: 3 };
    const foes: Unit[] = [{ id: "f", side: "black", kind: "rook", x: 0, y: 0, hp: 5 }, { id: "g", side: "black", kind: "rook", x: 1, y: 0, hp: 5 }];
    let g = board([{ ...king, x: 2, y: 3 }, rook, bishop, ...foes], { rules: ALL });
    g = move(g, "r", { x: 0, y: 1 });
    g = attack(g, "r", "f").run;
    g = move(g, "b", { x: 2, y: 1 });
    g = attack(g, "b", "g").run;
    g = move(g, "king", { x: 2, y: 2 });
    expect(unit(g, "f")!.hp).toBe(5 - DAMAGE.rook);
    expect(unit(g, "g")!.hp).toBe(5 - DAMAGE.bishop);
    expect(g.units.filter(u => u.side === "white").every(u => u.moved)).toBe(true);
    // Once a piece has struck it's done for the turn.
    expect(move(g, "r", { x: 0, y: 2 })).toBe(g);
    expect(attack(g, "r", "f").run).toBe(g);
  });
  it("starts a fresh, saveable run at a later battle that still goes through the hideout", () => {
    const g = startAt(1, ["king", "rook"], 4);
    expect(g).toMatchObject({ encounter: 1, gold: 4, phase: "deploy", turn: 1 });
    expect(g.units.filter(u => u.side === "white").map(u => [u.id, u.kind, u.x, u.y])).toEqual([["king", "king", ENCOUNTERS[1].starts[0].x, ENCOUNTERS[1].starts[0].y], ["ally-1", "rook", ENCOUNTERS[1].starts[1].x, ENCOUNTERS[1].starts[1].y]]);
    expect(readRun(stored(g))).not.toBeNull();
    const cleared = { ...begin(g), units: g.units.filter(u => u.side === "white") };
    expect(attack({ ...cleared, units: [...cleared.units, { id: "e", side: "black", kind: "pawn", x: g.units[0].x, y: g.units[0].y - 1, hp: 1 }] }, "king", "e").run.phase).toBe("camp");
  });
  it("logs a turn where the enemy does nothing", () => {
    const level: Encounter = { reward: 0, width: 4, height: 4, walls: [{ x: 0, y: 1 }], spawns: [["pawn", 0, 0, 1]], starts: [{ x: 3, y: 3 }] };
    const { run, steps } = endTurn(begin(testRun(level, ["king"], 0)));
    expect(steps).toEqual([]);
    expect(run.log[0]).toBe("Enemy waits");
    expect(run.turn).toBe(2);
  });
  it("plans the enemy turn End turn would play, from a previewed move, without changing the board", () => {
    // A rook on b3 steps beside the king and strikes; move the king away and the plan changes.
    const rook: Unit = { id: "e", side: "black", kind: "rook", x: 1, y: 1, hp: 5 };
    const g = board([king, rook, { id: "p", side: "black", kind: "pawn", x: 3, y: 0, hp: 1 }], { rules: ONE });
    const frozen = JSON.stringify(g), plan = enemyPlan(g);
    expect(JSON.stringify(g)).toBe(frozen);
    expect(plan).toEqual(endTurn(g).steps);
    expect(intentOf(g, plan, "e")).toMatchObject({ strike: { target: "king", damage: DAMAGE.rook, kills: false } });
    // Under one move per turn the other enemy waits.
    expect(intentWaits(intentOf(g, plan, "p")!)).toBe(true);
    const moved = move(g, "king", { x: 0, y: 3 });
    expect(intentOf(moved, enemyPlan(moved), "e")).not.toEqual(intentOf(g, plan, "e"));
    expect(intentOf(g, plan, "king")).toBeNull();
  });
  it("never restores a test run as a saved run", () => {
    const level: Encounter = { ...ENCOUNTERS[0] };
    expect(readRun(JSON.stringify(testRun(level, ["king"], 0)))).toBeNull();
  });
  it("plays a whole run with a simple strategy without breaking the board", () => {
    let g = newRun(), turns = 0;
    while (!["victory", "defeat"].includes(g.phase) && turns++ < 80) {
      if (g.phase === "deploy") { g = begin(g); continue; }
      if (g.phase === "camp") { g = leaveCamp(buy(g, unit(g, "king")!.hp < 3 ? "heal" : "rook")); continue; }
      g = playTurn(g);
      if (g.phase === "player") g = endTurn(g).run;
      expect(new Set(g.units.map(u => `${u.x},${u.y}`)).size).toBe(g.units.length);
    }
    // Winning is a balance question, not a rule: tests/balance.test.ts reports it.
    console.log(`Simple strategy run: ${g.phase} at battle ${g.encounter + 1}, turn ${g.turn}`);
  });

  describe("one move per turn", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const foe: Unit = { id: "f", side: "black", kind: "rook", x: 0, y: 0, hp: 5 };
    const start = () => board([{ ...king, x: 3, y: 3 }, rook, foe], { rules: ONE });
    it("lets only the piece that acted first carry on: move, then strike", () => {
      const moved = move(start(), "r", { x: 0, y: 1 });
      const k = unit(moved, "king")!;
      expect(sidelined(moved, k)).toBe(true);
      expect(moveTargets(moved, k)).toEqual([]);
      // The rook itself may still strike.
      expect(attack(moved, "r", "f").run).not.toBe(moved);
      // Striking without moving takes the turn too.
      const struck = attack(move(start(), "r", { x: 0, y: 1 }), "r", "f").run;
      expect(moveTargets(struck, unit(struck, "king")!)).toEqual([]);
    });
    it("passes the turn once the piece has acted, or has moved with nothing left worth doing", () => {
      expect(turnSpent(start())).toBe(false);
      // Next to the enemy rook: it can strike, so the turn waits.
      expect(turnSpent(move(start(), "r", { x: 0, y: 1 }))).toBe(false);
      expect(turnSpent(attack(move(start(), "r", { x: 0, y: 1 }), "r", "f").run)).toBe(true);
      // The king steps to a square with nothing in reach to strike.
      const far = board([{ ...king, x: 3, y: 3 }, { ...foe, x: 0, y: 0, kind: "pawn", hp: 1 }], { rules: ONE, level: BRIDGE });
      expect(turnSpent(move(far, "king", { x: 3, y: 2 }))).toBe(true);
      // Every piece acting never passes the turn on its own.
      const all = board(start().units, { rules: ALL });
      expect(turnSpent(attack(move(all, "r", { x: 0, y: 1 }), "r", "f").run)).toBe(false);
    });
    it("makes the enemy act with one piece: its best action and that piece's follow-up", () => {
      const level: Encounter = { reward: 0, width: 4, height: 6, walls: [], spawns: [["pawn", 0, 0, 1], ["pawn", 3, 0, 1], ["rook", 1, 0, 5]], starts: [{ x: 1, y: 5 }] };
      const { run, steps } = endTurn(begin(testRun(level, ["king"], 0, ONE)));
      expect(new Set(steps.map(s => s.actor)).size).toBe(1);
      expect(steps.length).toBeGreaterThan(0);
      expect(run.turn).toBe(2);
      // The rook slides next to the king and strikes him.
      const { steps: struck } = endTurn(board([{ ...king, x: 1, y: 3 }, { ...foe, x: 0, y: 1 }, { id: "p", side: "black", kind: "pawn", x: 3, y: 0, hp: 1 }], { rules: ONE }));
      expect(struck.map(s => [s.actor, s.kind])).toEqual([["f", "move"], ["f", "strike"]]);
    });
  });
});

describe("switches and spear traps", () => {
  // Spears sweep rows 1 and 2; the switch is the bottom-left corner.
  const TRAP: Encounter = { reward: 5, width: 6, height: 5, walls: [], switches: [{ type: "spears", x: 0, y: 4, rows: [1, 2], damage: 2 }], spawns: [["knight", 0, 1], ["pawn", 2, 1], ["pawn", 4, 2], ["rook", 3, 0]], starts: [{ x: 1, y: 4 }, { x: 3, y: 4 }] };
  const army: Placed[] = [{ kind: "king", x: 1, y: 4 }, { kind: "pawn", x: 3, y: 4 }];
  const deal = (level: Encounter = TRAP, placed: Placed[] = army) => begin(testRun(level, placed, 1, ONE));
  it("fires when your piece steps on it: every piece on the rows takes the hit, and the turn is spent", () => {
    const g = deal();
    expect(turns.armedRows(g)).toEqual([1, 2]);
    const { run, step } = turns.stepOnto(g, "king", { x: 0, y: 4 });
    expect(step?.kind).toBe("spring");
    expect(step?.rows).toEqual([1, 2]);
    // Pawns die, the knight is hurt, the rook on row 0 is untouched.
    expect(run.units.filter(u => u.side === "black").map(u => [u.kind, u.hp])).toEqual([["knight", HP.knight - 2], ["rook", HP.rook]]);
    expect(step?.killed).toHaveLength(2);
    expect(unit(run, "king")).toMatchObject({ x: 0, y: 4, moved: true, acted: true });
    expect(run.sprung).toEqual([0]);
    expect(turns.armedRows(run)).toEqual([]);
    expect(turnSpent(run)).toBe(true);
  });
  it("fires once: a sprung switch is an ordinary square", () => {
    const used = { ...deal(), sprung: [0] };
    const { run, step } = turns.stepOnto(used, "king", { x: 0, y: 4 });
    expect(step).toBeNull();
    expect(unit(run, "king")).toMatchObject({ x: 0, y: 4, moved: true });
    expect(unit(run, "king")?.acted).toBeFalsy();
    expect(run.units.filter(u => u.side === "black")).toHaveLength(4);
  });
  it("hits your own pieces on the rows too, and won't kill your own king", () => {
    const mine = deal({ ...TRAP, starts: [{ x: 1, y: 4 }, { x: 5, y: 2 }] }, [{ kind: "king", x: 1, y: 4 }, { kind: "pawn", x: 5, y: 2 }]);
    expect(turns.stepOnto(mine, "king", { x: 0, y: 4 }).run.units.some(u => u.side === "white" && u.kind === "pawn")).toBe(false);
    // The king stands in the spears' row; your pawn could press the switch, but that would kill him.
    const lane: Encounter = { ...TRAP, switches: [{ type: "spears", x: 1, y: 3, rows: [2], damage: 9 }], starts: [{ x: 3, y: 2 }, { x: 1, y: 4 }] };
    const risky = deal(lane, [{ kind: "king", x: 3, y: 2 }, { kind: "pawn", x: 1, y: 4 }]);
    expect(turns.stepOnto(risky, "ally-1", { x: 1, y: 3 }).run).toBe(risky);
    expect(move(risky, "ally-1", { x: 1, y: 3 })).toBe(risky);
  });
  it("wins the battle when the spears take the last enemy", () => {
    const g = deal({ ...TRAP, spawns: [["pawn", 2, 1], ["pawn", 4, 2]] });
    expect(turns.stepOnto(g, "king", { x: 0, y: 4 }).run.phase).toBe("victory");
  });
  it("is saved as sprung, and a bad switch index won't load", () => {
    const fired = { ...turns.stepOnto(deal(), "king", { x: 0, y: 4 }).run, level: undefined, encounter: 0 };
    const data = { rules: ONE, levels: [TRAP, TRAP] };
    expect(turns.readRun(stored(fired), data)?.sprung).toEqual([0]);
    expect(turns.readRun(stored({ ...fired, sprung: [3] }), data)).toBeNull();
  });
});

describe("floor tiles: ice and sludge, and the deploy kit", () => {
  const LAB: Encounter = { reward: 0, width: 6, height: 6, walls: [], spawns: [["pawn", 5, 0]], starts: [{ x: 3, y: 5 }, { x: 4, y: 5 }] };
  const tiles = (...t: [TileType, number, number][]): Partial<Encounter> => ({ tiles: t.map(([type, x, y]) => ({ type, x, y })) });
  const on = (extra: Partial<Encounter>, ...units: Unit[]) => board(units, { level: { ...LAB, ...extra }, rules: ONE });
  const w = (id: string, kind: Kind, x: number, y: number): Unit => ({ id, side: "white", kind, x, y, hp: HP[kind] });
  const sq = (g: Run, id: string) => moveTargets(g, unit(g, id)!).map(t => `${t.x},${t.y}`).sort();
  it("slides a piece that ends on ice to the first square past it", () => {
    expect(sq(on(tiles(["ice", 2, 3]), w("p", "pawn", 2, 4)), "p")).toEqual(["2,2"]);
    expect(sq(on(tiles(["ice", 2, 3], ["ice", 2, 2]), w("p", "pawn", 2, 4)), "p")).toEqual(["2,1"]);
    // A king stepping diagonally onto ice slides on diagonally.
    expect(sq(on(tiles(["ice", 3, 4]), w("k", "king", 4, 5)), "k")).toContain("2,3");
  });
  it("refuses a move whose slide is blocked, so nobody stands on ice", () => {
    expect(sq(on(tiles(["ice", 2, 3]), w("p", "pawn", 2, 4), w("x", "rook", 2, 2)), "p")).toEqual([]);
    expect(sq(on(tiles(["ice", 0, 4]), w("p", "pawn", 0, 5)), "p")).toEqual(["0,3"]);
    const edge = on(tiles(["ice", 2, 0]), w("p", "pawn", 2, 1));
    expect(sq(edge, "p")).toEqual([]);
  });
  it("lets sliders cross ice but not stop on it, and knights never land on it", () => {
    const rook = sq(on(tiles(["ice", 0, 3]), w("r", "rook", 0, 5)), "r");
    expect(rook).toContain("0,4"); expect(rook).toContain("0,2"); expect(rook).not.toContain("0,3");
    expect(sq(on(tiles(["ice", 2, 3]), w("n", "knight", 1, 5)), "n")).not.toContain("2,3");
  });
  it("burns each side's pieces left in sludge as that side's turn ends", () => {
    // Your rook sits in sludge; the enemy pawn in sludge is walled in by your pawn and can't leave.
    const g = on(tiles(["sludge", 0, 3], ["sludge", 5, 0]), w("king", "king", 3, 5), w("r", "rook", 0, 3), w("p", "pawn", 5, 1), { id: "e", side: "black", kind: "pawn", x: 5, y: 0, hp: 2 });
    const { run, steps } = endTurn(g);
    expect(unit(run, "r")?.hp).toBe(HP.rook - turns.SLUDGE_BURN);
    expect(unit(run, "e")?.hp).toBe(2 - turns.SLUDGE_BURN);
    expect(unit(run, "p")?.hp).toBe(HP.pawn);
    expect(steps.filter(s => s.kind === "sludge").map(s => s.damage.map(d => d.id))).toEqual([["r"], ["e"]]);
  });
  it("can kill with the burn, and won't let your king step into a burn that finishes him", () => {
    const g = on(tiles(["sludge", 0, 3]), w("king", "king", 3, 5), { ...w("p", "pawn", 0, 3), hp: 1 }, { id: "e", side: "black", kind: "rook", x: 5, y: 0, hp: 5 });
    expect(unit(endTurn(g).run, "p")).toBeUndefined();
    const weak = on(tiles(["sludge", 3, 4]), { ...w("king", "king", 3, 5), hp: 1 }, { id: "e", side: "black", kind: "pawn", x: 0, y: 0, hp: 1 });
    expect(move(weak, "king", { x: 3, y: 4 })).toBe(weak);
    const strong = on(tiles(["sludge", 3, 4]), w("king", "king", 3, 5), { id: "e", side: "black", kind: "pawn", x: 0, y: 0, hp: 1 });
    expect(unit(move(strong, "king", { x: 3, y: 4 }), "king")).toMatchObject({ x: 3, y: 4 });
  });
  it("keeps the enemy out of sludge unless it lines up a strike", () => {
    const g = on(tiles(["sludge", 2, 2]), w("king", "king", 2, 5), { id: "e", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 });
    expect(enemyPlan(g).some(s => s.kind === "move" && s.focus.some(p => p.x === 2 && p.y === 2))).toBe(false);
  });
  it("ends slides on sludge, and a slider in sludge moves one square", () => {
    const up = sq(on(tiles(["sludge", 0, 3]), w("r", "rook", 0, 5)), "r").filter(s => s.startsWith("0,"));
    expect(up).toEqual(["0,3", "0,4"]);
    expect(sq(on(tiles(["sludge", 0, 3]), w("r", "rook", 0, 3)), "r")).toEqual(["0,2", "0,4", "1,3"]);
    // An ice slide that runs into sludge stops in it.
    expect(sq(on(tiles(["ice", 2, 3], ["sludge", 2, 2]), w("p", "pawn", 2, 4)), "p")).toEqual(["2,2"]);
    // Kings and knights leave sludge as usual.
    expect(sq(on(tiles(["sludge", 2, 3]), w("n", "knight", 2, 3)), "n").length).toBeGreaterThan(2);
  });
  it("moves enemy pieces by the same rules", () => {
    const g = on(tiles(["ice", 2, 2]), w("king", "king", 5, 5), { id: "e", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 });
    expect(sq(g, "e")).toEqual(["2,3"]);
  });
  it("lets you lay kit tiles during deploy, away from enemies and starts, and pick them back up", () => {
    const level: Encounter = { ...LAB, kit: { ice: 1, sludge: 1 } };
    const g = testRun(level, [{ kind: "king", x: 3, y: 5 }], 0);
    expect(turns.kitLeft(g, "ice")).toBe(1);
    const iced = turns.lay(g, "ice", { x: 1, y: 3 });
    expect(iced.placed).toEqual([{ type: "ice", x: 1, y: 3 }]);
    expect(turns.kitLeft(iced, "ice")).toBe(0);
    expect(turns.lay(iced, "ice", { x: 2, y: 3 })).toBe(iced);
    // Not on a start, a piece, or next to an enemy (the pawn on f6).
    expect(turns.canLay(g, { x: 4, y: 5 })).toBe(false);
    expect(turns.canLay(g, { x: 3, y: 5 })).toBe(false);
    expect(turns.canLay(g, { x: 4, y: 1 })).toBe(false);
    expect(turns.unlay(iced, { x: 1, y: 3 }).placed).toEqual([]);
    // Laid tiles play once the battle begins; the pick-up is deploy only.
    const live = begin(iced);
    expect(turns.tileAt(live, { x: 1, y: 3 })).toBe("ice");
    expect(turns.lay(live, "sludge", { x: 1, y: 2 })).toBe(live);
    expect(turns.unlay(live, { x: 1, y: 3 })).toBe(live);
  });
});
