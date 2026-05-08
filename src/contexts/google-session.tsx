import {
  getGoogleClientId,
  hasDriveAppDataScope as readHasDriveAppDataScope,
  hasGoogleSession,
  hasValidGoogleAccessToken,
  isGisOAuthReady,
  loadGisScript,
  refreshGoogleAccessTokenSilently,
  requestGoogleAccessTokenFromUserGesture,
  restoreOAuthSessionFromStorage,
  signOutGoogle,
  type GoogleSignInOptions,
} from "@/lib/gapi";
import { purgeLegacyOpenMacroStorage } from "@/lib/oauth-session-storage";
import { useNavigate } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

function formatSignInError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const rec = e as Record<string, unknown>;
    if (typeof rec.error === "string") return rec.error;
    if (typeof rec.details === "string") return rec.details;
  }
  return "Sign-in failed or was cancelled.";
}

export type GoogleSessionContextValue = {
  clientId: string;
  ready: boolean;
  signedIn: boolean;
  hasDriveAppDataScope: boolean;
  /** Trying GIS `prompt: none` after returning with an expired access token. */
  oauthSilentRefreshPending: boolean;
  sessionReady: boolean;
  error: string | null;
  signInPending: boolean;
  signIn: (opts?: GoogleSignInOptions) => void;
  signOut: () => Promise<void>;
  refresh: () => void;
};

const GoogleSessionContext = createContext<GoogleSessionContextValue | null>(
  null,
);

export function GoogleSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const clientId = useMemo(() => getGoogleClientId(), []);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [hasDriveAppDataScope, setHasDriveAppDataScope] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);
  /** Bumped when GIS token/identity changes so memoized context reflects module state (e.g. hourly expiry). */
  const [oauthEpoch, setOauthEpoch] = useState(0);
  const [oauthSilentRefreshPending, setOauthSilentRefreshPending] =
    useState(false);
  /** Bumped when the tab becomes visible again — retries GIS `prompt:none` after transient failures. */
  const [silentRetryGen, setSilentRetryGen] = useState(0);

  const refresh = useCallback(() => {
    setSignedIn(hasGoogleSession());
    setHasDriveAppDataScope(readHasDriveAppDataScope());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clientId) {
        setReady(true);
        setSignedIn(false);
        setHasDriveAppDataScope(false);
        return;
      }
      try {
        await loadGisScript();
        if (!cancelled) {
          purgeLegacyOpenMacroStorage();
          await restoreOAuthSessionFromStorage();
          refresh();
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Google init failed");
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, refresh]);

  useEffect(() => {
    const onOAuthChanged = () => {
      refresh();
      setOauthEpoch((n) => n + 1);
    };
    window.addEventListener("openmacro:oauth-changed", onOAuthChanged);
    return () =>
      window.removeEventListener("openmacro:oauth-changed", onOAuthChanged);
  }, [refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setSilentRetryGen((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!clientId || !ready || !isGisOAuthReady()) return;
    if (document.visibilityState !== "visible") return;
    if (!hasGoogleSession()) return;
    if (hasValidGoogleAccessToken()) return;
    if (!readHasDriveAppDataScope()) return;

    let cancelled = false;
    setOauthSilentRefreshPending(true);
    void refreshGoogleAccessTokenSilently(clientId).finally(() => {
      if (cancelled) return;
      refresh();
      setOauthSilentRefreshPending(false);
    });
    return () => {
      cancelled = true;
      setOauthSilentRefreshPending(false);
    };
  }, [clientId, ready, refresh, oauthEpoch, silentRetryGen]);

  const signIn = useCallback(
    (opts?: GoogleSignInOptions) => {
      if (!clientId) {
        setError("Add VITE_GOOGLE_CLIENT_ID to enable Google login.");
        return;
      }
      if (!ready || !isGisOAuthReady()) {
        setError(
          "Google Sign-In is still loading. Wait a moment and try again.",
        );
        return;
      }

      /**
       * GIS `requestAccessToken` must run synchronously inside the click/tap handler so the
       * browser treats it as a user gesture and allows the OAuth popup.
       */
      const oauthPromise = requestGoogleAccessTokenFromUserGesture(
        clientId,
        opts,
      );
      setError(null);
      setSignInPending(true);

      void oauthPromise
        .then(() => {
          refresh();
        })
        .catch((e: unknown) => {
          const msg = formatSignInError(e);
          const lower = msg.toLowerCase();
          if (
            lower.includes("popup_closed") ||
            lower.includes("closed_by_user") ||
            lower.includes("popup_failed_to_open") ||
            lower.includes("popup blocked") ||
            lower.includes("failed to open") ||
            lower.includes("access_denied")
          ) {
            setError(
              "The Google sign-in window was blocked or closed. Allow popups for this site, then tap the button again.",
            );
          } else {
            setError(msg);
          }
        })
        .finally(() => {
          setSignInPending(false);
          refresh();
        });
    },
    [clientId, ready, refresh],
  );

  const signOut = useCallback(async () => {
    setError(null);
    await signOutGoogle();
    refresh();
    navigate({ to: "/login", replace: true });
  }, [refresh, navigate]);

  const value = useMemo(
    (): GoogleSessionContextValue => ({
      clientId,
      ready,
      signedIn,
      hasDriveAppDataScope,
      oauthSilentRefreshPending,
      sessionReady:
        !!clientId &&
        ready &&
        hasGoogleSession() &&
        hasValidGoogleAccessToken() &&
        readHasDriveAppDataScope(),
      error,
      signInPending,
      signIn,
      signOut,
      refresh,
    }),
    [
      clientId,
      ready,
      signedIn,
      hasDriveAppDataScope,
      oauthSilentRefreshPending,
      error,
      signInPending,
      signIn,
      signOut,
      refresh,
      oauthEpoch,
    ],
  );

  return (
    <GoogleSessionContext.Provider value={value}>
      {children}
    </GoogleSessionContext.Provider>
  );
}

/** Consumer hook — must live next to {@link GoogleSessionProvider} for one coherent module. */
// eslint-disable-next-line react-refresh/only-export-components -- intentional paired Provider + hook
export function useGoogleSession(): GoogleSessionContextValue {
  const ctx = useContext(GoogleSessionContext);
  if (!ctx) {
    throw new Error(
      "useGoogleSession must be used within GoogleSessionProvider",
    );
  }
  return ctx;
}
