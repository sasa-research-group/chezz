import { expect, test, type Page } from "@playwright/test";

const KINDS = ["Pawn", "Knight", "Bishop", "Rook", "Queen", "King"];
const seg = (page: Page, name: string) => page.getByRole("group", { name });
const joint = (page: Page, id: string) => page.locator(`.rs-bones [data-part="${id}"]`).evaluate(c => `${c.getAttribute("cx")},${c.getAttribute("cy")}`);

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  return errors;
}

test("rig tab: every piece and art style shows its bones and parts, on a phone", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/art.html#rig");
  for (const kind of KINDS) for (const side of ["Rebel", "Patrol"]) for (const art of ["Old", "SVG kit"]) {
    await seg(page, "Piece").getByRole("button", { name: kind }).click();
    await seg(page, "Side").getByRole("button", { name: side }).click();
    await seg(page, "Art").getByRole("button", { name: art }).click();
    await expect(page.locator(`.rs-fig .rig.rig-${kind.toLowerCase()}`)).toBeAttached();
    for (const id of ["squash", "head", "prop"]) {
      await expect(page.locator(`.rs-bones [data-part="${id}"]`)).toBeAttached();
      await expect(page.locator(`.rs-part[data-part="${id}"]`)).toBeAttached();
    }
    await expect(page.locator(".rs-table tbody tr").first()).toBeAttached();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("rig tab: a painted sprite has no parts, and its attack moves the root", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/art.html#rig");
  await seg(page, "Piece").getByRole("button", { name: "Knight" }).click();
  await seg(page, "Art").getByRole("button", { name: "Sprite" }).click();
  await expect(page.locator(".rs-fig .rig.art-sprite image")).toHaveCount(1);
  await expect(page.locator('.rs-bones [data-part="prop"]')).toHaveCount(0);
  await seg(page, "Action").getByRole("button", { name: "attack", exact: true }).click();
  const scrub = page.getByLabel("Scrub");
  await scrub.fill("0");
  const rest = await joint(page, "shield");
  await scrub.fill("220");
  await expect.poll(() => joint(page, "shield")).not.toBe(rest);
  expect(errors).toEqual([]);
});

test("rig tab: an action plays, and the scrubber moves the bones", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/art.html#rig");
  await seg(page, "Piece").getByRole("button", { name: "Pawn" }).click();
  await seg(page, "Action").getByRole("button", { name: "attack", exact: true }).click();
  await expect(page.locator(".rs-fig .rig.act-attack")).toBeAttached();
  const scrub = page.getByLabel("Scrub");
  await expect.poll(async () => +(await scrub.inputValue())).toBeGreaterThan(0);

  await scrub.fill("0");
  await expect(page.getByRole("button", { name: "▶ Play" })).toBeVisible();
  const rest = await joint(page, "prop");
  await scrub.fill("250");
  await expect.poll(() => joint(page, "prop")).not.toBe(rest);

  await page.getByRole("button", { name: "Onion skin" }).click();
  await expect(page.locator(".rs-ghost .rig")).toHaveCount(4);
  await page.getByRole("button", { name: "Bones only" }).click();
  await expect(page.locator(".rs-fig")).toHaveCSS("opacity", "0");
  expect(errors).toEqual([]);
});

test("rig tab: with reduced motion the player waits, and still steps by hand", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/art.html#rig");
  const scrub = page.getByLabel("Scrub");
  // The opening take (attack) is read with the reduced-motion rules already lifted.
  await expect(scrub).toHaveAttribute("max", "560");
  await expect(page.locator(".rs-table tbody tr", { hasText: ".prop" }).first()).toContainText("rig-");
  await seg(page, "Action").getByRole("button", { name: "hit", exact: true }).click();
  await expect(page.getByRole("button", { name: "▶ Play" })).toBeVisible();
  expect(await scrub.inputValue()).toBe("0");
  const rest = await joint(page, "head");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next frame" }).click();
  await expect.poll(async () => +(await scrub.inputValue())).toBe(100);
  await expect.poll(() => joint(page, "head")).not.toBe(rest);
});
