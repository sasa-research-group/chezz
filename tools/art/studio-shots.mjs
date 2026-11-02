// Screenshots a studio area (cast, stage, guide, mechanics) and the battle, at desktop and phone width.
//   node tools/art/studio-shots.mjs <outDir> [area=cast]
// The page clock is paused before animations are frozen at 300ms, so no timer can remount
// a rig between the freeze and the shot.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [out, section = "cast"] = process.argv.slice(2);
if (!out) { console.error("usage: node tools/art/studio-shots.mjs <outDir> [section-id]"); process.exit(1); }
mkdirSync(out, { recursive: true });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = await createServer({ root, logLevel: "error", server: { port: 5391, strictPort: false, host: "127.0.0.1" } });
const freeze = page => page.evaluate(() => {
  for (const svg of document.querySelectorAll("svg")) { svg.pauseAnimations(); svg.setCurrentTime(0); }
  document.getAnimations().forEach(a => { a.pause(); a.currentTime = 300; });
});
let browser;
try {
  await server.listen();
  const base = server.resolvedUrls.local[0];
  browser = await chromium.launch({ args: ["--disable-audio-output"], executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    const t0 = Date.now();
    await p.clock.install({ time: t0 });
    await p.goto(`${base}art.html#${section}`);
    await p.locator(`#${section}`).waitFor();
    await p.clock.pauseAt(t0 + 60_000);
    await freeze(p);
    await p.locator(`#${section}`).screenshot({ path: `${out}/${section}-${w}.png` });
    await p.goto(base);
    await p.getByRole("button", { name: /Start/ }).click();
    await p.locator(".rig").first().waitFor();
    await p.clock.pauseAt(t0 + 120_000);
    await freeze(p);
    await p.screenshot({ path: `${out}/battle-${w}.png` });
    await p.close();
  }
  console.log(`wrote ${out}`);
} finally {
  await browser?.close();
  await server.close();
}
