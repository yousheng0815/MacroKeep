import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SESSION_COOKIE, requireEnv } from "../../server/oauth/config.js";
import { parseCookies } from "../../server/oauth/cookies.js";
import { refreshAccessToken } from "../../server/oauth/google-token.js";
import {
  decryptRefreshToken,
  decryptToken,
} from "../../server/oauth/token-crypto.js";
import { getOAuthSession } from "../../server/oauth/session-store.js";

const EXPIRY_SKEW_MS = 60_000;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const cookies = parseCookies(req.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    if (!sessionId) {
      res.status(401).json({ error: "no_session" });
      return;
    }

    const row = await getOAuthSession(sessionId);
    if (!row) {
      res.status(401).json({ error: "session_not_found" });
      return;
    }

    const key = requireEnv("TOKEN_ENCRYPTION_KEY");
    if (row.encryptedRefreshToken) {
      const refreshToken = decryptRefreshToken(row.encryptedRefreshToken, key);
      const tok = await refreshAccessToken(refreshToken);

      res.status(200).json({
        access_token: tok.access_token,
        expires_in: tok.expires_in,
        scope: tok.scope ?? row.scope,
        token_type: tok.token_type ?? "Bearer",
      });
      return;
    }

    if (
      row.encryptedAccessToken &&
      typeof row.accessTokenExpiresAtMs === "number" &&
      row.accessTokenExpiresAtMs > Date.now() + EXPIRY_SKEW_MS
    ) {
      res.status(200).json({
        access_token: decryptToken(row.encryptedAccessToken, key),
        expires_in: Math.max(
          1,
          Math.floor((row.accessTokenExpiresAtMs - Date.now()) / 1000),
        ),
        scope: row.scope,
        token_type: "Bearer",
      });
      return;
    }

    res.status(401).json({ error: "session_access_token_expired" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh_failed";
    res.status(401).json({ error: msg });
  }
}
