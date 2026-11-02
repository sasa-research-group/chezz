import { describe, expect, it } from "vitest";
import { COST, DAMAGE, ENCOUNTERS, HP, approaches, attack, attackTargets, buy, campReason, canEscape, defend, endTurn, exposesKing, inCheck, kingThreat, leaveCamp, move, moveTargets, newRun, passable, playtest, promote, reaches, readRun, strikeExposesKing, unsafeStrikes, walkAndStrike } from "../src/game/turns";
import type { Encounter, Run, Unit } from "../src/game/turns";
import { playTurn } from "./turns-strategy";

const king: Unit = { id: "king", side: "white", kind: "king", x: 1, y: 3, hp: 5 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("turn-based rules", () => {
  it("opens on the player's turn", () => {
    const g = newRun();
    expect(g.phase).toBe("player");
    expect(g.units.filter(u => u.side === "white")).toHaveLength(1);
  });

  it("moves pieces in their chess shape, sliders any distance", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const g = board([king, rook]);
    // Rook from a1 slides up the whole file; the king blocks the row.
    expect(moveTargets(g, rook)).toEqual([{ x: 0, y: 2 }, { x: 0, y: 1 }, { x: 0, y: 0 }]);
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 1, y: 3, hp: 3 };
    expect(moveTargets(board([knight]), knight).map(t => `${t.x},${t.y}`).sort()).toEqual(["0,1", "2,1", "3,2"]);
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", x: 2, y: 3, hp: 1 };
    expect(moveTargets(board([pawn]), pawn)).toEqual([{ x: 2, y: 2 }]);
  });

  it("lets each piece move once, then attack or defend", () => {
    const g = board([king, { id: "p", side: "black", kind: "pawn", x: 1, y: 0, hp: 1 }]);
    const moved = move(g, "king", { x: 1, y: 2 });
    expect(unit(moved, "king")).toMatchObject({ x: 1, y: 2, moved: true });
    expect(move(moved, "king", { x: 1, y: 1 })).toBe(moved);
    const braced = defend(moved, "king");
    expect(unit(braced, "king")!.defending).toBe(true);
    expect(defend(braced, "king")).toBe(braced);
    // After attacking, a piece can't move.
    const near = board([king, { id: "p", side: "black", kind: "pawn", x: 2, y: 2, hp: 5 }]);
    const hit = attack(near, "king", "p").run;
    expect(move(hit, "king", { x: 0, y: 3 })).toBe(hit);
  });

  it("makes every piece strike only from an adjacent square in its shape", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const foe: Unit = { id: "f", side: "black", kind: "rook", x: 0, y: 0, hp: 5 };
    const far = board([rook, foe, { ...king, x: 3, y: 3 }]);
    // A rook can't strike down the file from across the board; it has to travel first.
    expect(attackTargets(far, rook)).toEqual([]);
    const near = move(far, "r", { x: 0, y: 1 });
    expect(attackTargets(near, unit(near, "r")!)).toEqual([{ x: 0, y: 0, id: "f" }]);
    const { run } = attack(near, "r", "f");
    expect(unit(run, "f")!.hp).toBe(5 - DAMAGE.rook);
    // Strikes land from where the piece stands: the rook doesn't move and takes nothing.
    expect(unit(run, "r")).toMatchObject({ x: 0, y: 1, hp: 5 });
    // Bishops strike only the next diagonal square.
    const bishop: Unit = { id: "b", side: "white", kind: "bishop", x: 0, y: 3, hp: 3 };
    expect(attackTargets(board([bishop, { ...foe, x: 2, y: 1 }, { ...king, x: 3, y: 3 }]), bishop)).toEqual([]);
    expect(attackTargets(board([bishop, { ...foe, x: 1, y: 2 }, { ...king, x: 3, y: 3 }]), bishop)).toEqual([{ x: 1, y: 2, id: "f" }]);
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

  it("makes a defender block 1 and counter an attacker it can reach", () => {
    // An enemy bishop strikes the defending king diagonally: 2 - 1 = 1 damage, and the king counters for 2.
    const bishop: Unit = { id: "b", side: "black", kind: "bishop", x: 0, y: 2, hp: 3 };
    const g = defend(board([king, bishop]), "king");
    const { run } = endTurn(g);
    expect(unit(run, "king")!.hp).toBe(5 - (DAMAGE.bishop - 1));
    expect(unit(run, "b")!.hp).toBe(3 - DAMAGE.king);
  });
  it("makes an enemy piece step next to a target it can't strike from where it stands", () => {
    // The rook sits diagonally from the king, so it can't strike; it steps beside the king, then strikes.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 0, y: 2, hp: 5 };
    const { run } = endTurn(board([king, rook], { encounter: 1 }));
    const r = unit(run, "r")!;
    expect(reaches(run, r, r, unit(run, "king")!)).toBe(true);
    expect(unit(run, "king")!.hp).toBe(5 - DAMAGE.rook);
  });
  it("makes an enemy brace against a piece that can step in and strike it", () => {
    // The rook can slide next to the cornered knight and strike for a kill. Walls block every jump, so bracing is all it can do.
    const level: Encounter = { reward: 0, width: 4, height: 4, walls: [{ x: 1, y: 2 }, { x: 2, y: 1 }], spawns: [], starts: [] };
    const knight: Unit = { id: "n", side: "black", kind: "knight", x: 0, y: 0, hp: 3 };
    // It already moved this turn; it can still step in next turn.
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5, moved: true };
    const { run } = endTurn(board([{ ...king, x: 3, y: 3 }, rook, knight], { level }));
    expect(unit(run, "n")).toMatchObject({ x: 0, y: 0, defending: true });
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
  it("doesn't make the enemy strike for 0 into a defender", () => {
    // On the 6×6 bridge, so the pawn has no far row to race for this turn.
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 3, y: 2, hp: 1 };
    const { run } = endTurn(defend(board([{ ...king, x: 2, y: 3 }, pawn], { encounter: 2 }), "king"));
    expect(unit(run, "p")).toBeDefined();
    expect(unit(run, "king")!.hp).toBe(5);
  });
  it("lets a defending slider counter only an attacker next to it", () => {
    // A black rook strikes a defending white rook from the next square; the defender hits back.
    const mine: Unit = { id: "m", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const theirs: Unit = { id: "t", side: "black", kind: "rook", x: 0, y: 1, hp: 5 };
    const { run } = endTurn(defend(board([{ ...king, x: 3, y: 3 }, mine, theirs], { encounter: 1 }), "m"));
    expect(unit(run, "t")!.y).toBe(2);
    expect(unit(run, "m")!.hp).toBe(5 - (DAMAGE.rook - 1));
    expect(unit(run, "t")!.hp).toBe(5 - DAMAGE.rook);
    expect(reaches(run, unit(run, "m")!, { x: 0, y: 3 }, { x: 0, y: 1 })).toBe(false);
  });
  it("doesn't counter an attacker the defender can't reach", () => {
    // A black rook strikes a defending knight from the next square; knights can't hit adjacent squares.
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 0, y: 3, hp: 3 };
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 0, y: 2, hp: 5 };
    const g = defend(board([{ ...king, x: 3, y: 3 }, knight, rook], { encounter: 1 }), "n");
    const { run } = endTurn(g);
    expect(unit(run, "n")!.hp).toBe(3 - (DAMAGE.rook - 1));
    expect(unit(run, "r")!.hp).toBe(5);
  });

  it("puts the king in check only when the enemy's next turn could kill him", () => {
    // The rook can step next to the king and strike for 3.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 1, hp: 5 };
    const weak = board([{ ...king, hp: 3 }, rook], { encounter: 1 });
    expect(kingThreat(weak)).toMatchObject({ damage: 3, attackers: ["r"] });
    expect(inCheck(weak)).toBe(true);
    // At full health the same hit only hurts, so it isn't check.
    expect(inCheck(board([king, rook], { encounter: 1 }))).toBe(false);
    // No single move puts it next to the king: no threat at all.
    expect(kingThreat(board([{ ...king, hp: 1 }, { ...rook, x: 5, y: 0 }], { encounter: 1 })).damage).toBe(0);
  });
  it("counts an enemy pawn that promotes and then strikes as a threat", () => {
    // The pawn steps onto your back row, becomes a queen, and strikes for 3.
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 3, y: 4, hp: 1 };
    const g = board([{ ...king, x: 2, y: 4, hp: 3 }, pawn], { encounter: 2 });
    expect(kingThreat(g)).toMatchObject({ damage: 3, attackers: ["p"] });
    expect(inCheck(g)).toBe(true);
  });
  it("marks every piece that could finish the king on its own", () => {
    const pawn = (id: string, x: number): Unit => ({ id, side: "black", kind: "pawn", x, y: 2, hp: 1 });
    const g = board([{ ...king, hp: 1 }, pawn("a", 0), pawn("b", 2)]);
    expect(kingThreat(g).attackers.sort()).toEqual(["a", "b"]);
  });
  it("lets defending or blocking get the king out of check", () => {
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 2, hp: 5 };
    const g = board([{ ...king, hp: 3 }, rook], { encounter: 1 });
    expect(inCheck(g)).toBe(true);
    // Defending takes 1 off the hit: 2 damage no longer kills a 3-HP king.
    expect(inCheck(defend(g, "king"))).toBe(false);
    // Blocking works too: with a piece in the way, the rook two squares off can't get next to him this turn.
    const far = board([{ ...king, hp: 3 }, { ...rook, y: 1 }], { encounter: 1 });
    expect(inCheck(far)).toBe(true);
    expect(inCheck({ ...far, units: [...far.units, { id: "w", side: "white", kind: "pawn", x: 1, y: 2, hp: 1 }] })).toBe(false);
    expect(canEscape(g)).toBe(true);
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
    // Striking the defending rook: it survives and counters for 3, leaving a 1-HP king it could finish next turn.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 2, hp: 5, defending: true };
    const g = board([{ ...king, hp: 4 }, rook]);
    expect(inCheck(g)).toBe(false);
    expect(strikeExposesKing(g, "king", "r")).toBe(true);
    expect(attack(g, "king", "r").run).toBe(g);
    expect(unsafeStrikes(g, "king")).toEqual(["r"]);
    expect(unsafeStrikes(board([{ ...king, hp: 4 }, { ...rook, defending: false }]), "king")).toEqual([]);
  });
  it("flags an enemy whose only walk-up strikes would leave the king in check", () => {
    // A defending queen counters any next square for 3, leaving the 4-HP king in check from every square he could strike from.
    const queen: Unit = { id: "q", side: "black", kind: "queen", x: 1, y: 1, hp: 9, defending: true };
    const g = board([{ ...king, hp: 4 }, queen]);
    expect(inCheck(g)).toBe(false);
    expect(approaches(g, "king", "q")).toEqual([]);
    expect(unsafeStrikes(g, "king")).toEqual(["q"]);
  });
  it("doesn't offer a walk-up strike whose counter would leave the king in check", () => {
    // From b2 the defending rook on b3 would counter for 3, leaving the king at 1 HP and in check. From a2 or c2
    // the king strikes diagonally, where a rook can't hit back, so those stay on offer.
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 1, hp: 5, defending: true };
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
    const tough: Unit = { id: "r", side: "black", kind: "rook", x: 2, y: 1, hp: 5, defending: true };
    expect(walkAndStrike(board([{ ...king, x: 0, y: 0, hp: 4 }, tough]), "king", { x: 1, y: 1 }, "r")).toBeNull();
  });
  it("still lets you act while already in check, so an escape can take several steps", () => {
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 2, hp: 5 };
    const ally: Unit = { id: "w", side: "white", kind: "pawn", x: 4, y: 3, hp: 1 };
    const g = board([{ ...king, hp: 3 }, rook, ally], { encounter: 1 });
    expect(inCheck(g)).toBe(true);
    expect(move(g, "w", { x: 4, y: 2 })).not.toBe(g);
  });
  it("won't end your turn in check while there's still a way out", () => {
    const rook: Unit = { id: "r", side: "black", kind: "rook", x: 1, y: 2, hp: 5 };
    const g = board([{ ...king, hp: 3 }, rook], { encounter: 1 });
    expect(endTurn(g).run).toBe(g);
    // Every piece has already acted and he's still in check: no way out, so the turn can end and the enemy may land the blow.
    const stuck = { ...g, units: g.units.map(u => (u.id === "king" ? { ...u, moved: true, acted: true } : u)) };
    expect(canEscape(stuck)).toBe(false);
    expect(endTurn(stuck).run).not.toBe(stuck);
  });

  it("runs a deterministic enemy turn, then readies the player's pieces", () => {
    const g = move(newRun(), "king", { x: 1, y: 2 });
    const a = endTurn(g), b = endTurn(g);
    expect(a).toEqual(b);
    expect(a.run.phase).toBe("player"); expect(a.run.turn).toBe(2);
    expect(a.run.units.filter(u => u.side === "white").every(u => !u.moved && !u.acted && !u.defending)).toBe(true);
  });

  it("keeps stuck enemy pawns busy when they can do something useful", () => {
    // King steps to a2: the pawn on a3 is blocked and bracing wouldn't save it, so it waits; the c-pawn marches.
    const { run, steps } = endTurn(move(newRun(), "king", { x: 0, y: 2 }));
    expect(unit(run, "enemy-0-0")).toMatchObject({ x: 0, y: 1 });
    expect(unit(run, "enemy-0-0")!.defending).toBeFalsy();
    expect(unit(run, "enemy-0-1")).toMatchObject({ x: 2, y: 2 });
    expect(steps.map(s => s.kind)).toEqual(["move"]);
  });
  it("braces only when it would survive the hit or could hit back", () => {
    // A cornered enemy knight on 2 HP next to the king (2 damage) has no strike or useful jump: only the block keeps it alive, so it braces.
    const knight: Unit = { id: "n", side: "black", kind: "knight", x: 3, y: 0, hp: 2 };
    const { run } = endTurn(board([{ ...king, x: 2, y: 1 }, knight]));
    expect(unit(run, "n")!.defending).toBe(true);
    // On 3 HP it survives the hit anyway, so bracing would be wasted.
    expect(unit(endTurn(board([{ ...king, x: 2, y: 1 }, { ...knight, hp: 3 }])).run, "n")!.defending).toBeFalsy();
  });
  it("doesn't march pawns away from every target when they can't promote yet", () => {
    // King behind the pawn's line on the 6×6 bridge: nothing ahead to chase, and the far row is too far.
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 };
    const { run } = endTurn(board([{ ...king, x: 0, y: 0 }, pawn], { encounter: 2 }));
    expect(unit(run, "p")).toMatchObject({ x: 2, y: 1 });
  });
  it("ends the run when the king falls", () => {
    // The king has already acted, so there's no way out of check: the turn ends and the pawn lands the blow.
    const g = board([{ ...king, hp: 1, moved: true, acted: true }, { id: "p", side: "black", kind: "pawn", x: 0, y: 2, hp: 1 }]);
    expect(endTurn(g).run.phase).toBe("defeat");
  });

  it("promotes your pawn on the far row into the piece you pick, which can still act", () => {
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", x: 0, y: 1, hp: 1 };
    const foe: Unit = { id: "f", side: "black", kind: "rook", x: 1, y: 0, hp: 5 };
    const g = board([{ ...king, x: 3, y: 3 }, pawn, foe]);
    const reached = move(g, "p", { x: 0, y: 0 });
    expect(reached.promoting).toBe("p");
    // Nothing else happens until the choice is made.
    expect(defend(reached, "king")).toBe(reached);
    expect(endTurn(reached).run).toBe(reached);
    expect(promote(reached, "p", "pawn" as never).run).toBe(reached);
    const { run, step } = promote(reached, "p", "rook");
    expect(run.promoting).toBeUndefined();
    expect(unit(run, "p")).toMatchObject({ kind: "rook", hp: HP.rook, x: 0, y: 0 });
    expect(step).toMatchObject({ actor: "p", kind: "promote", from: "pawn" });
    // Moved this turn, but it can still strike as its new self.
    expect(attackTargets(run, unit(run, "p")!).map(t => t.id)).toContain("f");
  });
  it("turns an enemy pawn that reaches your end into a full-health queen", () => {
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 3, y: 2, hp: 1 };
    const { run, steps } = endTurn(board([{ ...king, x: 0, y: 3 }, pawn]));
    expect(unit(run, "p")).toMatchObject({ kind: "queen", hp: HP.queen, x: 3, y: 3 });
    expect(steps.map(s => s.kind)).toEqual(["move", "promote"]);
  });
  it("starts every army square on a file with a clear run to the far row", () => {
    // A recruited pawn must be able to march all the way and promote on every map.
    ENCOUNTERS.forEach((e, i) => e.starts.forEach(st => {
      for (let y = st.y - 1; y >= 0; y--) expect(e.walls.some(w => w.x === st.x && w.y === y), `encounter ${i} start ${st.x},${st.y}`).toBe(false);
    }));
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
    expect(readRun(JSON.stringify(shopped))).toEqual(shopped);
    expect(readRun(JSON.stringify({ ...shopped, recruits: ["queen"] }))).toBeNull();
    expect(readRun(JSON.stringify({ ...newRun(), recruits: ["pawn"] }))).toBeNull();
    // More recruits than the next road has squares for would leave pieces with nowhere to stand.
    expect(readRun(JSON.stringify({ ...shopped, recruits: ["pawn", "pawn", "pawn"] }))).toBeNull();
    const next = leaveCamp(shopped);
    expect(next).toMatchObject({ phase: "player", encounter: 1, recruits: undefined });
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
    const g = newRun(); expect(readRun(JSON.stringify(g))).toEqual(g);
    expect(readRun(JSON.stringify({ ...g, units: [...g.units, { ...g.units[0], id: "dup" }] }))).toBeNull();
    expect(readRun("{")).toBeNull();
    expect(readRun(JSON.stringify({ ...g, promoting: "king" }))).toBeNull();
    const onFarRow = { ...g, units: [...g.units, { id: "ally-9", side: "white", kind: "pawn", x: 0, y: 0, hp: 1 }] };
    expect(readRun(JSON.stringify({ ...onFarRow, promoting: "ally-9" }))).not.toBeNull();
    expect(readRun(JSON.stringify({ ...onFarRow, phase: "camp", promoting: "ally-9" }))).toBeNull();
    expect(readRun(JSON.stringify({ ...g, units: g.units.filter(u => u.side === "white") }))).toBeNull();
    expect(readRun(JSON.stringify({ ...g, units: [...g.units, { id: "x", side: "black", kind: "constructor", x: 3, y: 0, hp: 1 }] }))).toBeNull();
    expect(readRun(JSON.stringify({ ...g, turn: 0 }))).toBeNull();
  });

  it("plays a single level on its own in a playtest, ending in victory with no hideout", () => {
    const level: Encounter = { reward: 5, width: 5, height: 3, walls: [{ x: 4, y: 0 }], spawns: [["pawn", 1, 1, 1]], starts: [{ x: 0, y: 2 }, { x: 2, y: 2 }] };
    const g = playtest(level, ["king", "rook"], 1);
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
  it("lets every enemy piece act each turn", () => {
    const level: Encounter = { reward: 0, width: 4, height: 6, walls: [], spawns: [["pawn", 0, 0, 1], ["pawn", 3, 0, 1], ["rook", 1, 0, 5]], starts: [{ x: 1, y: 5 }] };
    const { steps } = endTurn(playtest(level, ["king"], 0));
    expect(new Set(steps.map(s => s.actor))).toEqual(new Set(["enemy-0-0", "enemy-0-1", "enemy-0-2"]));
    // Each piece moves at most once and strikes or defends at most once.
    for (const id of ["enemy-0-0", "enemy-0-1", "enemy-0-2"]) {
      expect(steps.filter(s => s.actor === id && s.kind === "move").length).toBeLessThanOrEqual(1);
      expect(steps.filter(s => s.actor === id && (s.kind === "strike" || s.kind === "defend")).length).toBeLessThanOrEqual(1);
    }
  });
  it("lets every one of your pieces move and strike in the same turn", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const bishop: Unit = { id: "b", side: "white", kind: "bishop", x: 3, y: 2, hp: 3 };
    const foes: Unit[] = [{ id: "f", side: "black", kind: "rook", x: 0, y: 0, hp: 5 }, { id: "g", side: "black", kind: "rook", x: 1, y: 0, hp: 5 }];
    let g = board([{ ...king, x: 2, y: 3 }, rook, bishop, ...foes]);
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
  it("never restores a playtest as a saved run", () => {
    const level: Encounter = { ...ENCOUNTERS[0] };
    expect(readRun(JSON.stringify(playtest(level, ["king"], 0)))).toBeNull();
  });
  it("can complete the three-battle run with a simple strategy", () => {
    let g = newRun(), turns = 0;
    while (!["victory", "defeat"].includes(g.phase) && turns++ < 80) {
      if (g.phase === "camp") { g = leaveCamp(buy(g, unit(g, "king")!.hp < 3 ? "heal" : "rook")); continue; }
      g = playTurn(g);
      if (g.phase === "player") g = endTurn(g).run;
      expect(new Set(g.units.map(u => `${u.x},${u.y}`)).size).toBe(g.units.length);
    }
    expect(g.phase).toBe("victory");
  });
});
