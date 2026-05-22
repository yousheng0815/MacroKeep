import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function siteOriginFromEnv(env: Record<string, string>): string {
  const raw = env.MK_SITE_ORIGIN?.trim() || env.VITE_SITE_ORIGIN?.trim() || "";
  return raw.replace(/\/$/, "");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET?.trim();
  const siteOrigin = siteOriginFromEnv(env);
  const ogImage = siteOrigin
    ? `${siteOrigin}/pwa/icon-512.png`
    : "/pwa/icon-512.png";

  if (mode === "development" && apiProxyTarget) {
    console.info(
      `[vite] Proxying /api → ${apiProxyTarget} (use npm run dev:pages and open http://localhost:8788 instead)`,
    );
  }

  return {
    plugins: [
      react(),
      {
        name: "macrokeep-html-meta",
        transformIndexHtml(html) {
          const ogUrlTag = siteOrigin
            ? `<meta property="og:url" content="${siteOrigin}/" />\n    `
            : "";
          return html
            .replaceAll("%OG_IMAGE%", ogImage)
            .replace(
              "<!-- og:url injected at build when MK_SITE_ORIGIN is set -->\n    ",
              ogUrlTag,
            );
        },
      },
      VitePWA({
        disable: mode === "development",
        injectRegister: false,
        registerType: "autoUpdate",
        includeAssets: [
          "favicon.png",
          "icon-mark.png",
          "wordmark.png",
          "pwa/**/*",
        ],
        manifest: {
          name: "MacroKeep",
          short_name: "MacroKeep",
          description:
            "Privacy-first AI calorie tracking — your data stays in Google Drive.",
          theme_color: "#09090B",
          background_color: "#09090B",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/pwa/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    server: {
      watch: {
        ignored: ["**/.wrangler/**", "**/dist/**"],
      },
      allowedHosts: [],
      ...(apiProxyTarget
        ? {
            proxy: {
              "/api": {
                target: apiProxyTarget,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
  };
});
