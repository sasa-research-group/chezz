import { readFile, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

/** The studio's level designer saves here while `npm run dev` runs. Production builds have no such route. */
export const LEVELS_ENDPOINT = "/__studio/levels";
/** A custom header makes a cross-site form or fetch need a CORS preflight, which the dev server refuses. */
export const LEVELS_HEADER = "x-chezz-studio";
const MAX_BYTES = 256 * 1024;

type Checks = { parseLevels: (raw: unknown) => { ok: true; file: { levels: unknown[] } } | { ok: false; errors: string[] }; formatLevels: (levels: never[]) => string };

/** Handles one save: checks the request and the levels, then writes the formatted file. */
export function levelsHandler(file: string, load: () => Promise<Checks>) {
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
    const { parseLevels, formatLevels } = await load();
    const parsed = parseLevels(raw);
    if (!parsed.ok) return reply(400, { errors: parsed.errors });
    const text = formatLevels(parsed.file.levels as never[]);
    const before = await readFile(file, "utf8").catch(() => "");
    // An unchanged file isn't touched, so saving twice doesn't reload every open page.
    try {
      if (text !== before) { await writeFile(`${file}.tmp`, text); await rename(`${file}.tmp`, file); }
    } catch (e) { return reply(500, { errors: [`Write failed: ${(e as Error).message}`] }); }
    reply(200, { ok: true, changed: text !== before, levels: parsed.file.levels.length });
  };
}

/** Dev-only: lets the studio write `src/game/levels/levels.json`. The checks are loaded through the dev
 * server, so the config doesn't depend on the levels file and saving one doesn't restart the server. */
export function levelsPlugin(file: string): Plugin {
  return {
    name: "chezz-levels",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(LEVELS_ENDPOINT, levelsHandler(file, () => server.ssrLoadModule("/src/game/levels.ts") as Promise<Checks>));
    },
  };
}
