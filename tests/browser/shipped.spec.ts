import { expect, test } from "@playwright/test";

// The one browser test on the shipped rules and battles, which the owner retunes at will: it pins
// no numbers, only that the data loads, a battle starts and the studio finds nothing broken.
test("shipped data: a battle starts, and the studio's Levels and Mechanics list no problems", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.getByRole("button", { name: /white king/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /black \w+, \d+ HP/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "End turn" })).toBeVisible();

  await page.goto("/art.html#levels/1");
  const list = page.getByRole("complementary", { name: "Levels" });
  await expect(list.getByRole("button", { name: /^Battle \d/ }).first()).toBeVisible();
  await expect(list.getByLabel(/problems$/)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Problems" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "▶ Play" })).toBeEnabled();

  await page.getByRole("navigation", { name: "Studio areas" }).getByRole("link", { name: "Mechanics" }).click();
  await expect(page.getByRole("group", { name: "Rules editor" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Problems" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
