import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  absoluteSitePath,
  OAUTH_NEXT_COOKIE,
  OAUTH_RT_FALLBACK_COOKIE,
  OAUTH_STATE_COOKIE,
  oauthRedirectUri,
  requireEnv,
} from "../../../server/oauth/config.js";
import {
  appendSetCookie,
  cookieClear,
  cookieSession,
  parseCookies,
  safeNextPath,
} from "../../../server/oauth/cookies.js";
import { exchangeAuthorizationCode } from "../../../server/oauth/google-token.js";
import { fetchGoogleProfile } from "../../../server/oauth/google-profile.js";
import { encryptRefreshToken } from "../../../server/oauth/token-crypto.js";
import {
  saveOAuthSession,
  saveSessionHandoff,
} from "../../../server/oauth/session-store.js";
import { oauthSuccessHtml } from "../../../server/oauth/oauth-complete-html.js";
import crypto from "node:crypto";

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

    const tokenPack = await exchangeAuthorizationCode(code, oauthRedirectUri(req));
    const refreshToken = tokenPack.refresh_token;

    if (!refreshToken) {
      if (cookies[OAUTH_RT_FALLBACK_COOKIE] === "1") {
        throw new Error(
          "Google did not return a refresh token. Remove OpenMacro in Google Account → Third-party access, then try again.",
        );
      }
      appendSetCookie(
        res,
        cookieSession(OAUTH_RT_FALLBACK_COOKIE, "1", 600),
      );
      res.redirect(
        302,
        absoluteSitePath(
          req,
          `/login?oauth_retry=1&prompt_consent=1&next=${encodeURIComponent(next)}`,
        ),
      );
      return;
    }

    appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));

    const profile = await fetchGoogleProfile(tokenPack.access_token);
    const encryptionKey = requireEnv("TOKEN_ENCRYPTION_KEY");
    const encryptedRefreshToken = encryptRefreshToken(
      refreshToken,
      encryptionKey,
    );

    const scope =
      tokenPack.scope ??
      "https://www.googleapis.com/auth/drive.appdata openid email profile";

    const sessionId = crypto.randomUUID();
    await saveOAuthSession(sessionId, {
      encryptedRefreshToken,
      googleSub: profile.sub,
      email: profile.email,
      scope,
    });

    const handoffNonce = crypto.randomBytes(24).toString("hex");
    await saveSessionHandoff(handoffNonce, sessionId);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(
      oauthSuccessHtml({ nonce: handoffNonce, next }),
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
