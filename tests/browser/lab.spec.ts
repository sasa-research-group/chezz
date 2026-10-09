import { expect, test } from "@playwright/test";

test("lab duel: play to a result, rate it, and keep the log", async ({ page }) => {
  await page.goto("/lab.html");
  await expect(page.getByRole("heading", { name: "The Duel" })).toBeVisible();
  // No gate race and no sidestep: the duel must end in blows within a few turns.
  await page.getByRole("group", { name: "Gate race" }).getByRole("button", { name: "Off" }).click();
  await page.getByRole("checkbox", { name: "You" }).uncheck();
  await page.getByRole("checkbox", { name: "Enemy" }).uncheck();
  const strike = page.getByRole("button", { name: /^Strike/ });
  for (let i = 0; i < 10 && await strike.isVisible(); i++) { await expect(strike).toBeEnabled({ timeout: 10000 }); await strike.click(); }
  await expect(page.getByRole("heading", { name: /You win|You lose|Draw/ })).toBeVisible();
  await page.getByRole("group", { name: "Read or coin flip" }).getByRole("button", { name: "4" }).click();
  await expect(page.getByText("Thanks, saved.")).toBeVisible();
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem("chezz.lab.v1")!));
  expect(log).toHaveLength(1); expect(log[0].rating).toBe(4);
  await page.getByText("Show the math").click();
  await expect(page.locator(".hp-grid td")).toHaveCount(25);
  await page.screenshot({ path: "test-results/lab-duel.png", fullPage: true });
});

test("lab fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lab.html");
  await expect(page.getByRole("button", { name: /^Strike/ })).toBeEnabled({ timeout: 10000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/lab-mobile.png", fullPage: true });
});
