// Frames of the live sludge proof (live-sludge.html), at the same moments as a Cycles loop, for side-by-side judging.
//   node tools/art/diorama/capture_live.mjs URL OUTDIR [FRAMES=96] [LOOP_S=8]
// URL is the page with ?still&dir=...; a Vite dev server must be serving it.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const [url, out, framesArg = "96", loopArg = "8"] = process.argv.slice(2);
const frames = Number(framesArg), loop = Number(loopArg);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } });
page.on("console", m => console.log("page:", m.text()));
await page.goto(url);
await page.waitForFunction(() => window.liveReady || window.liveError, null, { timeout: 120000 });
const err = await page.evaluate(() => window.liveError);
if (err) { console.error("page failed:", err); process.exit(1); }
const times = [];
for (let i = 0; i < frames; i++) {
  const t0 = Date.now();
  const nd = await page.evaluate(t => window.renderAt(t), (i / frames) * loop);
  const ms = Date.now() - t0;
  times.push(ms);
  const png = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
  writeFileSync(`${out}/frame_${String(i).padStart(3, "0")}.png`, Buffer.from(png.split(",")[1], "base64"));
  if (i % 12 === 0) console.log(`frame ${i + 1}/${frames} drops ${nd} ${ms} ms`);
}
const gl = await page.evaluate(() => {
  const g = document.querySelector("canvas").getContext("webgl2");
  const d = g.getExtension("WEBGL_debug_renderer_info");
  return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown";
});
times.sort((a, b) => a - b);
console.log(`LIVE CAPTURE OK ${frames} frames, update+draw median ${times[frames >> 1]} ms, renderer ${gl}`);
await browser.close();
