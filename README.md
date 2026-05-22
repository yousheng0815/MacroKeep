# MacroKeep

Privacy-first AI calorie tracking — your data stays in Google Drive.

## Development

```bash
npm install
cp .dev.vars.example .dev.vars   # add Google OAuth client id/secret
npm run dev
```

Open **http://localhost:8788** in the browser (not Vite’s http://localhost:5173). API routes (`/api/*`) are served by wrangler on 8788.

`npm run dev:vite` runs Vite alone (no OAuth APIs). A cached service worker from older builds can make :5173 reload repeatedly — use `dev` instead.

OAuth redirect URI for local dev: `http://localhost:8788/api/auth/google/callback`. Copy `.dev.vars.example` → `.dev.vars` and set `MK_SITE_ORIGIN=http://localhost:8788` plus your Google OAuth credentials.

## Deploy (Cloudflare Pages)

1. Create a Pages project connected to this repo (build: `npm run build`, output: `dist`).
2. Set **environment variables** in the dashboard: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `MK_SITE_ORIGIN` (production URL, no trailing slash).
3. Or deploy from CLI: `npm run deploy` (requires `wrangler login`).

Add the production callback URL to your Google OAuth client: `{MK_SITE_ORIGIN}/api/auth/google/callback`.

Public legal pages (for Google OAuth consent screen): `{MK_SITE_ORIGIN}/privacy` and `{MK_SITE_ORIGIN}/terms`.
