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
  /** Silent broker refresh in progress for a remembered Google account. */
  reconnecting: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [oauthEpoch, setOauthEpoch] = useState(0);
  const [sessionReconnectFailed, setSessionReconnectFailed] = useState(false);

  const refresh = useCallback(() => {
    setOauthEpoch((n) => n + 1);
  }, []);

  const signedIn = ready && hasGoogleSession();
  const hasDriveAppDataScope = ready && readHasDriveAppDataScope();
  const sessionReady =
    ready &&
    hasGoogleSession() &&
    hasValidGoogleAccessToken() &&
    readHasDriveAppDataScope();
  const reconnecting =
    ready &&
    signedIn &&
    !sessionReady &&
    hasDriveAppDataScope &&
    !sessionReconnectFailed;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        purgeLegacyOpenMacroStorage();
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
    if (!ready || !hasGoogleSession()) return;
    if (hasValidGoogleAccessToken() && readHasDriveAppDataScope()) {
      setSessionReconnectFailed(false);
      return;
    }

    let cancelled = false;
    setSessionReconnectFailed(false);
    const bump = () => {
      void ensureGoogleAccessToken().then((t) => {
        if (cancelled) return;
        if (!t) {
          setSessionReconnectFailed(true);
          return;
        }
        const nowReady =
          hasValidGoogleAccessToken() && readHasDriveAppDataScope();
        /** Avoid `refresh()` when still not ready (e.g. missing Drive scope): it bumps `oauthEpoch` and would retrigger this effect forever. */
        if (nowReady) {
          setSessionReconnectFailed(false);
          refresh();
        } else {
          setSessionReconnectFailed(true);
        }
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
  }, [ready, oauthEpoch, refresh]);

  const signIn = useCallback((opts?: GoogleSignInOptions) => {
    setError(null);
    setSessionReconnectFailed(false);
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
      sessionReady,
      reconnecting,
      error,
      signIn,
      signOut,
      refresh,
    }),
    [
      ready,
      signedIn,
      hasDriveAppDataScope,
      sessionReady,
      reconnecting,
      error,
      signIn,
      signOut,
      refresh,
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
