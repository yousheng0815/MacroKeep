/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When set, Vite dev server proxies `/api/*` to this origin (e.g. `vercel dev`). */
  readonly VITE_DEV_API_PROXY_TARGET?: string;
  /** GA4 measurement ID (e.g. G-XXXXXXXXXX). Loaded in production builds only. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
