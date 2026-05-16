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
        injectRegister: false,
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "icon-mark.png", "wordmark.png", "pwa/**/*"],
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
