export function cookieClear(name: string, secure: boolean): string {
  return `${name}=; Path=/; HttpOnly${secure ? "; Secure" : ""}; SameSite=Lax; Max-Age=0`;
}

export function cookieSession(
  name: string,
  value: string,
  maxAgeSec: number,
  secure: boolean,
): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly${secure ? "; Secure" : ""}; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
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

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
