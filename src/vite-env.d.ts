/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When set, Vite dev server proxies `/api/*` to this origin (e.g. `vercel dev`). */
  readonly VITE_DEV_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
