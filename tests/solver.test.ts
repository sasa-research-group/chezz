import { describe, expect, it } from "vitest";
import { ENCOUNTERS, ENERGY, HP, attack, defend, endTurn, move, newRun, promote, walkAndStrike } from "../src/game/turns";
import type { Encounter, Run, Unit } from "../src/game/turns";
import { boardKey, lineToText, makeBound, playerOutcomes, replay, solve } from "../src/game/solver";
import type { Action } from "../src/game/solver";

const king: Unit = { id: "king", side: "white", kind: "king", x: 1, y: 3, hp: HP.king };
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, ...extra });

/** Plays one action with nothing but the rules module, the way the board would: a move the rules refuse
 * on its own followed by a strike from the same piece is a tap. Fails loudly on a refused action. */
function playWithRules(g: Run, turn: Action[], i: number): { run: Run; used: number } {
  const a = turn[i];
  if (a.type === "move") {
    const next = move(g, a.id, a.to);
    if (next !== g) return { run: next, used: 1 };
    const b = turn[i + 1];
    const tap = b?.type === "attack" && b.id === a.id ? walkAndStrike(g, a.id, a.to, b.targetId) : null;
    expect(tap, `tap ${JSON.stringify(a)}`).not.toBeNull();
    return { run: tap!.run, used: 2 };
  }
  const run = a.type === "attack" ? attack(g, a.id, a.targetId).run : a.type === "defend" ? defend(g, a.id) : a.type === "promote" ? promote(g, a.id, a.kind).run : endTurn(g).run;
  expect(run, `refused ${JSON.stringify(a)}`).not.toBe(g);
  return { run, used: 1 };
}
/** Replays a line with the rules alone. */
function replayWithRules(start: Run, line: Action[][]): Run {
  let g = start;
  for (const turn of line) for (let i = 0; i < turn.length;) { const r = playWithRules(g, turn, i); g = r.run; i += r.used; }
  return g;
}

/** Runs `fn` with a throwaway encounter on the roster (the rules and the bound read the board's size and
 * walls from it), then takes it off again, so the bridge stays the last road. */
function onBoard<T>(e: Encounter, fn: (encounter: number) => T): T {
  ENCOUNTERS.push(e);
  try { return fn(ENCOUNTERS.length - 1); } finally { ENCOUNTERS.pop(); }
}
/** An open 8x8 field: room for one piece to kill an enemy and walk on to the next, which the shipped
 * boards (6x6 at most) are too small for. */
const OPEN_FIELD: Encounter = { title: "The open field", story: "", reward: 0, enemyEnergy: 3, width: 8, height: 8, walls: [], spawns: [], starts: [] };
/** On the open field: the rook on a1 sweeps its file, pawns on a4 and a7, the king out of the way on h1. */
const sweep = (encounter: number): Run => board([
  { ...king, x: 7, y: 7 }, { id: "rook", side: "white", kind: "rook", x: 0, y: 7, hp: HP.rook },
  { id: "a", side: "black", kind: "pawn", x: 0, y: 4, hp: 1 }, { id: "b", side: "black", kind: "pawn", x: 0, y: 1, hp: 1 },
], { encounter });
/** The sweep by hand: a3 and a blow on a4, then, the other pawn having stepped to a6, a5 and a blow on a6. */
const SWEEP_LINE: Action[][] = [
  [{ type: "move", id: "rook", to: { x: 0, y: 5 } }, { type: "attack", id: "rook", targetId: "a" }, { type: "end" }],
  [{ type: "move", id: "rook", to: { x: 0, y: 3 } }, { type: "attack", id: "rook", targetId: "b" }],
];

