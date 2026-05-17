import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  absoluteSitePath,
  OAUTH_NEXT_COOKIE,
  OAUTH_RT_FALLBACK_COOKIE,
  OAUTH_STATE_COOKIE,
  oauthRedirectUri,
} from "../../../server/oauth/config.js";
import {
  appendSetCookie,
  cookieClear,
  parseCookies,
  safeNextPath,
} from "../../../server/oauth/cookies.js";
import { exchangeAuthorizationCode } from "../../../server/oauth/google-token.js";
import { fetchGoogleProfile } from "../../../server/oauth/google-profile.js";
import { oauthSuccessHtml } from "../../../server/oauth/oauth-complete-html.js";

const DEFAULT_GRANTED_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata openid email profile";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const cookies = parseCookies(req.headers.cookie);

  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const storedState = cookies[OAUTH_STATE_COOKIE] ?? "";
    const next = safeNextPath(cookies[OAUTH_NEXT_COOKIE]);

    if (!code || !state || state !== storedState) {
      throw new Error("Invalid OAuth state");
    }

    appendSetCookie(res, cookieClear(OAUTH_STATE_COOKIE));
    appendSetCookie(res, cookieClear(OAUTH_NEXT_COOKIE));
    appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));

    const tokenPack = await exchangeAuthorizationCode(code, oauthRedirectUri(req));
    const profile = await fetchGoogleProfile(tokenPack.access_token);
    const scope = tokenPack.scope ?? DEFAULT_GRANTED_SCOPE;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(
      oauthSuccessHtml({
        next,
        access_token: tokenPack.access_token,
        expires_in: tokenPack.expires_in,
        scope,
        refresh_token: tokenPack.refresh_token,
        sub: profile.sub,
        email: profile.email,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_callback_failed";
    appendSetCookie(res, cookieClear(OAUTH_STATE_COOKIE));
    appendSetCookie(res, cookieClear(OAUTH_NEXT_COOKIE));
    appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));
    res.redirect(
      302,
      absoluteSitePath(req, `/login?oauth_error=${encodeURIComponent(msg)}`),
    );
  }
}
