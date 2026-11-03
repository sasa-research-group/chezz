/** Browser tests play by the fixed test rules and battles, not the shipped files the owner retunes:
 * the dev server's `rules.json` and `levels.json` modules are swapped for the fixtures in every page. */
import { test as base } from "@playwright/test";
import { FIXED, FIXED_LEVELS, FIXED_RULES } from "../fixtures";
import type { Run } from "../../src/game/turns";
export { expect } from "@playwright/test";
export { FIXED, stored } from "../fixtures";

const module = (data: unknown) => ({ contentType: "text/javascript", body: `export default ${JSON.stringify(data)};` });
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(url => url.pathname === "/src/game/rules.json", route => route.fulfill(module(FIXED_RULES)));
    await page.route(url => url.pathname === "/src/game/levels/levels.json", route => route.fulfill(module({ version: 1, levels: FIXED_LEVELS })));
    await use(page);
  },
});
/** A saved run, read back with the fixed data it plays by. */
export const withFixed = (g: Run): Run => ({ ...g, ...FIXED });
