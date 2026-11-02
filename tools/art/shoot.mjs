// Renders a close-up sheet of one or more pieces into one PNG, for looking at new art.
//   node tools/art/shoot.mjs <rigs> <out.png> [--scale 1] [--crop 192]
// <rigs> is a comma list of kind.side[.<skin id>], for example
// pawn.white,pawn.black or pawn.white,pawn.white.frog-pot.
// The sheet (src/art/Sheet.tsx) shows each rig at 48px, 84px and 192px, a black
// silhouette, greyscale, idle/wounded/guarding, six frames of every action, and
// the rigs beside the rest of the cast. --crop 192 saves only the 192px renders,
// for close-ups at a higher --scale.
// The page clock is paused and every animation in a cell is set to the same
// moment, fraction × the action's length (RIG_MS), so two runs give the same image.
// Starts its own Vite server. PLAYWRIGHT_CHROMIUM_PATH picks a browser binary.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args.splice(i, 2)[1]; };
const scale = Number(opt("scale", 1));
const crop = opt("crop", null);
const [rigs, out] = args;
const usage = "usage: node tools/art/shoot.mjs pawn.white,pawn.black out.png [--scale 2] [--crop 192]";
if (!rigs || !out?.endsWith(".png") || !(scale > 0) || (crop !== null && !(Number(crop) > 0))) { console.error(usage); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = await createServer({ root, logLevel: "error", server: { port: 5390, strictPort: false, host: "127.0.0.1" } });
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ args: ["--disable-audio-output"], executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: scale });
  const t0 = Date.now();
  await page.clock.install({ time: t0 });
  await page.goto(`${base}art.html?sheet=${encodeURIComponent(rigs)}`);
  await page.locator("#sheet .sheet-cell").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(t0 + 60_000);
  await page.evaluate(() => {
    for (const svg of document.querySelectorAll("svg")) { svg.pauseAnimations(); svg.setCurrentTime(0); }
    for (const cell of document.querySelectorAll("[data-frac]")) {
      const at = Number(cell.dataset.frac) * Number(cell.dataset.ms);
      for (const a of cell.getAnimations({ subtree: true })) {
        if (!(a instanceof CSSAnimation)) { a.finish(); continue; }
        a.pause();
        a.currentTime = at;
      }
    }
  });
  if (crop) {
    const cells = page.locator(`#sheet .sheet-cell[data-px="${crop}"]`);
    const n = await cells.count();
    for (let i = 0; i < n; i++) await cells.nth(i).screenshot({ path: out.replace(/\.png$/, `-${i}.png`) });
  } else {
    await page.locator("#sheet").screenshot({ path: out });
  }
  console.log(`wrote ${crop ? out.replace(/\.png$/, "-<n>.png") : out}`);
} finally {
  await browser?.close();
  await server.close();
}
