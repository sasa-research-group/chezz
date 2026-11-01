import { expect, test } from "@playwright/test";

test("studio: every area renders without errors and fits a phone", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/art.html");
  for (const [area, heading] of [["Art catalog", "Cast × state"], ["Mechanics", "Pieces"], ["Style guide", "Target style: armour does the talking"], ["Tooling", "Adding new art"]]) {
    await page.getByRole("navigation", { name: "Studio areas" }).getByRole("link", { name: area }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (area === "Art catalog") {
      await expect(page.getByRole("heading", { name: "Skins", exact: true })).toBeVisible();
      await expect(page.locator("#skins .rig.skin-frog-pot").first()).toBeVisible();
      await expect(page.locator("#cast .rig.skin-frog-pot").first()).toBeAttached();
      await expect(page.locator("#painted .rig.art-sprite image").first()).toBeAttached();
    }
    // Named swatches flag hexes that no longer appear in the art sources.
    if (area === "Style guide") {
      await expect(page.locator(".swatch .missing")).toHaveCount(0);
      await expect(page.locator(".ref-grid img")).toHaveCount(18);
      await expect(page.getByRole("heading", { name: "Palette: current in-game art" })).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});
