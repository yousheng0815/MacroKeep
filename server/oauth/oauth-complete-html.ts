/** Returned by OAuth callback: POST session-handoff, then `location.replace(next)`. */
export function oauthSuccessHtml(payload: { nonce: string; next: string }): string {
  const json = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signing in…</title>
<style>
:root{color-scheme:dark;}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;background:#09090b;color:#a1a1aa;font-family:ui-sans-serif,system-ui,sans-serif;}
.spinner{width:2.25rem;height:2.25rem;color:#34d399;animation:om-spin 1s linear infinite;}
@keyframes om-spin{to{transform:rotate(360deg);}}
#m{margin:0;font-size:.875rem;line-height:1.25rem;}
</style>
</head>
<body>
<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
<p id="m">Completing sign-in…</p>
<script type="application/json" id="om">${json}</script>
<script>
(function(){
  try {
    var el = document.getElementById("om");
    var d = JSON.parse(el.textContent);
    fetch("/api/auth/session-handoff", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ nonce: d.nonce }),
      cache: "no-store",
    }).then(function (r) {
      if (r.status === 204) {
        var next = typeof d.next === "string" && d.next.indexOf("/") === 0 ? d.next : "/";
        window.location.replace(next);
        return;
      }
      return r.json().then(function (j) {
        var err = (j && j.error) || "session_handoff_" + r.status;
        window.location.replace("/login?oauth_error=" + encodeURIComponent(String(err)));
      });
    }).catch(function () {
      window.location.replace("/login?oauth_error=" + encodeURIComponent("session_handoff_network"));
    });
  } catch (e) {
    window.location.replace("/login?oauth_error=" + encodeURIComponent("session_handoff_script"));
  }
})();
</script>
</body>
</html>`;
}
