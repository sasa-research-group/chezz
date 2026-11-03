import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import * as checks from "../src/game/rules";
import { formatRules, parseRules } from "../src/game/rules";
import { RULES } from "../src/game/turns";
import { LEVELS_HEADER, rulesHandler, rulesPlugin } from "../vite.levels";

const FILE = new URL("../src/game/rules.json", import.meta.url);

describe("rules data", () => {
  it("ships a rules file that parses and round-trips byte for byte", () => {
    expect(parseRules(JSON.parse(readFileSync(FILE, "utf8"))).ok).toBe(true);
    expect(formatRules(RULES)).toBe(readFileSync(FILE, "utf8"));
  });
  it("lists every problem in a broken file", () => {
    expect(parseRules([]).ok).toBe(false);
    const bad = { ...RULES, turn: "some", hp: { ...RULES.hp, king: 0 }, damage: { ...RULES.damage, pawn: 1.5 }, defend: -1, counter: "yes", extra: 1 };
    expect(parseRules(bad)).toEqual({ ok: false, errors: ["Unknown field extra", 'turn must be "one" or "all"', "hp king: 1–99", "damage pawn: 0–99", "defend: 0–9", "counter must be true or false"] });
    const { queen: _, ...noQueen } = RULES.hp;
    expect(parseRules({ ...RULES, hp: noQueen })).toEqual({ ok: false, errors: ["hp needs king, queen, rook, bishop, knight, pawn"] });
  });
});

function request(body: string, headers: Record<string, string> = { [LEVELS_HEADER]: "save", "content-type": "application/json" }) {
  return Object.assign(Readable.from([Buffer.from(body)]), { method: "POST", headers }) as unknown as IncomingMessage;
}
async function send(file: string, req: IncomingMessage) {
  const res = { statusCode: 0, body: "", setHeader() {}, end(b: string) { this.body = b; } };
  await rulesHandler(file, async () => checks)(req, res as unknown as ServerResponse);
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

describe("rules save endpoint", () => {
  const scratch = () => { const f = join(mkdtempSync(join(tmpdir(), "chezz-rules-")), "rules.json"); writeFileSync(f, "old"); return f; };
  it("writes checked rules in the repo's format", async () => {
    const file = scratch(), next = { ...RULES, turn: "all" as const, damage: { ...RULES.damage, rook: 3 } };
    expect(await send(file, request(JSON.stringify(next)))).toEqual({ status: 200, body: { ok: true, changed: true } });
    expect(readFileSync(file, "utf8")).toBe(formatRules(next));
    expect((await send(file, request(JSON.stringify(next)))).body.changed).toBe(false);
  });
  it("refuses broken rules and strangers, leaving the file alone", async () => {
    const file = scratch();
    const r = await send(file, request(JSON.stringify({ ...RULES, defend: 10 })));
    expect(r).toEqual({ status: 400, body: { errors: ["defend: 0–9"] } });
    expect((await send(file, request(JSON.stringify(RULES), { "content-type": "application/json" }))).status).toBe(403);
    expect((await send(file, request(JSON.stringify(RULES), { [LEVELS_HEADER]: "save", "content-type": "application/json", host: "127.0.0.1:5173", origin: "http://localhost:3000" }))).status).toBe(403);
    expect(readFileSync(file, "utf8")).toBe("old");
    expect(rulesPlugin(file).apply).toBe("serve");
  });
});
