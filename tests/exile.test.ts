import { describe, expect, it } from "vitest";
import { ENCOUNTERS, at, budget, cleanupStrike, declineCleanup, enemyOrders, leaveCamp, legal, newRun, plan, readRun, resolveTurn } from "../src/game/exile";
import type { Mode, Run, Unit } from "../src/game/exile";
import { choosePlan } from "./exile-strategy";

function arena(mode: Mode, units: Unit[]): Run { return { ...newRun(mode), units }; }
const king: Unit = { id: "king", side: "white", kind: "king", x: 1, y: 3, hp: 5 };
const pawn: Unit = { id: "p", side: "black", kind: "pawn", x: 2, y: 2, hp: 1 };

describe("Escape from Exile", () => {
  it("opens with one king, two pawns, one available order and no enemy king", () => {
    const g = newRun();
    expect(budget(g)).toBe(1); expect(g.units).toHaveLength(3);
    expect(g.units.filter(u => u.kind === "king")).toHaveLength(1);
    expect(ENCOUNTERS[0].width).toBe(4);
  });
  it("compares retaliation and free hits with the exact same idle target", () => {
    for (const mode of ["retaliation", "ambush"] as const) {
      const g = arena(mode, [king, pawn]);
      const before = structuredClone(g);
      const result = resolveTurn(plan(g, { unitId: "king", to: pawn }), []);
      expect(result.run.units.find(u => u.id === "king")!.hp).toBe(mode === "retaliation" ? 4 : 5);
      expect(result.run.phase).toBe("camp");
      expect(g).toEqual(before);
      expect(result.beats.at(-1)!.units).toEqual(result.run.units);
    }
  });
  it("adds protection to defend in retaliation and trades against defence in free hits", () => {
    for (const mode of ["retaliation", "ambush"] as const) {
      const g = arena(mode, [king, pawn]);
      const ready = plan(g, { unitId: "king", to: king, defend: true });
      const result = resolveTurn(ready, [{ unitId: "p", to: king }]).run;
      expect(result.units.find(u => u.id === "king")!.hp).toBe(mode === "retaliation" ? 5 : 4);
    }
  });
  it("resolves reciprocal orders using original HP and removes equal traders", () => {
    const g = arena("ambush", [{ ...king, hp: 1 }, pawn]);
    const result = resolveTurn(plan(g, { unitId: "king", to: pawn }), [{ unitId: "p", to: king }]).run;
    expect(result.units).toEqual([]); expect(result.phase).toBe("defeat");
  });
  it("subtracts damage from a surviving defender and leaves the attacker back", () => {
    const a: Unit = { id: "ally", side: "white", kind: "bishop", hp: 3, x: 0, y: 2 };
    const b: Unit = { id: "guard", side: "black", kind: "rook", hp: 5, x: 1, y: 1 };
    const g = arena("ambush", [king, a, b]);
    const result = resolveTurn(plan(g, { unitId: a.id, to: b }), []).run;
    expect(at(result, b)!.hp).toBe(2);
    expect(result.units.find(u => u.id === a.id)).toMatchObject({ x: a.x, y: a.y, hp: 3 });
  });
  it("lets a moving target escape", () => {
    const g = arena("ambush", [king, pawn]);
    const result = resolveTurn(plan(g, { unitId: "king", to: pawn }), [{ unitId: "p", to: { x: 2, y: 3 } }]).run;
    expect(result.units.find(u => u.id === "king")).toMatchObject({ x: 2, y: 2, hp: 5 });
    expect(result.units.find(u => u.id === "p")).toMatchObject({ x: 2, y: 3, hp: 1 });
  });
  it("fires a held pawn attack only when an enemy enters its empty diagonal", () => {
    const a: Unit = { id: "ally", side: "white", kind: "pawn", hp: 1, x: 1, y: 2 };
    const b: Unit = { id: "guard", side: "black", kind: "pawn", hp: 1, x: 2, y: 0 };
    const g = arena("ambush", [king, a, b]);
    const ready = plan(g, { unitId: a.id, to: { x: 2, y: 1 } });
    expect(resolveTurn(ready, []).run.units.find(u => u.id === a.id)).toMatchObject({ x: 1, y: 2 });
    const triggered = resolveTurn(ready, [{ unitId: b.id, to: { x: 2, y: 1 } }]).run;
    expect(triggered.units.find(u => u.id === b.id)).toBeUndefined();
    expect(triggered.units.find(u => u.id === a.id)).toMatchObject({ x: 2, y: 1 });
  });
  it("blocks sliding paths at walls while allowing knight jumps", () => {
    const g = { ...newRun(), encounter: 2 };
    const bishop: Unit = { id: "ally", side: "white", kind: "bishop", hp: 3, x: 0, y: 5 };
    g.units = [bishop];
    expect(legal(g, bishop)).toContainEqual({ x: 4, y: 1 });
    expect(legal(g, { ...bishop, kind: "rook" })).not.toContainEqual({ x: 0, y: 1 });
    expect(legal(g, { ...bishop, kind: "knight", x: 1, y: 4 })).toContainEqual({ x: 2, y: 2 });
  });
  it("carries health and permanent losses into the next board; recruitment grows order capacity", () => {
    const g = { ...newRun(), phase: "camp" as const, gold: 10, units: [{ ...king, hp: 2 }] };
    const next = leaveCamp(g, "bishop");
    expect(next.encounter).toBe(1); expect(next.gold).toBe(4);
    expect(next.units.find(u => u.id === "king")!.hp).toBe(2);
    expect(budget(next)).toBe(2);
    const healed = leaveCamp(g, "heal");
    expect(healed.units.find(u => u.id === "king")!.hp).toBe(4);
    expect(healed.units.filter(u => u.side === "white")).toHaveLength(1);
  });
  it("keeps enemy planning independent of the player's queued choices", () => {
    const g = newRun();
    expect(enemyOrders(plan(g, { unitId: "king", to: king, defend: true }))).toEqual(enemyOrders(g));
  });
  it("allows exactly one voluntary cleanup strike, then returns to planning", () => {
    const a: Unit = { id: "ally", side: "white", kind: "bishop", hp: 3, x: 1, y: 2 };
    const b: Unit = { id: "guard", side: "black", kind: "rook", hp: 2, x: 2, y: 1 };
    const g = { ...arena("ambush", [king, a, b]), phase: "cleanup" as const, cleanupTargets: [b.id] };
    expect(plan(g, { unitId: a.id, to: b })).toBe(g);
    const cleaned = cleanupStrike(g, a.id, b.id).run;
    expect(cleaned.cleanupTargets).toEqual([]); expect(cleaned.phase).toBe("camp");
    expect(cleanupStrike(cleaned, a.id, b.id).run).toBe(cleaned);
    expect(declineCleanup(g).phase).toBe("planning");
  });
  it("restores valid runs and rejects overlapping or corrupt units", () => {
    const g = newRun(); expect(readRun(JSON.stringify(g))).toEqual(g);
    g.units.push({ ...g.units[0], id: "duplicate" });
    expect(readRun(JSON.stringify(g))).toBeNull();
  });
  it("hits a target whose own move fails instead of letting it slip away", () => {
    const rook: Unit = { id: "rook", side: "white", kind: "rook", hp: 5, x: 3, y: 5 };
    const wall: Unit = { id: "wall", side: "white", kind: "rook", hp: 5, x: 2, y: 1 };
    const knight: Unit = { id: "n", side: "black", kind: "knight", hp: 2, x: 3, y: 3 };
    const g = { ...arena("ambush", [king, rook, wall, knight]), encounter: 2 };
    const result = resolveTurn(plan(g, { unitId: rook.id, to: knight }), [{ unitId: knight.id, to: wall }]).run;
    expect(result.units.find(u => u.id === knight.id)).toBeUndefined();
    expect(result.units.find(u => u.id === rook.id)).toMatchObject({ x: 3, y: 3, hp: 5 });
    expect(result.units.find(u => u.id === wall.id)!.hp).toBe(3);
    expect(result.log.join(" ")).not.toContain("moves away");
  });
  it("only pins the stuck piece in a dodge cascade; pieces that really leave are not hit", () => {
    const k: Unit = { ...king, x: 1, y: 2 };
    const c: Unit = { id: "c", side: "black", kind: "rook", hp: 2, x: 1, y: 1 };
    const b: Unit = { id: "b", side: "white", kind: "rook", hp: 3, x: 2, y: 1 };
    const a: Unit = { id: "a", side: "black", kind: "rook", hp: 1, x: 3, y: 1 };
    const g = arena("ambush", [k, c, b, a]);
    const result = resolveTurn(plan(g, { unitId: b.id, to: c }), [{ unitId: c.id, to: k }, { unitId: a.id, to: b }]).run;
    expect(result.units.find(u => u.id === c.id)).toBeUndefined();
    expect(result.units.find(u => u.id === b.id)).toMatchObject({ x: 1, y: 1, hp: 3 });
    expect(result.units.find(u => u.id === a.id)).toMatchObject({ x: 2, y: 1, hp: 1 });
    expect(result.units.find(u => u.id === "king")!.hp).toBe(3);
  });
  it("rejects kingless live saves and never throws on a kingless board", () => {
    const g = { ...newRun(), units: newRun().units.filter(u => u.id !== "king") };
    expect(readRun(JSON.stringify(g))).toBeNull();
    expect(readRun(JSON.stringify({ ...g, units: [{ ...g.units[0], x: 0.5 }] }))).toBeNull();
    const lost = { ...g, phase: "defeat" as const };
    expect(readRun(JSON.stringify(lost))).not.toBeNull();
    expect(() => enemyOrders(g)).not.toThrow();
    expect(enemyOrders(g)).toEqual([]);
    expect(() => resolveTurn(g)).not.toThrow();
    expect(() => resolveTurn(lost)).not.toThrow();
  });
  it("trades HP when two pieces contest an empty square", () => {
    const bishop: Unit = { id: "bishop", side: "white", kind: "bishop", hp: 3, x: 3, y: 3 };
    const p: Unit = { ...pawn, x: 2, y: 1 };
    const g = arena("ambush", [king, bishop, p]);
    const result = resolveTurn(plan(g, { unitId: bishop.id, to: { x: 2, y: 2 } }), [{ unitId: p.id, to: { x: 2, y: 2 } }]).run;
    expect(result.units.find(u => u.id === p.id)).toBeUndefined();
    expect(result.units.find(u => u.id === bishop.id)).toMatchObject({ x: 2, y: 2, hp: 2 });
  });
  it("lets a held pawn strike an entrant; only Always trade hits back", () => {
    for (const mode of ["retaliation", "ambush"] as const) {
      const ally: Unit = { id: "ally", side: "white", kind: "pawn", hp: 1, x: 1, y: 2 };
      const bishop: Unit = { id: "guard", side: "black", kind: "bishop", hp: 3, x: 3, y: 0 };
      const g = arena(mode, [king, ally, bishop]);
      const result = resolveTurn(plan(g, { unitId: ally.id, to: { x: 2, y: 1 } }), [{ unitId: bishop.id, to: { x: 2, y: 1 } }]).run;
      expect(result.units.find(u => u.id === bishop.id)!.hp).toBe(2);
      expect(!!result.units.find(u => u.id === ally.id)).toBe(mode === "ambush");
    }
  });
  for (const mode of ["retaliation", "ambush"] as const) it(`can complete the three-encounter run in ${mode} with legal plans`, () => {
    let g = newRun(mode), turns = 0;
    while (!["victory", "defeat"].includes(g.phase) && turns++ < 65) {
      if (g.phase === "camp") { g = leaveCamp(g, g.units.find(u => u.id === "king")!.hp < 3 ? "heal" : "bishop"); continue; }
      if (g.phase === "cleanup") { g = declineCleanup(g); continue; }
      let ready = g;
      for (const o of choosePlan(g)) ready = plan(ready, o);
      g = resolveTurn(ready).run;
      expect(new Set(g.units.map(u => `${u.x},${u.y}`)).size).toBe(g.units.length);
    }
    expect(g.phase).toBe("victory");
  });
});
