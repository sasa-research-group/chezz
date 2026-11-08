import { FIXED, expect, stored, test } from "./fixed";
import type { Page } from "@playwright/test";
import { begin, tutorialRun } from "../../src/game/turns";
import type { Encounter, GameData, Run } from "../../src/game/turns";

/** The fixed battles with the first two in the tutorial; the third is the roguelike's only battle. */
const LEVELS: Encounter[] = FIXED.levels.map((l, i) => i === 0 ? { ...l, tutorial: { army: [{ kind: "king", x: 1, y: 3 }] } }
  : i === 1 ? { ...l, tutorial: { army: [{ kind: "rook", x: 1, y: 4 }, { kind: "king", x: 5, y: 4 }] } } : l);
const DATA: GameData = { ...FIXED, levels: LEVELS };

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("chezz.turns.v1")!) as Run);
const meta = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("chezz.meta.v1") ?? "{}") as { tutorialDone?: boolean });
async function withTutorial(page: Page, run?: Run) {
  await page.route(url => url.pathname === "/src/game/levels/levels.json", route => route.fulfill({ contentType: "text/javascript", body: `export default ${JSON.stringify({ version: 1, levels: LEVELS })};` }));
  if (run) await page.addInitScript(g => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("chezz.turns.v1", g); } }, stored(run));
}

test("a new game starts the tutorial: its own battle count, no gold, the level's preset army", async ({ page }) => {
  await withTutorial(page);
  await page.goto("/");
  const intro = page.getByRole("dialog", { name: "New run" });
  await expect(intro.getByText("Tutorial")).toBeVisible();
  await intro.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("img", { name: "Tutorial battle 1 of 2" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Gold/ })).toHaveCount(0);
  const g = await saved(page);
  expect(g.tutorial).toBe(true);
  expect(g.phase).toBe("deploy");
});

test("between tutorial battles there's no hideout: the next battle deals its own army", async ({ page }) => {
  const won = tutorialRun(DATA);
  await withTutorial(page, { ...won, phase: "camp", units: won.units.filter(u => u.side === "white").map(u => ({ ...u, hp: 1 })) });
  await page.goto("/");
  const between = page.getByRole("dialog", { name: "Battle won" });
  await expect(between).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toHaveCount(0);
  await expect(between.getByRole("img", { name: "Next army: rook, king" })).toBeVisible();
  await between.getByRole("button", { name: "Battle 2" }).click();
  await expect(page.getByRole("img", { name: "Tutorial battle 2 of 2" })).toBeVisible();
  const g = await saved(page);
  expect(g).toMatchObject({ encounter: 1, phase: "deploy", tutorial: true });
  expect(g.units.filter(u => u.side === "white").map(u => [u.kind, u.x, u.y, u.hp])).toEqual([["rook", 1, 4, FIXED.rules.hp.rook], ["king", 5, 4, FIXED.rules.hp.king]]);
});

test("losing a tutorial battle retries it", async ({ page }) => {
  const started = begin(tutorialRun(DATA, 1));
  await withTutorial(page, { ...started, phase: "defeat", units: started.units.filter(u => u.id !== "king") });
  await page.goto("/");
  await page.getByRole("dialog", { name: "Defeat" }).getByRole("button", { name: "Retry" }).click();
  await expect.poll(async () => (await saved(page)).phase).toBe("deploy");
  expect((await saved(page)).encounter).toBe(1);
});

test("the game is only the tutorial for now: finishing it marks it done and starts it again", async ({ page }) => {
  const last = begin(tutorialRun(DATA, 1));
  await withTutorial(page, { ...last, phase: "victory", units: last.units.filter(u => u.side === "white") });
  await page.goto("/");
  const victory = page.getByRole("dialog", { name: "Victory" });
  await expect.poll(async () => (await meta(page)).tutorialDone).toBe(true);
  await expect(victory.getByRole("button", { name: "Roguelike" })).toHaveCount(0);
  await victory.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByRole("img", { name: "Tutorial battle 1 of 2" })).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("button", { name: /tutorial/i })).toHaveCount(0);
  await menu.getByRole("button", { name: "New run" }).click();
  await expect(page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Tutorial" })).toHaveCount(0);
});
