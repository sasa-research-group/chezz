import { expect, test } from "@playwright/test";

test("studio: every area renders without errors and fits a phone", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/art.html");
  for (const [area, heading] of [["Art catalog", "Cast × state"], ["Mechanics", "Pieces"], ["Style guide", "Palette"], ["Tooling", "Adding new art"]]) {
    await page.getByRole("navigation", { name: "Studio areas" }).getByRole("link", { name: area }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    // Named swatches flag hexes that no longer appear in the art sources.
    if (area === "Style guide") await expect(page.locator(".swatch .missing")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
