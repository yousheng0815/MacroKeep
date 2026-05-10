import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  OAUTH_RT_FALLBACK_COOKIE,
  SESSION_COOKIE,
} from "../../server/oauth/config.js";
import {
  appendSetCookie,
  cookieClear,
  cookiePersistedSession,
} from "../../server/oauth/cookies.js";
import { consumeSessionHandoff } from "../../server/oauth/session-store.js";

function parseJsonBody(req: VercelRequest): { nonce?: string } {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) {
    return b as { nonce?: string };
  }
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as { nonce?: string };
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString("utf8")) as { nonce?: string };
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
    const { nonce } = parseJsonBody(req);
    if (typeof nonce !== "string" || nonce.length === 0) {
      res.status(400).json({ error: "missing_nonce" });
      return;
    }

    const sessionId = await consumeSessionHandoff(nonce);
    if (!sessionId) {
      res.status(410).json({ error: "invalid_or_expired_handoff" });
      return;
    }

    appendSetCookie(
      res,
      cookiePersistedSession(SESSION_COOKIE, sessionId, 31536000),
    );
    appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));
    res.status(204).end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "handoff_failed";
    res.status(500).json({ error: msg });
  }
}
