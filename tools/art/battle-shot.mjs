// Screenshots battle 1 on a phone with the new art, with redrawn pieces added to the board.
//   node tools/art/battle-shot.mjs <kinds> <out.png> [--width 390] [--height 844]
// <kinds> is a comma list such as knight or knight,rook: each adds one rebel
// (bottom rows) and one patrol piece (top rows) on free squares of a fresh run.
// The run save is seeded once per page, then the page opens with ?art=new.
// Starts its own Vite server. PLAYWRIGHT_CHROMIUM_PATH picks a browser binary.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args.splice(i, 2)[1]; };
const width = Number(opt("width", 390)), height = Number(opt("height", 844));
const [kinds, out] = args;
if (!kinds || !out?.endsWith(".png") || !(width > 0) || !(height > 0)) { console.error("usage: node tools/art/battle-shot.mjs knight out.png [--width 390] [--height 844]"); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = await createServer({ root, logLevel: "error", server: { port: 5392, strictPort: false, host: "127.0.0.1" } });
let browser;
try {
  await server.listen();
  const { newRun, ENCOUNTERS, HP } = await server.ssrLoadModule("/src/game/turns.ts");
  const run = newRun(), board = ENCOUNTERS[run.encounter];
  const taken = new Set(run.units.map(u => `${u.x},${u.y}`));
  const free = side => {
    const rows = side === "white" ? [board.height - 1, board.height - 2] : [0, 1];
    for (const y of rows) for (let x = 0; x < board.width; x++) {
      if (taken.has(`${x},${y}`) || board.walls.some(w => w.x === x && w.y === y)) continue;
      taken.add(`${x},${y}`);
      return { x, y };
    }
    throw new Error(`no free square for ${side}`);
  };
  for (const kind of kinds.split(",")) for (const side of ["white", "black"]) {
    if (!Object.hasOwn(HP, kind)) throw new Error(`unknown kind ${kind}`);
    run.units.push({ id: `shot-${kind}-${side}`, side, kind, hp: HP[kind], ...free(side) });
  }
  browser = await chromium.launch({ args: ["--disable-audio-output"], executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
  await page.addInitScript(r => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("chezz.turns.v1", r); } }, JSON.stringify(run));
  await page.goto(`${server.resolvedUrls.local[0]}?art=new`);
  await page.locator(".piece-layer svg.rig").first().waitFor();
  // The seeded pieces only show if the game accepted the save; otherwise it opens a fresh run.
  const ids = run.units.filter(u => u.id.startsWith("shot-")).map(u => u.id);
  const shown = await page.evaluate(() => document.querySelectorAll(".piece-layer svg.rig").length);
  if (shown < run.units.length) throw new Error(`the game rejected the seeded save (${shown} of ${run.units.length} pieces, wanted ${ids.join(", ")})`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out });
  console.log(`wrote ${out}`);
} finally {
  await browser?.close();
  await server.close();
}
