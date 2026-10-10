import { describe, expect, it } from "vitest";
import { COST, DAMAGE, ENCOUNTERS, ENERGY, HP, attack, attackTargets, campReason, defend, endTurn, leaveCamp, move, moveTargets, newRun, promote, readRun } from "../src/game/turns";
import type { Run, Unit } from "../src/game/turns";
import { playTurn } from "./turns-strategy";

const king: Unit = { id: "king", side: "white", kind: "king", x: 1, y: 3, hp: 5 };
function board(units: Unit[], extra: Partial<Run> = {}): Run { return { ...newRun(), units, ...extra }; }
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);

describe("turn-based rules", () => {
  it("opens on the player's turn with a full energy pool", () => {
    const g = newRun();
    expect(g.phase).toBe("player"); expect(g.energy).toBe(ENERGY);
    expect(g.units.filter(u => u.side === "white")).toHaveLength(1);
  });

  it("prices moves by distance in the piece's chess shape", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const g = board([king, rook], { energy: 2 });
    // Rook from a1: up to 2 squares (energy 2); the king blocks the row.
    expect(moveTargets(g, rook)).toEqual(expect.arrayContaining([{ x: 0, y: 2, cost: 1 }, { x: 0, y: 1, cost: 2 }]));
    expect(moveTargets(g, rook).some(t => t.y === 0)).toBe(false);
    expect(moveTargets(g, rook).some(t => t.x > 0)).toBe(false);
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 1, y: 3, hp: 3 };
    expect(moveTargets(board([knight]), knight).every(t => t.cost === 2)).toBe(true);
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", x: 2, y: 3, hp: 1 };
    expect(moveTargets(board([pawn]), pawn)).toEqual([{ x: 2, y: 2, cost: 1 }]);
  });

  it("lets each piece move once, then attack or defend, paying from the pool", () => {
    const g = board([king, { id: "p", side: "black", kind: "pawn", x: 1, y: 0, hp: 1 }]);
    const moved = move(g, "king", { x: 1, y: 2 });
    expect(moved.energy).toBe(ENERGY - 1); expect(unit(moved, "king")).toMatchObject({ x: 1, y: 2, moved: true });
    expect(move(moved, "king", { x: 1, y: 1 })).toBe(moved);
    const braced = defend(moved, "king");
    expect(braced.energy).toBe(ENERGY - 2); expect(unit(braced, "king")!.defending).toBe(true);
    expect(defend(braced, "king")).toBe(braced);
    // After attacking, a piece can't move.
    const near = board([king, { id: "p", side: "black", kind: "pawn", x: 2, y: 2, hp: 5 }]);
    const hit = attack(near, "king", "p").run;
    expect(move(hit, "king", { x: 0, y: 3 })).toBe(hit);
  });

  it("prices attacks at distance + 1, deals fixed damage and takes no return hit", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const foe: Unit = { id: "f", side: "black", kind: "rook", x: 0, y: 0, hp: 5 };
    const g = board([rook, foe, { ...king, x: 3, y: 3 }]);
    expect(attackTargets(g, rook)).toEqual([{ x: 0, y: 0, cost: 4, id: "f" }]);
    const { run } = attack(g, "r", "f");
    expect(run.energy).toBe(ENERGY - 4);
    expect(unit(run, "f")!.hp).toBe(5 - DAMAGE.rook);
    // Strikes land from where the piece stands: the rook doesn't move and takes nothing.
    expect(unit(run, "r")).toMatchObject({ x: 0, y: 3, hp: 5 });
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
  it("refuses actions the pool can't pay for", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const g = board([rook, { id: "f", side: "black", kind: "pawn", x: 0, y: 0, hp: 1 }, { ...king, x: 3, y: 3 }], { energy: 3 });
    expect(attackTargets(g, rook)).toEqual([]);
    expect(attack(g, "r", "f").run).toBe(g);
  });

  it("makes a defender block 1 and counter an attacker it can reach", () => {
    // An enemy bishop strikes the defending king diagonally: 2 - 1 = 1 damage, and the king counters for 2.
    const bishop: Unit = { id: "b", side: "black", kind: "bishop", x: 0, y: 2, hp: 3 };
    const g = defend(board([king, bishop]), "king");
    const { run } = endTurn(g);
    expect(unit(run, "king")!.hp).toBe(5 - (DAMAGE.bishop - 1));
    expect(unit(run, "b")!.hp).toBe(3 - DAMAGE.king);
  });
  it("doesn't make the enemy strike for 0 into a defender", () => {
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 0, y: 2, hp: 1 };
    const { run } = endTurn(defend(board([king, pawn]), "king"));
    expect(unit(run, "p")).toBeDefined();
    expect(unit(run, "king")!.hp).toBe(5);
  });
  it("lets a defender counter a ranged striker only if it can reach the striker's square", () => {
    // A rook strikes a defending rook from two squares away; the target can reach back along the line.
    const mine: Unit = { id: "m", side: "white", kind: "rook", x: 0, y: 3, hp: 5 };
    const theirs: Unit = { id: "t", side: "black", kind: "rook", x: 0, y: 1, hp: 5 };
    const { run } = endTurn(defend(board([{ ...king, x: 3, y: 3 }, mine, theirs], { encounter: 1 }), "m"));
    expect(unit(run, "m")!.hp).toBe(5 - (DAMAGE.rook - 1));
    expect(unit(run, "t")).toMatchObject({ x: 0, y: 1, hp: 5 - DAMAGE.rook });
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

  it("runs a deterministic enemy turn within its pool, then refills the player's", () => {
    const g = move(newRun(), "king", { x: 1, y: 2 });
    const a = endTurn(g), b = endTurn(g);
    expect(a).toEqual(b);
    expect(a.run.phase).toBe("player"); expect(a.run.energy).toBe(ENERGY); expect(a.run.turn).toBe(2);
    expect(a.spent).toBeLessThanOrEqual(ENCOUNTERS[0].enemyEnergy);
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
    // An enemy knight on 2 HP next to the king (2 damage): only the block keeps it alive, so it braces.
    const knight: Unit = { id: "n", side: "black", kind: "knight", x: 3, y: 2, hp: 2 };
    const { run } = endTurn(board([{ ...king, x: 2, y: 3 }, knight]));
    expect(unit(run, "n")!.defending).toBe(true);
    // On 3 HP it survives the hit anyway, so bracing would be wasted.
    expect(unit(endTurn(board([{ ...king, x: 2, y: 3 }, { ...knight, hp: 3 }])).run, "n")!.defending).toBeFalsy();
  });
  it("doesn't march pawns away from every target when they can't promote yet", () => {
    // King behind the pawn's line on the 6×6 bridge: nothing ahead to chase, and the far row is too far.
    const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 };
    const { run } = endTurn(board([{ ...king, x: 0, y: 0 }, pawn], { encounter: 2 }));
    expect(unit(run, "p")).toMatchObject({ x: 2, y: 1 });
  });
  it("ends the run when the king falls", () => {
    const g = board([{ ...king, hp: 1 }, { id: "p", side: "black", kind: "pawn", x: 0, y: 2, hp: 1 }]);
    expect(endTurn(g).run.phase).toBe("defeat");
  });

  it("promotes your pawn on the far row into the piece you pick, which can still act", () => {
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", x: 0, y: 1, hp: 1 };
    const foe: Unit = { id: "f", side: "black", kind: "rook", x: 2, y: 0, hp: 5 };
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
    const next = leaveCamp(g, "pawn");
    expect(next.units.filter(u => u.side === "white" && u.kind === "pawn")).toHaveLength(1);
    expect(next.gold).toBe(0);
  });
  it("restores valid saves and rejects broken ones", () => {
    const g = newRun(); expect(readRun(JSON.stringify(g))).toEqual(g);
    expect(readRun(JSON.stringify({ ...g, energy: -1 }))).toBeNull();
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

  it("can complete the three-battle run with a simple strategy", () => {
    let g = newRun(), turns = 0;
    while (!["victory", "defeat"].includes(g.phase) && turns++ < 80) {
      if (g.phase === "camp") { g = leaveCamp(g, unit(g, "king")!.hp < 3 ? "heal" : "rook"); continue; }
      g = playTurn(g);
      if (g.phase === "player") g = endTurn(g).run;
      expect(new Set(g.units.map(u => `${u.x},${u.y}`)).size).toBe(g.units.length);
    }
    expect(g.phase).toBe("victory");
  });
});
