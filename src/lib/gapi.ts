/**
 * Google auth via **Google Identity Services** (GIS) OAuth 2.0 token client.
 * `gapi.auth2` is deprecated; new OAuth clients must use GIS — see
 * https://developers.google.com/identity/gsi/web/guides/gis-migration
 */

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

/** OIDC scopes so we can read stable `sub` + email from userinfo. */
const GIS_SCOPES = [
  DRIVE_APPDATA_SCOPE,
  "openid",
  "email",
  "profile",
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

const EXPIRY_SKEW_MS = 60_000;

/** Fire ~2 min before access token expiry to renew without user interaction when possible. */
const PROACTIVE_REFRESH_BEFORE_MS = 120_000;

/** Timer id (`window.setTimeout`); typed as `number` to avoid Node `Timeout` augmentation clashes. */
let proactiveRefreshTimer: number | null = null;
let silentRefreshPromise: Promise<boolean> | null = null;

function clearProactiveRefreshTimer(): void {
  if (proactiveRefreshTimer !== null) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

function scheduleProactiveAccessTokenRefresh(): void {
  clearProactiveRefreshTimer();
  const cid = getGoogleClientId();
  if (!cid || !accessToken || accessValidUntilMs <= 0) return;
  const delay =
    accessValidUntilMs - Date.now() - PROACTIVE_REFRESH_BEFORE_MS;
  /** Minimum delay avoids tight loops if expiry already passed skew window. */
  const ms = Math.min(Math.max(delay, 15_000), 86_400_000);
  proactiveRefreshTimer = window.setTimeout(() => {
    proactiveRefreshTimer = null;
    void renewGoogleAccessTokenSilentlyProactive(cid).finally(() => {
      /** Timer cleared after fire; reschedule if token still valid but renewal failed or skipped. */
      if (hasValidGoogleAccessToken() && proactiveRefreshTimer === null) {
        scheduleProactiveAccessTokenRefresh();
      }
    });
  }, ms);
}

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
  scheduleProactiveAccessTokenRefresh();
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
  clearProactiveRefreshTimer();
  accessToken = null;
  accessValidUntilMs = 0;
  lastGrantedScopeRaw = "";
  cachedUserSub = null;
  cachedUserEmail = null;
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
  if (hasValidGoogleAccessToken()) scheduleProactiveAccessTokenRefresh();
  return hasValidGoogleAccessToken();
}

export type GoogleSignInOptions = {
  promptConsent?: boolean;
  /** GIS `prompt: none` — no popup when Google already has a session + prior consent. */
  silent?: boolean;
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
    if (opts?.silent === true) {
      const hint = cachedUserEmail ?? cachedUserSub;
      if (!hint) {
        reject(new Error("Silent token refresh requires a saved Google account hint"));
        return;
      }
    }

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
    } else if (opts?.silent === true) {
      const hint = cachedUserEmail ?? cachedUserSub!;
      client.requestAccessToken({ prompt: "none", login_hint: hint });
    } else {
      client.requestAccessToken();
    }
  });
}

/**
 * Obtains a new access token without showing consent/account UI when Google allows it.
 * Requires a stored email or `sub` from a prior sign-in.
 */
export function refreshGoogleAccessTokenSilently(clientId: string): Promise<boolean> {
  if (hasValidGoogleAccessToken()) return Promise.resolve(true);
  const hint = cachedUserEmail ?? cachedUserSub;
  if (!hint) return Promise.resolve(false);
  if (silentRefreshPromise) return silentRefreshPromise;

  silentRefreshPromise = (async (): Promise<boolean> => {
    try {
      await loadGisScript();
      await tokenClientSignIn(clientId, { silent: true });
      return hasValidGoogleAccessToken();
    } catch {
      return false;
    } finally {
      silentRefreshPromise = null;
    }
  })();

  return silentRefreshPromise;
}

/**
 * Renew via GIS `prompt: none` while the access token is still valid (~proactive timer).
 * Unlike {@link refreshGoogleAccessTokenSilently}, this does not no-op when a token exists —
 * the old proactive timer incorrectly returned early and never refreshed before expiry.
 */
function renewGoogleAccessTokenSilentlyProactive(
  clientId: string,
): Promise<boolean> {
  if (!accessToken || accessValidUntilMs <= 0) return Promise.resolve(false);
  const hint = cachedUserEmail ?? cachedUserSub;
  if (!hint) return Promise.resolve(false);
  if (silentRefreshPromise) return silentRefreshPromise;

  silentRefreshPromise = (async (): Promise<boolean> => {
    try {
      await loadGisScript();
      await tokenClientSignIn(clientId, { silent: true });
      return hasValidGoogleAccessToken();
    } catch {
      return false;
    } finally {
      silentRefreshPromise = null;
    }
  })();

  return silentRefreshPromise;
}

/**
 * Starts GIS OAuth in direct response to a user click — **do not await anything before this**.
 * Call only after {@link loadGisScript} / {@link isGisOAuthReady}.
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
    clearProactiveRefreshTimer();
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
