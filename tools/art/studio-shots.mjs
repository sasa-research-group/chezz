// Screenshots a studio section and the battle with ?art=new, at desktop and phone width.
//   node tools/art/studio-shots.mjs <outDir> [section-id=pilot]
// Animations are paused at 300ms; no clock waits. Starts its own Vite server.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [out, section = "pilot"] = process.argv.slice(2);
if (!out) { console.error("usage: node tools/art/studio-shots.mjs <outDir> [section-id]"); process.exit(1); }
mkdirSync(out, { recursive: true });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = await createServer({ root, logLevel: "error", server: { port: 5391, strictPort: false, host: "127.0.0.1" } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ["--disable-audio-output"], executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const freeze = page => page.evaluate(() => {
  for (const svg of document.querySelectorAll("svg")) { svg.pauseAnimations(); svg.setCurrentTime(0); }
  document.getAnimations().forEach(a => { a.pause(); a.currentTime = 300; });
});
try {
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.clock.install();
    await p.goto(`${base}art.html#${section}`);
    await p.locator(`#${section}`).waitFor();
    await freeze(p);
    await p.locator(`#${section}`).screenshot({ path: `${out}/${section}-${w}.png` });
    await p.goto(`${base}?art=new`);
    await p.getByRole("button", { name: /Start/ }).click();
    await p.locator(".rig").first().waitFor();
    await freeze(p);
    await p.screenshot({ path: `${out}/battle-art-new-${w}.png` });
    await p.close();
  }
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
  await server.close();
}
