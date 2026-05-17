import type { IncomingHttpHeaders } from "node:http";

/** Same scopes as the SPA Drive client — see {@link src/lib/gapi.ts} `DRIVE_APPDATA_SCOPE` etc. */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata",
  "openid",
  "email",
  "profile",
].join(" ");

/** Cleared on sign-out. */
export const SESSION_COOKIE = "mk_session";
export const OAUTH_STATE_COOKIE = "mk_oauth_state";
export const OAUTH_NEXT_COOKIE = "mk_oauth_next";
/** Marks that we already retried OAuth once with prompt=consent for refresh_token. */
export const OAUTH_RT_FALLBACK_COOKIE = "mk_oauth_rt_fallback";

function forwardedFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return s.split(",")[0]?.trim();
}

function inferScheme(protoHeader: string | undefined, host: string): "http" | "https" {
  const p = forwardedFirst(protoHeader)?.toLowerCase();
  if (p === "http" || p === "https") return p;
  const h = host.toLowerCase();
  if (h === "localhost" || h.startsWith("localhost:")) return "http";
  if (h.startsWith("127.")) return "http";
  return "https";
}

/** OAuth redirects: `MK_SITE_ORIGIN` if set, else `Host`/`x-forwarded-*` from the request. */
export function siteOriginFromRequestHeaders(headers: IncomingHttpHeaders): string | null {
  const host =
    forwardedFirst(headers["x-forwarded-host"]) ??
    forwardedFirst(headers[":authority"]) ??
    forwardedFirst(headers.host);
  if (!host) return null;
  const scheme = inferScheme(forwardedFirst(headers["x-forwarded-proto"]), host);
  return `${scheme}://${host}`;
}

export type SiteOriginRequest = { headers: IncomingHttpHeaders };

export function getSiteOrigin(req?: SiteOriginRequest): string {
  const explicit = process.env.MK_SITE_ORIGIN?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  if (req) {
    const fromReq = siteOriginFromRequestHeaders(req.headers);
    if (fromReq) return fromReq;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function oauthRedirectUri(req?: SiteOriginRequest): string {
  return `${getSiteOrigin(req)}/api/auth/google/callback`;
}

export function absoluteSitePath(
  req: SiteOriginRequest,
  pathnameAndQuery: string,
): string {
  const path = pathnameAndQuery.startsWith("/")
    ? pathnameAndQuery
    : `/${pathnameAndQuery}`;
  return `${getSiteOrigin(req)}${path}`;
}

export function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
