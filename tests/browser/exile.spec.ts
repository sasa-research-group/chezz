import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { coord } from "../../src/game/turns";
import type { Run } from "../../src/game/turns";
import { nextAction } from "../turns-strategy";

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("chezz.turns.v1")!) as Run);
const cell = (page: Page, g: Run, p: { x: number; y: number }) => page.getByRole("button", { name: new RegExp(`^${coord(g, p)} `) });

test("move, end turn, watch the enemy, and resume after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the rebellion" }).click();
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

test("compact layout remains usable on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the rebellion" }).click();
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await page.getByRole("button", { name: /^Defend · 1 energy/ }).click();
  await expect.poll(async () => (await saved(page)).energy).toBe(3);
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
      await expect(page.getByRole("dialog", { name: "Roadside camp" })).toBeVisible();
      if (g.encounter === 0) await page.screenshot({ path: "test-results/exile-camp.png", fullPage: true });
      const king = g.units.find(u => u.id === "king")!;
      await page.getByRole("button", { name: king.hp < 3 ? /Mend the king/ : g.gold >= 8 ? /Recruit a rook/ : /Recruit a bishop/ }).click();
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
