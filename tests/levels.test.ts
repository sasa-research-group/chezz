import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import * as checks from "../src/game/levels";
import { KINDS, formatLevels, isError, levelIssues, listIssues, parseLevels, testArmyOf, typicalArmy, withArmy, withTutorial } from "../src/game/levels";
import type { Level } from "../src/game/levels";
import { ENCOUNTERS, RULES, begin, endTurn, startAt } from "../src/game/turns";
import type { Kind, Rules, Run } from "../src/game/turns";
import { LIMITS, parseRules } from "../src/game/rules";
import { FIXED_RULES } from "./fixtures";
import { LEVELS_HEADER, levelsHandler, levelsPlugin } from "../vite.levels";

const FILE = new URL("../src/game/levels/levels.json", import.meta.url);
const base: Level = { reward: 4, width: 4, height: 4, walls: [], spawns: [["pawn", 1, 0, 1]], starts: [{ x: 1, y: 3 }, { x: 2, y: 3 }] };
const messages = (l: Partial<Level>) => levelIssues({ ...base, ...l }, FIXED_RULES).map(i => i.message);

/** A battle deals a king and live enemies, none above its kind's max, and a turn plays without throwing. */
function startsAndPlays(dealt: Run) {
  const max = (u: Run["units"][number]) => (dealt.rules ?? RULES).hp[u.kind];
  expect(dealt.phase).toBe("deploy");
  expect(dealt.units.some(u => u.id === "king")).toBe(true);
  expect(dealt.units.filter(u => u.side === "black").length).toBeGreaterThan(0);
  expect(dealt.units.every(u => u.hp >= 1 && u.hp <= max(u))).toBe(true);
  expect(["player", "camp", "victory", "defeat"]).toContain(endTurn(begin(dealt)).run.phase);
}

