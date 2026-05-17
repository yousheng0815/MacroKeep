/**
 * Google OAuth tokens + identity in localStorage.
 * Refresh tokens stay on the client; access tokens are refreshed via `/api/google/access-token`.
 */

export const OAUTH_STORAGE_KEY = "openmacro:oauth:v1";

/** v3 stores refresh token locally (no server session DB). */
export type PersistedOAuthPayload = {
  v: 3;
  refreshToken?: string;
  accessToken?: string;
  /** Epoch ms while access token valid; 0 when only identity/refresh is persisted. */
  expiresAtMs: number;
  scope?: string;
  sub?: string;
  email?: string;
};

function normalizePersistedPayload(raw: unknown): PersistedOAuthPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  if (p.v === 3 && typeof p.expiresAtMs === "number") {
    if (p.accessToken !== undefined && typeof p.accessToken !== "string") {
      return null;
    }
    if (p.refreshToken !== undefined && typeof p.refreshToken !== "string") {
      return null;
    }
    return {
      v: 3,
      refreshToken:
        typeof p.refreshToken === "string" ? p.refreshToken : undefined,
      accessToken:
        typeof p.accessToken === "string" ? p.accessToken : undefined,
      expiresAtMs: p.expiresAtMs,
      scope: typeof p.scope === "string" ? p.scope : undefined,
      sub: typeof p.sub === "string" ? p.sub : undefined,
      email: typeof p.email === "string" ? p.email : undefined,
    };
  }

  if (
    (p.v === 1 || p.v === 2) &&
    typeof p.expiresAtMs === "number"
  ) {
    return {
      v: 3,
      accessToken:
        typeof p.accessToken === "string" ? p.accessToken : undefined,
      expiresAtMs: p.expiresAtMs,
      scope: typeof p.scope === "string" ? p.scope : undefined,
      sub: typeof p.sub === "string" ? p.sub : undefined,
      email: typeof p.email === "string" ? p.email : undefined,
    };
  }

  return null;
}

export function loadPersistedOAuth(): PersistedOAuthPayload | null {
  try {
    const raw = localStorage.getItem(OAUTH_STORAGE_KEY);
    if (!raw) return null;
    return normalizePersistedPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePersistedOAuth(payload: PersistedOAuthPayload): void {
  localStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify(payload));
}

export function clearPersistedOAuth(): void {
  localStorage.removeItem(OAUTH_STORAGE_KEY);
}

/** Removes legacy diary/Gemini keys; keeps {@link OAUTH_STORAGE_KEY} only. */
export function purgeLegacyOpenMacroStorage(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === "openmacro:gemini_api_key") toRemove.push(k);
      else if (k.startsWith("openmacro:records:v1")) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
