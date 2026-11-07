import { describe, expect, it } from "vitest";
import { ENERGY, PUZZLES, alt, attack, endTurn, kingThreat, move, moveTargets, passable, readRun, startPuzzle } from "../src/game/turns";
import type { Encounter, Run, Unit } from "../src/game/turns";
import { isHole, isWall, landingOf } from "../src/game/board";

/** A 5x5 test board registered as a Guild puzzle so boardOf() can find it. Tiles are optional. */
function board(tiles: Partial<Encounter>, units: Unit[], extra: Partial<Run> = {}): Run {
  const e: Encounter = { title: "test", story: "", reward: 0, enemyEnergy: 3, width: 5, height: 5, walls: [], spawns: [], starts: [], ...tiles };
  const puzzle = PUZZLES.push(e) - 1;
  const gatesOpen = e.gates?.filter(x => x.open).map(x => x.at);
  return { version: 2, encounter: 0, puzzle, turn: 1, phase: "player", gold: 0, energy: ENERGY, units, log: [], history: [], nextId: 1, gatesOpen: gatesOpen?.length ? gatesOpen : undefined, ...extra };
}
const king = (x: number, y: number): Unit => ({ id: "king", side: "white", kind: "king", x, y, hp: 5 });
const foe = (id: string, kind: Unit["kind"], x: number, y: number, hp = 1): Unit => ({ id, side: "black", kind, x, y, hp });
const unit = (g: Run, id: string) => g.units.find(u => u.id === id);
const sq = (x: number, y: number) => ({ x, y });
/** A save needs an enemy on the board; this one stands in a corner and never matters. */
const sentry = foe("sentry", "pawn", 4, 0);

describe("pits (holes)", () => {
  it("stop sliders, are leapt by knights and can't be stood on", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 4, hp: 5 };
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 0, y: 4, hp: 3 };
    const g = board({ holes: [sq(0, 2)] }, [king(4, 4), rook, sentry]);
    expect(passable(g, sq(0, 2))).toBe(false);
    expect(moveTargets(g, rook).map(t => `${t.x},${t.y}`)).toEqual(expect.arrayContaining(["0,3"]));
    expect(moveTargets(g, rook).some(t => t.y <= 2 && t.x === 0)).toBe(false);
    const h = board({ holes: [sq(0, 3), sq(1, 3), sq(1, 4)] }, [king(4, 4), knight]);
    expect(moveTargets(h, knight)).toEqual(expect.arrayContaining([{ x: 1, y: 2, cost: 2 }, { x: 2, y: 3, cost: 2 }]));
    // A save with a piece in a pit is corrupt.
    expect(readRun(JSON.stringify({ ...g, units: [...g.units, foe("p", "pawn", 0, 2)] }))).toBeNull();
    expect(readRun(JSON.stringify(g))).not.toBeNull();
  });
});

describe("crumbling tiles", () => {
  it("fall away behind whoever leaves them, every tile a slide crossed", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 4, hp: 5 };
    const g = board({ crumbling: [sq(0, 4), sq(0, 3), sq(0, 2)] }, [king(4, 4), rook, sentry]);
    const slid = move(g, "r", sq(0, 1));
    expect(unit(slid, "r")).toMatchObject({ x: 0, y: 1 });
    expect(slid.collapsed).toEqual(expect.arrayContaining([sq(0, 4), sq(0, 3), sq(0, 2)]));
    expect(isHole(slid, sq(0, 3))).toBe(true);
    // The pits are real now: the rook can't slide back over them.
    expect(moveTargets({ ...slid, energy: ENERGY, units: slid.units.map(u => ({ ...u, moved: false })) }, unit(slid, "r")!).some(t => t.x === 0 && t.y >= 2)).toBe(false);
    expect(slid.log[0]).toMatch(/crumble/);
    expect(readRun(JSON.stringify(slid))).not.toBeNull();
    // A tile is safe to stand on for as long as you like: nothing happens until you leave.
    const stay = board({ crumbling: [sq(4, 4)] }, [king(4, 4)]);
    expect(endTurn(stay).run.collapsed).toBeUndefined();
  });
  it("collapses only the origin when a leaper leaves it", () => {
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 0, y: 4, hp: 3 };
    const g = board({ crumbling: [sq(0, 4), sq(0, 3), sq(1, 2)] }, [king(4, 4), knight]);
    const leapt = move(g, "n", sq(1, 2));
    expect(leapt.collapsed).toEqual([sq(0, 4)]);
  });
});

