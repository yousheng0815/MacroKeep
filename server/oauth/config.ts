import type { OAuthBindings } from "./bindings.js";

/** Same scopes as the SPA Drive client — see {@link src/lib/gapi.ts} `DRIVE_APPDATA_SCOPE` etc. */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata",
  "openid",
  "email",
  "profile",
].join(" ");

export const OAUTH_STATE_COOKIE = "mk_oauth_state";
export const OAUTH_NEXT_COOKIE = "mk_oauth_next";

function forwardedFirst(v: string | null): string | undefined {
  if (!v) return undefined;
  return v.split(",")[0]?.trim();
}

function inferScheme(protoHeader: string | undefined, host: string): "http" | "https" {
  const p = protoHeader?.toLowerCase();
  if (p === "http" || p === "https") return p;
  const h = host.toLowerCase();
  if (h === "localhost" || h.startsWith("localhost:")) return "http";
  if (h.startsWith("127.")) return "http";
  return "https";
}

function siteOriginFromHeaders(headers: Headers): string | null {
  const host =
    forwardedFirst(headers.get("x-forwarded-host")) ??
    forwardedFirst(headers.get("host"));
  if (!host) return null;
  const scheme = inferScheme(
    forwardedFirst(headers.get("x-forwarded-proto")),
    host,
  );
  return `${scheme}://${host}`;
}

export function getSiteOrigin(
  env: OAuthBindings,
  request?: Request,
): string {
  const explicit = env.MK_SITE_ORIGIN?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  if (request) {
    const fromReq = siteOriginFromHeaders(request.headers);
    if (fromReq) return fromReq;
  }
  return "http://localhost:8788";
}

export function oauthRedirectUri(
  env: OAuthBindings,
  request?: Request,
): string {
  return `${getSiteOrigin(env, request)}/api/auth/google/callback`;
}

export function absoluteSitePath(
  env: OAuthBindings,
  request: Request,
  pathnameAndQuery: string,
): string {
  const path = pathnameAndQuery.startsWith("/")
    ? pathnameAndQuery
    : `/${pathnameAndQuery}`;
  return `${getSiteOrigin(env, request)}${path}`;
}

export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === "https:";
}
