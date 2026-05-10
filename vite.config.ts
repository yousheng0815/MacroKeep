import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET?.trim();

  return {
  plugins: [
    react(),
    VitePWA({
      /** Do not register a service worker: Workbox was intercepting `/api/*` and breaking HttpOnly session cookies. */
      injectRegister: false,
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "OpenMacro",
        short_name: "OpenMacro",
        description:
          "Privacy-first AI calorie tracking — your data stays in Google Drive.",
        theme_color: "#09090B",
        background_color: "#09090B",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: ["252d-209-227-158-102.ngrok-free.app"],
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
