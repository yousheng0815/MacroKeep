import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

const marketingRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(marketingRoot, "..");

export default defineConfig({
  site: "https://macrokeep.com",
  outDir: "dist",
  publicDir: path.join(repoRoot, "public"),
  vite: {
    resolve: {
      alias: {
        "@legal": path.join(repoRoot, "src/content/legal"),
      },
    },
  },
});
