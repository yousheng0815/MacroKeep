/** Must match {@link src/lib/oauth-session-storage.ts} `OAUTH_STORAGE_KEY`. */
const OAUTH_STORAGE_KEY = "macrokeep:oauth:v1";

export type OAuthCompletePayload = {
  next: string;
  access_token: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
  sub: string;
  email: string | null;
};

/** OAuth callback page: persist tokens in localStorage, then redirect. */
export function oauthSuccessHtml(payload: OAuthCompletePayload): string {
  const json = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
  const storageKey = JSON.stringify(OAUTH_STORAGE_KEY);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signing in…</title>
<style>
:root{color-scheme:dark;}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;background:#09090b;color:#a1a1aa;font-family:ui-sans-serif,system-ui,sans-serif;}
.spinner{width:2.25rem;height:2.25rem;color:#34d399;animation:mk-spin 1s linear infinite;}
@keyframes mk-spin{to{transform:rotate(360deg);}}
#m{margin:0;font-size:.875rem;line-height:1.25rem;}
</style>
</head>
<body>
<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
<p id="m">Completing sign-in…</p>
<script type="application/json" id="mk-oauth">${json}</script>
<script>
(function(){
  var STORAGE_KEY = ${storageKey};
  var SKEW_MS = 60000;
  try {
    var d = JSON.parse(document.getElementById("mk-oauth").textContent);
    var existing = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) existing = JSON.parse(raw);
    } catch (_) {}
    var refresh = typeof d.refresh_token === "string" ? d.refresh_token : undefined;
    if (!refresh && existing && existing.sub === d.sub && typeof existing.refreshToken === "string") {
      refresh = existing.refreshToken;
    }
    var expMs = Date.now() + (d.expires_in || 3600) * 1000 - SKEW_MS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 3,
      refreshToken: refresh,
      accessToken: d.access_token,
      expiresAtMs: expMs,
      scope: d.scope,
      sub: d.sub,
      email: d.email || undefined
    }));
    var next = typeof d.next === "string" && d.next.indexOf("/") === 0 ? d.next : "/";
    window.location.replace(next);
  } catch (e) {
    window.location.replace("/login?oauth_error=" + encodeURIComponent("oauth_complete_script"));
  }
})();
</script>
</body>
</html>`;
}