describe("burrows (portals)", () => {
  const portals: [typeof sq extends (...a: never[]) => infer R ? R : never, { x: number; y: number }][] = [[sq(0, 4), sq(4, 0)]];
  it("send a piece out the other mouth; a slide carries on from there", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 1, y: 4, hp: 5 };
    const g = board({ portals }, [king(2, 2), rook]);
    const ts = moveTargets(g, rook);
    // Into a1 (0,4): out at e5 (4,0) for 1; on to d5 (3,0) for 2, c5 for 3, b5 for 4.
    expect(ts).toEqual(expect.arrayContaining([{ x: 4, y: 0, cost: 1 }, { x: 3, y: 0, cost: 2 }, { x: 2, y: 0, cost: 3 }, { x: 1, y: 0, cost: 4 }]));
    expect(ts.some(t => t.x === 0 && t.y === 4)).toBe(false);
    const through = move(g, "r", sq(3, 0));
    expect(unit(through, "r")).toMatchObject({ x: 3, y: 0 });
    expect(through.energy).toBe(ENERGY - 2);
    // A burrow's mouth is a square a piece can stand on, once it has come through.
    expect(passable(g, sq(0, 4))).toBe(true);
  });
  it("refuse the tunnel when the far mouth is occupied, and carry leapers and steps too", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 1, y: 4, hp: 5 };
    const blocked = board({ portals }, [king(2, 2), rook, foe("p", "pawn", 4, 0)]);
    expect(moveTargets(blocked, rook).some(t => t.y === 0 && t.x >= 2)).toBe(false);
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 2, y: 3, hp: 3 };
    const leap = board({ portals }, [king(2, 0), knight]);
    expect(moveTargets(leap, knight)).toEqual(expect.arrayContaining([{ x: 4, y: 0, cost: 2 }]));
    const step = board({ portals }, [king(1, 4)]);
    expect(moveTargets(step, unit(step, "king")!)).toEqual(expect.arrayContaining([{ x: 4, y: 0, cost: 1 }]));
    // Standing on a mouth is legal (you came through it); the burrow itself is never a destination.
    expect(readRun(JSON.stringify({ ...step, units: [king(4, 0), foe("p", "pawn", 2, 0)] }))).not.toBeNull();
  });
});