/** The bridge (encounter 2) with the full three-piece army on its start squares. */
function bridge(): Run {
  const e = ENCOUNTERS[2];
  const army: Unit[] = [{ ...king }, { id: "rook", side: "white", kind: "rook", x: 0, y: 0, hp: HP.rook }, { id: "bishop", side: "white", kind: "bishop", x: 0, y: 0, hp: HP.bishop }];
  const whites = army.map((u, i) => ({ ...u, ...e.starts[i] }));
  const blacks = e.spawns.map(([kind, x, y, hp], i): Unit => ({ id: `enemy-2-${i}`, side: "black", kind, x, y, hp }));
  return board([...whites, ...blacks], { encounter: 2 });
}
let bridgeResult: ReturnType<typeof solve> | undefined;
/** The bridge solved once for the file (a few seconds): the tests below share it. */
const solveBridge = () => (bridgeResult ??= solve(bridge(), { maxTurns: 6, nodeBudget: 300000 }));
/** The position two turns from the end of the bridge's winning line: small enough to search exhaustively. */
function bridgeTail(): Run {
  const r = solveBridge();
  expect(r.won).toBe(true);
  return r.won ? replay(bridge(), r.line.slice(0, r.turns - 2)) : bridge();
}
const LONG = 30000;

/** Walks a winning line through the bound the way the solver calls it: at each turn's start, after each
 * action, and once the turn's actions are spent (before the reply). Every call must say feasible. */
function walkBound(start: Run, line: Action[][]) {
  const feasible = makeBound();
  let g = start;
  line.forEach((turn, i) => {
    const left = line.length - i, later = ENERGY * (left - 1);
    const check = (s: Run, what: string) => expect(feasible(s, left, s.energy + later, left - 1), `turn ${i + 1}, ${what}`).toBe(true);
    check(g, "start");
    for (let n = 0; n < turn.length;) {
      const a = turn[n], r = playWithRules(g, turn, n);
      if (a.type === "end") expect(feasible(g, left - 1, later, left - 1), `turn ${i + 1}, end`).toBe(true);
      g = r.run; n += r.used;
      if (a.type !== "end" && g.phase === "player") check(g, `after ${n} actions`);
    }
  });
  expect(["camp", "victory"]).toContain(g.phase);
}