describe("levels data", () => {
  it("ships data that loads, with every battle ready to start", () => {
    expect(parseLevels(JSON.parse(readFileSync(FILE, "utf8"))).ok).toBe(true);
    expect(parseRules(JSON.parse(JSON.stringify(RULES))).ok).toBe(true);
    expect(listIssues(ENCOUNTERS).flat().filter(isError)).toEqual([]);
    ENCOUNTERS.forEach((_, i) => startsAndPlays(startAt(i, ["king"], 0)));
  });
  it("loads the shipped levels under any legal stats, so saving rules never breaks them", () => {
    const every = (n: number) => Object.fromEntries(KINDS.map(k => [k, n])) as Record<Kind, number>;
    const extremes: Rules[] = [LIMITS.hp[0], LIMITS.hp[1]].flatMap(hp => [LIMITS.damage[0], LIMITS.damage[1]].map(damage => ({ ...RULES, hp: every(hp), damage: every(damage) })));
    for (const rules of extremes) {
      expect(parseRules(JSON.parse(JSON.stringify(rules))).ok).toBe(true);
      expect(parseLevels(JSON.parse(readFileSync(FILE, "utf8"))).ok).toBe(true);
      expect(listIssues(ENCOUNTERS, rules).flat().filter(isError)).toEqual([]);
      ENCOUNTERS.forEach((_, i) => startsAndPlays(startAt(i, ["king"], 0, { rules })));
    }
  });
  it("keeps the file in the designer's own format, so a save round-trips without noise", () => {
    expect(formatLevels(ENCOUNTERS)).toBe(readFileSync(FILE, "utf8"));
  });
  it("flags what would break a level as errors, tied to the square", () => {
    expect(levelIssues(base)).toEqual([]);
    expect(messages({ width: 9 })).toContain("Size 2–8");
    expect(levelIssues({ ...base, spawns: [["pawn", 4, 0, 1]] })).toContainEqual({ field: "spawns", message: "Enemy pawn off the board", at: { x: 4, y: 0 } });
    expect(messages({ walls: [{ x: 1, y: 3 }] })).toContain("King start on a wall");
    expect(messages({ spawns: [["pawn", 2, 3, 1]] })).toContain("Start 2 overlaps enemy pawn");
    expect(messages({ spawns: [["rook", 1, 0, 0]] })).toContain("Enemy rook HP 1–99");
    expect(messages({ spawns: [] })).toContain("Needs an enemy");
    expect(messages({ starts: [] })).toContain("Needs a king start");
    expect(messages({ testArmy: [{ kind: "rook", x: 1, y: 3 }] })).toContain("Army needs exactly one king");
    expect(messages({ testArmy: [{ kind: "king", x: 1, y: 3 }, { kind: "king", x: 2, y: 3 }] })).toContain("Army needs exactly one king");
    expect(levelIssues({ ...base, testArmy: [{ kind: "king", x: 1, y: 3 }, { kind: "rook", x: 0, y: 0 }] })).toContainEqual({ field: "testArmy", message: "Army rook off a start", at: { x: 0, y: 0 } });
    expect(messages({ testArmy: [{ kind: "king", x: 1, y: 3 }, { kind: "rook", x: 1, y: 3 }] })).toContain("Two army pieces on one start");
    // Empty starts are fine: the king alone, on the second start.
    expect(levelIssues({ ...base, testArmy: [{ kind: "king", x: 2, y: 3 }] })).toEqual([]);
    expect(levelIssues({ ...base, width: 9, spawns: [], starts: [], testArmy: [{ kind: "rook", x: 1, y: 3 }] }).every(isError)).toBe(true);
  });
  it("warns, never errs, when a spawn's HP is above its kind's max: the game clamps it", () => {
    const over: Level = { ...base, spawns: [["rook", 1, 0, 6]] };
    expect(levelIssues(over, FIXED_RULES)).toEqual([{ field: "spawns", message: "rook HP 6 > max 5 → 5", at: { x: 1, y: 0 }, warning: true, clamped: true }]);
    expect(levelIssues(over, { ...FIXED_RULES, hp: { ...FIXED_RULES.hp, rook: 6 } })).toEqual([]);
    expect(parseLevels({ version: 1, levels: [over] }).ok).toBe(true);
    // HP left out means full health, whatever the stats.
    const full: Level = { ...base, spawns: [["rook", 1, 0]] };
    expect(levelIssues(full, FIXED_RULES)).toEqual([]);
    expect(parseLevels({ version: 1, levels: [full] })).toEqual({ ok: true, file: { version: 1, levels: [full] } });
    expect(formatLevels([full])).toContain('"spawns": [["rook", 1, 0]]');
    expect(parseLevels({ version: 1, levels: [{ ...base, spawns: [["rook", 1, 0, 1, 1]] }] }).ok).toBe(false);
  });
  it("flags design rules as warnings, which don't block", () => {
    // A wall ahead of a start is the designer's call, not a warning.
    expect(levelIssues({ ...base, walls: [{ x: 2, y: 1 }] })).toEqual([]);
    expect(levelIssues({ ...base, walls: [0, 1, 2, 3].map(x => ({ x, y: 2 })).filter(w => w.x !== 1 && w.x !== 2), spawns: [["pawn", 0, 0, 1]], starts: [{ x: 1, y: 3 }] })).toEqual([]);
    expect(levelIssues({ ...base, walls: [0, 1, 2, 3].map(x => ({ x, y: 1 })), spawns: [["pawn", 1, 0, 1]], starts: [{ x: 1, y: 3 }] })).toContainEqual({ field: "spawns", message: "Enemy pawn cut off", at: { x: 1, y: 0 }, warning: true });
    // Survivors carry over, so a later level should have at least as many starts.
    expect(listIssues([base, { ...base, starts: [{ x: 1, y: 3 }] }])[1]).toEqual([{ field: "starts", message: "Fewer starts than battle 1 (2)", warning: true }]);
  });
  it("rejects files with the wrong shape or any broken level", () => {
    expect(parseLevels({ version: 1, levels: [base] })).toEqual({ ok: true, file: { version: 1, levels: [base] } });
    expect(parseLevels([base]).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [] }).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [{ ...base, script: "x" }] })).toEqual({ ok: false, errors: ["Level 1: unknown field script"] });
    expect(parseLevels({ version: 1, levels: [{ ...base, spawns: [["dragon", 1, 0, 1]] }] }).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [{ ...base, width: "4" }] }).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [base, { ...base, spawns: [] }] })).toEqual({ ok: false, errors: ["Level 2: Needs an enemy"] });
    // Warnings alone don't stop a save.
    const warned = [base, { ...base, walls: [{ x: 2, y: 1 }], starts: [{ x: 2, y: 3 }] }];
    expect(parseLevels({ version: 1, levels: warned })).toEqual({ ok: true, file: { version: 1, levels: warned } });
  });
  it("gives a test run the king plus the best recruit each hideout's gold affords", () => {
    const three = [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 0, y: 3 }];
    const run: Level[] = [{ ...base, reward: 8, starts: [three[0]] }, { ...base, reward: 8, starts: three }, { ...base, starts: three }];
    expect(typicalArmy(run, 0, FIXED_RULES)).toEqual(["king"]);
    // 2 starting gold + 8 → a rook (8); then 2 + 8 → another rook.
    expect(typicalArmy(run, 1, FIXED_RULES)).toEqual(["king", "rook"]);
    expect(typicalArmy(run, 2, FIXED_RULES)).toEqual(["king", "rook", "rook"]);
    const poor = [{ ...base, reward: 2 }, { ...base, reward: 0 }, base];
    expect(typicalArmy(poor, 1, FIXED_RULES)).toEqual(["king", "pawn"]);
    // No room on the road: the recruit isn't bought.
    expect(typicalArmy([base, { ...base, starts: [{ x: 1, y: 3 }] }], 1, FIXED_RULES)).toEqual(["king"]);
    const placed = [{ kind: "bishop" as const, x: 1, y: 3 }, { kind: "king" as const, x: 2, y: 3 }];
    expect(testArmyOf([{ ...base, testArmy: placed }], 0)).toEqual(placed);
    // Without a saved test army, the typical one fills the starts in order.
    expect(testArmyOf(run, 1, FIXED_RULES)).toEqual([{ kind: "king", x: 1, y: 3 }, { kind: "rook", x: 2, y: 3 }]);
    expect(formatLevels([{ ...base, testArmy: [{ x: 1, y: 3, kind: "king" }] as never }])).toContain('"testArmy": [{ "kind": "king", "x": 1, "y": 3 }]');
    expect(parseLevels({ version: 1, levels: [{ ...base, testArmy: ["king"] }] }).ok).toBe(false);
  });
  it("keeps a tutorial level's preset army in its tutorial block, checked like a test army", () => {
    const army = [{ kind: "king" as const, x: 1, y: 3 }];
    const tutorial: Level = { ...base, tutorial: { army } };
    expect(parseLevels({ version: 1, levels: [tutorial] }).ok).toBe(true);
    expect(formatLevels([tutorial])).toContain('"tutorial": { "army": [{ "kind": "king", "x": 1, "y": 3 }] }');
    expect(testArmyOf([tutorial], 0)).toEqual(army);
    expect(messages({ tutorial: { army: [{ kind: "rook", x: 1, y: 3 }] } })).toContain("Army needs exactly one king");
    for (const bad of [{}, { army, extra: 1 }, { army: ["king"] }])
      expect(parseLevels({ version: 1, levels: [{ ...base, tutorial: bad }] }).ok).toBe(false);
    // The hand-out hook: empty by default, item ids once consumables exist.
    for (const handout of [{}, { items: [] }, { items: ["any-id"] }]) expect(parseLevels({ version: 1, levels: [{ ...tutorial, handout }] }).ok).toBe(true);
    for (const handout of [[], { items: "x" }, { items: [3] }, { gold: 1 }]) expect(parseLevels({ version: 1, levels: [{ ...tutorial, handout }] }).ok).toBe(false);
    expect(formatLevels([{ ...tutorial, handout: { items: [] } }])).toContain('"handout": { "items": [] }');
    expect(parseLevels({ version: 1, levels: [{ ...tutorial, testArmy: army }] }).ok).toBe(false);
    // Survivors don't carry over in the tutorial, so fewer starts than the level before is fine there.
    expect(listIssues([base, { ...tutorial, starts: [{ x: 1, y: 3 }] }], FIXED_RULES)[1]).toEqual([]);
  });
  it("moves a level in and out of the tutorial without losing its army", () => {
    const army = [{ kind: "king" as const, x: 2, y: 3 }];
    const on = withTutorial({ ...base, testArmy: army }, true, army);
    expect(on).toEqual({ ...base, tutorial: { army } });
    expect(withTutorial(on, false, army)).toEqual({ ...base, testArmy: army });
    expect(withArmy(on, [{ kind: "king", x: 1, y: 3 }]).tutorial?.army).toEqual([{ kind: "king", x: 1, y: 3 }]);
    expect(withArmy({ ...base, testArmy: army }, undefined)).toEqual(base);
  });
});

