/**
 * Google OAuth hints (identity + optional cached access token) for local UX.
 * Refresh tokens live on the server; diary/profile/Gemini key live in Drive.
 */

const STORAGE_KEY = "openmacro:oauth:v1";

/** v2 allows identity without a live access token (token expired — user reconnects). */
export type PersistedOAuthPayload = {
  v: 2;
  accessToken?: string;
  /** Epoch ms while token valid; 0 when only identity is persisted. */
  expiresAtMs: number;
  scope?: string;
  sub?: string;
  email?: string;
};

function normalizePersistedPayload(raw: unknown): PersistedOAuthPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  if (
    p.v === 1 &&
    typeof p.accessToken === "string" &&
    typeof p.expiresAtMs === "number"
  ) {
    return {
      v: 2,
      accessToken: p.accessToken,
      expiresAtMs: p.expiresAtMs,
      scope: typeof p.scope === "string" ? p.scope : undefined,
      sub: typeof p.sub === "string" ? p.sub : undefined,
      email: typeof p.email === "string" ? p.email : undefined,
    };
  }

  if (p.v !== 2 || typeof p.expiresAtMs !== "number") return null;
  if (p.accessToken !== undefined && typeof p.accessToken !== "string") {
    return null;
  }
  return {
    v: 2,
    accessToken: typeof p.accessToken === "string" ? p.accessToken : undefined,
    expiresAtMs: p.expiresAtMs,
    scope: typeof p.scope === "string" ? p.scope : undefined,
    sub: typeof p.sub === "string" ? p.sub : undefined,
    email: typeof p.email === "string" ? p.email : undefined,
  };
}

export function loadPersistedOAuth(): PersistedOAuthPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizePersistedPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePersistedOAuth(payload: PersistedOAuthPayload): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearPersistedOAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Removes legacy diary/Gemini keys; keeps {@link STORAGE_KEY} only. */
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
