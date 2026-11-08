import { FIXED, expect, stored, test, withFixed } from "./fixed";
import type { Page } from "@playwright/test";
import { begin, coord, newRun, startAt, turnSpent } from "../../src/game/turns";
import type { Run } from "../../src/game/turns";
import { nextAction } from "../turns-strategy";

const saved = async (page: Page) => withFixed(await page.evaluate(() => JSON.parse(localStorage.getItem("chezz.turns.v1")!) as Run));
const cell = (page: Page, g: Run, p: { x: number; y: number }) => page.getByRole("button", { name: new RegExp(`^${coord(g, p)} `) });

test("move, end turn, watch the enemy, and resume after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Begin" }).click();
  await expect(page.locator(".piece-layer svg.rig")).toHaveCount(3);
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await expect(page.getByRole("button", { name: /^b2 empty, move here/ })).toBeVisible();
  await page.getByRole("button", { name: /^b2 empty/ }).click();
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "king")?.y).toBe(2);
  await page.screenshot({ path: "test-results/exile-board.png", fullPage: true });
  await page.getByRole("button", { name: "End turn" }).click();
  await expect(page.locator(".phase-banner.enemy")).toHaveText("ENEMY PHASE");
  await expect(page.locator(".turn-ribbon", { hasText: "ENEMY PHASE" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^b2 white king/ })).toBeDisabled();
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.locator(".phase-banner.player")).toHaveText("YOUR PHASE");
  await expect.poll(async () => (await saved(page)).turn).toBe(2);
  await page.reload();
  await expect(page.getByRole("button", { name: /^b2 white king/ })).toBeEnabled();
});

