import {
  ensureGoogleAccessToken,
  getAccessToken,
  hasDriveAppDataScope as readHasDriveAppDataScope,
  hasGoogleSession,
  hasValidGoogleAccessToken,
  restoreOAuthSessionFromStorage,
  signOutGoogle,
  startGoogleOAuthRedirect,
  type GoogleSignInOptions,
} from "@/lib/gapi";
import { SESSION_HANDOFF_QUERY } from "@/lib/oauth-handoff-param";
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

export type GoogleSessionContextValue = {
  ready: boolean;
  signedIn: boolean;
  hasDriveAppDataScope: boolean;
  sessionReady: boolean;
  error: string | null;
  signIn: (opts?: GoogleSignInOptions) => void;
  signOut: () => Promise<void>;
  refresh: () => void;
};

const GoogleSessionContext = createContext<GoogleSessionContextValue | null>(
  null,
);

export function GoogleSessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [hasDriveAppDataScope, setHasDriveAppDataScope] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped when OAuth/token state changes so memoized context reflects module state. */
  const [oauthEpoch, setOauthEpoch] = useState(0);

  const refresh = useCallback(() => {
    setSignedIn(hasGoogleSession());
    setHasDriveAppDataScope(readHasDriveAppDataScope());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        purgeLegacyOpenMacroStorage();

        const params = new URLSearchParams(window.location.search);
        const handoff = params.get(SESSION_HANDOFF_QUERY);
        if (handoff) {
          const res = await fetch("/api/auth/session-handoff", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ nonce: handoff }),
            cache: "no-store",
          });
          const url = new URL(window.location.href);
          url.searchParams.delete(SESSION_HANDOFF_QUERY);
          const clean = `${url.pathname}${url.search}${url.hash}`;
          if (res.ok) {
            window.location.replace(clean);
            return;
          }
          window.history.replaceState({}, "", clean);
          if (!cancelled) {
            setError(
              res.status === 410
                ? "Sign-in link expired. Please try again."
                : "Could not complete sign-in. Please try again.",
            );
          }
        }

        await restoreOAuthSessionFromStorage();
        if (!cancelled) {
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
  }, [refresh]);

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
    if (!ready) return;
    const id = window.setInterval(() => {
      getAccessToken();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [ready]);

  useEffect(() => {
    if (!ready || !signedIn) return;
    if (hasValidGoogleAccessToken() && readHasDriveAppDataScope()) return;

    let cancelled = false;
    const bump = () => {
      void ensureGoogleAccessToken().then((t) => {
        if (cancelled || !t) return;
        refresh();
        setOauthEpoch((n) => n + 1);
      });
    };
    bump();
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ready, signedIn, refresh, oauthEpoch]);

  const signIn = useCallback((opts?: GoogleSignInOptions) => {
    setError(null);
    void startGoogleOAuthRedirect(opts);
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await signOutGoogle();
    refresh();
    navigate({ to: "/login", replace: true });
  }, [refresh, navigate]);

  const value = useMemo(
    (): GoogleSessionContextValue => ({
      ready,
      signedIn,
      hasDriveAppDataScope,
      sessionReady:
        ready &&
        hasGoogleSession() &&
        hasValidGoogleAccessToken() &&
        readHasDriveAppDataScope(),
      error,
      signIn,
      signOut,
      refresh,
    }),
    [
      ready,
      signedIn,
      hasDriveAppDataScope,
      error,
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
