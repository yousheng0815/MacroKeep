import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  OAUTH_RT_FALLBACK_COOKIE,
  SESSION_COOKIE,
} from "../../server/oauth/config.js";
import {
  appendSetCookie,
  cookieClear,
  cookieClearPersistedSession,
} from "../../server/oauth/cookies.js";

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
    appendSetCookie(res, cookieClearPersistedSession(SESSION_COOKIE));
    appendSetCookie(res, cookieClear(OAUTH_RT_FALLBACK_COOKIE));

    res.status(204).end();
  } catch {
    appendSetCookie(res, cookieClearPersistedSession(SESSION_COOKIE));
    res.status(204).end();
  }
}