test("the winning blow plays out and celebrates before the hideout", async ({ page }) => {
  // One pawn left, diagonally in front of the king.
  const g = { ...begin(newRun(FIXED)), units: [newRun(FIXED).units[0], { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 2, y: 2, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await page.getByRole("button", { name: /^c2 black pawn/ }).click();
  await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toBeHidden();
  const banner = page.getByRole("button", { name: /^Battle won/ });
  await expect(banner).toBeVisible();
  await page.screenshot({ path: "test-results/exile-victory-banner.png" });
  await banner.click();
  await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toBeVisible();
});

test("tap an enemy to walk up and strike it when there's one way in", async ({ page }) => {
  const start = begin(newRun(FIXED));
  const pawn = (id: string, x: number, y: number) => ({ id, side: "black" as const, kind: "pawn" as const, x, y, hp: 1 });
  // A rook down the a-file has one way in: the square in front of the pawn.
  const g = { ...start, units: [{ ...start.units[0], x: 2, y: 3 }, { id: "ally-1", side: "white" as const, kind: "rook" as const, x: 0, y: 3, hp: 5 }, pawn("enemy-0-0", 0, 0), pawn("enemy-0-1", 2, 1), pawn("enemy-0-2", 3, 0)] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a1 white rook/ }).click();
  // Enemies you can strike are marked on the board with a sword badge.
  await expect(page.locator(".strike-badge")).toHaveCount(1);
  await page.getByRole("button", { name: /^a4 black pawn, 1 HP, strike \(walks up first\)/ }).click();
  await expect.poll(async () => (await saved(page)).units.some(u => u.id === "enemy-0-0")).toBe(false);
  const now = await saved(page);
  expect(now.units.find(u => u.id === "ally-1")).toMatchObject({ x: 0, y: 1 });
});

test("a knight flips over to strike and lands back home", async ({ page }) => {
  const start = begin(newRun(FIXED));
  const g = { ...start, units: [{ ...start.units[0], x: 3, y: 3 }, { id: "ally-1", side: "white" as const, kind: "knight" as const, x: 0, y: 3, hp: 3 }, { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 1, y: 1, hp: 1 }, { id: "enemy-0-1", side: "black" as const, kind: "pawn" as const, x: 3, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a1 white knight/ }).click();
  await page.getByRole("button", { name: /^b3 black pawn, 1 HP, strike/ }).click();
  await expect(page.locator(".exile-piece.lunging")).toHaveCount(1);
  await expect.poll(async () => (await saved(page)).units.some(u => u.id === "enemy-0-0")).toBe(false);
  // The stunt ends with the knight home and the fallen pawn gone from the board.
  await expect(page.locator(".exile-piece.lunging")).toHaveCount(0);
  await expect(page.locator(".exile-piece.ghost")).toHaveCount(0);
  await expect(page.locator(".piece-layer svg.rig")).toHaveCount(3);
});

test("with several squares to strike from, you pick one", async ({ page }) => {
  const start = begin(newRun(FIXED));
  const pawn = (id: string, x: number, y: number) => ({ id, side: "black" as const, kind: "pawn" as const, x, y, hp: 1 });
  const now = { ...start, units: [start.units[0], pawn("enemy-0-1", 1, 1), pawn("enemy-0-2", 3, 0)] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(now));
  await page.goto("/");
  const king = now.units[0], target = now.units[1];
  await cell(page, now, king).click();
  await cell(page, now, target).click();
  await expect(page.locator(".playback-caption")).toHaveText("Strike from?");
  const picks = page.getByRole("button", { name: /walk here and strike the pawn/ });
  expect(await picks.count()).toBeGreaterThan(1);
  await page.screenshot({ path: "test-results/exile-pick-square.png" });
  // Tapping an empty square that isn't a pick cancels; it doesn't move the king.
  await page.getByRole("button", { name: /^d1 empty/ }).click();
  await expect(picks).toHaveCount(0);
  expect((await saved(page)).units.find(u => u.id === "king")).toMatchObject({ x: king.x, y: king.y });
  await cell(page, now, target).click();
  await picks.first().click();
  await expect.poll(async () => (await saved(page)).units.some(u => u.id === "enemy-0-1")).toBe(false);
});

test("check locks End turn until the king is safe", async ({ page }) => {
  const start = begin(newRun(FIXED));
  // The rook can step next to the 2-HP king and strike for 2.
  const g = { ...start, units: [{ ...start.units[0], hp: 2 }, { id: "ally-1", side: "white" as const, kind: "rook" as const, x: 0, y: 2, hp: 5 }, { id: "enemy-1-0", side: "black" as const, kind: "rook" as const, x: 1, y: 1, hp: 5 }, { id: "enemy-1-1", side: "black" as const, kind: "pawn" as const, x: 3, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveText("Check");
  await expect(page.locator(".check-mark")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "King in check" })).toBeDisabled();
  // Our rook slides in front of the king and blocks the enemy rook's way in: no longer check.
  await page.getByRole("button", { name: /^a2 white rook/ }).click();
  await page.getByRole("button", { name: /^b2 empty, move here/ }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End turn" })).toBeEnabled();
});

test("checkmate plays a finale before the defeat screen", async ({ page }) => {
  const start = begin(newRun(FIXED));
  // The king has already acted and is still in check: the turn may end, and the rook lands the killing blow.
  const g = { ...start, units: [{ ...start.units[0], hp: 2, moved: true, acted: true }, { id: "enemy-1-0", side: "black" as const, kind: "rook" as const, x: 1, y: 1, hp: 5 }, { id: "enemy-1-1", side: "black" as const, kind: "pawn" as const, x: 3, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("No way out");
  await page.getByRole("button", { name: "End turn" }).click();
  await expect(page.locator(".board-camera.mate-zoom")).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator(".rig.act-mate")).toHaveCount(1);
  const banner = page.getByRole("button", { name: /Checkmate!/ });
  await expect(banner).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: "test-results/exile-checkmate.png" });
  await banner.click();
  await expect(page.getByRole("dialog", { name: "Defeat" })).toBeVisible();
});

test("a king felled by a counter on your own turn still gets the finale", async ({ page }) => {
  const start = begin(newRun(FIXED));
  // Striking the rook: it survives and counters for 2, which kills a 2-HP king.
  const g = { ...start, units: [{ ...start.units[0], hp: 2 }, { id: "enemy-0-0", side: "black" as const, kind: "rook" as const, x: 1, y: 2, hp: 5 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await page.getByRole("button", { name: /^b2 black rook/ }).click();
  await expect(page.getByRole("button", { name: /Checkmate!/ })).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: "test-results/exile-checkmate-counter.png" });
  await page.getByRole("button", { name: /Checkmate!/ }).click();
  await expect(page.getByRole("dialog", { name: "Defeat" })).toBeVisible();
  // He stays flattened on his square, not standing idle.
  await expect(page.locator(".exile-piece.white .rig.act-mate")).toHaveCount(1);
});

test("moves that would put your own king in check are blocked", async ({ page }) => {
  const start = begin(newRun(FIXED));
  // On b2 the pawn could step to c3 and finish the 1-HP king, so b2 is off limits.
  const g = { ...start, units: [{ ...start.units[0], hp: 1 }, { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 2, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await expect(page.locator(".unsafe-dot")).toHaveCount(1);
  await page.getByRole("button", { name: /^b2 empty, blocked: would put your king in check/ }).click();
  expect((await saved(page)).units.find(u => u.id === "king")).toMatchObject({ x: 1, y: 3 });
  // A safe square still works.
  await page.getByRole("button", { name: /^a1 empty, move here/ }).click();
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "king")?.x).toBe(0);
});

test("a walk-up strike may step into danger when the blow removes it", async ({ page }) => {
  const start = begin(newRun(FIXED));
  // b3 sits in front of the pawn: on its own that's check for a 1-HP king, but striking from there kills the pawn.
  const g = { ...start, units: [{ ...start.units[0], x: 0, y: 0, hp: 1 }, { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 2, y: 0, hp: 1 }, { id: "enemy-0-1", side: "black" as const, kind: "pawn" as const, x: 3, y: 3, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a4 white king/ }).click();
  await expect(page.getByRole("button", { name: /^b3 empty, blocked/ })).toBeVisible();
  await page.getByRole("button", { name: /^c4 black pawn/ }).click();
  await page.getByRole("button", { name: /^b3 .*walk here and strike the pawn/ }).click();
  await expect.poll(async () => (await saved(page)).units.some(u => u.id === "enemy-0-0")).toBe(false);
  expect((await saved(page)).units.find(u => u.id === "king")).toMatchObject({ x: 1, y: 1 });
});

test("in check, an offered walk-up strike lands in full", async ({ page }) => {
  const start = begin(newRun(FIXED));
  // The king is in check from the rook on c4. Our rook walks to b4 (blocking) and strikes it; the counter is fine.
  const g = { ...start, units: [{ ...start.units[0], x: 0, y: 0, hp: 2 }, { id: "ally-1", side: "white" as const, kind: "rook" as const, x: 1, y: 2, hp: 1 }, { id: "enemy-1-0", side: "black" as const, kind: "rook" as const, x: 2, y: 0, hp: 5 }, { id: "enemy-1-1", side: "black" as const, kind: "pawn" as const, x: 3, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await expect(page.getByRole("alert")).toHaveText("Check");
  await page.getByRole("button", { name: /^b2 white rook/ }).click();
  await page.getByRole("button", { name: /^c4 black rook.*strike/ }).click();
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "enemy-1-0")?.hp ?? 0).toBeLessThan(5);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("one move per turn: once a piece moves the others are locked, and acting passes the turn", async ({ page }) => {
  const start = begin(newRun(FIXED));
  // The rook can slide up to the pawn on a4 and strike it; the king waits on d1.
  const g = { ...start, units: [{ ...start.units[0], x: 3, y: 3 }, { id: "ally-1", side: "white" as const, kind: "rook" as const, x: 0, y: 3, hp: 5 }, { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 0, y: 0, hp: 2 }, { id: "enemy-0-1", side: "black" as const, kind: "pawn" as const, x: 2, y: 0, hp: 2 }] };
  await page.addInitScript(run => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("chezz.turns.v1", run); } }, stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a1 white rook/ }).click();
  await page.getByRole("button", { name: /^a3 empty, move here/ }).click();
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "ally-1")?.y).toBe(1);
  // It can still strike, so the turn waits; the king is locked out.
  await expect(page.locator(".exile-piece.white.spent")).toHaveCount(1);
  await page.getByRole("button", { name: /^d1 white king/ }).click();
  await expect(page.getByRole("img", { name: /^locked/ })).toBeVisible();
  await expect(page.locator(".target-dot")).toHaveCount(0);
  await page.getByRole("button", { name: /^a3 white rook/ }).click();
  await page.getByRole("button", { name: /^a4 black pawn, 2 HP, strike/ }).click();
  // Striking spends the piece, and the turn passes without End turn.
  await expect(page.locator(".turn-ribbon", { hasText: "ENEMY PHASE" })).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => (await saved(page)).turn).toBe(2);
});

// The rook on b3 plans to step to b2 and strike the king on b1.
const intentBoard = () => {
  const start = begin(newRun(FIXED));
  return { ...start, units: [start.units[0], { id: "enemy-0-0", side: "black" as const, kind: "rook" as const, x: 1, y: 1, hp: 5 }, { id: "enemy-0-1", side: "black" as const, kind: "pawn" as const, x: 3, y: 0, hp: 1 }] };
};

test("hover or tap an enemy to see its card and what it plans", async ({ page }) => {
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(intentBoard()));
  await page.goto("/");
  await page.getByRole("button", { name: /^b3 black rook/ }).hover();
  await expect(page.locator(".intent-layer")).toHaveCount(1);
  await expect(page.locator(".intent-chip.hit")).toHaveText("−2");
  await page.mouse.move(0, 0);
  await expect(page.locator(".intent-layer")).toHaveCount(0);
  await page.getByRole("button", { name: /^b3 black rook/ }).click();
  const card = page.getByRole("group", { name: "Enemy rook card" });
  await expect(card).toContainText("♥5/5");
  await expect(card.getByRole("img", { name: "Intent: moves to b2, strikes king −2" })).toBeVisible();
  // Under one move per turn the pawn isn't the piece that acts.
  await page.getByRole("button", { name: /^d4 black pawn/ }).click();
  await expect(page.locator(".intent-chip.idle")).toHaveText("waits");
  // Selecting your own piece brings its card back.
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await expect(page.getByRole("group", { name: /Enemy/ })).toHaveCount(0);
});

test("a move is a preview: the enemy's plan follows it, and Escape or Cancel takes it back", async ({ page }) => {
  await page.addInitScript(run => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("chezz.turns.v1", run); } }, stored(intentBoard()));
  await page.goto("/");
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await page.getByRole("button", { name: /^a1 empty, move here/ }).click();
  await expect(page.getByRole("button", { name: /^a1 white king/ })).toBeVisible();
  await page.getByRole("button", { name: /^b3 black rook/ }).click();
  await expect(page.getByRole("img", { name: "Intent: moves to b1, strikes king −2" })).toBeVisible();
  // Nothing to strike, but a move alone doesn't pass the turn: it waits to be committed or cancelled.
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  // A reload keeps the preview, and it can still be cancelled.
  await page.reload();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: /^b1 white king/ })).toBeVisible();
  expect((await saved(page)).units.find(u => u.id === "king")).toMatchObject({ x: 1, y: 3 });
  // Escape closes the enemy card first, then takes the move back.
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await page.getByRole("button", { name: /^c1 empty, move here/ }).click();
  await page.getByRole("button", { name: /^b3 black rook/ }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole("group", { name: "Enemy rook card" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Enemy rook card" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^c1 white king/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^b1 white king/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("chezz.turns.v1.start"))).toBeNull();
  await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
});

test("a pawn on the far row stays a pawn", async ({ page }) => {
  const start = begin(newRun(FIXED));
  const g = { ...start, units: [{ ...start.units[0], x: 3, y: 3 }, { id: "ally-1", side: "white" as const, kind: "pawn" as const, x: 0, y: 1, hp: 2 }, { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 3, y: 0, hp: 1 }] };
  await page.addInitScript(run => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("chezz.turns.v1", run); } }, stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: /^a3 white pawn/ }).click();
  await page.getByRole("button", { name: /^a4 empty/ }).click();
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "ally-1")).toMatchObject({ kind: "pawn", y: 0 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the hideout: walk to the barracks, recruit, take the road; placeholders stay locked", async ({ page }) => {
  const start = begin(newRun(FIXED));
  const g = { ...start, phase: "camp" as const, gold: 20, units: [{ ...start.units[0], hp: 3 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/");
  const hub = page.getByRole("dialog", { name: "Rebel hideout" });
  await expect(hub).toBeVisible();
  await page.screenshot({ path: "test-results/hub-mobile.png" });
  for (const id of ["barracks", "training", "armory", "merchant", "guild", "road"]) {
    const box = (await hub.getByTestId(`place-${id}`).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(664);
  }
  for (const id of ["training", "armory", "merchant", "guild"]) await expect(hub.getByTestId(`place-${id}`)).toBeDisabled();
  await hub.getByTestId("place-barracks").click();
  const barracks = page.getByRole("dialog", { name: "Barracks" });
  await barracks.getByTestId("buy-pawn").click();
  await barracks.getByTestId("buy-bishop").click();
  await expect(barracks.getByTestId("buy-pawn")).toBeDisabled();
  await expect(barracks.getByTestId("buy-pawn")).toContainText("Army full");
  await page.screenshot({ path: "test-results/hub-barracks.png" });
  await barracks.getByRole("button", { name: "Close" }).click();
  await hub.getByTestId("place-road").click();
  await page.getByRole("button", { name: "Start battle" }).click();
  await page.getByRole("button", { name: "Begin" }).click();
  await expect.poll(async () => (await saved(page)).units.filter(u => u.side === "white").map(u => u.kind)).toEqual(["king", "pawn", "bishop"]);
  await expect(page.getByRole("button", { name: "End turn" })).toBeEnabled();
});

test("compact layout fits an iPhone screen without scrolling", async ({ page }) => {
  // iPhone 13 Pro with Safari's bars showing: about 390 × 664.
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Begin" }).click();
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  for (const control of [page.getByRole("button", { name: "End turn" }), page.getByRole("button", { name: /^a4 / }), page.getByRole("button", { name: /^d1 / })]) {
    const box = (await control.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(664);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/exile-mobile.png", fullPage: true });
});

const SIZES = [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }, { width: 360, height: 640 }, { width: 320, height: 568 }, { width: 768, height: 1024 }];
/** The page doesn't scroll, and since the shell clips rather than scrolls, nothing in the bar, the strip or the board spills out of view either. */
const noScroll = (page: Page) => page.evaluate(() => {
  const el = document.documentElement;
  const out = [...document.querySelectorAll(".top-bar > *, .team-bar, .table-hud > *, .table-hud button, .board-plane, .hub-map")].filter(e => {
    const r = e.getBoundingClientRect();
    return r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5;
  }).map(e => e.className);
  return { tall: el.scrollHeight - innerHeight, wide: el.scrollWidth - innerWidth, out };
});
const inView = async (page: Page, name: string) => {
  const box = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width); expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  // Tap targets stay at least 44px.
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
};

for (const size of SIZES) {
  test(`the battle and the hideout fit ${size.width}x${size.height} without scrolling`, async ({ page }) => {
    const start = begin(newRun(FIXED));
    const battle3 = { ...start, encounter: 2, units: [{ ...start.units[0], x: 2, y: 5 }, { id: "ally-1", side: "white" as const, kind: "rook" as const, x: 3, y: 5, hp: 5 }, { id: "enemy-2-0", side: "black" as const, kind: "knight" as const, x: 3, y: 0, hp: 3 }] };
    await page.setViewportSize(size);
    await page.addInitScript(run => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("chezz.turns.v1", run); } }, stored(battle3));
    await page.goto("/");
    await page.getByRole("button", { name: /^c1 white king/ }).click();
    expect(await noScroll(page)).toEqual({ tall: 0, wide: 0, out: [] });
    for (const name of ["Menu", "End turn"]) await inView(page, name);
    await page.screenshot({ path: `test-results/shell-battle-${size.width}x${size.height}.png` });
    await page.evaluate(run => localStorage.setItem("chezz.turns.v1", run), stored({ ...start, phase: "camp", gold: 12 }));
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toBeVisible();
    expect(await noScroll(page)).toEqual({ tall: 0, wide: 0, out: [] });
    for (const id of ["barracks", "road"]) {
      const box = (await page.getByTestId(`place-${id}`).boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    }
    await page.screenshot({ path: `test-results/shell-hub-${size.width}x${size.height}.png` });
  });
}

test("on battle 3's 6x6 board every square is at least 56px on a phone", async ({ page }) => {
  const start = begin(newRun(FIXED));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored({ ...start, encounter: 2, units: [{ ...start.units[0], x: 2, y: 5 }, { id: "enemy-2-0", side: "black" as const, kind: "knight" as const, x: 3, y: 0, hp: 3 }] }));
  await page.goto("/");
  const cells = page.locator(".exile-cell");
  await expect(cells).toHaveCount(36);
  for (const box of await cells.evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => ({ w: r.width, h: r.height })))) {
    expect(box.w).toBeGreaterThanOrEqual(56);
    expect(box.h).toBeGreaterThanOrEqual(56);
  }
});

