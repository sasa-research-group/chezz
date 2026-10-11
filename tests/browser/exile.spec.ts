import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { coord, newRun } from "../../src/game/turns";
import type { Run } from "../../src/game/turns";
import { nextAction } from "../turns-strategy";

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("chezz.turns.v1")!) as Run);
const cell = (page: Page, g: Run, p: { x: number; y: number }) => page.getByRole("button", { name: new RegExp(`^${coord(g, p)} `) });

test("move, end turn, watch the enemy, and resume after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the rebellion" }).click();
  await expect(page.locator(".piece-layer svg.rig")).toHaveCount(3);
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await expect(page.getByRole("button", { name: /^b2 empty, move for 1/ })).toBeVisible();
  await page.getByRole("button", { name: /^b2 empty/ }).click();
  await expect.poll(async () => (await saved(page)).energy).toBe(3);
  await page.screenshot({ path: "test-results/exile-board.png", fullPage: true });
  await page.getByRole("button", { name: "End turn" }).click();
  await expect(page.getByText("ENEMY TURN", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^b2 white king/ })).toBeDisabled();
  await page.getByRole("button", { name: "Skip enemy turn" }).click();
  await expect.poll(async () => (await saved(page)).turn).toBe(2);
  await page.reload();
  await expect(page.getByRole("button", { name: /^b2 white king/ })).toBeEnabled();
});

