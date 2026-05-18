import { requireBinding, type OAuthBindings } from "../bindings.js";
import {
  absoluteSitePath,
  GOOGLE_OAUTH_SCOPES,
  isSecureRequest,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  oauthRedirectUri,
} from "../config.js";
import { cookieSession, safeNextPath } from "../cookies.js";
import { randomHex } from "../random.js";
import { noStore, withSetCookies } from "../response.js";

function wantsJson(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "json") return true;
  const accept = request.headers.get("accept");
  return accept?.includes("application/json") ?? false;
}

export function handleAuthGoogle(
  request: Request,
  env: OAuthBindings,
): Response {
  const jsonClient = wantsJson(request);
  const secure = isSecureRequest(request);

  try {
    const clientId = requireBinding(env, "GOOGLE_OAUTH_CLIENT_ID");
    const state = randomHex(24);
    const url = new URL(request.url);
    const next = safeNextPath(url.searchParams.get("next"));
    const promptConsent = url.searchParams.get("prompt_consent") === "1";

    const redirectUri = oauthRedirectUri(env, request);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_OAUTH_SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      state,
    });
    if (promptConsent) {
      params.set("prompt", "consent");
    }

    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    const cookies = [
      cookieSession(OAUTH_STATE_COOKIE, state, 600, secure),
      cookieSession(OAUTH_NEXT_COOKIE, next, 600, secure),
    ];

    if (jsonClient) {
      return noStore(
        withSetCookies(
          Response.json({ url: googleUrl }),
          cookies,
        ),
      );
    }

    return noStore(
      withSetCookies(Response.redirect(googleUrl, 302), cookies),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_start_failed";
    if (jsonClient) {
      return noStore(Response.json({ error: msg }, { status: 500 }));
    }
    return noStore(
      Response.redirect(
        absoluteSitePath(
          env,
          request,
          `/login?oauth_error=${encodeURIComponent(msg)}`,
        ),
        302,
      ),
    );
  }
}
