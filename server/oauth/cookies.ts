import type { VercelResponse } from "@vercel/node";

function secureFlag(): string {
  return process.env.VERCEL || process.env.NODE_ENV === "production"
    ? "; Secure"
    : "";
}

export function appendSetCookie(res: VercelResponse, cookie: string): void {
  if (typeof res.appendHeader === "function") {
    res.appendHeader("Set-Cookie", cookie);
    return;
  }
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, cookie]);
    return;
  }
  res.setHeader("Set-Cookie", [prev as string, cookie]);
}

export function cookieClear(name: string): string {
  return `${name}=; Path=/; HttpOnly${secureFlag()}; SameSite=Lax; Max-Age=0`;
}

export function cookieSession(name: string, value: string, maxAgeSec: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly${secureFlag()}; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

function useStrictCrossSiteSessionCookie(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

/** Session cookie: `SameSite=None; Secure` in production (cross-site redirect from Google). */
export function cookiePersistedSession(
  name: string,
  value: string,
  maxAgeSec: number,
): string {
  const enc = encodeURIComponent(value);
  if (useStrictCrossSiteSessionCookie()) {
    return `${name}=${enc}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSec}`;
  }
  return `${name}=${enc}; Path=/; HttpOnly${secureFlag()}; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

/** Clear cookie set via {@link cookiePersistedSession}. */
export function cookieClearPersistedSession(name: string): string {
  if (useStrictCrossSiteSessionCookie()) {
    return `${name}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
  }
  return `${name}=; Path=/; HttpOnly${secureFlag()}; SameSite=Lax; Max-Age=0`;
}

function normalizeCookieHeader(header: string | string[] | undefined): string {
  if (header == null) return "";
  if (Array.isArray(header)) return header.join("; ");
  return header;
}

export function parseCookies(
  header: string | string[] | undefined,
): Record<string, string> {
  const raw = normalizeCookieHeader(header);
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (!k) continue;
    let v = part.slice(idx + 1).trim();
    try {
      v = decodeURIComponent(v);
    } catch {
      /* malformed encoding — keep raw segment */
    }
    out[k] = v;
  }
  return out;
}

export function safeNextPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
