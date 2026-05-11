/** Server OAuth + Firestore refresh tokens; access tokens via `/api/google/access-token`. */

import { isoBirthDateFromParts } from "@/lib/birth-date";
import {
  clearPersistedOAuth,
  loadPersistedOAuth,
  savePersistedOAuth,
} from "@/lib/oauth-session-storage";

type AccessTokenPayload = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
};

/** Private Drive app folder scope. */
export const DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata" as const;

let accessToken: string | null = null;
/** Epoch ms; token treated invalid at or after this time (includes skew). */
let accessValidUntilMs = 0;
let lastGrantedScopeRaw = "";
let cachedUserSub: string | null = null;
let cachedUserEmail: string | null = null;
/** Primary birthday from People API (`YYYY-MM-DD`), when Google exposes year+date. */
let cachedGoogleBirthDate: string | null = null;

const EXPIRY_SKEW_MS = 60_000;

let brokerAccessTokenRefresh: Promise<string | null> | null = null;

function notifyOAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("openmacro:oauth-changed"));
}

function applyTokenResponse(resp: AccessTokenPayload): void {
  if (!resp.access_token) return;
  accessToken = resp.access_token;
  const ttlSec = resp.expires_in ?? 3600;
  accessValidUntilMs = Date.now() + ttlSec * 1000 - EXPIRY_SKEW_MS;
  if (resp.scope && resp.scope.length > 0) lastGrantedScopeRaw = resp.scope;
  notifyOAuthChanged();
}

async function hydrateUserFromGoogle(token: string): Promise<void> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { sub?: string; email?: string };
    if (typeof data.sub === "string" && data.sub.length > 0) {
      cachedUserSub = data.sub;
    }
    if (typeof data.email === "string" && data.email.length > 0) {
      cachedUserEmail = data.email;
    }
  } catch {
    /* userinfo optional for Drive */
  }
}

type PeopleBirthdayEntry = {
  metadata?: { primary?: boolean };
  date?: { year?: number; month?: number; day?: number };
};

async function hydrateBirthdayFromPeople(token: string): Promise<void> {
  try {
    const url = new URL("https://people.googleapis.com/v1/people/me");
    url.searchParams.set("personFields", "birthdays");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { birthdays?: PeopleBirthdayEntry[] };
    const birthdays = data.birthdays;
    if (!Array.isArray(birthdays) || birthdays.length === 0) {
      cachedGoogleBirthDate = null;
      return;
    }
    const chosen =
      birthdays.find((b) => b.metadata?.primary === true) ?? birthdays[0];
    const date = chosen?.date;
    if (!date || typeof date.year !== "number") {
      cachedGoogleBirthDate = null;
      return;
    }
    const iso = isoBirthDateFromParts(
      date.year,
      typeof date.month === "number" ? date.month : 1,
      typeof date.day === "number" ? date.day : 1,
    );
    cachedGoogleBirthDate = iso;
  } catch {
    /* People API optional */
  }
}

async function hydrateScopesFromToken(token: string): Promise<void> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as { scope?: string };
    if (typeof data.scope === "string" && data.scope.length > 0) {
      lastGrantedScopeRaw = data.scope;
    }
  } catch {
    /* ignore */
  }
}

function clearSession(): void {
  accessToken = null;
  accessValidUntilMs = 0;
  lastGrantedScopeRaw = "";
  cachedUserSub = null;
  cachedUserEmail = null;
  cachedGoogleBirthDate = null;
  clearPersistedOAuth();
  notifyOAuthChanged();
}

function persistOAuthSnapshot(): void {
  const token = accessToken;
  const exp = accessValidUntilMs;
  const hasIdentity =
    !!cachedUserSub || !!cachedUserEmail || !!lastGrantedScopeRaw;

  if (token && Date.now() < exp) {
    savePersistedOAuth({
      v: 2,
      accessToken: token,
      expiresAtMs: exp,
      scope: lastGrantedScopeRaw || undefined,
      sub: cachedUserSub ?? undefined,
      email: cachedUserEmail ?? undefined,
    });
    return;
  }

  if (hasIdentity) {
    savePersistedOAuth({
      v: 2,
      expiresAtMs: 0,
      scope: lastGrantedScopeRaw || undefined,
      sub: cachedUserSub ?? undefined,
      email: cachedUserEmail ?? undefined,
    });
    return;
  }

  clearPersistedOAuth();
}

/** True while the in-memory access token is within its validity window (no side effects). */
export function hasValidGoogleAccessToken(): boolean {
  return !!accessToken && Date.now() < accessValidUntilMs;
}

/** Signed in for UX: valid token or remembered Google account from storage. */
export function hasGoogleSession(): boolean {
  return (
    hasValidGoogleAccessToken() ||
    !!cachedUserSub ||
    !!cachedUserEmail
  );
}

async function fetchSessionFromBroker(): Promise<boolean> {
  const p = loadPersistedOAuth();
  if (p) {
    lastGrantedScopeRaw = p.scope ?? "";
    cachedUserSub = p.sub ?? null;
    cachedUserEmail = p.email ?? null;
  } else {
    lastGrantedScopeRaw = "";
    cachedUserSub = null;
    cachedUserEmail = null;
    accessToken = null;
    accessValidUntilMs = 0;
  }

  try {
    const res = await fetch("/api/google/access-token", {
      credentials: "include",
    });
    if (!res.ok) {
      accessToken = null;
      accessValidUntilMs = 0;
      persistOAuthSnapshot();
      notifyOAuthChanged();
      return false;
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      scope?: string;
    };
    applyTokenResponse(data);
    await Promise.all([
      hydrateUserFromGoogle(data.access_token),
      hydrateBirthdayFromPeople(data.access_token),
      data.scope ? Promise.resolve() : hydrateScopesFromToken(data.access_token),
    ]);
    if (data.scope) lastGrantedScopeRaw = data.scope;
    persistOAuthSnapshot();
    notifyOAuthChanged();
    return true;
  } catch {
    accessToken = null;
    accessValidUntilMs = 0;
    persistOAuthSnapshot();
    notifyOAuthChanged();
    return false;
  }
}

