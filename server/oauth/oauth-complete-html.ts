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
body{font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;}
p{font-size:14px;opacity:.85;}
</style>
</head>
<body>
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
