import { expect, test } from "@playwright/test";
import { newRun } from "../../src/game/turns";

const SAVE = "chezz.turns.v1", META = "chezz.meta.v1";

test("level designer: edit a level, see problems inline, and test-run it without touching the run save", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  const run = JSON.stringify({ ...newRun(), gold: 7, turn: 3 }), meta = JSON.stringify({ version: 1, unlocked: [], equipped: {} });
  await page.addInitScript(([r, m]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("chezz.turns.v1", r); localStorage.setItem("chezz.meta.v1", m); sessionStorage.setItem("seeded", "1"); } }, [run, meta]);
  await page.goto("/art.html");
  await page.getByRole("navigation", { name: "Studio areas" }).getByRole("link", { name: "Levels" }).click();
  await expect(page).toHaveURL(/#levels\/1$/);
  const list = page.getByRole("complementary", { name: "Levels" });
  await expect(list.getByRole("button", { name: /^Battle \d/ })).toHaveCount(3);
  await expect(page.locator(".level-board .exile-piece.black image")).toHaveCount(2);

  // Paint an enemy rook on d4.
  await page.getByRole("group", { name: "Tool" }).getByRole("button", { name: "Enemy" }).click();
  await page.getByRole("group", { name: "Enemy piece" }).getByRole("button", { name: "rook" }).click();
  await page.getByRole("button", { name: /^d4 empty/ }).click();
  await expect(page.getByRole("button", { name: /^d4 enemy rook 5 HP/ })).toBeVisible();
  await expect(list.getByRole("button", { name: /Battle 1.*3♟/ })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Unsaved");

  // A broken size is flagged inline and blocks play until fixed.
  const height = page.getByRole("spinbutton", { name: "Height" });
  await height.fill("9");
  await expect(page.getByRole("list", { name: "Problems" })).toContainText("Size 2–8");
  await expect(page.getByRole("button", { name: "▶ Play" })).toBeDisabled();
  await height.fill("4");
  await expect(page.getByRole("list", { name: "Problems" })).toHaveCount(0);

  // A design rule broken is only a warning: shown in amber, and Play stays on. Walls across the
  // board cut both enemy pawns off from the king.
  await page.getByRole("group", { name: "Tool" }).getByRole("button", { name: "Wall" }).click();
  for (const s of ["a2", "b2", "c2", "d2"]) await page.getByRole("button", { name: new RegExp(`^${s} empty`) }).click();
  await expect(page.getByRole("list", { name: "Warnings" })).toContainText("Enemy pawn cut off");
  await expect(list.getByRole("button", { name: /Battle 1/ }).getByLabel(/\d warnings/)).toBeVisible();
  await expect(page.getByRole("button", { name: "▶ Play" })).toBeEnabled();

  // Undo and redo, by button and by keyboard.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /^d2 empty/ })).toBeVisible();
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByRole("button", { name: /^d2 wall/ })).toBeVisible();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("button", { name: /^a2 empty/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Warnings" })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.getByRole("button", { name: /^a2 wall/ })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("button", { name: /^a2 empty/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled();

  // Army: make c1 and d1 starts, put a rook on d1, move the king to c1 and leave b1 empty.
  await page.getByRole("group", { name: "Tool" }).getByRole("button", { name: "Army" }).click();
  await page.getByRole("button", { name: /^d1 empty/ }).click();
  const d1 = page.getByRole("group", { name: "Unit on d1" });
  await expect(d1.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
  await d1.getByRole("button", { name: "rook" }).click();
  await expect(page.getByRole("button", { name: /^d1 start 2 with rook/ })).toBeVisible();
  await page.getByRole("button", { name: /^c1 empty/ }).click();
  await page.getByRole("group", { name: "Unit on c1" }).getByRole("button", { name: "king" }).click();
  await expect(page.getByRole("button", { name: /^c1 start 3 with king/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^b1 start 1 empty/ })).toBeVisible();
  await expect(page.locator(".level-board .exile-piece.white")).toHaveCount(2);
  await page.getByRole("button", { name: /^b1 start 1/ }).click();
  await page.getByRole("group", { name: "Unit on b1" }).getByRole("button", { name: "pawn" }).click();
  await page.getByRole("group", { name: "Unit on b1" }).getByRole("button", { name: "None" }).click();
  await expect(page.getByRole("button", { name: /^b1 start 1 empty/ })).toBeVisible();
  // Taking the king off leaves the army without one: an error.
  await page.getByRole("button", { name: /^c1 start 3/ }).click();
  await page.getByRole("group", { name: "Unit on c1" }).getByRole("button", { name: "None" }).click();
  await expect(page.getByRole("list", { name: "Problems" })).toContainText("Army needs exactly one king");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByRole("list", { name: "Problems" })).toHaveCount(0);

  // Play it: the real game, this level, the army exactly where it was put; then back to the editor.
  await page.getByRole("button", { name: "▶ Play" }).click();
  const testRun = page.getByRole("region", { name: "Test run" });
  await expect(testRun.locator(".exile-piece.black")).toHaveCount(3);
  await expect(testRun.getByRole("dialog", { name: "New run" })).toHaveCount(0);
  await expect(testRun.getByRole("button", { name: /^d1 white rook/ })).toBeVisible();
  await expect(testRun.getByRole("button", { name: /^c1 white king/ })).toBeVisible();
  await expect(testRun.getByRole("button", { name: /^b1 empty, start square/ })).toBeVisible();
  await testRun.getByRole("button", { name: "Begin" }).click();
  await testRun.getByRole("button", { name: /^c1 white king/ }).click();
  await testRun.getByRole("button", { name: /^c2 empty, move here/ }).click();
  await expect(testRun.getByRole("button", { name: /^c2 white king/ })).toBeVisible();
  await testRun.getByRole("button", { name: "End turn" }).click();
  await expect(testRun.getByRole("button", { name: /^c2 white king/ })).toBeEnabled({ timeout: 15000 });
  await testRun.getByRole("button", { name: "■ Stop" }).click();
  await expect(testRun).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^d4 enemy rook/ })).toBeVisible();

  expect(await page.evaluate(([s, m]) => [localStorage.getItem(s), localStorage.getItem(m)], [SAVE, META])).toEqual([run, meta]);
  expect(errors).toEqual([]);
});
