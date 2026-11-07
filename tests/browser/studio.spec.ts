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
    if (area === "Art catalog") {
      // The character-select group: 18 portraits (3 variants × 6 kinds), every PNG found, and the sprite × state matrix with a row each.
      const group = page.locator("#sprite-cast");
      await expect(group.getByRole("heading", { name: "Character select (sprite cast)", exact: true })).toBeVisible();
      await expect(group.locator(".sprite-cast img")).toHaveCount(18);
      await expect.poll(() => group.locator(".sprite-cast img").evaluateAll(imgs => imgs.filter(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0).length)).toBe(18);
      await expect(group.locator(".sprite-matrix tbody tr")).toHaveCount(18);
      await expect(group.locator(".sprite-matrix tbody tr").first().locator("img")).toHaveCount(12);
      // The matrix documents the sprite's own timings (sprite.css), not the rig's: the hop is 380ms, the knight's 480.
      await expect(group.locator(".sprite-matrix thead th", { hasText: "move" })).toContainText("380ms · knight 480");
      // Each portrait's source path wraps only at its slashes on a phone: no slash-delimited segment or file name spans two lines.
      expect(await group.locator(".portrait figcaption code").evaluateAll(codes => codes.flatMap(c => [...c.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).filter(n => {
        const r = document.createRange(); r.selectNodeContents(n);
        return new Set([...r.getClientRects()].map(b => Math.round(b.top))).size > 1;
      }).map(n => `${c.textContent}: "${n.textContent}"`)))).toEqual([]);
      // The intro links to the pipeline write-up on the Tooling tab.
      await expect(group.locator(".group-intro a", { hasText: "see Tooling" })).toHaveAttribute("href", /^#(tooling|sprites)$/);
    }
  }
  expect(errors).toEqual([]);
});
