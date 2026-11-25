// Frame time of the live sludge page, split into the CPU's mesh update and the GPU's draw.
//   node tools/art/diorama/profile_live.mjs BASE_URL [CPU_SLOWDOWN=1] [FRAMES=48] -- "label|&extra" ...
// Each variant is BASE_URL plus its extra params. CPU_SLOWDOWN uses Chrome's throttling (4 to 6 is a mid phone);
// the GPU can't be slowed, so read its number against a phone GPU being roughly 5-10x slower than an M-series Mac.
import { chromium } from "@playwright/test";
import { stillUrl } from "./stillUrl.mjs";

const args = process.argv.slice(2), cut = args.indexOf("--");
const [base, slowArg = "1", framesArg = "48"] = cut < 0 ? args : args.slice(0, cut);
const variants = cut < 0 ? ["default|"] : args.slice(cut + 1);
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const v of variants) {
  const [label, extra = ""] = v.split("|");
  const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } });
  await page.goto(stillUrl(base + extra));
  await page.waitForFunction(() => window.liveReady || window.liveError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.liveError);
  if (err) { console.log(label.padEnd(14), "FAILED", err); await page.close(); continue; }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(slowArg) });
  await page.evaluate(() => window.liveProfile(6));  // warm up: shaders compiled, buffers allocated
  const r = await page.evaluate(n => window.liveProfile(n), Number(framesArg));
  console.log(label.padEnd(14), `cpu ${r.cpu.toFixed(1)} ms  gpu ${r.gpu.toFixed(1)} ms  verts ${r.verts}  events ${r.events}  px ${r.px}`);
  await page.close();
}
await browser.close();
