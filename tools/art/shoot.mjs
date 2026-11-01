// Renders the judge sheet for one or more rigs into one PNG.
//   node tools/art/shoot.mjs <rigs> <out.png> [--scale 1] [--crop 192]
// <rigs> is a comma list of kind.side[.old], for example pawn.white,pawn.black.
// The sheet (src/art/Sheet.tsx) shows each rig at 48px, 84px and 192px, a black
// silhouette, greyscale, idle/wounded/guarding, six frames of every action, and
// the rigs beside the rest of the cast. --crop 192 saves only the 192px renders,
// for close-ups at a higher --scale.
// Every animation is paused and set to its cell's fraction: no clock waits, so
// two runs give the same image. Starts its own Vite server on a free port.
// PLAYWRIGHT_CHROMIUM_PATH picks a browser binary if Playwright's own is missing.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args.splice(i, 2)[1]; };
const scale = Number(opt("scale", 1));
const crop = opt("crop", null);
const [rigs, out] = args;
if (!rigs || !out) { console.error("usage: node tools/art/shoot.mjs pawn.white,pawn.black out.png [--scale 2] [--crop 192]"); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = await createServer({ root, logLevel: "error", server: { port: 5390, strictPort: false, host: "127.0.0.1" } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ["--disable-audio-output"], executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: scale });
  await page.clock.install();
  await page.goto(`${base}art.html?sheet=${encodeURIComponent(rigs)}`);
  await page.locator("#sheet .sheet-cell").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    for (const svg of document.querySelectorAll("svg")) { svg.pauseAnimations(); svg.setCurrentTime(0); }
    for (const cell of document.querySelectorAll("[data-frac]")) {
      const frac = Number(cell.dataset.frac);
      for (const a of cell.getAnimations({ subtree: true })) {
        if (!(a instanceof CSSAnimation)) { a.finish(); continue; }
        const t = a.effect.getTiming();
        a.pause();
        a.currentTime = Math.max(0, Number(t.delay) || 0) + frac * Number(t.duration);
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
  await browser.close();
  await server.close();
}
