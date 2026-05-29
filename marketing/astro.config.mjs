import path from "node:path";
import { fileURLToPath } from "node:url";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

const marketingRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(marketingRoot, "..");

export default defineConfig({
  site: "https://macrokeep.com",
  outDir: "dist",
  integrations: [sitemap()],
  publicDir: path.join(repoRoot, "public"),
  vite: {
    resolve: {
      alias: {
        "@legal": path.join(repoRoot, "src/content/legal"),
        "@app-i18n": path.join(repoRoot, "src/i18n"),
      },
    },
  },
});