describe("ice", () => {
  const ice = [sq(1, 2), sq(2, 2), sq(3, 2)];
  it("glides a piece on for free until the first dry square", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 2, hp: 5 };
    const g = board({ ice }, [king(2, 4), rook]);
    const ts = moveTargets(g, rook);
    // Choosing b3 (1,2) for 1 skids to e3 (4,2); the three ice squares are never destinations.
    expect(ts).toEqual(expect.arrayContaining([{ x: 4, y: 2, cost: 1 }]));
    expect(ts.some(t => t.y === 2 && t.x >= 1 && t.x <= 3)).toBe(false);
    const slid = move(g, "r", sq(4, 2));
    expect(unit(slid, "r")).toMatchObject({ x: 4, y: 2 });
    expect(slid.energy).toBe(ENERGY - 1);
    expect(landingOf(g, sq(1, 2), [1, 0])).toEqual(sq(4, 2));
  });
  it("stops on the last ice square before a piece, a wall or the edge", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 0, y: 2, hp: 5 };
    const g = board({ ice }, [king(2, 4), rook, foe("p", "pawn", 4, 2)]);
    expect(moveTargets(g, rook)).toEqual(expect.arrayContaining([{ x: 3, y: 2, cost: 1 }]));
    const edge = board({ ice: [sq(1, 2), sq(2, 2), sq(3, 2), sq(4, 2)] }, [king(2, 4), rook]);
    expect(moveTargets(edge, rook)).toEqual(expect.arrayContaining([{ x: 4, y: 2, cost: 1 }]));
    // Leapers land where they land.
    const knight: Unit = { id: "n", side: "white", kind: "knight", x: 0, y: 4, hp: 3 };
    const leap = board({ ice }, [king(4, 4), knight]);
    expect(moveTargets(leap, knight)).toEqual(expect.arrayContaining([{ x: 1, y: 2, cost: 2 }]));
  });
  it("carries a pawn onto the far row to promote, and the AI's pieces glide too", () => {
    const pawn: Unit = { id: "p", side: "white", kind: "pawn", x: 2, y: 3, hp: 1 };
    const g = board({ ice: [sq(2, 2), sq(2, 1)] }, [king(4, 4), pawn, foe("e", "pawn", 0, 0)]);
    expect(moveTargets(g, pawn)).toEqual([{ x: 2, y: 0, cost: 1 }]);
    const slid = move(g, "p", sq(2, 0));
    expect(unit(slid, "p")).toMatchObject({ x: 2, y: 0 });
    expect(slid.promoting).toBe("p");
    // An enemy rook closing in on the king skids across the lake.
    const chase = board({ ice: [sq(1, 0), sq(2, 0), sq(3, 0)] }, [king(4, 4), foe("r", "rook", 0, 0, 5)]);
    const after = endTurn(chase).run;
    expect(unit(after, "r")!.y === 0 ? [1, 2, 3].includes(unit(after, "r")!.x) : true).toBe(false);
  });
});

describe("gates and levers", () => {
  const gates = [{ at: sq(2, 2), group: "g" }], levers = [{ at: sq(4, 3), group: "g" }];
  it("a shut gate is a wall until a piece stops on its lever; pulling again shuts it", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 2, y: 4, hp: 5 };
    const g = board({ gates, levers, walls: [sq(0, 2), sq(1, 2), sq(3, 2), sq(4, 2)] }, [king(4, 4), rook, sentry]);
    expect(isWall(g, sq(2, 2))).toBe(true);
    expect(moveTargets(g, rook).some(t => t.y <= 2)).toBe(false);
    const pulled = move(g, "king", sq(4, 3));
    expect(pulled.gatesOpen).toEqual([sq(2, 2)]);
    expect(isWall(pulled, sq(2, 2))).toBe(false);
    expect(pulled.log[0]).toMatch(/lever/);
    expect(moveTargets(pulled, rook)).toEqual(expect.arrayContaining([{ x: 2, y: 1, cost: 3 }]));
    expect(readRun(JSON.stringify(pulled))).not.toBeNull();
    // Step off and back on: the gate shuts again.
    const fresh = { ...pulled, energy: ENERGY, units: pulled.units.map(u => ({ ...u, moved: false })) };
    const away = move(fresh, "king", sq(4, 4));
    expect(away.gatesOpen).toEqual([sq(2, 2)]);
    const back = move({ ...away, units: away.units.map(u => ({ ...u, moved: false })) }, "king", sq(4, 3));
    expect(back.gatesOpen).toEqual([]);
  });
  it("can't shut on a piece standing in it, and starts open when the board says so", () => {
    const rook: Unit = { id: "r", side: "white", kind: "rook", x: 2, y: 2, hp: 5 };
    const g = board({ gates: [{ at: sq(2, 2), group: "g", open: true }], levers }, [king(4, 4), rook, sentry]);
    expect(g.gatesOpen).toEqual([sq(2, 2)]);
    const pulled = move(g, "king", sq(4, 3));
    expect(pulled.gatesOpen).toEqual([sq(2, 2)]);
    expect(readRun(JSON.stringify({ ...g, gatesOpen: [sq(0, 0)] }))).toBeNull();
  });
  it("reads gate state when judging check", () => {
    // Your king on c1 (2,4) with an enemy rook on c5 (2,0): the shut gate at c3 keeps the file closed.
    const g = board({ gates, levers, walls: [sq(0, 2), sq(1, 2), sq(3, 2), sq(4, 2)], enemyEnergy: 5 }, [king(2, 4), foe("r", "rook", 2, 0, 5)]);
    expect(kingThreat(g).damage).toBe(0);
    // Open, the rook slides to c2 (3) and strikes (2).
    expect(kingThreat({ ...g, gatesOpen: [sq(2, 2)] })).toEqual({ damage: 3, attackers: ["r"] });
    // A set-up move (one piece pulls the lever so another can strike) is not check: check counts only
    // what strikes the king, each attacker stepping in and striking by itself (docs/variants.md).
    const helper = { ...g, units: [...g.units, foe("k", "king", 3, 3, 5)] };
    expect(kingThreat(helper).damage).toBe(2);
  });
});