test("the ☰ menu opens and closes with Escape and keeps focus inside", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  const button = page.getByRole("button", { name: "Menu" }), menu = page.getByRole("dialog", { name: "Menu" });
  await button.click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Resume" })).toBeFocused();
  // Tab wraps from the last item to the first, and Shift+Tab back.
  await page.keyboard.press("Shift+Tab");
  await expect(menu.getByRole("button", { name: "Battle 3" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("button", { name: "Resume" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
  // On the table, Escape first drops the selection, then opens the menu.
  await page.getByRole("button", { name: /^b1 white king/ }).click();
  await expect(page.locator(".exile-piece.selected")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".exile-piece.selected")).toHaveCount(0);
  await expect(menu).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Rules" }).click();
  await expect(menu.locator(".rules-card")).toBeVisible();
  await menu.getByRole("button", { name: "Resume" }).click();
  await expect(menu).toBeHidden();
});

test("the menu pauses the enemy's turn", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Begin" }).click();
  await page.getByRole("button", { name: "End turn" }).click();
  await expect(page.locator(".turn-ribbon", { hasText: "ENEMY PHASE" })).toBeVisible();
  const caption = page.locator(".playback-caption");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  const paused = await caption.textContent();
  // Many 800ms steps' worth of clock: the step shown must not change while paused.
  await page.clock.runFor(10000);
  expect(await caption.textContent()).toBe(paused);
  await expect(page.locator(".turn-ribbon", { hasText: "ENEMY PHASE" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.clock.runFor(10000);
  await expect(page.locator(".turn-ribbon", { hasText: "ENEMY PHASE" })).toBeHidden();
});

test("the menu stays shut over the hideout, and light dialogs keep dark text", async ({ page }) => {
  const start = begin(newRun(FIXED));
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored({ ...start, phase: "camp", gold: 12 }));
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
  await page.getByTestId("place-barracks").click();
  const title = page.getByRole("dialog", { name: "Barracks" }).getByRole("heading", { name: "Barracks" });
  expect(await title.evaluate(el => getComputedStyle(el).color)).toBe("rgb(56, 47, 46)");
});

test("play the exile run through browser controls", async ({ page }) => {
  test.setTimeout(150000);
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("checkbox", { name: "Fast enemy phase" }).check();
  await page.keyboard.press("Escape");
  for (let i = 0; i < 120; i++) {
    const g = await saved(page);
    if (g.phase === "victory" || g.phase === "defeat") break;
    if (g.phase === "deploy") { await page.getByRole("button", { name: "Begin" }).click(); await expect.poll(async () => (await saved(page)).phase).not.toBe("deploy"); continue; }
    if (g.phase === "camp") {
      await expect(page.getByRole("dialog", { name: "Rebel hideout" })).toBeVisible();
      const king = g.units.find(u => u.id === "king")!;
      await page.getByTestId("place-barracks").click();
      const barracks = page.getByRole("dialog", { name: "Barracks" });
      await barracks.getByTestId(g.gold >= 8 ? "buy-rook" : "buy-bishop").click();
      if (king.hp < 5 && (await saved(page)).gold >= 4) await barracks.getByTestId("buy-heal").click();
      await barracks.getByRole("button", { name: "Close" }).click();
      await page.getByTestId("place-road").click();
      await page.getByRole("button", { name: "Start battle" }).click();
      await expect.poll(async () => (await saved(page)).encounter).toBe(g.encounter + 1);
      continue;
    }
    // Under one move per turn the game passes a spent turn on its own once a piece has acted; a move
    // alone is a preview, which End turn commits.
    if (turnSpent(g)) {
      if (!g.units.some(u => u.side === "white" && u.acted)) await page.getByRole("button", { name: "End turn" }).click();
      await expect.poll(async () => { const s = await saved(page); return s.turn !== g.turn || s.phase !== "player"; }, { timeout: 15000 }).toBe(true);
      continue;
    }
    const a = nextAction(g);
    if (!a) {
      await page.getByRole("button", { name: "End turn" }).click();
      await expect.poll(async () => { const s = await saved(page); return s.turn !== g.turn || s.phase !== "player"; }, { timeout: 15000 }).toBe(true);
      continue;
    }
    const u = g.units.find(v => v.id === a.id)!;
    await cell(page, g, u).click();
    await cell(page, g, a.to).click();
    await expect.poll(async () => JSON.stringify(await saved(page)) !== JSON.stringify(g)).toBe(true);
  }
  // Whether the search player wins is a balance readout (tests/balance.test.ts), not a pass condition.
  const end = await saved(page);
  console.log(`Browser run: ${end.phase} at battle ${end.encounter + 1}, turn ${end.turn}`);
  expect(end.encounter).toBeGreaterThan(0);
  if (end.phase === "victory" || end.phase === "defeat") await expect(page.getByRole("dialog", { name: end.phase === "victory" ? "Victory" : "Defeat" })).toBeVisible({ timeout: 15000 });
});

test("winning the last battle shows Victory and unlocks the first skin", async ({ page }) => {
  const start = begin(newRun(FIXED));
  const g = { ...start, encounter: 2, units: [{ ...start.units[0], x: 2, y: 5 }, { id: "enemy-2-0", side: "black" as const, kind: "pawn" as const, x: 3, y: 4, hp: 1 }] };
  await page.addInitScript(run => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("chezz.turns.v1", run); } }, stored(g));
  await page.goto("/");
  await cell(page, g, g.units[0]).click();
  await cell(page, g, g.units[1]).click();
  await expect.poll(async () => (await saved(page)).phase).toBe("victory");
  await expect(page.getByRole("dialog", { name: "Victory" })).toBeVisible({ timeout: 10000 });
  // Finishing the run unlocks the first skin, kept apart from the run save.
  const meta = () => page.evaluate(() => JSON.parse(localStorage.getItem("chezz.meta.v1")!) as { unlocked: string[] });
  expect((await meta()).unlocked).toEqual(["frog-pot"]);
  await page.reload();
  expect((await meta()).unlocked).toEqual(["frog-pot"]);
  await page.getByRole("button", { name: /Play again/ }).click();
  expect((await saved(page)).encounter).toBe(0);
  expect((await meta()).unlocked).toEqual(["frog-pot"]);
});

test("the game draws every piece as one painted sprite", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".piece-layer svg.rig image.sprite")).toHaveCount(3);
});

