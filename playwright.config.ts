import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["exile.spec.ts", "lab.spec.ts"],
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    // Set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium (e.g. in a
    // cloud container) instead of the browser Playwright downloads.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ["--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