test("the winning blow plays out and celebrates before the hideout", async ({ page }) => {
  // One pawn left, diagonally in front of the king.
  const g = { ...newRun(), units: [newRun().units[0], { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 2, y: 2, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await page.getByRole("button", { name: /^c2 black pawn/ }).click();
  await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toBeHidden();
  const banner = page.getByRole("button", { name: /Road cleared!/ });
  await expect(banner).toBeVisible();
  await page.screenshot({ path: "test-results/exile-victory-banner.png" });
  await banner.click();
  await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toBeVisible();
});

test("tap an enemy to walk up and strike it when there's one way in", async ({ page }) => {
  const start = newRun();
  const pawn = (id: string, x: number, y: number) => ({ id, side: "black" as const, kind: "pawn" as const, x, y, hp: 1 });
  // A rook down the a-file has one way in: the square in front of the pawn.
  const g = { ...start, units: [{ ...start.units[0], x: 2, y: 3 }, { id: "ally-1", side: "white" as const, kind: "rook" as const, x: 0, y: 3, hp: 5 }, pawn("enemy-0-0", 0, 0), pawn("enemy-0-1", 2, 1), pawn("enemy-0-2", 3, 0)] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a1 white rook/ }).click();
  // Enemies you can strike are marked on the board: a sword badge with the cost on each.
  await expect(page.locator(".strike-badge")).toHaveText(["⚔ 4"]);
  await page.getByRole("button", { name: /^a4 black pawn, 1 HP, strike for 4/ }).click();
  await expect.poll(async () => (await saved(page)).units.some(u => u.id === "enemy-0-0")).toBe(false);
  const now = await saved(page);
  expect(now.units.find(u => u.id === "ally-1")).toMatchObject({ x: 0, y: 1 });
  expect(now.energy).toBe(0);
});

test("a knight flips over to strike for 2 and lands back home", async ({ page }) => {
  const start = newRun();
  const g = { ...start, units: [{ ...start.units[0], x: 3, y: 3 }, { id: "ally-1", side: "white" as const, kind: "knight" as const, x: 0, y: 3, hp: 3 }, { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 1, y: 1, hp: 1 }, { id: "enemy-0-1", side: "black" as const, kind: "pawn" as const, x: 3, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a1 white knight/ }).click();
  await page.getByRole("button", { name: /^b3 black pawn, 1 HP, strike for 2/ }).click();
  await expect(page.locator(".exile-piece.lunging")).toHaveCount(1);
  await expect.poll(async () => (await saved(page)).energy).toBe(2);
  // The stunt ends with the knight home and the fallen pawn gone from the board.
  await expect(page.locator(".exile-piece.lunging")).toHaveCount(0);
  await expect(page.locator(".exile-piece.ghost")).toHaveCount(0);
  await expect(page.locator(".piece-layer svg.rig")).toHaveCount(3);
});

test("with several squares to strike from, you pick one", async ({ page }) => {
  const start = newRun();
  const pawn = (id: string, x: number, y: number) => ({ id, side: "black" as const, kind: "pawn" as const, x, y, hp: 1 });
  const now = { ...start, units: [start.units[0], pawn("enemy-0-1", 1, 1), pawn("enemy-0-2", 3, 0)] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(now));
  await page.goto("/");
  const king = now.units[0], target = now.units[1];
  await cell(page, now, king).click();
  await cell(page, now, target).click();
  await expect(page.getByRole("status")).toHaveText(/Pick a square to strike the pawn from/);
  const picks = page.getByRole("button", { name: /walk here and strike the pawn/ });
  expect(await picks.count()).toBeGreaterThan(1);
  await page.screenshot({ path: "test-results/exile-pick-square.png" });
  // Tapping an empty square that isn't a pick cancels; it doesn't move the king.
  await page.getByRole("button", { name: /^d1 empty/ }).click();
  await expect(picks).toHaveCount(0);
  expect((await saved(page)).energy).toBe(4);
  await cell(page, now, target).click();
  await picks.first().click();
  await expect.poll(async () => (await saved(page)).units.some(u => u.id === "enemy-0-1")).toBe(false);
});

test("check locks End turn until the king is safe", async ({ page }) => {
  const start = newRun();
  // Battle 2's patrol has 3 energy: its rook can step next to the 3-HP king and strike for 3.
  const g = { ...start, encounter: 1, units: [{ ...start.units[0], hp: 3 }, { id: "enemy-1-0", side: "black" as const, kind: "rook" as const, x: 1, y: 1, hp: 5 }, { id: "enemy-1-1", side: "black" as const, kind: "pawn" as const, x: 5, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Check!");
  await expect(page.locator(".check-mark")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "King in check" })).toBeDisabled();
  // Defending takes the hit down to 2, so the king would survive: no longer check.
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await page.getByRole("button", { name: /^Defend · 1 energy/ }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End turn" })).toBeEnabled();
});

test("checkmate plays a finale before the defeat screen", async ({ page }) => {
  const start = newRun();
  // Out of energy, still in check: the turn may end, and the rook lands the killing blow.
  const g = { ...start, encounter: 1, energy: 0, units: [{ ...start.units[0], hp: 3 }, { id: "enemy-1-0", side: "black" as const, kind: "rook" as const, x: 1, y: 1, hp: 5 }, { id: "enemy-1-1", side: "black" as const, kind: "pawn" as const, x: 5, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("No way out");
  await page.getByRole("button", { name: "End turn" }).click();
  await expect(page.locator(".board-camera.mate-zoom")).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator(".rig.act-mate")).toHaveCount(1);
  const banner = page.getByRole("button", { name: /Checkmate!/ });
  await expect(banner).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: "test-results/exile-checkmate.png" });
  await banner.click();
  await expect(page.getByRole("dialog", { name: "Rebellion ended" })).toBeVisible();
});

test("a king felled by a counter on your own turn still gets the finale", async ({ page }) => {
  const start = newRun();
  // Striking a defending rook: it survives and counters for 3, which kills a 2-HP king.
  const g = { ...start, units: [{ ...start.units[0], hp: 2 }, { id: "enemy-0-0", side: "black" as const, kind: "rook" as const, x: 1, y: 2, hp: 5, defending: true }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await page.getByRole("button", { name: /^b2 black rook/ }).click();
  await expect(page.getByRole("button", { name: /Checkmate!/ })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: "test-results/exile-checkmate-counter.png" });
  await page.getByRole("button", { name: /Checkmate!/ }).click();
  await expect(page.getByRole("dialog", { name: "Rebellion ended" })).toBeVisible();
  // He stays flattened on his square, not standing idle.
  await expect(page.locator(".exile-piece.white .rig.act-mate")).toHaveCount(1);
});

test("moves that would put your own king in check are blocked", async ({ page }) => {
  const start = newRun();
  // On b2 the rook could reach the 3-HP king and finish him, so b2 is off limits.
  const g = { ...start, encounter: 1, units: [{ ...start.units[0], hp: 3 }, { id: "enemy-1-0", side: "black" as const, kind: "rook" as const, x: 1, y: 0, hp: 5 }, { id: "enemy-1-1", side: "black" as const, kind: "pawn" as const, x: 5, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await expect(page.locator(".unsafe-dot")).toHaveCount(1);
  await page.getByRole("button", { name: /^b2 empty, blocked: would put your king in check/ }).click();
  await expect(page.getByRole("status")).toHaveText(/would put your king in check/);
  expect((await saved(page)).units.find(u => u.id === "king")).toMatchObject({ x: 1, y: 3 });
  // A safe square still works.
  await page.getByRole("button", { name: /^a1 empty, move for 1/ }).click();
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "king")?.x).toBe(0);
});

test("a walk-up strike may step into danger when the blow removes it", async ({ page }) => {
  const start = newRun();
  // b3 sits next to the rook: on its own that's check for a 1-HP king, but striking from there kills the rook.
  const g = { ...start, units: [{ ...start.units[0], x: 0, y: 0, hp: 1 }, { id: "enemy-0-0", side: "black" as const, kind: "rook" as const, x: 2, y: 1, hp: 1 }, { id: "enemy-0-1", side: "black" as const, kind: "pawn" as const, x: 3, y: 3, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a4 white king/ }).click();
  await expect(page.getByRole("button", { name: /^b3 empty, blocked/ })).toBeVisible();
  await page.getByRole("button", { name: /^c3 black rook/ }).click();
  await page.getByRole("button", { name: /^b3 .*walk here and strike the rook/ }).click();
  await expect.poll(async () => (await saved(page)).units.some(u => u.id === "enemy-0-0")).toBe(false);
  expect((await saved(page)).units.find(u => u.id === "king")).toMatchObject({ x: 1, y: 1 });
});

test("a pawn on the far row lets you pick its promotion", async ({ page }) => {
  const start = newRun();
  const g = { ...start, units: [{ ...start.units[0], x: 3, y: 3 }, { id: "ally-1", side: "white" as const, kind: "pawn" as const, x: 0, y: 1, hp: 1 }, { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 3, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a3 white pawn/ }).click();
  await page.getByRole("button", { name: /^a4 empty/ }).click();
  const picker = page.getByRole("dialog", { name: "Promote your pawn" });
  await expect(picker).toBeVisible();
  await expect(page.getByRole("button", { name: "End turn" })).toBeDisabled();
  await picker.getByRole("button", { name: /Knight/ }).click();
  await expect(picker).toBeHidden();
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "ally-1")?.kind).toBe("knight");
  await page.screenshot({ path: "test-results/exile-promotion.png" });
});

test("the hideout: walk to the barracks, recruit, peek at placeholders, take the road", async ({ page }) => {
  const start = newRun();
  const g = { ...start, phase: "camp" as const, gold: 20, units: [{ ...start.units[0], hp: 3 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), JSON.stringify(g));
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/");
  const hub = page.getByRole("dialog", { name: "Rebel hideout" });
  await expect(hub).toBeVisible();
  await page.screenshot({ path: "test-results/hub-mobile.png" });
  for (const name of [/^Barracks/, /^Training grounds/, /^Armory/, /^Merchant/, /^Grandmaster.s Guild/, /^Road out/]) {
    const box = (await hub.getByRole("button", { name }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(664);
  }
  await page.getByRole("button", { name: /^Training grounds/ }).click();
  const training = page.getByRole("dialog", { name: "Training grounds" });
  await expect(training).toBeVisible();
  // A placeholder: nothing to do there yet but leave.
  await expect(training.getByRole("button")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(training).toBeHidden();
  await page.getByRole("button", { name: /^Armory/ }).click();
  const armory = page.getByRole("dialog", { name: "Armory" });
  await expect(armory.getByRole("button")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(armory).toBeHidden();
  await page.getByRole("button", { name: /^Grandmaster.s Guild/ }).click();
  const guild = page.getByRole("dialog", { name: "Grandmaster's Guild" });
  await expect(guild.getByRole("button")).toHaveCount(1);
  await page.screenshot({ path: "test-results/hub-guild.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Barracks/ }).click();
  const barracks = page.getByRole("dialog", { name: "Barracks" });
  await barracks.getByRole("button", { name: /Recruit a pawn/ }).click();
  await barracks.getByRole("button", { name: /Recruit a bishop/ }).click();
  await expect(barracks.getByRole("button", { name: /Recruit a pawn/ })).toBeDisabled();
  await page.screenshot({ path: "test-results/hub-barracks.png" });
  await barracks.getByRole("button", { name: "Back to the hideout" }).click();
  await page.getByRole("button", { name: /^Road out/ }).click();
  await page.getByRole("button", { name: "March out" }).click();
  await expect.poll(async () => (await saved(page)).units.filter(u => u.side === "white").map(u => u.kind)).toEqual(["king", "pawn", "bishop"]);
  await expect(page.getByRole("button", { name: "End turn" })).toBeEnabled();
});

test("compact layout fits an iPhone screen without scrolling", async ({ page }) => {
  // iPhone 13 Pro with Safari's bars showing: about 390 × 664.
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the rebellion" }).click();
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  for (const control of [page.getByRole("button", { name: "End turn" }), page.getByRole("button", { name: /^Defend · 1 energy/ }), page.getByRole("button", { name: /^a4 / }), page.getByRole("button", { name: /^d1 / })]) {
    const box = (await control.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(664);
  }
  await page.getByRole("button", { name: /^Defend · 1 energy/ }).click();
  await expect.poll(async () => (await saved(page)).energy).toBe(3);
  // A defending piece is marked: a shield chip and "defending" in its label.
  await expect(page.locator(".guard-badge")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^b1 white king, 5 HP, defending/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/exile-mobile.png", fullPage: true });
});

test("complete the exile run through browser controls", async ({ page }) => {
  test.setTimeout(150000);
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the rebellion" }).click();
  await page.getByRole("checkbox", { name: "Fast enemy turns" }).check();
  for (let i = 0; i < 120; i++) {
    const g = await saved(page);
    if (g.phase === "victory" || g.phase === "defeat") break;
    if (g.phase === "camp") {
      await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toBeVisible();
      const king = g.units.find(u => u.id === "king")!;
      await page.getByRole("button", { name: /^Barracks/ }).click();
      const barracks = page.getByRole("dialog", { name: "Barracks" });
      await barracks.getByRole("button", { name: king.hp < 3 ? /Mend the king/ : g.gold >= 8 ? /Recruit a rook/ : /Recruit a bishop/ }).click();
      await barracks.getByRole("button", { name: "Back to the hideout" }).click();
      await page.getByRole("button", { name: /^Road out/ }).click();
      await page.getByRole("button", { name: "March out" }).click();
      await expect.poll(async () => (await saved(page)).encounter).toBe(g.encounter + 1);
      continue;
    }
    const a = nextAction(g);
    if (!a) {
      await page.getByRole("button", { name: "End turn" }).click();
      await expect.poll(async () => { const s = await saved(page); return s.turn !== g.turn || s.phase !== "player"; }, { timeout: 15000 }).toBe(true);
      continue;
    }
    const u = g.units.find(v => v.id === a.id)!;
    await cell(page, g, u).click();
    if (a.type === "defend") await page.getByRole("button", { name: /^Defend · 1 energy/ }).click();
    else await cell(page, g, a.to).click();
    await expect.poll(async () => JSON.stringify(await saved(page)) !== JSON.stringify(g)).toBe(true);
  }
  expect((await saved(page)).phase).toBe("victory");
  await expect(page.getByRole("dialog", { name: "Exile run complete" })).toBeVisible();
  await page.getByRole("button", { name: /Play again/ }).click();
  expect((await saved(page)).encounter).toBe(0);
});