function request(body: string, headers: Record<string, string> = { [LEVELS_HEADER]: "save", "content-type": "application/json" }, method = "POST") {
  return Object.assign(Readable.from([Buffer.from(body)]), { method, headers }) as unknown as IncomingMessage;
}
async function send(file: string, req: IncomingMessage) {
  const res = { statusCode: 0, body: "", setHeader() {}, end(b: string) { this.body = b; } };
  await levelsHandler(file, async () => checks)(req, res as unknown as ServerResponse);
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

describe("level designer save endpoint", () => {
  const scratch = () => { const f = join(mkdtempSync(join(tmpdir(), "chezz-levels-")), "levels.json"); writeFileSync(f, "old"); return f; };
  it("writes checked levels in the repo's format", async () => {
    const file = scratch();
    const r = await send(file, request(JSON.stringify({ version: 1, levels: [base] })));
    expect(r).toEqual({ status: 200, body: { ok: true, changed: true, levels: 1 } });
    expect((await send(file, request(JSON.stringify({ version: 1, levels: [base] }), { [LEVELS_HEADER]: "save", "content-type": "application/json", host: "127.0.0.1:5173", origin: "http://127.0.0.1:5173", "sec-fetch-site": "same-origin" }))).body.changed).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(formatLevels([base]));
  });
  it("refuses broken levels and leaves the file alone", async () => {
    const file = scratch();
    const r = await send(file, request(JSON.stringify({ version: 1, levels: [{ ...base, starts: [] }] })));
    expect(r.status).toBe(400);
    expect(r.body.errors).toEqual(["Level 1: Needs a king start"]);
    expect((await send(file, request("{nope"))).status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe("old");
  });
  it("only answers a studio POST, and only on the dev server", async () => {
    const file = scratch(), body = JSON.stringify({ version: 1, levels: [base] });
    expect((await send(file, request(body, { "content-type": "application/json" }))).status).toBe(403);
    expect((await send(file, request(body, { [LEVELS_HEADER]: "save", "content-type": "text/plain" }))).status).toBe(403);
    expect((await send(file, request(body, undefined, "GET"))).status).toBe(405);
    const studio = { [LEVELS_HEADER]: "save", "content-type": "application/json", host: "127.0.0.1:5173" };
    expect((await send(file, request(body, { ...studio, origin: "http://localhost:3000" }))).status).toBe(403);
    expect((await send(file, request(body, { ...studio, "sec-fetch-site": "same-site" }))).status).toBe(403);
    expect(readFileSync(file, "utf8")).toBe("old");
    expect(levelsPlugin(file).apply).toBe("serve");
  });
});

describe("switches in the levels file", () => {
  const trap = { type: "spears" as const, x: 0, y: 3, rows: [1, 2], damage: 2 };
  it("accepts a spear switch and writes it back unchanged", () => {
    expect(messages({ switches: [trap] })).toEqual([]);
    const l = { ...base, switches: [trap] };
    const parsed = parseLevels(JSON.parse(formatLevels([l])));
    expect(parsed.ok && parsed.file.levels[0].switches).toEqual([trap]);
  });
  it("flags a switch off the board, on a start or enemy, with ranks off the board or no damage", () => {
    expect(messages({ switches: [{ ...trap, x: 9 }] })).toContain("Switch off the board");
    expect(messages({ switches: [{ ...trap, x: 1, y: 3 }] })).toContain("King start overlaps switch");
    expect(messages({ switches: [{ ...trap, rows: [4] }] })).toContain("Spear rows on the board");
    expect(messages({ switches: [{ ...trap, rows: [] }] })).toContain("Spear rows on the board");
    expect(messages({ switches: [{ ...trap, damage: 0 }] }).some(m => m.startsWith("Spear damage"))).toBe(true);
  });
  it("refuses an unknown switch type or a missing field", () => {
    expect(parseLevels({ version: 1, levels: [{ ...base, switches: [{ ...trap, type: "fire" }] }] }).ok).toBe(false);
    const { type: _, ...untyped } = trap;
    expect(parseLevels({ version: 1, levels: [{ ...base, switches: [untyped] }] }).ok).toBe(false);
  });
  it("places a new switch with spears on a middle rank", () => {
    expect(checks.newSwitch({ height: 5 }, { x: 0, y: 4 })).toEqual({ type: "spears", x: 0, y: 4, rows: [2], damage: 2 });
  });
});

describe("floor tiles and kits in the levels file", () => {
  it("accepts tiles and a kit and writes them back unchanged", () => {
    const l: Level = { ...base, tiles: [{ type: "ice", x: 0, y: 2 }, { type: "sludge", x: 3, y: 2 }], kit: { ice: 2, sludge: 1 } };
    expect(messages(l)).toEqual([]);
    const parsed = parseLevels(JSON.parse(formatLevels([l])));
    expect(parsed.ok && parsed.file.levels[0]).toEqual(l);
  });
  it("flags a tile under an enemy, a start, a wall or another tile", () => {
    expect(messages({ tiles: [{ type: "ice", x: 1, y: 0 }] })).toContain("Enemy pawn overlaps ice");
    expect(messages({ tiles: [{ type: "sludge", x: 1, y: 3 }] })).toContain("King start overlaps sludge");
    expect(messages({ walls: [{ x: 0, y: 0 }], tiles: [{ type: "ice", x: 0, y: 0 }] })).toContain("Ice on a wall");
    expect(messages({ tiles: [{ type: "ice", x: 0, y: 2 }, { type: "sludge", x: 0, y: 2 }] })).toContain("Sludge overlaps ice");
  });
  it("refuses unknown tile types and kit counts out of range", () => {
    expect(parseLevels({ version: 1, levels: [{ ...base, tiles: [{ type: "lava", x: 0, y: 2 }] }] }).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [{ ...base, kit: { ice: 10 } }] }).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [{ ...base, kit: { lava: 1 } }] }).ok).toBe(false);
  });
});
