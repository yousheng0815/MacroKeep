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
        includeAssets: ["favicon.png", "wordmark.png"],
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
              src: "/favicon.png",
              sizes: "128x128",
              type: "image/png",
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
