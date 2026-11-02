// Screenshots a battle with the listed pieces added to the board, and measures
// how far each top-row piece's ink rises above its square and the board's frame.
//   node tools/art/battle-shot.mjs <kinds> <out.png> [--width 390] [--height 844] [--battle 1] [--art paint|new]  [--skins ids]
// <kinds> is a comma list such as knight or knight,rook: each adds one rebel
// (bottom rows) and one patrol piece (top row first) on free squares.
// --battle 1 (the default) is a fresh run of battle 1 with its own enemies. Any other battle
// number starts that battle's board with only your king and the listed pieces, so the top row
// is free for them. --art paint (the default, the game's art) or new (?art=new, the SVG shape kit).
// --skins frog-pot,cat-king unlocks and wears those skins (the meta save).
// The run save is seeded once per page. Starts its own Vite server. PLAYWRIGHT_CHROMIUM_PATH
// picks a browser binary.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args.splice(i, 2)[1]; };
const width = Number(opt("width", 390)), height = Number(opt("height", 844)), battle = Number(opt("battle", 1));
const art = opt("art", "paint");
const skins = opt("skins", "").split(",").filter(Boolean);
const [kinds, out] = args;
if (!kinds || !out?.endsWith(".png") || !(width > 0) || !(height > 0) || !Number.isInteger(battle) || !["new", "paint"].includes(art)) { console.error("usage: node tools/art/battle-shot.mjs knight out.png [--width 390] [--height 844] [--battle 1] [--art paint|new] [--skins frog-pot,cat-king]"); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const server = await createServer({ root, logLevel: "error", server: { port: 5392, strictPort: false, host: "127.0.0.1" } });
let browser;
try {
  await server.listen();
  const { newRun, ENCOUNTERS, HP } = await server.ssrLoadModule("/src/game/turns.ts");
  const board = ENCOUNTERS[battle - 1];
  if (!board) throw new Error(`no battle ${battle}`);
  const run = newRun();
  if (battle !== 1) Object.assign(run, { encounter: battle - 1, units: [{ ...run.units.find(u => u.id === "king"), ...board.starts[0] }] });
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
  const { SKINS } = await server.ssrLoadModule("/src/components/skins/index.ts");
  const worn = skins.map(id => SKINS.find(s => s.id === id) ?? (() => { throw new Error(`unknown skin ${id}`); })());
  const meta = { version: 1, unlocked: skins, equipped: Object.fromEntries(worn.map(s => [s.kind, s.id])) };
  await page.addInitScript(([r, m]) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("chezz.turns.v1", r); localStorage.setItem("chezz.meta.v1", m); } }, [JSON.stringify(run), JSON.stringify(meta)]);
  await page.goto(`${server.resolvedUrls.local[0]}${art === "new" ? "?art=new" : ""}`);
  await page.locator(".piece-layer svg.rig").first().waitFor();
  // The seeded pieces only show if the game accepted the save; otherwise it opens a fresh run.
  const ids = run.units.filter(u => u.id.startsWith("shot-")).map(u => u.id);
  const shown = await page.evaluate(() => document.querySelectorAll(".piece-layer svg.rig").length);
  if (shown < run.units.length) throw new Error(`the game rejected the seeded save (${shown} of ${run.units.length} pieces, wanted ${ids.join(", ")})`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out });
  console.log(`wrote ${out} (battle ${battle}, ${board.width}×${board.height}, ${width}×${height}, ${art} art)`);
  // Idle loops start at negative per-piece delays, so cancel them to measure the rest pose.
  const rows = await page.evaluate(() => {
    for (const a of document.getAnimations()) a.cancel();
    const hidden = el => { for (let e = el; e && e.tagName !== "svg"; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return true; } return false; };
    const plane = document.querySelector(".board-plane").getBoundingClientRect().top;
    const field = document.querySelector(".exile-field")?.getBoundingClientRect().top ?? 0;
    const square = document.querySelectorAll(".exile-cell")[0].getBoundingClientRect();
    return [...document.querySelectorAll(".exile-piece")].map(p => {
      const svg = p.querySelector("svg.rig"), box = svg.getBoundingClientRect(), px = box.width / 100;
      const kind = svg.className.baseVal.match(/rig-(\w+)/)[1], side = svg.classList.contains("rebel") ? "rebel" : "patrol";
      let ink = Infinity;
      for (const el of svg.querySelectorAll(".flip path, .flip circle, .flip ellipse, .flip rect, .flip image")) {
        // Shading copies and highlights are clipped to their part, which bounding boxes ignore.
        if (hidden(el) || el.closest("clipPath, defs, [clip-path]")) continue;
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const stroke = s.stroke !== "none" ? parseFloat(s.strokeWidth) * px / 2 : 0;
        ink = Math.min(ink, r.top - stroke);
      }
      const unit = v => +((v - box.top) / px).toFixed(1);
      return { piece: `${side} ${kind}`, row: Math.abs(p.getBoundingClientRect().top + box.height * .64 - (square.top + square.height / 2)) < square.height / 2 ? 0 : -1, unitPx: +px.toFixed(2), inkTop: unit(ink), squareTop: unit(square.top), frameTop: unit(plane), fieldTop: unit(field), overFramePx: +(plane - ink).toFixed(1) };
    }).filter(r => r.row === 0);
  });
  for (const r of rows) console.log(`${r.piece.padEnd(14)} ink top y ${r.inkTop}  square top y ${r.squareTop}  frame edge y ${r.frameTop}  clip y ${r.fieldTop}  (1 unit = ${r.unitPx}px; ${r.overFramePx > 0 ? `${r.overFramePx}px past the frame` : "inside the frame"})`);
} finally {
  await browser?.close();
  await server.close();
}
