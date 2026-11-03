import { expect, test } from "./fixed";
import type { Page } from "@playwright/test";

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  return errors;
}
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test("studio: the cast sheet lands as still images and opens a sprite on the stage, on a phone", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/art.html");
  for (const group of ["Friendly", "Enemy", "Skins"]) await expect(page.getByRole("heading", { name: group, exact: true })).toBeVisible();
  await expect(page.locator(".cast-tile[data-sprite] image")).toHaveCount(18);
  await expect(page.locator(".cast-tile[data-skin] image")).toHaveCount(6);
  await expect(page.locator(".cast-tile.unpainted")).toHaveCount(0);
  // The landing sheet stays cheap: no animated figures at all.
  expect(await page.locator("svg.rig").count()).toBe(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await scrollWidth(page)).toBeLessThanOrEqual(390);

  await page.locator('[data-sprite="patrol-knight"]').click();
  await expect(page).toHaveURL(/#stage\/patrol-knight$/);
  await expect(page.getByRole("combobox", { name: "Piece" })).toHaveValue("patrol-knight");
  await expect(page.locator("svg.rig")).toHaveCount(1);
  await expect(page.locator(".stage-piece .rig.rig-knight.patrol")).toBeVisible();
  expect(await scrollWidth(page)).toBeLessThanOrEqual(390);

  await page.getByRole("combobox", { name: "Piece" }).selectOption("skin-cat-king");
  await expect(page).toHaveURL(/#stage\/skin-cat-king$/);
  await expect(page.locator(".stage-piece .rig.rig-king.skin-cat-king")).toBeVisible();
  await expect(page.getByRole("group", { name: "Animation" }).getByRole("button", { name: "Checkmate" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("studio stage: buttons play one take at the game's speed scale, and the toggles stick", async ({ page }) => {
  const errors = watchErrors(page);
  // The take's timers run on a paused page clock, so each step is checked without racing real time.
  const t0 = Date.now();
  await page.clock.install({ time: t0 });
  await page.goto("/art.html#stage/rebel-king");
  await page.clock.pauseAt(t0 + 1000);
  const rig = page.locator(".stage-piece .rig");
  const takes = page.getByRole("group", { name: "Animation" });
  await expect(takes.getByRole("button", { name: "Checkmate" })).toBeVisible();
  await expect(takes.getByRole("button", { name: "Leap" })).toHaveCount(0);

  await page.getByRole("group", { name: "Speed" }).getByRole("button", { name: "0.25×" }).click();
  await expect(page.locator(".stage-canvas")).toHaveAttribute("style", /--spd: ?4/);
  await takes.getByRole("button", { name: "Attack" }).click();
  await expect(rig).toHaveClass(/act-attack/);
  // The lunge keyframes run 560ms × --spd, as on the game board.
  expect(await page.locator(".stage-piece .squash").evaluate(el => el.getAnimations().map(a => a.effect?.getComputedTiming().duration))).toEqual([2240]);

  await page.getByRole("group", { name: "Speed" }).getByRole("button", { name: "1×", exact: true }).click();
  await takes.getByRole("button", { name: "Cheer" }).click();
  await expect(rig).toHaveClass(/act-cheer/);
  await page.clock.runFor(1400);
  await expect(rig).toHaveClass(/act-idle/);

  await page.getByRole("group", { name: "State" }).getByRole("button", { name: "Guarding" }).click();
  await page.getByRole("group", { name: "State" }).getByRole("button", { name: "Wounded" }).click();
  await expect(rig).toHaveClass(/is-defending/);
  await expect(rig).toHaveClass(/is-wounded/);
  await page.getByRole("group", { name: "Facing" }).getByRole("button", { name: "Left" }).click();
  await expect(rig).toHaveAttribute("style", /--face: ?-1/);

  await page.getByRole("combobox", { name: "Piece" }).selectOption("rebel-knight");
  await expect(page).toHaveURL(/#stage\/rebel-knight$/);
  await expect(takes.getByRole("button", { name: "Leap" })).toBeVisible();
  await expect(takes.getByRole("button", { name: "Checkmate" })).toHaveCount(0);
  await takes.getByRole("button", { name: "Leap" }).click();
  await expect(rig).toHaveClass(/act-leap /);
  await page.clock.runFor(340);
  await expect(rig).toHaveClass(/act-attack/);
  await page.clock.runFor(380);
  await expect(rig).toHaveClass(/act-leap-back/);
  expect(errors).toEqual([]);
});

test("studio: the Mechanics stats edit live and revert", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/art.html#mechanics");
  const editor = page.getByRole("group", { name: "Rules editor" });
  const rook = page.getByRole("figure").filter({ hasText: "Recruit rook" });
  await expect(rook).toContainText("2 dmg");
  await editor.getByRole("spinbutton", { name: "rook damage" }).fill("4");
  await expect(rook).toContainText("4 dmg");
  await expect(editor.getByRole("status")).toHaveText("Unsaved");
  // A number out of range is listed and blocks Save, and the diagrams keep the last good value.
  await editor.getByRole("spinbutton", { name: "Defend bonus" }).fill("12");
  await expect(editor.getByRole("list", { name: "Problems" })).toContainText("defend: 0–9");
  await expect(editor.getByRole("button", { name: "Save" })).toBeDisabled();
  await editor.getByRole("group", { name: "Turn" }).getByRole("button", { name: "Every piece" }).click();
  await expect(page.locator("#turn")).toContainText("One piece per side");
  await editor.getByRole("spinbutton", { name: "Defend bonus" }).fill("2");
  await expect(page.locator("#turn")).toContainText("+2 (−2 damage per hit)");
  await editor.getByRole("group", { name: "Turn" }).getByRole("button", { name: "Every piece" }).click();
  await expect(page.locator("#turn")).toContainText("Every piece, every turn");
  await editor.getByRole("button", { name: "Revert" }).click();
  await expect(rook).toContainText("2 dmg");
  await expect(editor.getByRole("list", { name: "Problems" })).toHaveCount(0);
  await expect(page.locator("#turn")).toContainText("One piece per side");
  expect(errors).toEqual([]);
});

test("studio: style guide and mechanics render without errors and fit a phone", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/art.html");
  for (const [area, heading] of [["Style guide", "Target style: armour does the talking"], ["Mechanics", "Pieces"]]) {
    await page.getByRole("navigation", { name: "Studio areas" }).getByRole("link", { name: area }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(await scrollWidth(page)).toBeLessThanOrEqual(390);
  }
  await page.getByRole("navigation", { name: "Studio areas" }).getByRole("link", { name: "Style guide" }).click();
  // Named swatches flag hexes that no longer appear in the art sources.
  await expect(page.locator(".swatch .missing")).toHaveCount(0);
  await expect(page.locator(".ref-grid img")).toHaveCount(18);
  expect(errors).toEqual([]);
});
