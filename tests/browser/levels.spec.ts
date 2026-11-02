import { expect, test } from "@playwright/test";
import { newRun } from "../../src/game/turns";

const SAVE = "chezz.turns.v1", META = "chezz.meta.v1";

test("level designer: edit a level, see problems inline, and playtest it without touching the run save", async ({ page }) => {
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

  // Play it: the real game, this level, the test army; then back to the editor.
  await page.getByRole("button", { name: "▶ Play" }).click();
  const playtest = page.getByRole("region", { name: "Playtest" });
  await expect(playtest.locator(".exile-piece.black")).toHaveCount(3);
  await expect(playtest.getByRole("dialog", { name: "New run" })).toHaveCount(0);
  await playtest.getByRole("button", { name: /^b1 white king/ }).click();
  await playtest.getByRole("button", { name: /^b2 empty, move here/ }).click();
  await expect(playtest.getByRole("button", { name: /^b2 white king/ })).toBeVisible();
  await playtest.getByRole("button", { name: "End turn" }).click();
  await expect(playtest.getByRole("button", { name: "End turn" })).toBeEnabled();
  await playtest.getByRole("button", { name: "■ Stop" }).click();
  await expect(playtest).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^d4 enemy rook/ })).toBeVisible();

  expect(await page.evaluate(([s, m]) => [localStorage.getItem(s), localStorage.getItem(m)], [SAVE, META])).toEqual([run, meta]);
  expect(errors).toEqual([]);
});
