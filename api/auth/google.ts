import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  absoluteSitePath,
  GOOGLE_OAUTH_SCOPES,
  OAUTH_NEXT_COOKIE,
  OAUTH_RT_FALLBACK_COOKIE,
  OAUTH_STATE_COOKIE,
  oauthRedirectUri,
  requireEnv,
} from "../../server/oauth/config.js";
import {
  appendSetCookie,
  cookieClear,
  cookieSession,
  safeNextPath,
} from "../../server/oauth/cookies.js";
import crypto from "node:crypto";

function wantsJson(req: VercelRequest): boolean {
  if (req.query.format === "json") return true;
  const a = req.headers.accept;
  return typeof a === "string" && a.includes("application/json");
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  const jsonClient = wantsJson(req);

  try {
    const clientId = requireEnv("GOOGLE_OAUTH_CLIENT_ID");
    const state = crypto.randomBytes(24).toString("hex");
    const nextRaw =
      typeof req.query.next === "string" ? req.query.next : undefined;
    const next = safeNextPath(nextRaw);
    const promptConsent =
      typeof req.query.prompt_consent === "string" &&
      req.query.prompt_consent === "1";

    if (!promptConsent) {
      appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));
    }

    appendSetCookie(res, cookieSession(OAUTH_STATE_COOKIE, state, 600));
    appendSetCookie(res, cookieSession(OAUTH_NEXT_COOKIE, next, 600));

    const redirectUri = oauthRedirectUri(req);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_OAUTH_SCOPES,
      access_type: "offline",
      include_granted_scopes: "true",
      state,
    });
    if (promptConsent || jsonClient) {
      params.set("prompt", "consent");
    }

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    if (jsonClient) {
      res.status(200).json({ url });
      return;
    }
    res.redirect(302, url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_start_failed";
    if (jsonClient) {
      res.status(500).json({ error: msg });
      return;
    }
    res.redirect(
      302,
      absoluteSitePath(req, `/login?oauth_error=${encodeURIComponent(msg)}`),
    );
  }
}
