import { describe, expect, it } from "vitest";
import { ENCOUNTERS, HP, attack, defend, endTurn, move, newRun, promote, walkAndStrike } from "../src/game/turns";
import type { Run, Unit } from "../src/game/turns";
import { boardKey, lineToText, playerOutcomes, replay, solve } from "../src/game/solver";
import type { Action } from "../src/game/solver";

const king: Unit = { id: "king", side: "white", kind: "king", x: 1, y: 3, hp: HP.king };
const board = (units: Unit[], extra: Partial<Run> = {}): Run => ({ ...newRun(), units, ...extra });

/** Replays a line with nothing but the rules module, the way the board would: a move the rules refuse
 * on its own followed by a strike from the same piece is a tap. Fails loudly on any refused action. */
function replayWithRules(start: Run, line: Action[][]): Run {
  let g = start;
  for (const turn of line) {
    for (let i = 0; i < turn.length; i++) {
      const a = turn[i], before = g;
      if (a.type === "move") {
        g = move(g, a.id, a.to);
        if (g === before) {
          const b = turn[i + 1];
          const tap = b?.type === "attack" && b.id === a.id ? walkAndStrike(g, a.id, a.to, b.targetId) : null;
          expect(tap, `tap ${JSON.stringify(a)}`).not.toBeNull();
          g = tap!.run; i++;
        }
      } else if (a.type === "attack") g = attack(g, a.id, a.targetId).run;
      else if (a.type === "defend") g = defend(g, a.id);
      else if (a.type === "promote") g = promote(g, a.id, a.kind).run;
      else g = endTurn(g).run;
      expect(g, `refused ${JSON.stringify(a)}`).not.toBe(before);
    }
  }
  return g;
}

/** The bridge (encounter 2) with the full three-piece army on its start squares. */
function bridge(): Run {
  const e = ENCOUNTERS[2];
  const army: Unit[] = [{ ...king }, { id: "rook", side: "white", kind: "rook", x: 0, y: 0, hp: HP.rook }, { id: "bishop", side: "white", kind: "bishop", x: 0, y: 0, hp: HP.bishop }];
  const whites = army.map((u, i) => ({ ...u, ...e.starts[i] }));
  const blacks = e.spawns.map(([kind, x, y, hp], i): Unit => ({ id: `enemy-2-${i}`, side: "black", kind, x, y, hp }));
  return board([...whites, ...blacks], { encounter: 2 });
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
    expect(replayWithRules(newRun(), r.line).phase).toBe("camp");
    expect(replay(newRun(), r.line).phase).toBe("camp");
    const text = lineToText(newRun(), r.line);
    console.log(text.join("\n"));
    expect(text).toHaveLength(2);
    expect(text[0]).toMatch(/^T1: king b1→/);
    expect(text[1]).toMatch(/\(kill\) — battle won$/);
  });

  it("finds a win in one and calls it unique however the blow lands", () => {
    const r = solve(board([king, { id: "p", side: "black", kind: "pawn", x: 1, y: 2, hp: 1 }]), { maxTurns: 3 });
    expect(r).toMatchObject({ won: true, turns: 1, unique: true, winningFirstMoves: 1 });
    if (r.won) expect(r.line).toEqual([[{ type: "attack", id: "king", targetId: "p" }]]);
  });

  it("counts two winning first moves when either pawn can go first", () => {
    // With only two energy the king can strike one pawn now and the other next turn; anything else wastes the turn.
    const g = board([{ ...king, x: 1, y: 2 }, { id: "a", side: "black", kind: "pawn", x: 0, y: 1, hp: 1 }, { id: "b", side: "black", kind: "pawn", x: 2, y: 1, hp: 1 }], { energy: 2 });
    const r = solve(g, { maxTurns: 3 });
    expect(r).toMatchObject({ won: true, turns: 2, unique: false, winningFirstMoves: 2 });
    if (r.won) expect(replayWithRules(g, r.line).phase).toBe("camp");
  });

  it("reports no win within the horizon for a hopeless position", () => {
    const r = solve(board([{ ...king, hp: 1 }, { id: "q", side: "black", kind: "queen", x: 1, y: 0, hp: HP.queen }]), { maxTurns: 2 });
    expect(r).toMatchObject({ won: false, reason: "no-win-within" });
  });

  it("stops with reason budget when the node budget runs out", () => {
    const r = solve(bridge(), { maxTurns: 6, nodeBudget: 30 });
    expect(r).toMatchObject({ won: false, reason: "budget" });
    expect(r.nodes).toBe(31);
  });

  it("solves the bridge from the full army within six turns", () => {
    const g = bridge();
    const t0 = performance.now();
    const r = solve(g, { maxTurns: 6, nodeBudget: 300000 });
    console.log(`bridge: ${r.nodes} nodes, ${Math.round(performance.now() - t0)}ms`, r.won ? { turns: r.turns, unique: r.unique, winningFirstMoves: r.winningFirstMoves } : r);
    expect(r.won).toBe(true);
    if (!r.won) return;
    expect(replayWithRules(g, r.line).phase).toBe("camp");
    const text = lineToText(g, r.line);
    console.log(text.join("\n"));
    expect(text).toHaveLength(r.turns);
  });
});
