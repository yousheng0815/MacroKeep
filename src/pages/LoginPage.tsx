import {
  ButtonPendingContents,
  ButtonSpinner,
} from "@/components/ButtonSpinner";
import { Logo } from "@/components/Logo";
import { useGoogleSession } from "@/contexts/google-session";
import { DRIVE_APPDATA_SCOPE, startGoogleOAuthRedirect } from "@/lib/gapi";
import { CORE_DRIVE_FILE } from "@/lib/google-drive";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import {
  Navigate,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
export function LoginPage() {
  const {
    ready,
    sessionReady,
    signedIn,
    hasDriveAppDataScope,
    error,
    signIn,
  } = useGoogleSession();

  const navigate = useNavigate();

  const oauthError = useRouterState({
    select: (s) =>
      new URLSearchParams(s.location.search).get("oauth_error"),
  });

  /** Callback asked us to re-run OAuth with prompt=consent (refresh token retry). */
  const oauthRetrySearch = useRouterState({
    select: (s) => s.location.search,
  });

  useEffect(() => {
    const params = new URLSearchParams(oauthRetrySearch);
    if (params.get("oauth_retry") !== "1") return;
    const dedupeKey = `om_oauth_retry:${oauthRetrySearch}`;
    try {
      if (sessionStorage.getItem(dedupeKey) === "1") return;
      sessionStorage.setItem(dedupeKey, "1");
    } catch {
      /* ignore */
    }

    const promptConsent = params.get("prompt_consent") === "1";
    let nextPath = "/";
    const n = params.get("next");
    if (n) {
      try {
        const decoded = decodeURIComponent(n);
        if (decoded.startsWith("/") && !decoded.startsWith("//")) nextPath = decoded;
      } catch {
        /* ignore */
      }
    }

    void navigate({ to: "/login", replace: true });
    void startGoogleOAuthRedirect({ promptConsent, nextPath });
  }, [oauthRetrySearch, navigate]);

  const needsConsent = ready && signedIn && !hasDriveAppDataScope;

  if (ready && sessionReady) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-om-bg px-6 py-12 text-zinc-100">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="scale-125" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome to OpenMacro
          </h1>
          <p className="text-sm leading-relaxed text-om-muted">
            Sign in with Google so your diary, profile, and optional Gemini key live in
            your Drive{" "}
            <strong className="font-medium text-zinc-300">App Data</strong> folder (
            <span className="font-mono text-sm text-zinc-400">
              {CORE_DRIVE_FILE}
            </span>
            ). A secure session cookie and encrypted refresh tokens on the server keep
            you signed in without repeated prompts.
          </p>
        </div>

        {oauthError ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-center text-sm text-red-200">
            {oauthError}
          </div>
        ) : null}

        {error ? (
          <p className="text-center text-sm text-red-400">{error}</p>
        ) : null}

        {!ready ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-10 animate-spin text-emerald-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {needsConsent ? (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
                <p className="font-medium text-amber-50">Drive permission needed</p>
                <p className="mt-2 text-sm leading-relaxed text-amber-200/90">
                  OpenMacro needs{" "}
                  <span className="break-all font-mono text-sm text-amber-100/90">
                    {DRIVE_APPDATA_SCOPE}
                  </span>{" "}
                  to save your data in the hidden app folder. Tap below to grant
                  access.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              disabled={!ready}
              onClick={() =>
                signIn(needsConsent ? { promptConsent: true } : undefined)
              }
              className="relative flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ButtonPendingContents pending={false} spinner={<ButtonSpinner />}>
                {needsConsent ? "Grant Drive app data access" : "Continue with Google"}
              </ButtonPendingContents>
            </button>

            <p className="text-center text-sm leading-relaxed text-zinc-500">
              By continuing, you agree to connect Google Drive App Data for sync.
              OpenMacro stores an encrypted OAuth refresh token for your account on the
              deployment backend (configure server env vars).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
