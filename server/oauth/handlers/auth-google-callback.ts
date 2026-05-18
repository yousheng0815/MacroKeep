import type { OAuthBindings } from "../bindings.js";
import {
  absoluteSitePath,
  isSecureRequest,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  oauthRedirectUri,
} from "../config.js";
import { cookieClear, parseCookies, safeNextPath } from "../cookies.js";
import { exchangeAuthorizationCode } from "../google-token.js";
import { fetchGoogleProfile } from "../google-profile.js";
import { oauthSuccessHtml } from "../oauth-complete-html.js";
import { noStore, withSetCookies } from "../response.js";

const DEFAULT_GRANTED_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata openid email profile";

export async function handleAuthGoogleCallback(
  request: Request,
  env: OAuthBindings,
): Promise<Response> {
  const secure = isSecureRequest(request);
  const cookies = parseCookies(request.headers.get("cookie"));

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const storedState = cookies[OAUTH_STATE_COOKIE] ?? "";
    const next = safeNextPath(cookies[OAUTH_NEXT_COOKIE]);

    if (!code || !state || state !== storedState) {
      throw new Error("Invalid OAuth state");
    }

    const clearCookies = [
      cookieClear(OAUTH_STATE_COOKIE, secure),
      cookieClear(OAUTH_NEXT_COOKIE, secure),
    ];

    const tokenPack = await exchangeAuthorizationCode(
      env,
      code,
      oauthRedirectUri(env, request),
    );
    const profile = await fetchGoogleProfile(tokenPack.access_token);
    const scope = tokenPack.scope ?? DEFAULT_GRANTED_SCOPE;

    return noStore(
      withSetCookies(
        new Response(
          oauthSuccessHtml({
            next,
            access_token: tokenPack.access_token,
            expires_in: tokenPack.expires_in,
            scope,
            refresh_token: tokenPack.refresh_token,
            sub: profile.sub,
            email: profile.email,
          }),
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        ),
        clearCookies,
      ),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_callback_failed";
    const clearCookies = [
      cookieClear(OAUTH_STATE_COOKIE, secure),
      cookieClear(OAUTH_NEXT_COOKIE, secure),
    ];
    return noStore(
      withSetCookies(
        Response.redirect(
          absoluteSitePath(
            env,
            request,
            `/login?oauth_error=${encodeURIComponent(msg)}`,
          ),
          302,
        ),
        clearCookies,
      ),
    );
  }
}
