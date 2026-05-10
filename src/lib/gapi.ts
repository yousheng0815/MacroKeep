/**
 * Google auth via **Google Identity Services** (GIS) OAuth 2.0 token client.
 * `gapi.auth2` is deprecated; new OAuth clients must use GIS — see
 * https://developers.google.com/identity/gsi/web/guides/gis-migration
 */

import { isoBirthDateFromParts } from "@/lib/birth-date";
import {
  clearPersistedOAuth,
  loadPersistedOAuth,
  savePersistedOAuth,
} from "@/lib/oauth-session-storage";
import type {
  GoogleOAuth2TokenErrorDetail,
  GoogleOAuth2TokenResponse,
} from "@/types/google-gsi";

/** Private Drive app folder scope. */
export const DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata" as const;

const GOOGLE_USER_BIRTHDAY_READ =
  "https://www.googleapis.com/auth/user.birthday.read" as const;

/** OIDC + People (birthday) for profile-backed defaults. */
const GIS_SCOPES = [
  DRIVE_APPDATA_SCOPE,
  "openid",
  "email",
  "profile",
  GOOGLE_USER_BIRTHDAY_READ,
].join(" ");

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GIS_SCRIPT_ID = "google-gsi-client";

let scriptPromise: Promise<void> | null = null;

let accessToken: string | null = null;
/** Epoch ms; token treated invalid at or after this time (includes skew). */
let accessValidUntilMs = 0;
let lastGrantedScopeRaw = "";
let cachedUserSub: string | null = null;
let cachedUserEmail: string | null = null;
/** Primary birthday from People API (`YYYY-MM-DD`), when Google exposes year+date. */
let cachedGoogleBirthDate: string | null = null;

const EXPIRY_SKEW_MS = 60_000;

export function getGoogleClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
  return id.trim();
}

/** True when GIS is usable — avoids `await` before `requestAccessToken` (popup blocker). */
export function isGisOAuthReady(): boolean {
  return typeof window !== "undefined" && !!window.google?.accounts?.oauth2;
}

export function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Identity Services script failed")),
        { once: true },
      );
      return;
    }

    const s = document.createElement("script");
    s.id = GIS_SCRIPT_ID;
    s.src = GIS_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });

  return scriptPromise;
}

function notifyOAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("openmacro:oauth-changed"));
}

function applyTokenResponse(resp: GoogleOAuth2TokenResponse): void {
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

/** Restore GIS session from localStorage after a previous visit. */
export async function restoreOAuthSessionFromStorage(): Promise<boolean> {
  const p = loadPersistedOAuth();
  if (!p) {
    clearSession();
    return false;
  }

  lastGrantedScopeRaw = p.scope ?? "";
  cachedUserSub = p.sub ?? null;
  cachedUserEmail = p.email ?? null;

  const tokenOk =
    !!p.accessToken &&
    p.expiresAtMs > 0 &&
    Date.now() < p.expiresAtMs;

  if (tokenOk && p.accessToken) {
    accessToken = p.accessToken;
    accessValidUntilMs = p.expiresAtMs;
    try {
      await Promise.all([
        hydrateUserFromGoogle(p.accessToken),
        hydrateBirthdayFromPeople(p.accessToken),
        hydrateScopesFromToken(p.accessToken),
      ]);
    } catch {
      accessToken = null;
      accessValidUntilMs = 0;
    }
  } else {
    accessToken = null;
    accessValidUntilMs = 0;
  }

  persistOAuthSnapshot();
  notifyOAuthChanged();
  return hasValidGoogleAccessToken();
}

export type GoogleSignInOptions = {
  promptConsent?: boolean;
};

function tokenClientSignIn(
  clientId: string,
  opts?: GoogleSignInOptions,
): Promise<void> {
  const googleAccounts = window.google?.accounts?.oauth2;
  if (!googleAccounts) {
    return Promise.reject(new Error("Google Identity Services not loaded"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finishError = (message: string): void => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };
    const finishOk = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const client = googleAccounts.initTokenClient({
      client_id: clientId,
      scope: GIS_SCOPES,
      /**
       * GIS defaults to `select_account`, which re-shows the account picker on every
       * `requestAccessToken()` — bad UX. Empty string = prompt only on first access.
       */
      prompt: "",
      callback: async (resp: GoogleOAuth2TokenResponse) => {
        if (resp.error) {
          finishError(
            resp.error_description?.trim() ||
              resp.error ||
              "OAuth token request failed",
          );
          return;
        }
        if (!resp.access_token) {
          finishError("No access token returned");
          return;
        }
        try {
          applyTokenResponse(resp);
          await Promise.all([
            hydrateUserFromGoogle(resp.access_token),
            hydrateBirthdayFromPeople(resp.access_token),
            hydrateScopesFromToken(resp.access_token),
          ]);
          persistOAuthSnapshot();
          finishOk();
        } catch (e) {
          finishError(e instanceof Error ? e.message : String(e));
        }
      },
      /** Closing the OAuth popup does not always invoke `callback`; GIS uses this instead. */
      error_callback: (detail: GoogleOAuth2TokenErrorDetail) => {
        const t = detail?.type ?? "unknown";
        if (t === "popup_closed") {
          finishError("popup_closed_by_user");
          return;
        }
        if (t === "popup_failed_to_open") {
          finishError("popup_failed_to_open");
          return;
        }
        finishError(`google_oauth_${t}`);
      },
    });

    if (opts?.promptConsent === true) {
      client.requestAccessToken({ prompt: "consent" });
    } else {
      client.requestAccessToken();
    }
  });
}

/**
 * Starts GIS OAuth in direct response to a user click — **do not await anything before this**.
 * Call only after {@link loadGisScript} / {@link isGisOAuthReady}.
 *
 * Note: We deliberately do NOT attempt non-gesture silent refresh
 * (`prompt: "none"`). GIS `oauth2.initTokenClient` opens a brief popup window
 * even for silent attempts, which the browser will block (and surface the
 * popup-blocked icon) when no user activation is present. Always route
 * renewals through this gesture-bound entry point.
 */
export function requestGoogleAccessTokenFromUserGesture(
  clientId: string,
  opts?: GoogleSignInOptions,
): Promise<void> {
  return tokenClientSignIn(clientId, opts);
}

export async function signInGoogle(
  clientId: string,
  opts?: GoogleSignInOptions,
): Promise<void> {
  await loadGisScript();
  await tokenClientSignIn(clientId, opts);
}

export async function signOutGoogle(): Promise<void> {
  const token = accessToken;
  clearSession();
  try {
    await loadGisScript();
    if (token && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(token, () => {});
    }
  } catch {
    /* ignore */
  }
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