describe("solver", () => {
  it("enumerates every distinct position a turn can reach, taps included, each replaying to itself", () => {
    const g = newRun();
    const outs = playerOutcomes(g);
    expect(outs.find(o => o.plan.length === 0)?.run).toBe(g);
    expect(new Set(outs.map(o => boardKey(o.run))).size).toBe(outs.length);
    for (const o of outs) expect(boardKey(replay(g, [o.plan]))).toBe(boardKey(o.run));
    // A king who may not step next to a bishop that would kill him can still tap it: the walk and the blow are one move.
    const bishop: Unit = { id: "b", side: "black", kind: "bishop", x: 1, y: 1, hp: 2 };
    const far: Unit = { id: "p", side: "black", kind: "pawn", x: 3, y: 0, hp: 1 };
    const tap = board([{ ...king, x: 0, y: 3, hp: 2 }, bishop, far]);
    expect(move(tap, "king", { x: 0, y: 2 })).toBe(tap);
    const viaTap = playerOutcomes(tap).find(o => o.plan.length === 2 && o.plan[0].type === "move" && o.plan[0].to.x === 0 && o.plan[0].to.y === 2);
    expect(viaTap?.plan[1]).toEqual({ type: "attack", id: "king", targetId: "b" });
    expect(viaTap?.run.units.some(u => u.id === "b")).toBe(false);
    // A pawn on the far row has to pick its piece before the turn can end; every piece is tried.
    const pawn: Unit = { id: "pawn", side: "white", kind: "pawn", x: 3, y: 1, hp: 1 };
    const promo = playerOutcomes(board([{ ...king, x: 0, y: 3 }, pawn, { ...far, x: 0, y: 0 }]));
    expect(promo.every(o => !o.run.promoting)).toBe(true);
    expect(new Set(promo.flatMap(o => o.plan.filter(a => a.type === "promote").map(a => a.kind)))).toEqual(new Set(["queen", "rook", "bishop", "knight"]));
  });

  it("solves the first encounter within three turns, and the line replays through the real rules to camp", () => {
    const t0 = performance.now();
    const r = solve(newRun(), { maxTurns: 3 });
    console.log(`first encounter: ${r.nodes} nodes, ${Math.round(performance.now() - t0)}ms`, r);
    expect(r.won).toBe(true);
    if (!r.won) return;
    expect(r.turns).toBe(2);
    // Four first turns work: a step to one of three squares and a blow on one of the two pawns.
    expect(r).toMatchObject({ winningFirstMoves: 4, unique: false, countComplete: true });
    expect(replayWithRules(newRun(), r.line).phase).toBe("camp");
    expect(replay(newRun(), r.line).phase).toBe("camp");
    const text = lineToText(newRun(), r.line);
    console.log(text.join("\n"));
    expect(text).toHaveLength(2);
    expect(text[0]).toMatch(/^T1: king b1→/);
    expect(text[1]).toMatch(/\(kill\) — battle won$/);
  });

  it("finds a win in one and calls it unique however the blow lands", () => {
    // The king can strike from where he stands or walk to any of several squares first: the walk is spare.
    const r = solve(board([king, { id: "p", side: "black", kind: "pawn", x: 1, y: 2, hp: 1 }]), { maxTurns: 3 });
    expect(r).toMatchObject({ won: true, turns: 1, unique: true, winningFirstMoves: 1, countComplete: true });
    if (r.won) expect(r.line).toEqual([[{ type: "attack", id: "king", targetId: "p" }]]);
  });

  it("counts two winning first moves when either pawn can go first", () => {
    // With only two energy the king can strike one pawn now and the other next turn; anything else wastes the turn.
    const g = board([{ ...king, x: 1, y: 2 }, { id: "a", side: "black", kind: "pawn", x: 0, y: 1, hp: 1 }, { id: "b", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 }], { energy: 2 });
    const r = solve(g, { maxTurns: 3 });
    expect(r).toMatchObject({ won: true, turns: 2, unique: false, winningFirstMoves: 2, countComplete: true });
    if (r.won) expect(replayWithRules(g, r.line).phase).toBe("camp");
  });

  it("keys a first move by its essential actions, so spare energy spent on a brace or a sidestep is no second solution", () => {
    // Three energy: the king kills one pawn and has one left for a brace or a step. Many boards, two ideas.
    const g = board([{ ...king, x: 1, y: 2 }, { id: "a", side: "black", kind: "pawn", x: 0, y: 1, hp: 1 }, { id: "b", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 }], { energy: 3 });
    expect(playerOutcomes(g).length).toBeGreaterThan(4);
    const r = solve(g, { maxTurns: 3 });
    expect(r).toMatchObject({ won: true, turns: 2, unique: false, winningFirstMoves: 2, countComplete: true });
    expect(solve(g, { maxTurns: 3, exhaustive: true })).toMatchObject({ won: true, turns: 2, winningFirstMoves: 2 });
  });

  it("reports no win within the horizon for a hopeless position, and none at all for a finished run", () => {
    const g = board([{ ...king, hp: 1 }, { id: "q", side: "black", kind: "queen", x: 1, y: 0, hp: HP.queen }]);
    expect(solve(g, { maxTurns: 2 })).toMatchObject({ won: false, reason: "no-win-within" });
    expect(solve({ ...g, phase: "defeat" }, { maxTurns: 2 })).toEqual({ won: false, reason: "no-win-within", nodes: 0 });
  });

  it("stops with reason budget when the proof outruns the node budget, but keeps a proven line when only the count does", () => {
    // The bridge's proof takes about 70 nodes; counting its first moves, the better part of a thousand more.
    const r = solve(bridge(), { maxTurns: 6, nodeBudget: 30 });
    expect(r).toMatchObject({ won: false, reason: "budget" });
    expect(r.nodes).toBe(31);
    const partial = solve(bridge(), { maxTurns: 6, nodeBudget: 300 });
    expect(partial).toMatchObject({ won: true, turns: 4, unique: false, countComplete: false });
    if (!partial.won) return;
    expect(partial.nodes).toBe(301);
    expect(partial.winningFirstMoves).toBeGreaterThanOrEqual(1);
    expect(replayWithRules(bridge(), partial.line).phase).toBe("victory");
  });

  it("solves the bridge from the full army in four turns", () => {
    const g = bridge();
    const t0 = performance.now();
    const r = solveBridge();
    console.log(`bridge: ${r.nodes} nodes, ${Math.round(performance.now() - t0)}ms`, r.won ? { turns: r.turns, unique: r.unique, winningFirstMoves: r.winningFirstMoves } : r);
    expect(r.won).toBe(true);
    if (!r.won) return;
    expect(r.turns).toBe(4);
    expect(r.countComplete).toBe(true);
    // The bridge is the last road: clearing it wins the run.
    expect(replayWithRules(g, r.line).phase).toBe("victory");
    const text = lineToText(g, r.line);
    console.log(text.join("\n"));
    expect(text).toHaveLength(r.turns);
  }, LONG);

  it("agrees with an exhaustive search, so the pruning never hides a win or miscounts the first moves", () => {
    // Positions a random cross-check once disagreed on: a counter that only wounds, a brace already paid
    // for, a pawn racing to promote, a rook that must come to the braced king; then the open-field sweep,
    // where one piece kills an enemy and walks on to the next (a bound that charged each approach from
    // the start square pruned it); then the last two turns of the bridge.
    const positions: { g: Run; maxTurns: number }[] = [
      { g: board([{ ...king, hp: 3, x: 4, y: 3 }, { id: "r", side: "black", kind: "rook", hp: 3, x: 5, y: 0 }], { encounter: 1, energy: 3 }), maxTurns: 3 },
      { g: board([{ ...king, hp: 5, x: 3, y: 2 }, { id: "p", side: "white", kind: "pawn", hp: 1, x: 0, y: 3 }, { id: "r", side: "black", kind: "rook", hp: 2, x: 2, y: 3 }], { energy: 3 }), maxTurns: 3 },
      { g: board([{ ...king, hp: 2, x: 0, y: 3 }, { id: "q", side: "white", kind: "queen", hp: 9, x: 1, y: 2 }, { id: "p", side: "black", kind: "pawn", hp: 2, x: 4, y: 1 }], { encounter: 1, energy: 3 }), maxTurns: 3 },
      { g: board([{ ...king, hp: 5, x: 1, y: 3 }, { id: "n", side: "white", kind: "knight", hp: 3, x: 4, y: 0 }, { id: "r", side: "black", kind: "rook", hp: 2, x: 2, y: 0 }], { encounter: 1 }), maxTurns: 3 },
      { g: bridgeTail(), maxTurns: 2 },
    ];
    const sig = (r: ReturnType<typeof solve>) => (r.won ? `won in ${r.turns}, ${r.winningFirstMoves} first moves` : r.reason);
    const compare = ({ g, maxTurns }: { g: Run; maxTurns: number }) => {
      const full = solve(g, { maxTurns, exhaustive: true }), pruned = solve(g, { maxTurns });
      expect(full.won).toBe(true);
      expect(sig(pruned)).toBe(sig(full));
      expect(pruned.nodes).toBeLessThanOrEqual(full.nodes);
    };
    positions.forEach(compare);
    onBoard(OPEN_FIELD, encounter => {
      // At a horizon of two the old bound said no win at all; at three it found the two-turn line anyway.
      compare({ g: sweep(encounter), maxTurns: 2 });
      compare({ g: sweep(encounter), maxTurns: 3 });
      expect(solve(sweep(encounter), { maxTurns: 2 })).toMatchObject({ won: true, turns: 2, unique: true, winningFirstMoves: 1 });
    });
  }, LONG);

  it("never rules out a position on a winning line", () => {
    // The bound only prunes positions it can prove hopeless, so every position along a winning line must
    // pass it. The lines come from where the bound had no hand: exhaustive searches and a line by hand.
    const exhaustive = (g: Run, maxTurns: number): Action[][] => {
      const r = solve(g, { maxTurns, exhaustive: true });
      expect(r.won).toBe(true);
      return r.won ? r.line : [];
    };
    walkBound(newRun(), exhaustive(newRun(), 3));
    const spare = board([{ ...king, x: 1, y: 2 }, { id: "a", side: "black", kind: "pawn", x: 0, y: 1, hp: 1 }, { id: "b", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 }], { energy: 3 });
    walkBound(spare, exhaustive(spare, 3));
    const tail = bridgeTail();
    walkBound(tail, exhaustive(tail, 2));
    onBoard(OPEN_FIELD, encounter => {
      expect(replayWithRules(sweep(encounter), SWEEP_LINE).phase).toBe("victory");
      walkBound(sweep(encounter), SWEEP_LINE);
      walkBound(sweep(encounter), exhaustive(sweep(encounter), 2));
    });
  }, LONG);
});
