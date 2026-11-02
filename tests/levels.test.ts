import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import * as checks from "../src/game/levels";
import { formatLevels, levelIssues, parseLevels, testArmyOf, typicalArmy } from "../src/game/levels";
import type { Level } from "../src/game/levels";
import { ENCOUNTERS } from "../src/game/turns";
import { LEVELS_HEADER, levelsHandler, levelsPlugin } from "../vite.levels";

const FILE = new URL("../src/game/levels/levels.json", import.meta.url);
const base: Level = { reward: 4, enemyEnergy: 2, width: 4, height: 4, walls: [], spawns: [["pawn", 1, 0, 1]], starts: [{ x: 1, y: 3 }, { x: 2, y: 3 }] };
const messages = (l: Partial<Level>) => levelIssues({ ...base, ...l }).map(i => i.message);

describe("levels data", () => {
  it("ships the three battles exactly as they were written in code", () => {
    const parsed = parseLevels(JSON.parse(readFileSync(FILE, "utf8")));
    expect(parsed.ok).toBe(true);
    expect(ENCOUNTERS).toEqual([
      { reward: 8, enemyEnergy: 2, width: 4, height: 4, walls: [], spawns: [["pawn", 0, 1, 1], ["pawn", 2, 1, 1]], starts: [{ x: 1, y: 3 }] },
      { reward: 8, enemyEnergy: 3, width: 6, height: 4, walls: [{ x: 3, y: 1 }, { x: 3, y: 2 }], spawns: [["pawn", 0, 0, 1], ["pawn", 3, 0, 1], ["pawn", 5, 0, 1]], starts: [{ x: 1, y: 3 }, { x: 0, y: 3 }, { x: 5, y: 3 }] },
      { reward: 0, enemyEnergy: 3, width: 6, height: 6, walls: [2, 3].flatMap(y => [0, 1, 4, 5].map(x => ({ x, y }))), spawns: [["knight", 3, 0, 2], ["pawn", 1, 1, 1], ["pawn", 4, 1, 1]], starts: [{ x: 2, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 }] },
    ]);
  });
  it("keeps the file in the designer's own format, so a save round-trips without noise", () => {
    expect(formatLevels(ENCOUNTERS)).toBe(readFileSync(FILE, "utf8"));
  });
  it("flags what would break a level, tied to the square", () => {
    expect(levelIssues(base)).toEqual([]);
    expect(messages({ width: 9 })).toContain("Size 2–8");
    expect(levelIssues({ ...base, spawns: [["pawn", 4, 0, 1]] })).toContainEqual({ field: "spawns", message: "Enemy pawn off the board", at: { x: 4, y: 0 } });
    expect(messages({ walls: [{ x: 1, y: 3 }] })).toContain("King start on a wall");
    expect(messages({ walls: [{ x: 2, y: 1 }] })).toContain("Wall ahead of start");
    expect(messages({ spawns: [["pawn", 2, 3, 1]] })).toContain("Start 2 overlaps enemy pawn");
    expect(messages({ spawns: [["rook", 1, 0, 6]] })).toContain("Enemy rook HP 1–5");
    expect(messages({ spawns: [] })).toContain("Needs an enemy");
    expect(messages({ starts: [] })).toContain("Needs a king start");
    expect(messages({ testArmy: ["rook"] })).toContain("Army needs one king, first");
    expect(messages({ testArmy: ["king", "rook", "pawn"] })).toContain("Army 3 > 2 starts");
    expect(messages({ enemyEnergy: -1 })).toContain("Enemy energy 0–12");
    expect(levelIssues({ ...base, walls: [0, 1, 2, 3].map(x => ({ x, y: 2 })).filter(w => w.x !== 1 && w.x !== 2), spawns: [["pawn", 0, 0, 1]], starts: [{ x: 1, y: 3 }] })).toEqual([]);
    expect(levelIssues({ ...base, walls: [0, 1, 2, 3].map(x => ({ x, y: 1 })), spawns: [["pawn", 1, 0, 1]], starts: [{ x: 1, y: 3 }] })).toContainEqual({ field: "spawns", message: "Enemy pawn cut off", at: { x: 1, y: 0 } });
  });
  it("rejects files with the wrong shape or any broken level", () => {
    expect(parseLevels({ version: 1, levels: [base] })).toEqual({ ok: true, file: { version: 1, levels: [base] } });
    expect(parseLevels([base]).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [] }).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [{ ...base, script: "x" }] })).toEqual({ ok: false, errors: ["Level 1: unknown field script"] });
    expect(parseLevels({ version: 1, levels: [{ ...base, spawns: [["dragon", 1, 0, 1]] }] }).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [{ ...base, width: "4" }] }).ok).toBe(false);
    expect(parseLevels({ version: 1, levels: [base, { ...base, spawns: [] }] })).toEqual({ ok: false, errors: ["Level 2: Needs an enemy"] });
    // Survivors carry over, so a later level needs at least as many starts.
    expect(parseLevels({ version: 1, levels: [base, { ...base, starts: [{ x: 1, y: 3 }] }] })).toEqual({ ok: false, errors: ["Level 2: Fewer starts than battle 1 (2)"] });
  });
  it("gives a playtest the king plus the best recruit each hideout's gold affords", () => {
    expect(typicalArmy(ENCOUNTERS, 0)).toEqual(["king"]);
    // 2 starting gold + 8 → a rook (8); then 2 + 8 → another rook.
    expect(typicalArmy(ENCOUNTERS, 1)).toEqual(["king", "rook"]);
    expect(typicalArmy(ENCOUNTERS, 2)).toEqual(["king", "rook", "rook"]);
    const poor = [{ ...base, reward: 2 }, { ...base, reward: 0 }, base];
    expect(typicalArmy(poor, 1)).toEqual(["king", "pawn"]);
    // No room on the road: the recruit isn't bought.
    expect(typicalArmy([base, { ...base, starts: [{ x: 1, y: 3 }] }], 1)).toEqual(["king"]);
    expect(testArmyOf([{ ...base, testArmy: ["king", "bishop"] }], 0)).toEqual(["king", "bishop"]);
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
