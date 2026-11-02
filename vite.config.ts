import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { levelsPlugin } from "./vite.levels";
export default defineConfig({
  plugins: [react(), levelsPlugin(fileURLToPath(new URL("./src/game/levels/levels.json", import.meta.url)))],
  base: "./",
  build: { rollupOptions: { input: { main: "index.html", lab: "lab.html", art: "art.html" } } },
});