test("a skin worn in an old save still draws; the menu has no skin picker", async ({ page }) => {
  await page.addInitScript(meta => localStorage.setItem("chezz.meta.v1", meta), JSON.stringify({ version: 1, unlocked: ["cat-king"], equipped: { king: "cat-king" } }));
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  await expect(page.locator(".piece-layer .rig.skin-cat-king image.sprite")).toHaveAttribute("href", /skin-cat-king/);
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" }).getByRole("group", { name: "Skins" })).toHaveCount(0);
});

test("ending a turn where the enemy does nothing shows ENEMY WAITS and logs it", async ({ page }) => {
  const start = begin(newRun(FIXED));
  // The pawn is boxed in by the rook and has nothing to strike.
  const g = { ...start, units: [{ ...start.units[0], x: 3, y: 3 }, { id: "ally-1", side: "white" as const, kind: "rook" as const, x: 0, y: 1, hp: 5, moved: true, acted: true }, { id: "enemy-0-0", side: "black" as const, kind: "pawn" as const, x: 0, y: 0, hp: 1 }] };
  await page.addInitScript(run => localStorage.setItem("chezz.turns.v1", run), stored(g));
  await page.goto("/");
  await page.getByRole("button", { name: "End turn" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ENEMY WAITS" })).toBeVisible();
  await expect.poll(async () => (await saved(page)).log[0]).toBe("Enemy waits");
  await expect(page.getByRole("status").filter({ hasText: "ENEMY WAITS" })).toBeHidden();
});

test("the top bar reads Battle n of N, and Developer → Jump to battle starts battle N after a second tap", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("dialog", { name: "New run" }).getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("img", { name: "Battle 1 of 3" })).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("heading", { name: "Developer" })).toBeVisible();
  await menu.getByRole("button", { name: "Battle 2" }).click();
  await expect(menu).toBeVisible();
  expect((await saved(page)).encounter).toBe(0);
  await menu.getByRole("button", { name: "Confirm battle 2" }).click();
  await expect(menu).toBeHidden();
  await expect.poll(async () => (await saved(page)).encounter).toBe(1);
  const g = await saved(page);
  expect(g.units.filter(u => u.side === "white").map(u => u.kind)).toEqual(["king", "rook"]);
  expect(g.turn).toBe(1);
  await expect(page.getByRole("img", { name: "Battle 2 of 3" })).toBeVisible();
});

