import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { levelsPlugin, rulesPlugin } from "./vite.levels";
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  plugins: [react(), levelsPlugin(here("./src/game/levels/levels.json")), rulesPlugin(here("./src/game/rules.json"))],
  base: "./",
  build: { rollupOptions: { input: { main: "index.html", lab: "lab.html", art: "art.html" } } },
});
