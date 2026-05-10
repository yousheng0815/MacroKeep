import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SESSION_COOKIE, requireEnv } from "../../server/oauth/config.js";
import { parseCookies } from "../../server/oauth/cookies.js";
import { refreshAccessToken } from "../../server/oauth/google-token.js";
import { decryptRefreshToken } from "../../server/oauth/token-crypto.js";
import { getOAuthSession } from "../../server/oauth/session-store.js";

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
    const refreshToken = decryptRefreshToken(row.encryptedRefreshToken, key);
    const tok = await refreshAccessToken(refreshToken);

    res.status(200).json({
      access_token: tok.access_token,
      expires_in: tok.expires_in,
      scope: tok.scope ?? row.scope,
      token_type: tok.token_type ?? "Bearer",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh_failed";
    res.status(401).json({ error: msg });
  }
}