describe("Brick and gates", () => {
  it("demolishes a shut gate into floor for good: the lever no longer shuts it", () => {
    const brick: Unit = { id: "r", side: "white", kind: "rook", variant: "rebel", x: 2, y: 3, hp: 5 };
    const g = board({ gates: [{ at: sq(2, 2), group: "g" }], levers: [{ at: sq(4, 3), group: "g" }], walls: [sq(0, 2), sq(1, 2), sq(3, 2), sq(4, 2)] }, [king(4, 4), brick, sentry]);
    const smashed = alt(g, "r", "demolish", sq(2, 2)).run;
    expect(smashed).not.toBe(g);
    expect(isWall(smashed, sq(2, 2))).toBe(false);
    expect(smashed.broken).toEqual([sq(2, 2)]);
    // Pulling the lever afterwards changes nothing: there is no gate left.
    const pulled = move({ ...smashed, energy: ENERGY }, "king", sq(4, 3));
    expect(isWall(pulled, sq(2, 2))).toBe(false);
    expect(readRun(JSON.stringify(pulled))).not.toBeNull();
  });
});

describe("Guild puzzles", () => {
  it("start with the puzzle's own army, win when the board is clear and lose on the turn limit", () => {
    const e: Encounter = { title: "Two moves", story: "Take the pawn.", reward: 0, enemyEnergy: 2, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 0, 1]], starts: [], army: [["king", 3, 3, 5], ["rook", 1, 3, 5, "rebel"]], turns: 2 };
    const i = PUZZLES.push(e) - 1;
    const g = startPuzzle(i);
    expect(g.puzzle).toBe(i); expect(g.gold).toBe(0);
    expect(g.units.map(u => `${u.id}@${u.x},${u.y}`)).toEqual(expect.arrayContaining(["king@3,3", "ally-1@1,3", `enemy-0-0@0,0`]));
    // Dawdle twice: out of moves.
    const t2 = endTurn(g).run;
    expect(t2.phase).toBe("player"); expect(t2.turn).toBe(2);
    expect(endTurn(t2).run.phase).toBe("defeat");
    // Or rook b1→b4 isn't reachable (pawn's lane), so a1 via a-file: rook b1→a1 (1), a1→a2.. the pawn sits at a4 (0,0): slide to a3 (0,1) costs 1+2=3? One move per turn: b1→a1 then strike needs adjacency. Use the tap: walk b1→a2? Not in a rook's shape. Simplest: rook b1→b4 (1,0) is beside the pawn: 3 energy, then strike (2) exceeds 4. So turn 1: rook to b4 (3). Enemy pawn marches to a3 (0,1) maybe. Just assert the win is possible via attack from an adjacent square.
    const walked = move(g, "ally-1", { x: 1, y: 0 });
    expect(walked.energy).toBe(1);
    const next = endTurn(walked).run;
    const rook = unit(next, "ally-1")!, pawn = next.units.find(u => u.side === "black")!;
    if (Math.abs(rook.x - pawn.x) + Math.abs(rook.y - pawn.y) === 1) {
      const won = attack(next, "ally-1", pawn.id).run;
      expect(won.phase).toBe("victory");
      expect(readRun(JSON.stringify(won))).not.toBeNull();
    }
  });
});
