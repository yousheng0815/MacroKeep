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
  parseCookies,
  safeNextPath,
} from "../../../server/oauth/cookies.js";
import { exchangeAuthorizationCode } from "../../../server/oauth/google-token.js";
import { fetchGoogleProfile } from "../../../server/oauth/google-profile.js";
import {
  encryptRefreshToken,
  encryptToken,
} from "../../../server/oauth/token-crypto.js";
import {
  findOAuthSessionByGoogleSub,
  saveOAuthSession,
  saveSessionHandoff,
} from "../../../server/oauth/session-store.js";
import { oauthSuccessHtml } from "../../../server/oauth/oauth-complete-html.js";
import crypto from "node:crypto";

const DEFAULT_GRANTED_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata openid email profile";
const EXPIRY_SKEW_MS = 60_000;

function scopeIncludesDriveAppData(scope: string): boolean {
  return scope
    .split(/\s+/)
    .some(
      (s) =>
        s === "https://www.googleapis.com/auth/drive.appdata" ||
        s.endsWith("/auth/drive.appdata"),
    );
}

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
    const profile = await fetchGoogleProfile(tokenPack.access_token);
    const scope = tokenPack.scope ?? DEFAULT_GRANTED_SCOPE;

    if (!refreshToken) {
      const reusable = await findOAuthSessionByGoogleSub(profile.sub);
      if (
        reusable?.encryptedRefreshToken &&
        scopeIncludesDriveAppData(reusable.scope)
      ) {
        appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));
        const handoffNonce = crypto.randomBytes(24).toString("hex");
        await saveSessionHandoff(handoffNonce, reusable.sessionId);

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.status(200).send(
          oauthSuccessHtml({ nonce: handoffNonce, next }),
        );
        return;
      }

      const encryptionKey = requireEnv("TOKEN_ENCRYPTION_KEY");
      const sessionId = crypto.randomUUID();
      await saveOAuthSession(sessionId, {
        encryptedAccessToken: encryptToken(tokenPack.access_token, encryptionKey),
        accessTokenExpiresAtMs:
          Date.now() + tokenPack.expires_in * 1000 - EXPIRY_SKEW_MS,
        googleSub: profile.sub,
        email: profile.email,
        scope,
      });

      appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));
      const handoffNonce = crypto.randomBytes(24).toString("hex");
      await saveSessionHandoff(handoffNonce, sessionId);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(
        oauthSuccessHtml({ nonce: handoffNonce, next }),
      );
      return;
    }

    appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));

    const encryptionKey = requireEnv("TOKEN_ENCRYPTION_KEY");
    const encryptedRefreshToken = encryptRefreshToken(
      refreshToken,
      encryptionKey,
    );

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
