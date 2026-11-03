import { readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

/** The studio's level designer saves here while `npm run dev` runs. Production builds have no such route. */
export const LEVELS_ENDPOINT = "/__studio/levels";
/** The studio's Mechanics tab saves piece stats and rule switches here, under the same guards. */
export const RULES_ENDPOINT = "/__studio/rules";
/** A custom header makes a cross-site form or fetch need a CORS preflight, which the dev server refuses. */
export const LEVELS_HEADER = "x-chezz-studio";
const MAX_BYTES = 256 * 1024;

/** Turns a request body into the file's text, or the reasons it can't be saved. */
type Check = (raw: unknown) => { ok: true; text: string; reply?: object } | { ok: false; errors: string[] };
type LevelChecks = { parseLevels: (raw: unknown) => { ok: true; file: { levels: unknown[] } } | { ok: false; errors: string[] }; formatLevels: (levels: never[]) => string };
type RuleChecks = { parseRules: (raw: unknown) => { ok: true; rules: unknown } | { ok: false; errors: string[] }; formatRules: (rules: never) => string };

/** Handles one studio save: checks the request and the body, then writes the formatted file. */
export function saveHandler(file: string, load: () => Promise<Check>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const reply = (status: number, body: object) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(body)); };
    if (req.method !== "POST") return reply(405, { errors: ["POST only"] });
    if (req.headers[LEVELS_HEADER] !== "save" || !String(req.headers["content-type"]).startsWith("application/json")) return reply(403, { errors: ["Not a studio save"] });
    // Only the studio page on this same dev server may save: not another local site, not another machine.
    const origin = req.headers.origin, site = req.headers["sec-fetch-site"];
    if ((origin && origin.replace(/^https?:\/\//, "") !== req.headers.host) || (site && site !== "same-origin")) return reply(403, { errors: ["Not a studio save"] });
    if (Number(req.headers["content-length"]) > MAX_BYTES) return reply(413, { errors: ["Too large"] });
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BYTES) return reply(413, { errors: ["Too large"] });
      chunks.push(chunk as Buffer);
    }
    let raw: unknown;
    try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return reply(400, { errors: ["Not JSON"] }); }
    const checked = (await load())(raw);
    if (!checked.ok) return reply(400, { errors: checked.errors });
    const before = await readFile(file, "utf8").catch(() => "");
    // An unchanged file isn't touched, so saving twice doesn't reload every open page.
    try {
      if (checked.text !== before) { await writeFile(`${file}.tmp`, checked.text); await rename(`${file}.tmp`, file); }
    } catch (e) { return reply(500, { errors: [`Write failed: ${(e as Error).message}`] }); }
    reply(200, { ok: true, changed: checked.text !== before, ...checked.reply });
  };
}

export function levelsHandler(file: string, load: () => Promise<LevelChecks>) {
  return saveHandler(file, async () => {
    const { parseLevels, formatLevels } = await load();
    return raw => {
      const parsed = parseLevels(raw);
      return parsed.ok ? { ok: true, text: formatLevels(parsed.file.levels as never[]), reply: { levels: parsed.file.levels.length } } : parsed;
    };
  });
}
export function rulesHandler(file: string, load: () => Promise<RuleChecks>) {
  return saveHandler(file, async () => {
    const { parseRules, formatRules } = await load();
    return raw => {
      const parsed = parseRules(raw);
      return parsed.ok ? { ok: true, text: formatRules(parsed.rules as never) } : parsed;
    };
  });
}

/** Dev-only: lets the studio write `src/game/levels/levels.json`. The checks are loaded through the dev
 * server, so the config doesn't depend on the levels file and saving one doesn't restart the server. */
export function levelsPlugin(file: string): Plugin {
  return {
    name: "chezz-levels",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(LEVELS_ENDPOINT, levelsHandler(file, () => server.ssrLoadModule("/src/game/levels.ts") as Promise<LevelChecks>));
    },
  };
}
/** Dev-only: lets the studio write `src/game/rules.json`. `rules.ts` doesn't read the file, so a broken
 * file on disk can still be saved over. */
export function rulesPlugin(file: string): Plugin {
  return {
    name: "chezz-rules",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(RULES_ENDPOINT, rulesHandler(file, () => server.ssrLoadModule("/src/game/rules.ts") as Promise<RuleChecks>));
    },
  };
}