test("deploy: drag a piece onto another start square to swap, then Begin", async ({ page }) => {
  // Battle 2: the king on b1, a rook on a1, and f1 spare.
  const g = startAt(1, ["king", "rook"], 0, FIXED);
  await page.addInitScript(run => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("chezz.turns.v1", run); sessionStorage.setItem("seeded", "1"); } }, stored(g));
  await page.goto("/");
  await expect(page.getByText("DEPLOY", { exact: true })).toBeVisible();
  await expect(page.locator(".exile-cell.deploy-square")).toHaveCount(3);
  const drag = async (from: RegExp, to: RegExp) => {
    const a = (await page.getByRole("button", { name: from }).boundingBox())!, b = (await page.getByRole("button", { name: to }).boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
  };
  const whites = async () => (await saved(page)).units.filter(u => u.side === "white").map(u => [u.id, coord(g, u)]);
  await drag(/^b1 white king/, /^a1 white rook/);
  await expect.poll(whites).toEqual([["king", "a1"], ["ally-1", "b1"]]);
  await drag(/^b1 white rook/, /^f1 empty, start square/);
  await expect.poll(whites).toEqual([["king", "a1"], ["ally-1", "f1"]]);
  // Off the start squares, the piece snaps back.
  await drag(/^a1 white king/, /^b2 empty/);
  await expect(page.getByRole("button", { name: /^a1 white king/ })).toBeVisible();
  // Tap a piece, then a start square.
  await page.getByRole("button", { name: /^f1 white rook/ }).click();
  await page.getByRole("button", { name: /^b1 empty, start square/ }).click();
  await expect.poll(whites).toEqual([["king", "a1"], ["ally-1", "b1"]]);
  // The phase survives a reload.
  await page.reload();
  await expect(page.getByText("DEPLOY", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Begin" }).click();
  await expect.poll(async () => (await saved(page)).phase).toBe("player");
  await expect(page.getByRole("button", { name: "End turn" })).toBeEnabled();
  await page.getByRole("button", { name: /^a1 white king/ }).click();
  await expect(page.getByRole("button", { name: /, move here/ }).first()).toBeVisible();
});