/** Restore session from cookie-backed broker + localStorage hints after navigation. */
export async function restoreOAuthSessionFromStorage(): Promise<boolean> {
  return fetchSessionFromBroker();
}

export type GoogleSignInOptions = {
  promptConsent?: boolean;
  /** Return path after OAuth (must start with `/`). Defaults to current URL. */
  nextPath?: string;
};

export async function signOutGoogle(): Promise<void> {
  try {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    /* ignore */
  }
  clearSession();
}

export function getAccessToken(): string | null {
  if (!accessToken) return null;
  if (Date.now() >= accessValidUntilMs) {
    accessToken = null;
    accessValidUntilMs = 0;
    persistOAuthSnapshot();
    notifyOAuthChanged();
    return null;
  }
  return accessToken;
}

/** Returns a valid access token, refreshing via `/api/google/access-token` when needed. */
export async function ensureGoogleAccessToken(): Promise<string | null> {
  const existing = getAccessToken();
  if (existing) return existing;

  if (!brokerAccessTokenRefresh) {
    const run = async (): Promise<string | null> => {
      try {
        const res = await fetch("/api/google/access-token", {
          credentials: "include",
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          access_token: string;
          expires_in: number;
          scope?: string;
        };
        applyTokenResponse(data);
        await Promise.all([
          hydrateUserFromGoogle(data.access_token),
          hydrateBirthdayFromPeople(data.access_token),
          data.scope
            ? Promise.resolve()
            : hydrateScopesFromToken(data.access_token),
        ]);
        if (data.scope) lastGrantedScopeRaw = data.scope;
        persistOAuthSnapshot();
        notifyOAuthChanged();
        return getAccessToken();
      } catch {
        return null;
      }
    };
    brokerAccessTokenRefresh = run().finally(() => {
      brokerAccessTokenRefresh = null;
    });
  }
  return brokerAccessTokenRefresh;
}

/** JSON `fetch` to `/api/auth/google` then redirect to Google (avoids navigating to `/api/…` as a document). */
export async function startGoogleOAuthRedirect(
  opts?: GoogleSignInOptions,
): Promise<void> {
  const rawPath =
    opts?.nextPath ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/");
  const path = rawPath.startsWith("/") ? rawPath : "/";
  const next = encodeURIComponent(path || "/");
  const qs = new URLSearchParams({ next, format: "json" });
  if (opts?.promptConsent) qs.set("prompt_consent", "1");
  try {
    const res = await fetch(`/api/auth/google?${qs}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      let msg = `oauth_start_http_${res.status}`;
      try {
        const j = (await res.json()) as { error?: string };
        if (typeof j.error === "string" && j.error.length > 0) msg = j.error;
      } catch {
        /* ignore */
      }
      window.location.assign(`/login?oauth_error=${encodeURIComponent(msg)}`);
      return;
    }
    const data = (await res.json()) as { url?: string };
    if (typeof data.url !== "string" || data.url.length === 0) {
      window.location.assign(
        `/login?oauth_error=${encodeURIComponent("missing_auth_url")}`,
      );
      return;
    }
    window.location.assign(data.url);
  } catch {
    window.location.assign(
      `/login?oauth_error=${encodeURIComponent("oauth_start_network")}`,
    );
  }
}

export function isSignedInGoogle(): boolean {
  return hasGoogleSession();
}

function grantedScopesIncludeDriveAppData(granted: string): boolean {
  const parts = granted.split(/\s+/).filter(Boolean);
  return parts.some(
    (s) => s === DRIVE_APPDATA_SCOPE || s.endsWith("/auth/drive.appdata"),
  );
}

export function hasDriveAppDataScope(): boolean {
  if (hasValidGoogleAccessToken()) {
    if (!lastGrantedScopeRaw) return true;
    return grantedScopesIncludeDriveAppData(lastGrantedScopeRaw);
  }
  /** Persisted consent uses scope text; identity may be email-only on older saves. */
  if (!cachedUserSub && !cachedUserEmail) return false;
  if (!lastGrantedScopeRaw) return false;
  return grantedScopesIncludeDriveAppData(lastGrantedScopeRaw);
}

export function canSyncToDriveAppData(): boolean {
  if (!hasValidGoogleAccessToken()) return false;
  if (!lastGrantedScopeRaw) return true;
  return grantedScopesIncludeDriveAppData(lastGrantedScopeRaw);
}

export function getGoogleUserEmail(): string | null {
  return cachedUserEmail;
}

export function getGoogleUserId(): string | null {
  return cachedUserSub;
}

/** Last primary birthday fetched via People API (requires `user.birthday.read`). */
export function getGoogleProfileBirthDate(): string | null {
  return cachedGoogleBirthDate;
}

/**
 * Loads the signed-in user's birthday from Google People (if permitted and present).
 * Updates the in-memory cache returned by {@link getGoogleProfileBirthDate}.
 */
export async function fetchGoogleProfileBirthDate(token: string): Promise<string | null> {
  await hydrateBirthdayFromPeople(token);
  return cachedGoogleBirthDate;
}
