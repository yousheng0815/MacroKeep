import type { VercelRequest, VercelResponse } from "@vercel/node";
import { refreshAccessToken } from "../../server/oauth/google-token.js";

function parseJsonBody(req: VercelRequest): { refresh_token?: string } {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) {
    return b as { refresh_token?: string };
  }
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as { refresh_token?: string };
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString("utf8")) as { refresh_token?: string };
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const { refresh_token: refreshToken } = parseJsonBody(req);
    if (typeof refreshToken !== "string" || refreshToken.length === 0) {
      res.status(401).json({ error: "no_refresh_token" });
      return;
    }

    const tok = await refreshAccessToken(refreshToken);

    res.status(200).json({
      access_token: tok.access_token,
      expires_in: tok.expires_in,
      scope: tok.scope,
      token_type: tok.token_type ?? "Bearer",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh_failed";
    const lower = msg.toLowerCase();
    const invalid_grant =
      lower.includes("invalid_grant") ||
      lower.includes("token has been expired or revoked");
    res.status(401).json({ error: msg, invalid_grant });
  }
}
